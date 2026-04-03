from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from utils.database import DatabaseManager
from django.db import ProgrammingError
from rest_framework.permissions import IsAuthenticated

class NotificationSummaryView(APIView):
    permission_classes = [IsAuthenticated]
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
        # Build a stable per-type summary for the frontend filter buttons.
        query = """
        SELECT
            notification_type,
            COUNT(*)::int AS total_count,
            COUNT(*) FILTER (WHERE is_read = FALSE)::int AS unread_count,
            MAX(created_at) AS latest_notification_time
        FROM notifications
        WHERE user_id = %s
        GROUP BY notification_type
        ORDER BY latest_notification_time DESC
        """
        result = DatabaseManager.execute_query(query, (request.user.id,))
        return Response(result or [])


class MarkNotificationsByTypeView(APIView):
    permission_classes = [IsAuthenticated]
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
        if not notification_type or notification_type.startswith('type-'):
            return Response(
                {'error': 'Invalid notification type'},
                status=status.HTTP_400_BAD_REQUEST
            )

        result = DatabaseManager.execute_function(
            'mark_notifications_read_by_type',
            (request.user.id, notification_type)
        )

        row = result[0] if result else {}
        count = (
            row.get('mark_notifications_read_by_type')
            or row.get('updated_count')
            or row.get('count')
            or 0
        )
        return Response({'message': f'{count} notifications marked as read'})


class ActivityNotificationsView(APIView):
    permission_classes = [IsAuthenticated]
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
    permission_classes = [IsAuthenticated]
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
    permission_classes = [IsAuthenticated]
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
    permission_classes = [IsAuthenticated]
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
    def _ensure_preferences_table(self):
        DatabaseManager.execute_update(
            """
            CREATE TABLE IF NOT EXISTS notification_preferences (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                email_notifications BOOLEAN DEFAULT TRUE,
                push_notifications BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

    def get(self, request):
        defaults = {
            'email_notifications': True,
            'push_notifications': True,
            'notification_types': {
                'likes': True,
                'comments': True,
                'follows': True,
                'mentions': True
            }
        }

        query = """
        SELECT * FROM notification_preferences
        WHERE user_id = %s
        """
        try:
            self._ensure_preferences_table()
            result = DatabaseManager.execute_query(query, (request.user.id,))
        except ProgrammingError:
            return Response(defaults)
        except Exception:
            return Response(defaults)
        
        if not result:
            return Response(defaults)
        
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
        
        try:
            self._ensure_preferences_table()
            DatabaseManager.execute_update(
                query,
                (request.user.id,
                 data.get('email_notifications', True),
                 data.get('push_notifications', True))
            )
        except ProgrammingError:
            return Response({'error': 'Notification preferences setup failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception:
            return Response({'error': 'Failed to update preferences'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response({'message': 'Preferences updated successfully'})
