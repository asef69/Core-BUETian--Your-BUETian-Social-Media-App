import re

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from utils.database import DatabaseManager
from utils.params import get_limit
from utils.validators import clean_str, escape_like
from utils.throttles import throttled


def _normalize_media_url(url):
    if not url:
        return url
    if isinstance(url, str) and (url.startswith('http://') or url.startswith('https://') or url.startswith('/')):
        return url
    return f"/{str(url).lstrip('/')}"

class PostsByHashtagView(APIView):
    """
    Get posts containing a specific hashtag.
    
    API Endpoint: GET /api/posts/hashtag/<hashtag>/
    Authentication: Required (JWT)
    
    Query Parameters:
        hashtag (str): Hashtag to search (without # symbol)
    
    Query Parameters:
        limit (int): Number of posts (default: 20)
    
    Returns:
        List of posts containing the hashtag:
        [
            {
                "post_id": 123,
                "content": "Great day! #sunny #happy",
                "author_name": "John Doe",
                "author_picture": "media/profile_pictures/john.jpg",
                "likes_count": 15,
                "comments_count": 3,
                "created_at": "2025-12-29T10:00:00"
            },
            ...
        ]
    
    Database:
        Function: get_posts_by_hashtag(hashtag, limit)
    """
    def get(self, request):
        hashtag = request.query_params.get('hashtag', '').strip().lstrip('#')
        if not hashtag:
            return Response(
                {'error': 'Hashtag query parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        limit = get_limit(request.query_params, 20)

        # Hashtags are letters/digits/underscore only; anything else cannot match a post and
        # must never reach the database's regular-expression engine.
        if not re.fullmatch(r'\w{1,50}', hashtag):
            return Response([])

        result = DatabaseManager.execute_function(
            'get_posts_by_hashtag',
            (hashtag, limit)
        )
        return Response(result or [])


class UserLikedPostsView(APIView):
    """
    Get posts liked by a specific user.
    
    API Endpoint: GET /api/posts/liked/<user_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        user_id (int): ID of the user (use 'me' for authenticated user)
    
    Query Parameters:
        limit (int): Number of posts (default: 20)
    
    Returns:
        List of posts the user has liked, ordered by most recent like
    
    Database:
        Function: get_user_liked_posts(user_id, limit, viewer_id)
    """
    def get(self, request, user_id):
        if user_id == 'me':
            user_id = request.user.id
        else:
            try:
                user_id = int(user_id)
            except (TypeError, ValueError):
                return Response({'error': 'user_id must be an integer or "me"'},
                                status=status.HTTP_400_BAD_REQUEST)

        limit = get_limit(request.query_params, 20)

        # The viewer is passed so private / followers-only / group posts are filtered in SQL.
        result = DatabaseManager.execute_function(
            'get_user_liked_posts',
            (user_id, limit, request.user.id)
        )
        return Response(result or [])


class PostEngagementStatsView(APIView):
    """
    Get detailed engagement statistics for a specific post.
    
    API Endpoint: GET /api/posts/<post_id>/engagement/
    Authentication: Required (JWT)
    
    URL Parameters:
        post_id (int): ID of the post
    
    Returns:
        Engagement statistics:
        {
            "total_likes": 45,
            "total_comments": 12,
            "total_shares": 0,
            "unique_commenters": 8,
            "engagement_rate": 12.5
        }
    
    Database:
        Function: get_post_engagement_stats(post_id)
    """
    def get(self, request, post_id):
        from posts.views import _can_user_access_post, _get_post_owner_and_visibility

        post_context = _get_post_owner_and_visibility(post_id)
        if not post_context or not _can_user_access_post(
            request.user.id,
            post_context.get('user_id'),
            post_context.get('visibility', 'public'),
            post_context.get('group_id'),
        ):
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        result = DatabaseManager.execute_function(
            'get_post_engagement_stats',
            (post_id,)
        )
        return Response(result[0] if result else {})


class TrendingHashtagsView(APIView):
    """
    Get currently trending hashtags.
    
    API Endpoint: GET /api/posts/hashtags/trending/
    Authentication: Required (JWT)
    
    Query Parameters:
        limit (int): Number of hashtags (default: 10)
    
    Returns:
        List of trending hashtags with usage statistics:
        [
            {
                "hashtag": "buet",
                "post_count": 125,
                "total_engagement": 580
            },
            ...
        ]
    
    Database:
        Function: get_trending_hashtags(limit)
        Window: last 30 days of public, non-group posts
    """
    def get(self, request):
        limit = get_limit(request.query_params, 10)
        
        result = DatabaseManager.execute_function(
            'get_trending_hashtags',
            (limit,)
        )
        return Response(result or [])


class PostsByMediaTypeView(APIView):
    """
    Get posts filtered by media type.
    
    API Endpoint: GET /api/posts/media/<media_type>/
    Authentication: Required (JWT)
    
    URL Parameters:
        media_type (str): "image", "video", or "text"
    
    Query Parameters:
        limit (int): Number of posts (default: 20)
    
    Returns:
        List of posts with specified media type
    
    Database:
        Function: get_posts_by_media_type(media_type, user_id, limit)
    """
    def get(self, request, media_type):
        limit = get_limit(request.query_params, 20)
        
        result = DatabaseManager.execute_function(
            'get_posts_by_media_type',
            (media_type, request.user.id, limit)
        )
        return Response(result or [])


class SearchPostsView(APIView):
    """
    Search posts by content.
    
    API Endpoint: GET /api/posts/search/
    Authentication: Required (JWT)
    
    Query Parameters:
        q (str): Search query
        limit (int): Number of results (default: 20)
    
    Returns:
        List of posts matching search query:
        [
            {
                "post_id": 123,
                "content": "...",
                "author_name": "...",
                "likes_count": 15,
                "comments_count": 3,
                "created_at": "...",
                "relevance": 0.85
            },
            ...
        ]
    
    Database:
        Function: search_posts(search_term, limit)
    """
    def get(self, request):
        search_term = (
            request.query_params.get('q')
            or request.query_params.get('query')
            or request.query_params.get('search')
            or ''
        )
        limit = get_limit(request.query_params, 20)
        
        if not search_term:
            return Response(
                {'error': 'Search query (q) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        query = """
        SELECT
            p.id AS post_id,
            p.content,
            u.name AS author_name,
            u.profile_picture AS author_picture,
            p.likes_count,
            p.comments_count,
            p.created_at,
            ts_rank(to_tsvector('english', COALESCE(p.content, '')), plainto_tsquery('english', %s)) AS relevance
        FROM posts p
        INNER JOIN users u ON p.user_id = u.id
        WHERE to_tsvector('english', COALESCE(p.content, '')) @@ plainto_tsquery('english', %s)
          AND p.visibility = 'public'
          AND p.group_id IS NULL
        ORDER BY relevance DESC, p.created_at DESC
        LIMIT %s
        """

        try:
            result = DatabaseManager.execute_query(query, (search_term, search_term, limit))
        except Exception:
            fallback_query = """
            SELECT
                p.id AS post_id,
                p.content,
                u.name AS author_name,
                u.profile_picture AS author_picture,
                p.likes_count,
                p.comments_count,
                p.created_at,
                1.0::REAL AS relevance
            FROM posts p
            INNER JOIN users u ON p.user_id = u.id
            WHERE LOWER(COALESCE(p.content, '')) LIKE %s
              AND p.visibility = 'public'
              AND p.group_id IS NULL
            ORDER BY p.created_at DESC
            LIMIT %s
            """
            result = DatabaseManager.execute_query(fallback_query, (f"%{escape_like(search_term.lower())}%", limit))

        posts = result or []
        for post in posts:
            post['author_picture'] = _normalize_media_url(post.get('author_picture'))

        return Response({'results': posts})


@throttled('comments')
class DeleteCommentView(APIView):
    """
    Delete a comment.
    
    API Endpoint: DELETE /api/posts/comments/<comment_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        comment_id (int): ID of the comment to delete
    
    Authorization:
        - Only comment author can delete their comment
        - OR post author can delete any comment on their post
    
    Returns:
        200 OK:
            {
                "message": "Comment deleted successfully"
            }
        
        403 Forbidden:
            {
                "error": "Unauthorized"
            }
    
    Database:
        Deletes from comments table with authorization check
    """
    permission_classes = [IsAuthenticated]
    def delete(self, request, comment_id):
        user_id = getattr(request.user, 'id', None)
        if not user_id:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            # Fetch comment and post authors
            query = """
                SELECT c.user_id AS comment_author, p.user_id AS post_author
                FROM comments c
                LEFT JOIN posts p ON c.post_id = p.id
                WHERE c.id = %s
            """
            result = DatabaseManager.execute_query(query, (comment_id,))
            if not result:
                return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)

            row = result[0]
            comment_author = row.get('comment_author') if isinstance(row, dict) else row[0]
            post_author = row.get('post_author') if isinstance(row, dict) else row[1]

            # Authorization check
            if user_id != comment_author and user_id != post_author:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

            # Delete comment
            rows_deleted = DatabaseManager.execute_update("DELETE FROM comments WHERE id = %s", (comment_id,))
            if not rows_deleted:
                return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)

            return Response({'message': 'Comment deleted successfully'}, status=status.HTTP_200_OK)

        except Exception as e:
            print("DeleteCommentView error:", e)
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@throttled('comments')
class UpdateCommentView(APIView):
    """
    Update a comment's content.
    
    API Endpoint: PATCH /api/posts/comments/<comment_id>/
    Authentication: Required (JWT)
    
    URL Parameters:
        comment_id (int): ID of the comment to update
    
    Request Body:
        {
            "content": str (required) - Updated comment text
        }
    
    Authorization:
        - Only comment author can update their comment
    
    Returns:
        200 OK:
            {
                "message": "Comment updated successfully"
            }
        
        403 Forbidden:
            {
                "error": "Unauthorized"
            }
    
    Database:
        Updates comments.content and updated_at timestamp
    """
    permission_classes = [IsAuthenticated]
    def patch(self, request, comment_id):
        content = (clean_str(request.data.get('content'), 'content', 2000) or '').strip()
        
        if not content:
            return Response(
                {'error': 'Content is required and cannot be empty'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        query = "SELECT id, user_id, content FROM comments WHERE id = %s"
        result = DatabaseManager.execute_query(query, (comment_id,))
        
        if not result:
            return Response(
                {'error': 'Comment not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        comment = result[0]

        # Authorization check
        if comment['user_id'] != request.user.id:
            return Response(
                {'error': 'Unauthorized'},
                status=status.HTTP_403_FORBIDDEN
            )
        
         # Update comment
        update_query = """
        UPDATE comments
        SET content = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        """

        DatabaseManager.execute_update(update_query, (content.strip(), comment_id))

        # Return updated response
        return Response({
            'message': 'Comment updated successfully',
            'comment': {
                'id': comment_id,
                'content': content
            }
        }, status=status.HTTP_200_OK)

    def put(self, request, comment_id):
        return self.patch(request, comment_id)
    
    
@throttled('likes')
class LikeCommentView(APIView):
    """
    Like or unlike a comment (toggle functionality).

    API Endpoint: POST /api/posts/comments/<comment_id>/like/
    Authentication: Required (JWT)

    URL Parameters:
        comment_id (int): ID of the comment to like/unlike

    Functionality:
        - If user already liked the comment: Remove like (unlike)
        - If user hasn't liked the comment: Add like

    Returns:
        200 OK:
            {"liked": True/False, "likes_count": int}

    Database:
        Table: comment_likes (user_id, comment_id)
        Constraint: UNIQUE(user_id, comment_id)
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, comment_id):
        user_id = request.user.id

        try:
            comment_exists = DatabaseManager.execute_query(
                "SELECT id FROM comments WHERE id = %s",
                (comment_id,)
            )
            if not comment_exists:
                return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)

            # A comment can only be liked by someone who is allowed to see its post.
            from posts.views import _can_user_access_post
            post_ctx = DatabaseManager.execute_query(
                "SELECT p.user_id, p.visibility, p.group_id FROM comments c "
                "JOIN posts p ON p.id = c.post_id WHERE c.id = %s",
                (comment_id,)
            )
            if not post_ctx or not _can_user_access_post(
                user_id, post_ctx[0]['user_id'], post_ctx[0]['visibility'], post_ctx[0]['group_id']
            ):
                return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)

            # Use procedure for comment like toggle with notification
            params = (
                int(user_id),
                int(comment_id),
                None,  # out_liked
                None,  # out_likes_count
                None,  # out_success
                None   # out_message
            )
            result = DatabaseManager.execute_procedure('toggle_comment_like_with_notification', params)
            
            if not result or not result[0].get('out_success'):
                error_message = result[0].get('out_message', 'Unknown error') if result else 'Unknown error'
                return Response({'error': error_message}, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'liked': result[0]['out_liked'],
                'likes_count': result[0]['out_likes_count'],
                'comment_id': comment_id,
            })

        except Exception as e:
            return Response({'error': 'Failed to toggle comment like'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)