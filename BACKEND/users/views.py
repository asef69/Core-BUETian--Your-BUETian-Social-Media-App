from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from django.db.utils import ProgrammingError
from utils.database import DatabaseManager
from utils.file_upload import FileUploadHandler


def _normalize_media_url(url):
    if not url:
        return url
    if isinstance(url, str) and (url.startswith('http://') or url.startswith('https://') or url.startswith('/')):
        return url
    return f"/{str(url).lstrip('/')}"


def _get_follow_counts(user_id):
    counts = DatabaseManager.execute_query(
        """
        SELECT
            (SELECT COUNT(*)::int FROM follows WHERE following_id = %s AND status = 'accepted') AS followers_count,
            (SELECT COUNT(*)::int FROM follows WHERE follower_id = %s AND status = 'accepted') AS following_count
        """,
        (user_id, user_id)
    )
    return counts[0] if counts else {'followers_count': 0, 'following_count': 0}


def _delete_follow_request_notification(follow_id):
    DatabaseManager.execute_update(
        "DELETE FROM notifications WHERE notification_type = 'follow_request' AND reference_id = %s",
        (follow_id,)
    )


def _mark_follow_request_notification_read(user_id, follow_id):
    DatabaseManager.execute_update(
        """
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = %s
          AND notification_type = 'follow_request'
          AND reference_id = %s
        """,
        (user_id, follow_id)
    )

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Retrieve user profile information.
    
    API Endpoint: GET /api/users/profile/<user_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        user_id (int): ID of the user whose profile to retrieve
    
    Returns:
        200 OK:
            {
                "id": 1,
                "student_id": 1805001,
                "name": "John Doe",
                "email": "john@example.com",
                "profile_picture": "media/profile_pictures/abc.jpg",
                "bio": "Software Engineer",
                "blood_group": "A+",
                "batch": 18,
                "hall_name": "Sher-e-Bangla Hall",
                "hall_attachement": "Resident",
                "department_name": "CSE",
                "followers_count": 150,
                "following_count": 200,
                "posts_count": 45,
                "created_at": "..."
            }
        
        404 Not Found:
            {
                "error": "User not found"
            }
    
    Database:
        Function: get_user_profile(user_id)
    """
    def get(self,request,user_id):
        viewer_id = request.user.id if hasattr(request.user, 'id') else None

        result = DatabaseManager.execute_function(
            'get_user_profile',
            (user_id, viewer_id)
        )

        if result and result[0].get('profile_picture'):
            result[0]['profile_picture'] = _normalize_media_url(result[0]['profile_picture'])

        if not result:
            return Response({
                'error':'User not found'
            },status=status.HTTP_404_NOT_FOUND)
        return Response(result[0])
    
class UpdateProfileView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Update authenticated user's profile information.
    
    API Endpoint: PATCH /api/users/profile/update/
    Authentication: Required (JWT)
    
    Request Body (all fields optional):
        {
            "name": str - User's full name,
            "bio": str - User biography,
            "profile_picture": str - Profile picture URL,
            "blood_group": str - Blood group (A+, B+, etc.),
            "hall_name": str - Hall name,
            "hall_attachement": str - "Resident" or "Attached",
            "department_name": str - Department name
        }
    
    Returns:
        200 OK:
            {
                "message": "Profile updated successfully"
            }
        
        400 Bad Request:
            {
                "error": "No fields to update"
            }
    
    Database:
        Updates users table, sets updated_at to current timestamp
    
    Note:
        - Only updates fields that are present in request
        - Automatically updates authenticated user (from JWT token)
        - For profile picture upload, use POST /api/users/profile/upload-picture/
    """
    def _update_profile(self, request):
        user_id=request.user.id
        data=request.data

        update_fields=[]
        params=[]

        allowed_fields=  ['name', 'bio', 'profile_picture', 'blood_group', 
                         'hall_name', 'hall_attachement', 'department_name']

        for field in allowed_fields:
            if field in data:
                update_fields.append(f"{field} = %s")
                params.append(data[field])

        if not update_fields:
            return Response(
                {
                    'error':'No fields to update'
                },status=status.HTTP_400_BAD_REQUEST
            )
        params.append(user_id)
        query=f"""
        UPDATE users SET {', '.join(update_fields)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        """

        DatabaseManager.execute_update(query,tuple(params))
        return Response({'message': 'Profile updated successfully'})

    def patch(self,request):
        return self._update_profile(request)

    def put(self, request):
        return self._update_profile(request)
    
class FollowUserView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Follow or unfollow a user (toggle functionality).
    
    API Endpoint: POST /api/users/follow/<user_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        user_id (int): ID of the user to follow/unfollow
    
    Functionality:
        - If already following: Removes follow (unfollow/cancel request)
        - If not following: Creates a pending follow request
    
    Returns:
        200 OK (unfollow/cancel):
            {
                "message": "Unfollowed Successful"
            }
        
        200 OK (follow):
            {
                "message": "Follow request sent"
            }
    
    Database:
        Table: follows
        Columns: follower_id, following_id, status
        Status: 'pending'

    Note:
        - Creates pending follow requests that need to be accepted
        - Cannot follow yourself (database constraint)
        - The target user must accept via AcceptFollowView
    """
    def post(self,request,user_id):
        follower_id = request.user.id

        if follower_id == user_id:
            return Response({'error': 'You cannot follow yourself'}, status=status.HTTP_400_BAD_REQUEST)

        user_exists = DatabaseManager.execute_query(
            "SELECT 1 FROM users WHERE id = %s AND is_active = TRUE",
            (user_id,)
        )
        if not user_exists:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        result = DatabaseManager.execute_procedure(
            'toggle_follow_request_with_cleanup',
            (
                follower_id,
                user_id,
                None,
                None,
                None
            )
        )

        proc_row = result[0] if result else {}
        if not proc_row.get('out_success'):
            return Response(
                {'error': proc_row.get('out_message') or 'Follow request action failed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        out_follow = bool(proc_row.get('out_follow'))
        message = proc_row.get('out_message') or 'Follow request action completed'
        follow_status = 'pending' if out_follow else None
        relationship_status = 'pending_sent' if out_follow else 'none'

        target_counts = _get_follow_counts(user_id)

        return Response({
            'message': message,
            'is_following': follow_status == 'accepted',
            'follow_status': follow_status,
            'relationship_status': relationship_status,
            'followers_count': target_counts['followers_count'],
            'following_count': target_counts['following_count'],
        })
        
class AcceptFollowView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Accept a pending follow request.
    
    API Endpoint: POST /api/users/follow/accept/<follow_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        follow_id (int): ID of the follow request to accept
    
    Authorization:
        - Only the target user (following_id) can accept their follow requests
        - Request must have status='pending'
    
    Returns:
        200 OK:
            {
                "message": "Follow request accepted"
            }
        
        404 Not Found:
            {
                "error": "Follow request can not be found"
            }
    
    Database:
        Updates follows.status from 'pending' to 'accepted'
    
    Flow:
        1. User A sends follow request to User B (status='pending')
        2. User B accepts via this endpoint
        3. Status changes to 'accepted'
        4. User A can now see User B's follower-only posts
    """
    def post(self,request,follow_id):
        follow_request = DatabaseManager.execute_query(
            """
            SELECT id, follower_id, following_id
            FROM follows
            WHERE id = %s AND following_id = %s AND status = 'pending'
            """,
            (follow_id, request.user.id)
        )

        if not follow_request:
            return Response({
                'error':'Follow request can not be found'
            },status=status.HTTP_404_NOT_FOUND)

        DatabaseManager.execute_update(
            "UPDATE follows SET status = 'accepted' WHERE id = %s",
            (follow_id,)
        )
        _mark_follow_request_notification_read(request.user.id, follow_id)

        accepted_follow = follow_request[0]
        follower_counts = _get_follow_counts(accepted_follow['follower_id'])
        following_counts = _get_follow_counts(accepted_follow['following_id'])

        return Response(
            {
                'message':'Follow request accepted',
                'follow_id': follow_id,
                'follower_id': accepted_follow['follower_id'],
                'following_id': accepted_follow['following_id'],
                'follower_profile': {
                    'followers_count': follower_counts['followers_count'],
                    'following_count': follower_counts['following_count'],
                },
                'following_profile': {
                    'followers_count': following_counts['followers_count'],
                    'following_count': following_counts['following_count'],
                }
            }
        )
    
class SuggestedUsersView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Get suggested users to follow.
    
    API Endpoint: GET /api/users/suggestions/
    Authentication: Required (JWT)
    
    Query Parameters:
        limit (int): Number of suggestions to return (default: 10)
    
    Returns:
        List of user objects suggested for following, typically based on:
        - Mutual connections
        - Same department/batch
        - Similar interests
        - Popular users
    
    Database:
        Function: get_suggested_users(user_id, limit)
    
    Note:
        Excludes users already followed or with pending follow requests
    """
    def get(self,request):
        limit = int(request.query_params.get('limit', 10))

        try:
            result = DatabaseManager.execute_function(
                'get_suggested_users',
                (request.user.id, limit)
            )
        except ProgrammingError:
            try:
                result = DatabaseManager.execute_function(
                    'get_suggested_users',
                    (request.user.id,)
                )
            except ProgrammingError:
                fallback_query = """
                SELECT
                    u.id,
                    u.name,
                    u.profile_picture,
                    u.department_name,
                    u.batch,
                    (
                        SELECT COUNT(*)
                        FROM follows f2
                        WHERE f2.following_id = u.id AND f2.status = 'accepted'
                    ) AS followers_count
                FROM users u
                WHERE u.id != %s
                  AND u.is_active = TRUE
                  AND NOT EXISTS (
                      SELECT 1
                      FROM follows f
                      WHERE f.follower_id = %s
                        AND f.following_id = u.id
                  )
                ORDER BY followers_count DESC, u.id DESC
                LIMIT %s
                """
                result = DatabaseManager.execute_query(
                    fallback_query,
                    (request.user.id, request.user.id, limit)
                )
        return Response(result)


class MutualFollowersView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Get mutual followers (users who follow each other).
    
    API Endpoint: GET /api/users/mutual-followers/
    Authentication: Required (JWT)
    
    Returns:
        List of users where:
        - Current user follows them
        - They follow current user
        - Both follows have status='accepted'
    
    Database:
        Function: get_mutual_followers(user_id)
    
    Use Case:
        Finding close connections or friends on the platform
    """
    def get(self,request):
        result = DatabaseManager.execute_function('get_mutual_followers', (request.user.id,))
        return Response(result)
    

class UserActivityView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Get activity summary for authenticated user.
    
    API Endpoint: GET /api/users/activity/
    Authentication: Required (JWT)
    
    Returns:
        Activity summary object with:
        - Total posts count
        - Total likes received
        - Total comments received
        - Recent activity statistics
        - Engagement metrics
    
    Database:
        Function: get_user_activity_summary(user_id)
    
    Example Response:
        {
            "total_posts": 45,
            "total_likes": 320,
            "total_comments": 87,
            "posts_this_week": 5,
            "engagement_rate": 0.85
        }
    """
    def get(self, request):
        result = DatabaseManager.execute_function('get_user_activity_summary', (request.user.id,))
        return Response(result[0] if result else {})


class UploadProfilePictureView(APIView):
    permission_classes = [IsAuthenticated]
    """
    Upload or update user's profile picture.
    
    API Endpoint: POST /api/users/profile/upload-picture/
    Authentication: Required (JWT)
    Content-Type: multipart/form-data
    
    Request Body:
        profile_picture: file (required) - Image file to upload
    
    Validation:
        - File type: jpg, jpeg, png, gif, webp
        - Max size: 5MB
    
    Storage:
        - Folder: media/profile_pictures/
        - Filename: UUID-based (e.g., abc123def456.jpg)
    
    Returns:
        200 OK:
            {
                "message": "Profile picture uploaded successfully",
                "profile_picture_url": "media/profile_pictures/abc123.jpg"
            }
        
        400 Bad Request:
            {
                "error": "No file provided. Please upload a profile picture."
            }
            or
            {
                "error": "Invalid image format. Allowed: jpg, jpeg, png, gif, webp"
            }
            or
            {
                "error": "Image size exceeds 5MB limit"
            }
        
        500 Internal Server Error:
            {
                "error": "Failed to upload profile picture: ..."
            }
    
    Database:
        Updates users.profile_picture with file path
        Sets users.updated_at to current timestamp
    
    Note:
        - Automatically updates authenticated user's profile
        - Old profile picture is not deleted (manual cleanup needed)
        - URL is publicly accessible at http://localhost:8000/<profile_picture_url>
    """
    parser_classes = (MultiPartParser, FormParser)
    
    def post(self, request):
        user_id = request.user.id
        
        if 'profile_picture' not in request.FILES:
            return Response(
                {'error': 'No file provided. Please upload a profile picture.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES['profile_picture']
        
        try:
            FileUploadHandler.validate_file(file, file_type='image')
            
            file_path = FileUploadHandler.upload_file(file, folder='profile_pictures')
            
            query = """
            UPDATE users 
            SET profile_picture = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """
            DatabaseManager.execute_update(query, (file_path, user_id))
            
            return Response({
                'message': 'Profile picture uploaded successfully',
                'profile_picture_url': file_path
            }, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to upload profile picture: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
           