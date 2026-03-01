from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from utils.database import DatabaseManager

class NotificationSummaryView(APIView):
    """
    Get notification summary grouped by type.
    
    API Endpoint: GET /api/notifications/summary/
    Authentication: Required (JWT)
    
    Returns:
        Summary of notifications by type:
        [
            {
                "notification_type": "like",
                "total_count": 45,
                "unread_count": 12,
                "latest_notification_time": "2025-12-29T10:30:00"
            },
            {
                "notification_type": "comment",
                "total_count": 30,
                "unread_count": 8,
                "latest_notification_time": "2025-12-29T09:15:00"
            },
            ...
        ]
    
    Database:
        Function: get_notification_summary(user_id)
    """
    def get(self, request):
        result = DatabaseManager.execute_function(
            'get_notification_summary',
            (request.user.id,)
        )
        return Response(result or [])


class MarkNotificationsByTypeView(APIView):
    """
    Mark all notifications of a specific type as read.
    
    API Endpoint: POST /api/notifications/mark-read/<notification_type>/
    Authentication: Required (JWT)
    
    URL Parameters:
        notification_type (str): Type of notifications to mark as read
    
    Returns:
        200 OK:
            {
                "message": "12 notifications marked as read"
            }
    
    Database:
        Function: mark_notifications_read_by_type(user_id, type)
    """
    def post(self, request, notification_type):
        result = DatabaseManager.execute_function(
            'mark_notifications_read_by_type',
            (request.user.id, notification_type)
        )
        
        count = result[0]['mark_notifications_read_by_type'] if result else 0
        return Response({'message': f'{count} notifications marked as read'})


class ActivityNotificationsView(APIView):
    """
    Get activity-based notifications (likes, comments, follows, etc.).
    
    API Endpoint: GET /api/notifications/activity/
    Authentication: Required (JWT)
    
    Query Parameters:
        limit (int): Number of notifications (default: 20)
    
    Returns:
        List of activity notifications:
        [
            {
                "notification_id": 100,
                "actor_name": "John Doe",
                "actor_picture": "media/profile_pictures/john.jpg",
                "notification_type": "like",
                "content": "liked your post",
                "reference_id": 123,
                "is_read": false,
                "created_at": "2025-12-29T10:30:00"
            },
            ...
        ]
    
    Database:
        Function: get_activity_notifications(user_id, limit)
    """
    def get(self, request):
        limit = int(request.query_params.get('limit', 20))
        
        result = DatabaseManager.execute_function(
            'get_activity_notifications',
            (request.user.id, limit)
        )
        return Response(result or [])


class DeleteNotificationView(APIView):
    """
    Delete a specific notification.
    
    API Endpoint: DELETE /api/notifications/<notification_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        notification_id (int): ID of the notification to delete
    
    Authorization:
        - Only the notification owner can delete it
    
    Returns:
        200 OK:
            {
                "message": "Notification deleted successfully"
            }
        
        403 Forbidden:
            {
                "error": "Unauthorized"
            }
    
    Database:
        Deletes from notifications table with authorization check
    """
    def delete(self, request, notification_id):
        query = "SELECT user_id FROM notifications WHERE id = %s"
        result = DatabaseManager.execute_query(query, (notification_id,))
        
        if not result:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if result[0]['user_id'] != request.user.id:
            return Response(
                {'error': 'Unauthorized'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        DatabaseManager.execute_update(
            "DELETE FROM notifications WHERE id = %s",
            (notification_id,)
        )
        
        return Response({'message': 'Notification deleted successfully'})


class ClearAllNotificationsView(APIView):
    """
    Delete all read notifications for authenticated user.
    
    API Endpoint: DELETE /api/notifications/clear/
    Authentication: Required (JWT)
    
    Returns:
        200 OK:
            {
                "message": "25 notifications cleared"
            }
    
    Database:
        Deletes all read notifications for user
    """
    def delete(self, request):
        query = "DELETE FROM notifications WHERE user_id = %s AND is_read = TRUE"
        DatabaseManager.execute_update(query, (request.user.id,))
        
        return Response({'message': 'Read notifications cleared'})


class NotificationPreferencesView(APIView):
    """
    Get or update notification preferences.
    
    API Endpoints:
        GET /api/notifications/preferences/ - Get current preferences
        PATCH /api/notifications/preferences/ - Update preferences
    
    Authentication: Required (JWT)
    
    Request Body (PATCH):
        {
            "email_notifications": bool,
            "push_notifications": bool,
            "notification_types": {
                "likes": bool,
                "comments": bool,
                "follows": bool,
                "mentions": bool
            }
        }
    
    Returns:
        Notification preferences object
    
    Note:
        This requires a notification_preferences table in the database
    """
    def get(self, request):
        query = """
        SELECT * FROM notification_preferences
        WHERE user_id = %s
        """
        result = DatabaseManager.execute_query(query, (request.user.id,))
        
        if not result:
            return Response({
                'email_notifications': True,
                'push_notifications': True,
                'notification_types': {
                    'likes': True,
                    'comments': True,
                    'follows': True,
                    'mentions': True
                }
            })
        
        return Response(result[0])
    
    def patch(self, request):
        data = request.data
        
        query = """
        INSERT INTO notification_preferences 
        (user_id, email_notifications, push_notifications)
        VALUES (%s, %s, %s)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            email_notifications = EXCLUDED.email_notifications,
            push_notifications = EXCLUDED.push_notifications,
            updated_at = CURRENT_TIMESTAMP
        """
        
        DatabaseManager.execute_update(
            query,
            (request.user.id, 
             data.get('email_notifications', True),
             data.get('push_notifications', True))
        )
        
        return Response({'message': 'Preferences updated successfully'})
