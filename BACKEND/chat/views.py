from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from utils.database import DatabaseManager
from utils.file_upload import FileUploadHandler


def _can_message(sender_id, receiver_id):
    result = DatabaseManager.execute_function(
        'can_user_message',
        (sender_id, receiver_id)
    )
    return result[0]['can_user_message'] if result else False

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
            WHERE sender_id = %s OR receiver_id = %s
            ORDER BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC
        )
        SELECT 
            lm.*,
            u.name as other_user_name,
            u.profile_picture as other_user_picture,
            (SELECT COUNT(*) FROM messages 
             WHERE sender_id = lm.other_user_id 
             AND receiver_id = %s 
             AND is_read = FALSE) as unread_count
        FROM latest_messages lm
        JOIN users u ON u.id = lm.other_user_id
        ORDER BY lm.created_at DESC
        """
        
        result = DatabaseManager.execute_query(query, (user_id, user_id, user_id, user_id))
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
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))

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
        WHERE (m.sender_id = %s AND m.receiver_id = %s)
           OR (m.sender_id = %s AND m.receiver_id = %s)
        ORDER BY m.created_at DESC
        LIMIT %s OFFSET %s
        """
        
        result = DatabaseManager.execute_query(
            query,
            (user_id, other_user_id, other_user_id, user_id, limit, offset)
        )
        
        DatabaseManager.execute_update(
            "UPDATE messages SET is_read = TRUE WHERE sender_id = %s AND receiver_id = %s AND is_read = FALSE",
            (other_user_id, user_id)
        )
        
        return Response(result or [])


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
        receiver_id = data.get('receiver_id')
        content = (data.get('content') or '').strip()
        media_url = data.get('media_url')
        
        if not receiver_id:
            return Response(
                {'error': 'receiver_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not content and not media_url:
            return Response(
                {'error': 'Message cannot be empty'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not _can_message(sender_id, receiver_id):
            return Response({'error': 'Messaging not allowed'}, status=status.HTTP_403_FORBIDDEN)
        
        query = """
        INSERT INTO messages (sender_id, receiver_id, content, media_url)
        VALUES (%s, %s, %s, %s)
        RETURNING id, sender_id, receiver_id, content, media_url, is_read, created_at
        """
        
        result = DatabaseManager.execute_query(
            query,
            (sender_id, receiver_id, content, media_url)
        )
        
        return Response(
            {'message': 'Message sent', 'data': result[0] if result else None},
            status=status.HTTP_201_CREATED
        )


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
                {'error': f'Failed to upload image: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


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
                {'error': f'Failed to upload video: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


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
        receiver_id = data.get('receiver_id')
        content = (data.get('content') or '').strip()
        media_url = data.get('media_url')
        
        if not receiver_id:
            return Response(
                {'error': 'receiver_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not content and not media_url:
            return Response(
                {'error': 'Message cannot be empty'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not _can_message(sender_id, receiver_id):
            return Response({'error': 'Messaging not allowed'}, status=status.HTTP_403_FORBIDDEN)
        
        query = """
        INSERT INTO messages (sender_id, receiver_id, content, media_url)
        VALUES (%s, %s, %s, %s)
        RETURNING id, sender_id, receiver_id, content, media_url, is_read, created_at
        """
        
        result = DatabaseManager.execute_query(
            query,
            (sender_id, receiver_id, content, media_url)
        )
        
        return Response(
            {'message': 'Message sent with image', 'data': result[0] if result else None},
            status=status.HTTP_201_CREATED
        )