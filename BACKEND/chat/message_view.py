from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from utils.database import DatabaseManager

class SendMessageView(APIView):
    """
    Send a message to another user with chat permission validation.
    
    API Endpoint: POST /api/chat/messages/send/
    Authentication: Required (JWT)
    
    Request Body:
        {
            "receiver_id": int (required) - ID of message recipient,
            "content": str (required) - Message text content,
            "media_url": str (optional) - URL of attached media file
        }
    
    Functionality:
        - Validates that users can chat (mutual follow or previous conversation)
        - Creates message in database if permission granted
        - Returns message_id for reference
    
    Returns:
        201 Created:
            {
                "message": "Message sent successfully",
                "message_id": 123
            }
        
        403 Forbidden:
            {
                "error": "Cannot send message to this user"
            }
    
    Database:
        Function: can_users_chat(sender_id, receiver_id)
        Table: messages (sender_id, receiver_id, content, media_url)
    
    Note:
        Users can chat if:
        - They follow each other
        - OR they have previous message history
    """
    def post(self, request):
        data = request.data
        receiver_id = data['receiver_id']
        content = (data.get('content') or '').strip()
        media_url = data.get('media_url')

        if not content and not media_url:
            return Response({'error': 'Message cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)
        
        result = DatabaseManager.execute_function(
            'can_users_chat',
            (request.user.id, receiver_id)
        )
        
        if not result[0]['can_users_chat']:
            return Response({'error': 'Cannot send message to this user'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        message_id = DatabaseManager.execute_insert(
            "INSERT INTO messages (sender_id, receiver_id, content, media_url) VALUES (%s, %s, %s, %s) RETURNING id",
            (request.user.id, receiver_id, content, media_url)
        )
        
        return Response({
            'message': 'Message sent successfully',
            'message_id': message_id
        }, status=status.HTTP_201_CREATED)


class ConversationView(APIView):
    """
    Retrieve full message history with another user.
    
    API Endpoint: GET /api/chat/messages/conversation/<user_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        user_id (int): ID of the other user in the conversation
    
    Functionality:
        - Fetches all messages between authenticated user and specified user
        - Orders messages chronologically (ASC) for conversation flow
        - Includes sender and receiver details for each message
        - Automatically marks unread messages as read
    
    Returns:
        List of message objects with:
        - id, content, media_url, is_read, created_at
        - sender_id, sender_name, sender_picture
        - receiver_id, receiver_name, receiver_picture
    
    Example Response:
        [
            {
                "id": 10,
                "sender_id": 2,
                "receiver_id": 1,
                "content": "Hello!",
                "media_url": null,
                "is_read": true,
                "created_at": "2025-12-29T09:00:00",
                "sender_name": "John",
                "sender_picture": "media/profiles/john.jpg",
                "receiver_name": "Jane",
                "receiver_picture": "media/profiles/jane.jpg"
            }
        ]
    
    Side Effects:
        Marks all messages from other user to current user as read
    """
    def get(self, request, user_id):
        query = """
        SELECT m.*, 
               s.name as sender_name, s.profile_picture as sender_picture,
               r.name as receiver_name, r.profile_picture as receiver_picture
        FROM messages m
        INNER JOIN users s ON m.sender_id = s.id
        INNER JOIN users r ON m.receiver_id = r.id
        WHERE (m.sender_id = %s AND m.receiver_id = %s)
           OR (m.sender_id = %s AND m.receiver_id = %s)
        ORDER BY m.created_at ASC
        """
        result = DatabaseManager.execute_query(
            query,
            (request.user.id, user_id, user_id, request.user.id)
        )
        
        DatabaseManager.execute_update(
            "UPDATE messages SET is_read = TRUE WHERE sender_id = %s AND receiver_id = %s AND is_read = FALSE",
            (user_id, request.user.id)
        )
        
        return Response(result)


class RecentConversationsView(APIView):
    """
    Get list of recent conversations for authenticated user.
    
    API Endpoint: GET /api/chat/messages/conversations/
    Authentication: Required (JWT)
    
    Functionality:
        - Lists all conversations with their most recent message
        - Shows unread message count per conversation
        - Includes other user details (name, profile picture)
        - Orders by most recent message first
    
    Returns:
        List of conversation objects:
        [
            {
                "other_user_id": 2,
                "other_user_name": "John Doe",
                "other_user_picture": "media/profile_pictures/john.jpg",
                "last_message": "Hey, how are you?",
                "last_message_time": "2025-12-29T10:30:00",
                "unread_count": 3
            }
        ]
    
    Database:
        Function: get_recent_conversations(user_id)
    """
    def get(self, request):
        result = DatabaseManager.execute_function('get_recent_conversations', (request.user.id,))
        return Response(result)


class MarkAsReadView(APIView):
    """
    Mark a specific message as read.
    
    API Endpoint: POST /api/chat/messages/<message_id>/read/
    Authentication: Required (JWT)
    
    URL Parameters:
        message_id (int): ID of the message to mark as read
    
    Authorization:
        - Only the message receiver can mark their received messages as read
        - Prevents users from marking other people's messages as read
    
    Returns:
        200 OK:
            {
                "message": "Marked as read"
            }
    
    Database:
        Updates messages.is_read to TRUE
        Conditions: id = message_id AND receiver_id = current_user_id
    
    Use Case:
        - Mark individual message as read when user views it
        - Update read status for real-time read receipts
    """
    def post(self, request, message_id):
        DatabaseManager.execute_update(
            "UPDATE messages SET is_read = TRUE WHERE id = %s AND receiver_id = %s",
            (message_id, request.user.id)
        )
        return Response({'message': 'Marked as read'})