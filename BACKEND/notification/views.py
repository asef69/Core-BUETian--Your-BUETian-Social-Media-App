from rest_framework.views import APIView
from rest_framework.response import Response
from utils.database import DatabaseManager

class NotificationsListView(APIView):
    """
    Get list of all notifications for authenticated user.
    
    API Endpoint: GET /api/notifications/
    Authentication: Required (JWT)
    
    Functionality:
        - Fetches all notifications (read and unread) for current user
        - Includes actor information (user who triggered the notification)
        - Orders by most recent first
        - Limits to last 50 notifications
    
    Returns:
        List of notification objects:
        [
            {
                "id": 100,
                "user_id": 1,
                "actor_id": 5,
                "actor_name": "John Doe",
                "actor_picture": "media/profile_pictures/john.jpg",
                "type": "like",
                "target_type": "post",
                "target_id": 123,
                "content": "liked your post",
                "is_read": false,
                "created_at": "2025-12-29T10:30:00"
            },
            ...
        ]
    
    Database:
        Tables: notifications, users
        LEFT JOIN on actor_id to get actor details
    
    Use Case:
        Display full notification history in notifications page
    """
    def get(self, request):
        query = """
        SELECT n.*, u.name as actor_name, u.profile_picture as actor_picture
        FROM notifications n
        LEFT JOIN users u ON n.actor_id = u.id
        WHERE n.user_id = %s
        ORDER BY n.created_at DESC
        LIMIT 50
        """
        result = DatabaseManager.execute_query(query, (request.user.id,))
        for notification in result:
            if 'actor_profile_picture' not in notification and 'actor_picture' in notification:
                notification['actor_profile_picture'] = notification['actor_picture']
        return Response(result)

class UnreadNotificationsView(APIView):
    """
    Get only unread notifications for authenticated user.
    
    API Endpoint: GET /api/notifications/unread/
    Authentication: Required (JWT)
    
    Functionality:
        - Fetches only notifications with is_read=FALSE
        - Orders by most recent first
        - Limits to last 50 unread notifications
    
    Returns:
        List of unread notification objects (same structure as NotificationsListView)
    
    Database:
        View/Query: unread_notifications WHERE user_id = ? AND is_read = FALSE
    
    Use Case:
        - Display notification badge count
        - Show unread notifications dropdown
        - Real-time notification updates
    """
    def get(self, request):
        query = "SELECT * FROM unread_notifications WHERE user_id = %s LIMIT 50"
        result = DatabaseManager.execute_query(query, (request.user.id,))
        return Response(result)

class NotificationCountView(APIView):
    """
    Get count of unread notifications for authenticated user.
    
    API Endpoint: GET /api/notifications/count/
    Authentication: Required (JWT)
    
    Returns:
        200 OK:
            {
                "count": 5
            }
    
    Database:
        Function: get_unread_notification_count(user_id)
        Returns: INTEGER count of unread notifications
    
    Use Case:
        - Display notification badge with count
        - Check for new notifications periodically
        - Update UI without fetching full notification list
    """
    def get(self, request):
        result = DatabaseManager.execute_function(
            'get_unread_notification_count',
            (request.user.id,)
        )
        return Response({'count': result[0]['get_unread_notification_count']})

class MarkNotificationReadView(APIView):
    """
    Mark a specific notification as read.
    
    API Endpoint: POST /api/notifications/<notification_id>/read/
    Authentication: Required (JWT)
    
    URL Parameters:
        notification_id (int): ID of the notification to mark as read
    
    Authorization:
        - Only marks notifications belonging to authenticated user
        - Prevents marking other users' notifications
    
    Returns:
        200 OK:
            {
                "message": "Marked as read"
            }
    
    Database:
        Updates notifications.is_read to TRUE
        WHERE id = notification_id AND user_id = current_user_id
    
    Use Case:
        Mark notification as read when user clicks/views it
    """
    def post(self, request, notification_id):
        DatabaseManager.execute_update(
            "UPDATE notifications SET is_read = TRUE WHERE id = %s AND user_id = %s",
            (notification_id, request.user.id)
        )
        return Response({'message': 'Marked as read'})

class MarkAllReadView(APIView):
    """
    Mark all notifications as read for authenticated user.
    
    API Endpoint: POST /api/notifications/read-all/
    Authentication: Required (JWT)
    
    Functionality:
        - Marks all unread notifications as read for current user
        - Returns count of notifications marked
    
    Returns:
        200 OK:
            {
                "message": "5 notifications marked as read"
            }
    
    Database:
        Function: mark_all_notifications_read(user_id)
        Returns: INTEGER count of updated rows
    
    Use Case:
        - "Mark all as read" button in notifications panel
        - Clear notification badge
        - Bulk operation for better UX
    """
    def post(self, request):
        count = DatabaseManager.execute_function(
            'mark_all_notifications_read',
            (request.user.id,)
        )
        return Response({'message': f'{count[0]["mark_all_notifications_read"]} notifications marked as read'})
