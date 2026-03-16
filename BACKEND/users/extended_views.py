from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from utils.database import DatabaseManager


def _normalize_media_url(url):
    if not url:
        return url
    if isinstance(url, str) and (url.startswith('http://') or url.startswith('https://') or url.startswith('/')):
        return url
    return f"/{str(url).lstrip('/')}"


def _delete_follow_request_notification(follow_id):
    DatabaseManager.execute_update(
        "DELETE FROM notifications WHERE notification_type = 'follow_request' AND reference_id = %s",
        (follow_id,)
    )


def _viewer_follows_author(viewer_id, author_id):
    if not viewer_id or not author_id:
        return False

    query = """
    SELECT 1
    FROM follows
    WHERE follower_id = %s
      AND following_id = %s
      AND status = 'accepted'
    LIMIT 1
    """
    result = DatabaseManager.execute_query(query, (viewer_id, author_id))
    return bool(result)


def _can_view_post(viewer_id, author_id, visibility):
    if viewer_id == author_id:
        return True

    if visibility == 'public':
        return True

    if visibility == 'followers':
        return _viewer_follows_author(viewer_id, author_id)

    return False

class UserFollowersView(APIView):
    """
    Get list of users following the specified user.
    
    API Endpoint: GET /api/users/<user_id>/followers/
    Authentication: Required (JWT)
    
    URL Parameters:
        user_id (int): ID of the user whose followers to retrieve
    
    Query Parameters:
        limit (int): Number of followers to return (default: 50)
    
    Returns:
        List of follower objects:
        [
            {
                "user_id": 5,
                "name": "John Doe",
                "profile_picture": "media/profile_pictures/john.jpg",
                "department_name": "CSE",
                "batch": 18,
                "followed_at": "2025-12-15T10:30:00"
            },
            ...
        ]
    
    Database:
        Function: get_user_followers(user_id, limit)
    """
    def get(self, request, user_id):
        limit = int(request.query_params.get('limit', 50))
        query = """
        SELECT
            u.id as user_id,
            u.name,
            u.profile_picture,
            u.department_name,
            u.batch,
            f.created_at as followed_at
        FROM follows f
        INNER JOIN users u ON f.follower_id = u.id
        WHERE f.following_id = %s
          AND f.status = 'accepted'
          AND u.is_active = TRUE
        ORDER BY f.created_at DESC
        LIMIT %s
        """
        result = DatabaseManager.execute_query(query, (user_id, limit))
        for row in result:
            row['profile_picture'] = _normalize_media_url(row.get('profile_picture'))
        return Response(result or [])


class UserFollowingView(APIView):
    """
    Get list of users that the specified user is following.
    
    API Endpoint: GET /api/users/<user_id>/following/
    Authentication: Required (JWT)
    
    URL Parameters:
        user_id (int): ID of the user whose following list to retrieve
    
    Query Parameters:
        limit (int): Number of users to return (default: 50)
    
    Returns:
        List of following objects (same structure as followers)
    
    Database:
        Function: get_user_following(user_id, limit)
    """
    def get(self, request, user_id):
        limit = int(request.query_params.get('limit', 50))
        query = """
        SELECT
            u.id as user_id,
            u.name,
            u.profile_picture,
            u.department_name,
            u.batch,
            f.created_at as followed_at
        FROM follows f
        INNER JOIN users u ON f.following_id = u.id
        WHERE f.follower_id = %s
          AND f.status = 'accepted'
          AND u.is_active = TRUE
        ORDER BY f.created_at DESC
        LIMIT %s
        """
        result = DatabaseManager.execute_query(query, (user_id, limit))
        for row in result:
            row['profile_picture'] = _normalize_media_url(row.get('profile_picture'))
        return Response(result or [])


class PendingFollowRequestsView(APIView):
    """
    Get pending follow requests for authenticated user.
    
    API Endpoint: GET /api/users/follow-requests/pending/
    Authentication: Required (JWT)
    
    Returns:
        List of pending follow request objects:
        [
            {
                "follow_id": 10,
                "follower_id": 5,
                "follower_name": "John Doe",
                "follower_picture": "media/profile_pictures/john.jpg",
                "follower_department": "CSE",
                "follower_batch": 18,
                "requested_at": "2025-12-29T10:00:00"
            },
            ...
        ]
    
    Database:
        Function: get_pending_follow_requests(user_id)
    
    Use Case:
        Display list of users waiting for follow approval
    """
    def get(self, request):
        result = DatabaseManager.execute_query(
            """
            SELECT
                f.id AS follow_id,
                u.id AS follower_id,
                u.name AS follower_name,
                u.profile_picture AS follower_picture,
                u.department_name AS follower_department,
                u.batch AS follower_batch,
                f.created_at AS requested_at
            FROM follows f
            INNER JOIN users u ON u.id = f.follower_id
            WHERE f.following_id = %s
              AND f.status = 'pending'
              AND u.is_active = TRUE
            ORDER BY f.created_at DESC
            """,
            (request.user.id,)
        )
        for row in result:
            row['follower_picture'] = _normalize_media_url(row.get('follower_picture'))
        return Response(result or [])


class RejectFollowRequestView(APIView):
    """
    Reject a pending follow request.
    
    API Endpoint: POST /api/users/follow/reject/<follow_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        follow_id (int): ID of the follow request to reject
    
    Authorization:
        - Only the target user (following_id) can reject their follow requests
        - Request must have status='pending'
    
    Returns:
        200 OK:
            {
                "message": "Follow request rejected"
            }
        
        404 Not Found:
            {
                "error": "Follow request not found"
            }
    
    Database:
        Function: reject_follow_request(follow_id, user_id)
        Deletes the follow record instead of updating status
    """
    def post(self, request, follow_id):
        deleted = DatabaseManager.execute_update(
            """
            DELETE FROM follows
            WHERE id = %s
              AND following_id = %s
              AND status = 'pending'
            """,
            (follow_id, request.user.id)
        )

        if deleted:
            _delete_follow_request_notification(follow_id)
            return Response({'message': 'Follow request rejected'})
        
        return Response(
            {'error': 'Follow request not found'},
            status=status.HTTP_404_NOT_FOUND
        )


class UserSearchView(APIView):
    """
    Search for users with advanced filters.
    
    API Endpoint: GET /api/users/search/
    Authentication: Required (JWT)
    
    Query Parameters:
        q (str): Search term (searches name and student_id)
        department (str): Filter by department name
        batch (int): Filter by batch number
        blood_group (str): Filter by blood group
        limit (int): Number of results (default: 20)
    
    Returns:
        List of user objects matching search criteria:
        [
            {
                "id": 5,
                "student_id": 1805001,
                "name": "John Doe",
                "email": "john@example.com",
                "profile_picture": "media/profile_pictures/john.jpg",
                "department_name": "CSE",
                "batch": 18,
                "blood_group": "A+",
                "relevance": 0.95
            },
            ...
        ]
    
    Database:
        Function: search_users_advanced(search_term, department, batch, blood_group, limit)
    """
    def get(self, request):
        search_term = (
            request.query_params.get('q')
            or request.query_params.get('query')
            or request.query_params.get('search')
            or ''
        )
        department = request.query_params.get('department')
        batch = request.query_params.get('batch')
        blood_group = request.query_params.get('blood_group')
        limit = int(request.query_params.get('limit', 20))
        
        if not search_term:
            return Response(
                {'error': 'Search term (q) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        result = DatabaseManager.execute_function(
            'search_users_advanced',
            (search_term, department, batch, blood_group, limit)
        )
        users = result or []
        for user in users:
            user['profile_picture'] = _normalize_media_url(user.get('profile_picture'))
        return Response({'results': users})


class UsersByDepartmentView(APIView):
    """
    Get users by department and optional batch.
    
    API Endpoint: GET /api/users/department/<department_name>/
    Authentication: Required (JWT)
    
    URL Parameters:
        department_name (str): Name of the department
    
    Query Parameters:
        batch (int): Optional batch filter
        limit (int): Number of results (default: 50)
    
    Returns:
        List of users in the specified department
    
    Database:
        Function: get_users_by_department(department, batch, limit)
    """
    def get(self, request, department_name):
        batch = request.query_params.get('batch')
        limit = int(request.query_params.get('limit', 50))
        
        result = DatabaseManager.execute_function(
            'get_users_by_department',
            (department_name, batch, limit)
        )
        return Response(result or [])


class UsersByBloodGroupView(APIView):
    """
    Get users by blood group.
    
    API Endpoint: GET /api/users/blood-group/<blood_group>/
    Authentication: Required (JWT)
    
    URL Parameters:
        blood_group (str): Blood group (A+, B+, O+, AB+, A-, B-, O-, AB-)
    
    Query Parameters:
        limit (int): Number of results (default: 50)
    
    Returns:
        List of users with specified blood group
    
    Database:
        Function: get_users_by_blood_group(blood_group, limit)
    
    Use Case:
        Find potential blood donors in emergency situations
    """
    def get(self, request, blood_group):
        limit = int(request.query_params.get('limit', 50))
        
        result = DatabaseManager.execute_function(
            'get_users_by_blood_group',
            (blood_group, limit)
        )
        return Response(result or [])


class UserEngagementMetricsView(APIView):
    """
    Get detailed engagement metrics for a user.
    
    API Endpoint: GET /api/users/<user_id>/engagement/
    Authentication: Required (JWT)
    
    URL Parameters:
        user_id (int): ID of the user
    
    Returns:
        Comprehensive engagement metrics:
        {
            "total_posts": 45,
            "total_likes_given": 320,
            "total_likes_received": 580,
            "total_comments_given": 150,
            "total_comments_received": 200,
            "followers_count": 120,
            "following_count": 95,
            "posts_per_day": 0.52,
            "avg_likes_per_post": 12.89,
            "engagement_score": 85.5
        }
    
    Database:
        Function: get_user_engagement_metrics(user_id)
    """
    def get(self, request, user_id):
        result = DatabaseManager.execute_function(
            'get_user_engagement_metrics',
            (user_id,)
        )
        return Response(result[0] if result else {})


class UserPostsView(APIView):
    """
    Get posts created by a specific user.
    
    API Endpoint: GET /api/users/<user_id>/posts/
    Authentication: Required (JWT)
    
    URL Parameters:
        user_id (int): ID of the user
    
    Query Parameters:
        limit (int): Number of posts (default: 20)
        offset (int): Pagination offset (default: 0)
    
    Returns:
        List of user's posts with engagement data
    
    Database:
        Function: get_user_posts(user_id, viewer_id, limit, offset)
    """
    def get(self, request, user_id):
        limit = int(request.query_params.get('limit', 20))
        offset = int(request.query_params.get('offset', 0))
        
        result = DatabaseManager.execute_function(
            'get_user_posts',
            (user_id, request.user.id, limit, offset)
        )
        posts = result or []
        filtered_posts = []
        for post in posts:
            post_visibility = post.get('visibility', 'public')
            author_id = post.get('author_id') or post.get('user_id') or user_id

            if not _can_view_post(request.user.id, author_id, post_visibility):
                continue

            post_id_value = post.get('post_id') or post.get('id')
            if post_id_value:
                post['id'] = post_id_value
                post['post_id'] = post_id_value
            filtered_posts.append(post)
        return Response(filtered_posts)
