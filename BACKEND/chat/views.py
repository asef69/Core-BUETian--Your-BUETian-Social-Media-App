import logging
from datetime import date, datetime

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser
from utils.database import DatabaseManager
from utils.params import get_limit, get_offset
from utils.validators import clean_int, clean_media_url, clean_str
from utils.file_upload import FileUploadHandler
from utils.throttles import throttled


def _can_message(sender_id, receiver_id):
    result = DatabaseManager.execute_function(
        'can_user_message',
        (sender_id, receiver_id)
    )
    return result[0]['can_message'] if result else False

MAX_MESSAGE_LENGTH = 5000

logger = logging.getLogger(__name__)

MESSAGE_COLUMNS = (
    "id, sender_id, receiver_id, product_id, content, media_url, is_read, created_at, edited_at, is_deleted"
)
DELETED_PLACEHOLDER = 'This message was deleted'


def _jsonable(row):
    return {k: (v.isoformat() if isinstance(v, (date, datetime)) else v) for k, v in row.items()}


def _broadcast_message_event(event_type, message):
    """Tell every open socket of both people (and the sender's other devices) about an edit/delete."""
    layer = get_channel_layer()
    if layer is None:
        return
    payload = {'type': event_type, 'message': _jsonable(message)}
    for user_id in {message['sender_id'], message['receiver_id']}:
        try:
            async_to_sync(layer.group_send)(f'user_{user_id}', payload)
        except Exception:
            logger.warning('Could not broadcast %s to user %s', event_type, user_id, exc_info=True)


def validate_message_payload(data, sender_id):
    """Validate receiver / content / media / product of an outgoing message.

    Returns (receiver_id, content, media_url, product_id) or raises
    ValidationError (-> 400). Also rejects unknown receivers and products so
    the database never sees a broken foreign key.
    """
    receiver_id = clean_int(data.get('receiver_id'), 'receiver_id', required=True, minimum=1)
    content = clean_str(data.get('content'), 'content', MAX_MESSAGE_LENGTH) or ''
    media_url = clean_media_url(data.get('media_url'), 'media_url')
    product_id = clean_int(data.get('product_id'), 'product_id', minimum=1)

    if not content and not media_url:
        raise ValidationError({'error': 'Message cannot be empty'})
    if receiver_id == sender_id:
        raise ValidationError({'receiver_id': 'You cannot message yourself.'})

    receiver = DatabaseManager.execute_query(
        "SELECT 1 FROM users WHERE id = %s AND is_active = TRUE", (receiver_id,)
    )
    if not receiver:
        raise NotFound('Recipient not found')
    if product_id is not None:
        product = DatabaseManager.execute_query(
            "SELECT 1 FROM marketplace_products WHERE id = %s", (product_id,)
        )
        if not product:
            raise NotFound('Product not found')
    return receiver_id, content, media_url, product_id


class ConversationListView(APIView):
    """
    Get list of all conversations for the authenticated user.
    
    API Endpoint: GET /api/chat/conversations/
    Authentication: Required (JWT)
    
    Returns:
        List of conversation objects, each containing:
        - Latest message details (id, content, media_url, created_at)
        - Other user info (name, profile_picture)
        - Unread message count for this conversation
    
    Query:
        Uses CTE to get latest message for each unique conversation pair,
        then joins with users table for other user details and calculates
        unread count.
    
    Example Response:
        [
            {
                "id": 15,
                "content": "Hey there!",
                "media_url": null,
                "created_at": "2025-12-29T10:30:00",
                "other_user_id": 2,
                "other_user_name": "John Doe",
                "other_user_picture": "media/profile_pictures/abc.jpg",
                "unread_count": 3
            },
            ...
        ]
    """
    def get(self, request):
        user_id = request.user.id
        
        query = """
        WITH latest_messages AS (
            SELECT DISTINCT ON (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id))
                *,
                CASE 
                    WHEN sender_id = %s THEN receiver_id 
                    ELSE sender_id 
                END as other_user_id
            FROM messages
            WHERE (sender_id = %s AND NOT deleted_for_sender)
               OR (receiver_id = %s AND NOT deleted_for_receiver)
            ORDER BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC
        )
        SELECT 
            lm.*,
            u.name as other_user_name,
            u.profile_picture as other_user_picture,
            (SELECT COUNT(*) FROM messages 
             WHERE sender_id = lm.other_user_id 
             AND receiver_id = %s 
             AND is_read = FALSE
             AND NOT deleted_for_receiver) as unread_count
        FROM latest_messages lm
        JOIN users u ON u.id = lm.other_user_id
        ORDER BY lm.created_at DESC
        """
        
        result = DatabaseManager.execute_query(query, (user_id, user_id, user_id, user_id))
        for row in result:
            if row.get('is_deleted'):
                row['content'] = DELETED_PLACEHOLDER
        return Response(result or [])


class MessageListView(APIView):
    """
    Retrieve messages between authenticated user and another user.
    
    API Endpoint: GET /api/chat/messages/<other_user_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        other_user_id (int): ID of the other user in conversation
    
    Query Parameters:
        limit (int): Number of messages to return (default: 50)
        offset (int): Pagination offset (default: 0)
    
    Functionality:
        - Fetches messages between two users (bidirectional)
        - Orders by created_at DESC (newest first)
        - Includes sender and receiver details
        - Automatically marks fetched messages as read
    
    Returns:
        List of message objects with:
        - id, content, media_url, is_read, created_at
        - sender_name, sender_picture
        - receiver_name, receiver_picture
    
    Side Effects:
        Marks all messages from other_user to current user as read
    
    Example Response:
        [
            {
                "id": 25,
                "sender_id": 2,
                "receiver_id": 1,
                "content": "Hello!",
                "media_url": "media/chat_images/xyz.jpg",
                "is_read": true,
                "created_at": "2025-12-29T10:30:00",
                "sender_name": "John",
                "sender_picture": "media/profile_pictures/john.jpg",
                "receiver_name": "Jane",
                "receiver_picture": "media/profile_pictures/jane.jpg"
            },
            ...
        ]
    """
    def get(self, request, other_user_id):
        user_id = request.user.id
        limit = get_limit(request.query_params, 50)
        offset = get_offset(request.query_params, 0)

        if not _can_message(user_id, other_user_id):
            return Response({'error': 'Messaging not allowed'}, status=status.HTTP_403_FORBIDDEN)
        
        query = """
        SELECT 
            m.*,
            sender.name as sender_name,
            sender.profile_picture as sender_picture,
            receiver.name as receiver_name,
            receiver.profile_picture as receiver_picture
        FROM messages m
        JOIN users sender ON sender.id = m.sender_id
        JOIN users receiver ON receiver.id = m.receiver_id
        WHERE (
                (m.sender_id = %s AND m.receiver_id = %s)
             OR (m.sender_id = %s AND m.receiver_id = %s)
        )
        AND ((m.sender_id = %s AND NOT m.deleted_for_sender)
             OR (m.receiver_id = %s AND NOT m.deleted_for_receiver))
        ORDER BY m.created_at DESC
        LIMIT %s OFFSET %s
        """

        result = DatabaseManager.execute_query(
            query,
            (user_id, other_user_id, other_user_id, user_id, user_id, user_id, limit, offset)
        )
        
        DatabaseManager.execute_update(
            "UPDATE messages SET is_read = TRUE WHERE sender_id = %s AND receiver_id = %s AND is_read = FALSE",
            (other_user_id, user_id)
        )
        
        return Response(result or [])


@throttled('chat')
class SendMessageView(APIView):
    """
    Send a text message via REST API (fallback if WebSocket unavailable).
    
    API Endpoint: POST /api/chat/send/
    Authentication: Required (JWT)
    
    Request Body:
        {
            "receiver_id": int (required) - ID of message recipient,
            "content": str (optional) - Message text content
        }
    
    Note:
        This is a REST API fallback. For real-time messaging, use WebSocket
        at ws://localhost:8000/ws/chat/?token=<token>
    
    Returns:
        201 Created:
            {
                "message": "Message sent",
                "data": {...message object...}
            }
        
        400 Bad Request:
            {
                "error": "receiver_id is required"
            }
    
    Database:
        Inserts into messages table with sender_id, receiver_id, content
    """
    def post(self, request):
        data = request.data
        sender_id = request.user.id
        receiver_id, content, media_url, product_id = validate_message_payload(data, sender_id)

        if not _can_message(sender_id, receiver_id):
            return Response({'error': 'Messaging not allowed'}, status=status.HTTP_403_FORBIDDEN)
        
        query = """
        INSERT INTO messages (sender_id, receiver_id, content, media_url, product_id)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, sender_id, receiver_id, content, media_url, product_id, is_read, created_at
        """
        
        result = DatabaseManager.execute_query(
            query,
            (sender_id, receiver_id, content, media_url, product_id)
        )
        
        return Response(
            {'message': 'Message sent', 'data': result[0] if result else None},
            status=status.HTTP_201_CREATED
        )


@throttled('uploads')
class UploadChatImageView(APIView):
    """
    Upload an image file for use in chat messages.
    
    API Endpoint: POST /api/chat/upload-image/
    Authentication: Required (JWT)
    Content-Type: multipart/form-data
    
    Request Body:
        image: file (required) - Image file to upload
    
    Validation:
        - File type: jpg, jpeg, png, gif, webp
        - Max size: 5MB
    
    Storage:
        - Folder: media/chat_images/
        - Filename: UUID-based (e.g., abc123def456.jpg)
    
    Returns:
        200 OK:
            {
                "message": "Image uploaded successfully",
                "image_url": "media/chat_images/abc123.jpg"
            }
        
        400 Bad Request:
            {
                "error": "No image file provided" | "Invalid format" | "Size exceeds 5MB"
            }
        
        500 Internal Server Error:
            {
                "error": "Failed to upload image: ..."
            }
    
    Usage Flow:
        1. Upload image using this endpoint
        2. Get image_url from response
        3. Send message with image_url via WebSocket or SendMessageWithImageView
    """
    parser_classes = (MultiPartParser, FormParser)
    
    def post(self, request):
        if 'image' not in request.FILES:
            return Response(
                {'error': 'No image file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES['image']
        
        try:
            FileUploadHandler.validate_file(file, file_type='image')
            file_path = FileUploadHandler.upload_file(file, folder='chat_images')
            
            return Response({
                'message': 'Image uploaded successfully',
                'image_url': file_path
            }, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': 'Failed to upload image'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@throttled('uploads')
class UploadChatVideoView(APIView):
    """
    Upload a video file for use in chat messages.

    API Endpoint: POST /api/chat/upload-video/
    Authentication: Required (JWT)
    Content-Type: multipart/form-data

    Request Body:
        video: file (required) - Video file to upload

    Validation:
        - File type: mp4, avi, mov, wmv
        - Max size: 50MB

    Storage:
        - Folder: media/chat_videos/

    Returns:
        200 OK:
            {
                "message": "Video uploaded successfully",
                "video_url": "media/chat_videos/abc123.mp4"
            }
    """
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        if 'video' not in request.FILES:
            return Response(
                {'error': 'No video file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        file = request.FILES['video']

        try:
            FileUploadHandler.validate_file(file, file_type='video')
            file_path = FileUploadHandler.upload_file(file, folder='chat_videos')

            return Response({
                'message': 'Video uploaded successfully',
                'video_url': file_path
            }, status=status.HTTP_200_OK)

        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': 'Failed to upload video'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@throttled('chat')
class SendMessageWithImageView(APIView):
    """
    Send a message with an attached image.
    
    API Endpoint: POST /api/chat/send-with-image/
    Authentication: Required (JWT)
    
    Request Body:
        {
            "receiver_id": int (required) - ID of message recipient,
            "content": str (optional) - Message text content,
            "media_url": str (optional) - Pre-uploaded image URL from UploadChatImageView
        }
    
    Workflow:
        1. First upload image via POST /api/chat/upload-image/
        2. Use returned image_url in this endpoint
        3. Message is saved with both content and media_url
    
    Returns:
        201 Created:
            {
                "message": "Message sent with image",
                "data": {
                    "id": 25,
                    "sender_id": 1,
                    "receiver_id": 2,
                    "content": "Check this out!",
                    "media_url": "media/chat_images/abc.jpg",
                    "is_read": false,
                    "created_at": "2025-12-29T10:30:00"
                }
            }
        
        400 Bad Request:
            {
                "error": "receiver_id is required"
            }
    
    Note:
        For real-time delivery, prefer using WebSocket with:
        {
            "type": "chat_message",
            "receiver_id": 2,
            "content": "...",
            "media_url": "..."
        }
    """
    def post(self, request):
        data = request.data
        sender_id = request.user.id
        receiver_id, content, media_url, product_id = validate_message_payload(data, sender_id)

        if not _can_message(sender_id, receiver_id):
            return Response({'error': 'Messaging not allowed'}, status=status.HTTP_403_FORBIDDEN)
        
        query = """
        INSERT INTO messages (sender_id, receiver_id, content, media_url, product_id)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, sender_id, receiver_id, content, media_url, product_id, is_read, created_at
        """
        
        result = DatabaseManager.execute_query(
            query,
            (sender_id, receiver_id, content, media_url, product_id)
        )
        
        return Response(
            {'message': 'Message sent with image', 'data': result[0] if result else None},
            status=status.HTTP_201_CREATED
        )


class ProductMessageListView(APIView):
    """
    Get messages between authenticated user and another user for a specific product.
    
    API Endpoint: GET /api/chat/messages/<other_user_id>/product/<product_id>/
    Authentication: Required (JWT)
    
    Returns all messages related to a specific product transaction.
    """
    def get(self, request, other_user_id, product_id):
        user_id = request.user.id
        limit = get_limit(request.query_params, 50)
        offset = get_offset(request.query_params, 0)
        
        query = """
        SELECT 
            m.*,
            sender.name as sender_name,
            sender.profile_picture as sender_picture,
            receiver.name as receiver_name,
            receiver.profile_picture as receiver_picture,
            p.title as product_title,
            p.id as product_id
        FROM messages m
        JOIN users sender ON sender.id = m.sender_id
        JOIN users receiver ON receiver.id = m.receiver_id
        JOIN marketplace_products p ON p.id = m.product_id
        WHERE (
                (m.sender_id = %s AND m.receiver_id = %s)
             OR (m.sender_id = %s AND m.receiver_id = %s)
        )
        AND m.product_id = %s
        AND ((m.sender_id = %s AND NOT m.deleted_for_sender)
             OR (m.receiver_id = %s AND NOT m.deleted_for_receiver))
        ORDER BY m.created_at DESC
        LIMIT %s OFFSET %s
        """
        
        result = DatabaseManager.execute_query(
            query,
            (user_id, other_user_id, other_user_id, user_id, product_id, user_id, user_id, limit, offset)
        )
        
        # Mark messages as read
        DatabaseManager.execute_update(
            "UPDATE messages SET is_read = TRUE WHERE sender_id = %s AND receiver_id = %s AND is_read = FALSE AND product_id = %s",
            (other_user_id, user_id, product_id)
        )
        
        return Response(result or [])


@throttled('contact')
class ContactSellerView(APIView):
    """
    Initiate contact with seller about a specific product.
    
    API Endpoint: POST /api/chat/contact-seller/
    Authentication: Required (JWT)
    
    Request Body:
        {
            "product_id": int (required),
            "message": str (optional) - Initial message to send
        }
    
    Response (201 Created):
        {
            "message": "Message sent to seller",
            "seller_id": 5,
            "seller_name": "John Doe",
            "conversation_started": true
        }
    
    Notes:
        - Creates initial message about the product
        - Returns seller information for UI flow
        - Automatically links message to product_id
    """
    def post(self, request):
        data = request.data
        buyer_id = request.user.id
        product_id = clean_int(data.get('product_id'), 'product_id', required=True, minimum=1)
        message_text = clean_str(data.get('message'), 'message', MAX_MESSAGE_LENGTH) or ''
        
        # Get product and seller info
        product_query = "SELECT seller_id, title FROM marketplace_products WHERE id = %s"
        product_result = DatabaseManager.execute_query(product_query, (product_id,))
        
        if not product_result:
            return Response(
                {'error': 'Product not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        seller_id = product_result[0]['seller_id']
        product_title = product_result[0]['title']
        
        # Prevent buyer from messaging themselves
        if buyer_id == seller_id:
            return Response(
                {'error': 'Cannot message yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user1_id = min(buyer_id, seller_id)
        user2_id = max(buyer_id, seller_id)
        DatabaseManager.execute_update(
            """
            INSERT INTO contextual_chat_permission (user1_id, user2_id, context_type, context_id, is_active)
            VALUES (%s, %s, 'marketplace_product', %s, TRUE)
            ON CONFLICT (user1_id, user2_id, context_type, context_id)
            DO UPDATE SET
                is_active = TRUE,
                expires_at = NULL
            """,
            (user1_id, user2_id, product_id)
        )
        
        # Create contact message
        if not message_text:
            message_text = f"Hi! I'm interested in your product: {product_title}"
        
        query = """
        INSERT INTO messages (sender_id, receiver_id, product_id, content)
        VALUES (%s, %s, %s, %s)
        RETURNING id, sender_id, receiver_id, content, created_at
        """
        
        result = DatabaseManager.execute_query(
            query,
            (buyer_id, seller_id, product_id, message_text)
        )
        
        # Get seller info
        seller_query = "SELECT id, name FROM users WHERE id = %s"
        seller_info = DatabaseManager.execute_query(seller_query, (seller_id,))
        
        return Response({
            'message': 'Message sent to seller',
            'seller_id': seller_id,
            'seller_name': seller_info[0]['name'] if seller_info else 'Unknown',
            'product_id': product_id,
            'conversation_started': True
        }, status=status.HTTP_201_CREATED)


@throttled('chat')
class EditMessageView(APIView):
    """
    Edit the text of one of your own messages.

    API Endpoint: PATCH /api/chat/messages/<message_id>/edit/
    Body: {"content": "new text"}

    - Only the sender can edit; anyone else gets 404 (the message is not revealed).
    - Deleted messages cannot be edited.
    - A photo/video message may only be edited into a caption, never into nothing.
    - Both people's open chats are updated live over the WebSocket.
    """

    def patch(self, request, message_id):
        content = clean_str(request.data.get('content'), 'content', MAX_MESSAGE_LENGTH) or ''

        rows = DatabaseManager.execute_query(
            "SELECT sender_id, content, media_url, is_deleted FROM messages WHERE id = %s", (message_id,)
        )
        if not rows or rows[0]['sender_id'] != request.user.id:
            return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)
        current = rows[0]
        if current['is_deleted']:
            return Response({'error': 'A deleted message cannot be edited'}, status=status.HTTP_400_BAD_REQUEST)
        if not content and not current['media_url']:
            return Response({'error': 'A message cannot be empty. Delete it instead.'}, status=status.HTTP_400_BAD_REQUEST)

        if content == current['content']:
            updated = DatabaseManager.execute_query(
                f"SELECT {MESSAGE_COLUMNS} FROM messages WHERE id = %s", (message_id,)
            )
        else:
            updated = DatabaseManager.execute_query(
                f"UPDATE messages SET content = %s, edited_at = NOW() "
                f"WHERE id = %s AND sender_id = %s AND NOT is_deleted RETURNING {MESSAGE_COLUMNS}",
                (content, message_id, request.user.id)
            )
            if updated:
                _broadcast_message_event('message_edited', updated[0])
        return Response({'message': 'Message updated', 'data': _jsonable(updated[0]) if updated else None})

    def post(self, request, message_id):
        return self.patch(request, message_id)


@throttled('chat')
class DeleteMessageView(APIView):
    """
    Delete one of your own messages for everyone.

    API Endpoint: DELETE /api/chat/messages/<message_id>/delete/

    The text and any photo/video link are wiped; the row stays as a "This message was
    deleted" placeholder so the conversation keeps its shape. Deleting twice is harmless.
    """

    def delete(self, request, message_id):
        rows = DatabaseManager.execute_query(
            "SELECT sender_id, is_deleted FROM messages WHERE id = %s", (message_id,)
        )
        if not rows or rows[0]['sender_id'] != request.user.id:
            return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)

        if rows[0]['is_deleted']:
            done = DatabaseManager.execute_query(f"SELECT {MESSAGE_COLUMNS} FROM messages WHERE id = %s", (message_id,))
        else:
            done = DatabaseManager.execute_query(
                f"UPDATE messages SET is_deleted = TRUE, content = '', media_url = NULL, edited_at = NULL "
                f"WHERE id = %s AND sender_id = %s RETURNING {MESSAGE_COLUMNS}",
                (message_id, request.user.id)
            )
            # The "sent you a message" notification no longer has anything to point at.
            DatabaseManager.execute_update(
                "DELETE FROM notifications WHERE notification_type = 'message' AND reference_id = %s", (message_id,)
            )
            if done:
                _broadcast_message_event('message_deleted', done[0])
        return Response({'message': 'Message deleted', 'data': _jsonable(done[0]) if done else None})
