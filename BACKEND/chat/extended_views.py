from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from utils.database import DatabaseManager

class UnreadMessagesCountView(APIView):
    """
    Get unread messages count per conversation.
    
    API Endpoint: GET /api/chat/unread/count/
    Authentication: Required (JWT)
    
    Returns:
        List of conversations with unread message counts:
        [
            {
                "sender_id": 5,
                "sender_name": "John Doe",
                "sender_picture": "media/profile_pictures/john.jpg",
                "unread_count": 3
            },
            ...
        ]
    
    Database:
        Function: get_unread_messages_count(user_id)
    """
    def get(self, request):
        result = DatabaseManager.execute_function(
            'get_unread_messages_count',
            (request.user.id,)
        )
        return Response(result or [])


class TotalUnreadMessagesView(APIView):
    """
    Get total count of unread messages.
    
    API Endpoint: GET /api/chat/unread/total/
    Authentication: Required (JWT)
    
    Returns:
        200 OK:
            {
                "total_unread": 15
            }
    
    Database:
        Function: get_total_unread_messages(user_id)
    """
    def get(self, request):
        result = DatabaseManager.execute_function(
            'get_total_unread_messages',
            (request.user.id,)
        )
        
        total = result[0]['get_total_unread_messages'] if result else 0
        return Response({'total_unread': total})


class SearchMessagesView(APIView):
    """
    Search messages by content.
    
    API Endpoint: GET /api/chat/search/
    Authentication: Required (JWT)
    
    Query Parameters:
        q (str): Search query
        limit (int): Number of results (default: 50)
    
    Returns:
        List of messages matching search query:
        [
            {
                "message_id": 100,
                "sender_id": 5,
                "receiver_id": 1,
                "content": "Let's meet tomorrow...",
                "sender_name": "John Doe",
                "receiver_name": "Jane Smith",
                "created_at": "2025-12-29T10:00:00"
            },
            ...
        ]
    
    Database:
        Function: search_messages(user_id, search_term, limit)
    """
    def get(self, request):
        search_term = request.query_params.get('q', '')
        limit = int(request.query_params.get('limit', 50))
        
        if not search_term:
            return Response(
                {'error': 'Search query (q) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        result = DatabaseManager.execute_function(
            'search_messages',
            (request.user.id, search_term, limit)
        )
        return Response(result or [])


class DeleteConversationView(APIView):
    """
    Delete entire conversation with another user.
    
    API Endpoint: DELETE /api/chat/conversation/<user_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        user_id (int): ID of the other user in conversation
    
    Returns:
        200 OK:
            {
                "message": "Conversation deleted successfully",
                "deleted_count": 25
            }
    
    Database:
        Function: delete_conversation(user1_id, user2_id)
    """
    def delete(self, request, user_id):
        result = DatabaseManager.execute_function(
            'delete_conversation',
            (request.user.id, user_id)
        )
        
        deleted_count = result[0]['delete_conversation'] if result else 0
        return Response({
            'message': 'Conversation deleted successfully',
            'deleted_count': deleted_count
        })


class MarkConversationReadView(APIView):
    """
    Mark all messages in a conversation as read.
    
    API Endpoint: POST /api/chat/conversation/<user_id>/read/
    Authentication: Required (JWT)
    
    URL Parameters:
        user_id (int): ID of the other user (sender)
    
    Returns:
        200 OK:
            {
                "message": "Conversation marked as read",
                "marked_count": 5
            }
    
    Database:
        Function: mark_conversation_read(receiver_id, sender_id)
    """
    def post(self, request, user_id):
        result = DatabaseManager.execute_function(
            'mark_conversation_read',
            (request.user.id, user_id)
        )
        
        marked_count = result[0]['mark_conversation_read'] if result else 0
        return Response({
            'message': 'Conversation marked as read',
            'marked_count': marked_count
        })


class UserMessageStatsView(APIView):
    """
    Get message statistics for authenticated user.
    
    API Endpoint: GET /api/chat/stats/
    Authentication: Required (JWT)
    
    Returns:
        Message statistics:
        {
            "total_sent": 320,
            "total_received": 285,
            "unread_count": 12,
            "active_conversations": 15,
            "messages_today": 25
        }
    
    Database:
        Function: get_user_message_stats(user_id)
    """
    def get(self, request):
        result = DatabaseManager.execute_function(
            'get_user_message_stats',
            (request.user.id,)
        )
        return Response(result[0] if result else {})


class ConversationParticipantsView(APIView):
    """
    Get participant details for a conversation.
    
    API Endpoint: GET /api/chat/conversation/<user_id>/participants/
    Authentication: Required (JWT)
    
    URL Parameters:
        user_id (int): ID of the other user
    
    Returns:
        List of participants:
        [
            {
                "user_id": 1,
                "name": "Jane Smith",
                "profile_picture": "media/profile_pictures/jane.jpg",
                "is_active": true
            },
            {
                "user_id": 5,
                "name": "John Doe",
                "profile_picture": "media/profile_pictures/john.jpg",
                "is_active": true
            }
        ]
    
    Database:
        Function: get_conversation_participants(user_id, other_user_id)
    """
    def get(self, request, user_id):
        result = DatabaseManager.execute_function(
            'get_conversation_participants',
            (request.user.id, user_id)
        )
        return Response(result or [])


class CanSendMessageView(APIView):
    """
    Check if current user can send message to another user.
    
    API Endpoint: GET /api/chat/can-message/<user_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        user_id (int): ID of the potential recipient
    
    Returns:
        200 OK:
            {
                "can_message": true
            }
        or
            {
                "can_message": false
            }
    
    Database:
        Function: can_user_message(sender_id, receiver_id)
    """
    def get(self, request, user_id):
        result = DatabaseManager.execute_function(
            'can_user_message',
            (request.user.id, user_id)
        )
        
        can_message = result[0]['can_user_message'] if result else False
        return Response({'can_message': can_message})
