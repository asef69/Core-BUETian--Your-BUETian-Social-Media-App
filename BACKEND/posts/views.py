from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from utils.database import DatabaseManager
from utils.file_upload import FileUploadHandler


def _is_group_member(group_id, user_id):
    if not group_id or not user_id:
        return False

    membership_query = """
    SELECT 1
    FROM group_members
    WHERE group_id = %s
      AND user_id = %s
      AND status = 'accepted'
    LIMIT 1
    """
    membership_result = DatabaseManager.execute_query(membership_query, (group_id, user_id))
    if membership_result:
        return True

    # Fallback for legacy data where admin may not exist in group_members.
    admin_query = "SELECT 1 FROM groups WHERE id = %s AND admin_id = %s LIMIT 1"
    admin_result = DatabaseManager.execute_query(admin_query, (group_id, user_id))
    return bool(admin_result)


def _can_user_access_post(viewer_user_id, post_owner_id, visibility, group_id=None):
    """Server-side visibility guard for post access."""
    if not viewer_user_id or not post_owner_id:
        return False

    if viewer_user_id == post_owner_id:
        return True

    # Group posts require accepted membership regardless of public/followers visibility.
    if group_id is not None:
        return _is_group_member(group_id, viewer_user_id)

    if visibility == 'public':
        return True

    if visibility == 'followers':
        follow_query = """
        SELECT 1
        FROM follows
        WHERE follower_id = %s
          AND following_id = %s
          AND status = 'accepted'
        LIMIT 1
        """
        follow_result = DatabaseManager.execute_query(
            follow_query,
            (viewer_user_id, post_owner_id)
        )
        return bool(follow_result)

    return False


def _get_post_owner_and_visibility(post_id):
    query = "SELECT user_id, visibility, group_id FROM posts WHERE id = %s LIMIT 1"
    result = DatabaseManager.execute_query(query, (post_id,))
    if not result:
        return None
    return result[0]

class CreatePostView(APIView):
    """
    Create a new post with optional media URLs.
    
    API Endpoint: POST /api/posts/create/
    Authentication: Required (JWT)
    
    Request Body:
        {
            "content": str (optional) - Post text content,
            "media_type": str (optional) - "image"|"video"|"text" (default: "text"),
            "visibility": str (optional) - "public"|"private"|"followers" (default: "public"),
            "group_id": int (optional) - ID of group if posting to group,
            "media_urls": list (optional) - List of pre-uploaded media URLs
        }
    
    Workflow:
        1. Creates post entry in posts table
        2. If media_urls provided, creates entries in media_urls table
    
    Returns:
        201 Created:
            {
                "message": "Post Created Successfully",
                "post_id": 123
            }
    
    Database Tables:
        - posts: Main post record
        - media_urls: Multiple media files per post (one row per file)
    
    Note:
        For uploading media first, use POST /api/posts/upload-media/
        Or use POST /api/posts/create-with-media/ for complete workflow
    """
    parser_classes = (JSONParser, MultiPartParser, FormParser)
    
    def post(self,request):
        data=request.data
        user_id=request.user.id

        query="""
        INSERT INTO posts(user_id,content,media_type,visibility,group_id)
        VALUES(%s,%s,%s,%s,%s)
        RETURNING id
        """

        raw_group_id = data.get('group_id')
        group_id = None if raw_group_id in (None, '', 0, '0', 'null', 'None') else raw_group_id

        params=(
            user_id,
            data.get('content'),
            data.get('media_type','text'),
            data.get('visibility','public'),
            group_id
        )

        post_id=DatabaseManager.execute_insert(query,params)

        # Handle raw media files if provided
        media_files = request.FILES.getlist('media_files')
        if media_files:
            media_type = data.get('media_type', 'image')
            for file in media_files:
                try:
                    FileUploadHandler.validate_file(file, file_type=media_type)
                    folder = 'post_images' if media_type == 'image' else 'post_videos'
                    file_path = FileUploadHandler.upload_file(file, folder=folder)
                    DatabaseManager.execute_insert(
                        "INSERT INTO media_urls (post_id, media_url, media_type) VALUES (%s, %s, %s)",
                        (post_id, file_path, media_type)
                    )
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Error uploading file: {str(e)}")

        # Handle pre-uploaded URLs if provided
        media_urls=data.get('media_urls',[])
        if media_urls and post_id:
            for url in media_urls:
                DatabaseManager.execute_insert(
                    "INSERT INTO media_urls (post_id,media_url,media_type) VALUES (%s,%s,%s)",
                    (post_id,url,data.get('media_type','image'))
                )
        
        # Fetch the complete post data using get_post_details function
        # This returns the same structure as the feed for consistency
        try:
            post_details = DatabaseManager.execute_function(
                'get_post_details',
                (post_id, user_id)
            )
            
            if post_details:
                post_data = post_details[0]
                # Ensure both 'id' and 'post_id' exist with fallback
                id_value = post_data.get('post_id') or post_data.get('id') or post_id
                post_data['id'] = id_value
                post_data['post_id'] = id_value
                return Response(post_data, status=status.HTTP_201_CREATED)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error fetching post details: {str(e)}")
        
        # Fallback: Fetch post with user information manually
        try:
            fallback_query = """
            SELECT 
                p.id as post_id,
                p.content,
                p.media_type,
                p.visibility,
                p.created_at,
                u.id as user_id,
                u.name as user_name,
                u.profile_picture as profile_picture,
                p.likes_count,
                p.comments_count,
                FALSE as is_liked,
                COALESCE(JSON_AGG(JSON_BUILD_OBJECT('media_url', m.media_url, 'media_type', m.media_type)) FILTER (WHERE m.id IS NOT NULL), '[]'::JSON) as media_urls
            FROM posts p
            INNER JOIN users u ON p.user_id = u.id
            LEFT JOIN media_urls m ON p.id = m.post_id
            WHERE p.id = %s
            GROUP BY p.id, u.id
            """
            result = DatabaseManager.execute_query(fallback_query, (post_id,))
            if result:
                post_data = result[0]
                # Ensure both 'id' and 'post_id' exist with fallback
                id_value = post_data.get('post_id') or post_data.get('id') or post_id
                post_data['id'] = id_value
                post_data['post_id'] = id_value
                return Response(post_data, status=status.HTTP_201_CREATED)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Fallback query failed: {str(e)}")
        
        # Final fallback to simple response
        return Response({
            'message':'Post Created Successfully',
            'id': post_id,
            'post_id':post_id
        },status=status.HTTP_201_CREATED)

class UserFeedView(APIView):
    """
    Get personalized feed of posts for authenticated user.
    
    API Endpoint: GET /api/posts/feed/
    Authentication: Required (JWT)
    
    Query Parameters:
        limit (int): Number of posts to return (default: 20)
        offset (int): Pagination offset (default: 0)
    
    Functionality:
        Calls database function 'get_user_feed' which typically returns:
        - Posts from users the current user follows
        - Posts sorted by relevance/recency
        - Includes post details, media, author info, like/comment counts
    
    Returns:
        List of post objects with complete details including:
        - Post content and metadata
        - Author information
        - Media URLs array
        - Engagement metrics (likes, comments)
    
    Database:
        Function: get_user_feed(user_id, limit, offset)
    """
    def get(self, request):
        limit = int(request.query_params.get('limit', 20))
        offset = int(request.query_params.get('offset', 0))
        
        try:
            result = DatabaseManager.execute_function(
                'get_user_feed',
                (request.user.id, limit, offset)
            )
            if result is None:
                result = []
            
            # Ensure both 'id' and 'post_id' fields exist for frontend compatibility
            filtered_result = []
            for post in result:
                post_owner_id = post.get('user_id') or post.get('author_id')
                post_visibility = post.get('visibility', 'public')

                if not _can_user_access_post(
                    request.user.id,
                    post_owner_id,
                    post_visibility,
                    post.get('group_id')
                ):
                    continue

                # Use post_id if available, otherwise try id
                post_id_value = post.get('post_id') or post.get('id')
                if post_id_value:
                    post['id'] = post_id_value
                    post['post_id'] = post_id_value
                filtered_result.append(post)
            
            return Response(filtered_result)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error fetching user feed: {str(e)}")
            return Response([], status=status.HTTP_500_INTERNAL_SERVER_ERROR)        


class PublicFeedView(APIView):
    """
    Get recent public posts for discovery feed.

    API Endpoint: GET /api/posts/public/
    Authentication: Required (JWT)

    Query Parameters:
        limit (int): Number of posts to return (default: 20)
    """
    def get(self, request):
        limit = int(request.query_params.get('limit', 20))

        query = """
        SELECT
            p.id AS post_id,
            p.id AS id,
            p.user_id,
            u.name AS user_name,
            u.profile_picture,
            p.content,
            p.media_type,
            p.visibility,
            p.created_at,
            p.likes_count,
            p.comments_count,
            EXISTS (
                SELECT 1
                FROM likes l
                WHERE l.post_id = p.id AND l.user_id = %s
            ) AS has_liked,
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'media_url', m.media_url,
                        'media_type', m.media_type
                    )
                ) FILTER (WHERE m.id IS NOT NULL),
                '[]'::JSON
            ) AS media_urls
        FROM posts p
        INNER JOIN users u ON u.id = p.user_id
        LEFT JOIN media_urls m ON m.post_id = p.id
        WHERE p.visibility = 'public'
          AND p.group_id IS NULL
        GROUP BY p.id, u.id
        ORDER BY p.created_at DESC
        LIMIT %s
        """

        result = DatabaseManager.execute_query(query, (request.user.id, limit))
        return Response(result or [])


class PostDetailView(APIView):
    """
    Retrieve or delete a specific post.
    
    API Endpoints:
        GET /api/posts/<post_id>/ - Get post details
        DELETE /api/posts/<post_id>/ - Delete post (owner only)
    
    Authentication: Required (JWT)
    """
    def get(self,request,post_id):
        """
        Get detailed information about a specific post.
        
        URL Parameters:
            post_id (int): ID of the post to retrieve
        
        Returns:
            200 OK:
                {
                    "id": 123,
                    "content": "Post content",
                    "media_type": "image",
                    "visibility": "public",
                    "media_urls": [{"url": "...", "type": "image"}, ...],
                    "author": {...},
                    "likes_count": 15,
                    "comments_count": 3,
                    "created_at": "...",
                    "user_has_liked": true
                }
            
            404 Not Found:
                {
                    "error": "Post not found"
                }
        
        Database:
            Function: get_post_details(post_id, user_id)
        """
        result=DatabaseManager.execute_function(
            'get_post_details',
            (post_id,request.user.id)
        )

        if not result:
            return Response(
                {
                    'error':'Post not found'
                },status=status.HTTP_404_NOT_FOUND
            )
        
        post_data = result[0]
        post_owner_id = post_data.get('user_id') or post_data.get('author_id') or post_data.get('owner_id')
        if not _can_user_access_post(
            request.user.id,
            post_owner_id,
            post_data.get('visibility', 'public'),
            post_data.get('group_id')
        ):
            return Response(
                {
                    'error': 'Post not found'
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # Ensure both 'id' and 'post_id' exist
        id_value = post_data.get('post_id') or post_data.get('id') or post_id
        post_data['id'] = id_value
        post_data['post_id'] = id_value
        if 'user_id' not in post_data and post_data.get('author_id') is not None:
            post_data['user_id'] = post_data.get('author_id')
        if 'user_name' not in post_data and post_data.get('author_name') is not None:
            post_data['user_name'] = post_data.get('author_name')
        if 'profile_picture' not in post_data and post_data.get('author_picture') is not None:
            post_data['profile_picture'] = post_data.get('author_picture')
        return Response(post_data)
    
    def delete(self,request,post_id):
        """
        Delete a post (owner only).
        
        URL Parameters:
            post_id (int): ID of the post to delete
        
        Authorization:
            Only the post owner can delete their post
        
        Returns:
            200 OK:
                {
                    "message": "Post deleted successfully"
                }
            
            403 Forbidden:
                {
                    "error": "Unauthorized"
                }
        
        Side Effects:
            - Deletes post from posts table
            - CASCADE deletes associated media_urls entries
            - CASCADE deletes associated likes and comments
        """
        query="""
        SELECT user_id FROM posts WHERE id = %s
        """
        result=DatabaseManager.execute_query(query,(post_id,))

        if not result or result[0]['user_id'] != request.user.id:
            return Response(
                {
                    'error': 'Unauthorized'
                }, status=status.HTTP_403_FORBIDDEN
            )
        
        DatabaseManager.execute_update("DELETE FROM posts WHERE id = %s", (post_id,))
        return Response(
                {
                'message': 'Post deleted successfully'
                }
            )

    def patch(self, request, post_id):
        """
        Update a post (owner only).

        URL Parameters:
            post_id (int): ID of the post to update

        Allowed fields:
            content, visibility
        """
        query = "SELECT user_id FROM posts WHERE id = %s"
        result = DatabaseManager.execute_query(query, (post_id,))

        if not result or result[0]['user_id'] != request.user.id:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        update_fields = []
        params = []

        if 'content' in data:
            update_fields.append("content = %s")
            params.append(data['content'])
        if 'visibility' in data:
            update_fields.append("visibility = %s")
            params.append(data['visibility'])

        if not update_fields:
            return Response({'error': 'No fields to update'}, status=status.HTTP_400_BAD_REQUEST)

        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        params.append(post_id)

        update_query = f"UPDATE posts SET {', '.join(update_fields)} WHERE id = %s"
        DatabaseManager.execute_update(update_query, tuple(params))
        return Response({'message': 'Post updated successfully'})
    
    
    
    
class LikePostView(APIView):
    """
    Like or unlike a post (toggle functionality).
    
    API Endpoint: POST /api/posts/<post_id>/like/
    Authentication: Required (JWT)
    
    URL Parameters:
        post_id (int): ID of the post to like/unlike
    
    Functionality:
        - If user already liked the post: Remove like (unlike)
        - If user hasn't liked the post: Add like
    
    Returns:
        200 OK:
            {"message": "Post liked"} or {"message": "Post unliked"}
    
    Database:
        Table: likes (user_id, post_id)
        Constraint: UNIQUE(user_id, post_id)
    
    Example Usage:
        First call: Adds like
        Second call: Removes like
        Third call: Adds like again
    """
    def post(self, request, post_id):
        user_id = request.user.id

        post_context = _get_post_owner_and_visibility(post_id)
        if not post_context or not _can_user_access_post(
            user_id,
            post_context.get('user_id'),
            post_context.get('visibility', 'public'),
            post_context.get('group_id')
        ):
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
        
        query = """
        SELECT id FROM likes WHERE user_id = %s AND post_id = %s
        """
        result = DatabaseManager.execute_query(query, (user_id, post_id))

        if result:
            DatabaseManager.execute_update(
                "DELETE FROM likes WHERE user_id = %s AND post_id = %s",
                (user_id, post_id)
            )
            liked = False
            message = 'Post unliked'
        else:
            DatabaseManager.execute_insert(
                """
                INSERT INTO likes (user_id, post_id)
                VALUES (%s, %s)
                ON CONFLICT (user_id, post_id) DO NOTHING
                RETURNING id
                """,
                (user_id, post_id)
            )
            liked = True
            message = 'Post liked'

        count_result = DatabaseManager.execute_query(
            "SELECT COUNT(*) AS count FROM likes WHERE post_id = %s",
            (post_id,)
        )
        likes_count = count_result[0]['count'] if count_result else 0

        return Response({
            'message': message,
            'liked': liked,
            'likes_count': likes_count,
            'post_id': post_id
        })


class CommentView(APIView):
    """
    Retrieve comments or add a comment to a post.
    
    API Endpoints:
        GET /api/posts/<post_id>/comments/ - Get all comments
        POST /api/posts/<post_id>/comments/ - Add new comment
    
    Authentication: Required (JWT)
    """
    def get(self, request, post_id):
        """
        Get all comments for a specific post.
        
        URL Parameters:
            post_id (int): ID of the post
        
        Returns:
            List of comment objects with:
            - Comment details (id, content, created_at)
            - Author information
            - Parent comment reference (for replies)
        
        Database:
            Function: get_post_comments(post_id)
        """
        post_context = _get_post_owner_and_visibility(post_id)
        if not post_context:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        if not _can_user_access_post(
            request.user.id,
            post_context.get('user_id'),
            post_context.get('visibility', 'public'),
            post_context.get('group_id')
        ):
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        result = DatabaseManager.execute_function('get_post_comments', (post_id, request.user.id)) or []
        for comment in result:
            if 'profile_picture' not in comment and 'user_picture' in comment:
                comment['profile_picture'] = comment['user_picture']
        return Response(result)
    
    def post(self, request, post_id):
        """
        Add a new comment to a post.
        
        URL Parameters:
            post_id (int): ID of the post to comment on
        
        Request Body:
            {
                "content": str (required) - Comment text,
                "parent_comment_id": int (optional) - ID of parent comment if replying
            }
        
        Returns:
            201 Created:
                {
                    "message": "Comment added",
                    "comment_id": 456
                }
        
        Database:
            Table: comments
            Supports nested comments via parent_comment_id
        """
        data = request.data

        post_context = _get_post_owner_and_visibility(post_id)
        if not post_context or not _can_user_access_post(
            request.user.id,
            post_context.get('user_id'),
            post_context.get('visibility', 'public'),
            post_context.get('group_id')
        ):
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Validate required field
        if not data.get('content'):
            return Response(
                {'error': 'Content is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            query = """
            INSERT INTO comments (post_id, user_id, content)
            VALUES (%s, %s, %s)
            RETURNING id
            """
            
            comment_id = DatabaseManager.execute_insert(
                query,
                (post_id, request.user.id, data['content'])
            )
            
            # If parent_comment_id is provided, try to update it
            parent_id = data.get('parent_comment_id')
            if parent_id:
                try:
                    DatabaseManager.execute_update(
                        "UPDATE comments SET comment_id = %s WHERE id = %s",
                        (parent_id, comment_id)
                    )
                except:
                    # Column doesn't exist, continue without it
                    pass
            
            return Response({
                'message': 'Comment added',
                'comment_id': comment_id
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error adding comment: {str(e)}")
            return Response(
                {'error': 'Failed to add comment', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    

class TrendingPostsView(APIView):
    """
    Get trending/popular posts.
    
    API Endpoint: GET /api/posts/trending/
    Authentication: Required (JWT)
    
    Query Parameters:
        limit (int): Number of posts to return (default: 10)
    
    Returns:
        List of trending posts, typically sorted by:
        - Recent engagement (likes, comments)
        - View count
        - Recency
    
    Database:
        Function: get_trending_posts(limit)
    """
    def get(self, request):
        limit = request.query_params.get('limit', 10)
        result = DatabaseManager.execute_function('get_trending_posts', (limit,))
        return Response(result)


class UploadPostMediaView(APIView):
    """
    Upload multiple media files (images or videos) for a post.
    
    API Endpoint: POST /api/posts/upload-media/
    Authentication: Required (JWT)
    Content-Type: multipart/form-data
    
    Request Body:
        media: file[] (required) - Multiple files with same field name
        media_type: str (optional) - "image" or "video" (default: "image")
    
    Validation:
        Images:
            - Formats: jpg, jpeg, png, gif, webp
            - Max size: 5MB per file
        Videos:
            - Formats: mp4, avi, mov, wmv
            - Max size: 50MB per file
    
    Storage:
        - Images: media/post_images/
        - Videos: media/post_videos/
        - Filenames: UUID-based (e.g., abc123.jpg)
    
    Returns:
        200 OK:
            {
                "message": "3 file(s) uploaded successfully",
                "uploaded_files": [
                    {"url": "media/post_images/abc.jpg", "type": "image"},
                    {"url": "media/post_images/def.jpg", "type": "image"},
                    {"url": "media/post_images/ghi.jpg", "type": "image"}
                ],
                "errors": []  // Only present if some files failed
            }
        
        400 Bad Request:
            {
                "error": "No media files provided"
            }
    
    Usage Flow:
        1. Upload media files using this endpoint
        2. Get uploaded_files array from response
        3. Use URLs in POST /api/posts/create-with-media/
    
    Notes:
        - Validates each file individually
        - Continues uploading valid files even if some fail
        - Returns both successes and errors
    """
    parser_classes = (MultiPartParser, FormParser)
    
    def post(self, request):
        if 'media' not in request.FILES:
            return Response(
                {'error': 'No media files provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        files = request.FILES.getlist('media')  
        media_type = request.data.get('media_type', 'image')  
        
        uploaded_files = []
        errors = []
        
        for file in files:
            try:
                FileUploadHandler.validate_file(file, file_type=media_type)
                
                folder = 'post_images' if media_type == 'image' else 'post_videos'
                file_path = FileUploadHandler.upload_file(file, folder=folder)
                
                uploaded_files.append({
                    'url': file_path,
                    'type': media_type
                })
                
            except ValueError as e:
                errors.append({
                    'file': file.name,
                    'error': str(e)
                })
            except Exception as e:
                errors.append({
                    'file': file.name,
                    'error': f'Upload failed: {str(e)}'
                })
        
        response_data = {
            'message': f'{len(uploaded_files)} file(s) uploaded successfully',
            'uploaded_files': uploaded_files
        }
        
        if errors:
            response_data['errors'] = errors
        
        return Response(response_data, status=status.HTTP_200_OK)


class CreatePostWithMediaView(APIView):
    """
    Create a post with multiple media files.
    
    API Endpoint: POST /api/posts/create-with-media/
    Authentication: Required (JWT)
    
    Request Body:
        {
            "content": str (optional) - Post text content,
            "media_type": str (optional) - "image"|"video"|"text" (default: "text"),
            "visibility": str (optional) - "public"|"private"|"followers" (default: "public"),
            "group_id": int (optional) - ID of group if posting to group,
            "media_urls": array (optional) - Array of media objects or URL strings
        }
    
    Media URLs Format (flexible):
        Option 1 - Array of objects:
            [{"url": "media/post_images/abc.jpg", "type": "image"}, ...]
        
        Option 2 - Array of strings:
            ["media/post_images/abc.jpg", "media/post_images/def.jpg"]
    
    Workflow:
        1. Creates post record in posts table
        2. For each media URL, creates entry in media_urls table
        3. Returns post_id for reference
    
    Returns:
        201 Created:
            {
                "message": "Post created successfully",
                "post_id": 123
            }
    
    Database Tables:
        posts:
            - id, user_id, content, media_type, visibility, group_id
        
        media_urls:
            - id, post_id, media_url, media_type
            - Multiple rows per post (one per media file)
    
    Complete Usage Example:
        1. Upload files: POST /api/posts/upload-media/
           Response: {uploaded_files: [{url: "...", type: "..."}, ...]}
        
        2. Create post: POST /api/posts/create-with-media/
           Body: {content: "...", media_urls: [...]}
    
    Note:
        This endpoint expects pre-uploaded media URLs.
        Use UploadPostMediaView first to get the URLs.
    """
    def post(self, request):
        data = request.data
        user_id = request.user.id
        
        query = """
        INSERT INTO posts(user_id, content, media_type, visibility, group_id)
        VALUES(%s, %s, %s, %s, %s)
        RETURNING id
        """
        
        raw_group_id = data.get('group_id')
        group_id = None if raw_group_id in (None, '', 0, '0', 'null', 'None') else raw_group_id

        params = (
            user_id,
            data.get('content'),
            data.get('media_type', 'text'),
            data.get('visibility', 'public'),
            group_id
        )
        
        post_id = DatabaseManager.execute_insert(query, params)
        
        media_urls = data.get('media_urls', [])
        if isinstance(media_urls, str):
            try:
                import json
                media_urls = json.loads(media_urls)
            except json.JSONDecodeError:
                media_urls = []
        if media_urls and post_id:
            media_insert_query = """
            INSERT INTO media_urls (post_id, media_url, media_type)
            VALUES (%s, %s, %s)
            """
            for media_item in media_urls:
                if isinstance(media_item, dict):
                    media_url = media_item.get('url')
                    media_type = media_item.get('type', data.get('media_type', 'image'))
                else:
                    media_url = media_item
                    media_type = data.get('media_type', 'image')

                DatabaseManager.execute_insert(
                    media_insert_query,
                    (post_id, media_url, media_type)
                )
        
        # Fetch the complete post data using get_post_details function
        # This returns the same structure as the feed for consistency
        try:
            post_details = DatabaseManager.execute_function(
                'get_post_details',
                (post_id, user_id)
            )
            
            if post_details:
                post_data = post_details[0]
                # Ensure both 'id' and 'post_id' exist with fallback
                id_value = post_data.get('post_id') or post_data.get('id') or post_id
                post_data['id'] = id_value
                post_data['post_id'] = id_value
                return Response(post_data, status=status.HTTP_201_CREATED)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error fetching post details: {str(e)}")
        
        # Fallback: Fetch post with user information manually
        try:
            fallback_query = """
            SELECT 
                p.id as post_id,
                p.content,
                p.media_type,
                p.visibility,
                p.created_at,
                u.id as user_id,
                u.name as user_name,
                u.profile_picture as profile_picture,
                p.likes_count,
                p.comments_count,
                FALSE as is_liked,
                COALESCE(JSON_AGG(JSON_BUILD_OBJECT('media_url', m.media_url, 'media_type', m.media_type)) FILTER (WHERE m.id IS NOT NULL), '[]'::JSON) as media_urls
            FROM posts p
            INNER JOIN users u ON p.user_id = u.id
            LEFT JOIN media_urls m ON p.id = m.post_id
            WHERE p.id = %s
            GROUP BY p.id, u.id
            """
            result = DatabaseManager.execute_query(fallback_query, (post_id,))
            if result:
                post_data = result[0]
                # Ensure both 'id' and 'post_id' exist with fallback
                id_value = post_data.get('post_id') or post_data.get('id') or post_id
                post_data['id'] = id_value
                post_data['post_id'] = id_value
                return Response(post_data, status=status.HTTP_201_CREATED)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Fallback query failed: {str(e)}")
        
        # Final fallback to simple response
        return Response({
            'message': 'Post created successfully',
            'id': post_id,
            'post_id': post_id
        }, status=status.HTTP_201_CREATED)
    
