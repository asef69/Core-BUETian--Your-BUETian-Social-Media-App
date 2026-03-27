from rest_framework.views import APIView # type: ignore
from rest_framework.response import Response # type: ignore
from rest_framework import status # type: ignore
from utils.database import DatabaseManager


def _ensure_blog_comment_extensions():
    DatabaseManager.execute_update(
        """
        ALTER TABLE blog_comments
        ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER REFERENCES blog_comments(id) ON DELETE CASCADE
        """
    )
    DatabaseManager.execute_update(
        """
        CREATE TABLE IF NOT EXISTS blog_comment_likes (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            comment_id INTEGER REFERENCES blog_comments(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, comment_id)
        )
        """
    )

class CreateBlogPostView(APIView):
    def post(self, request):
        data = request.data
        # Explicitly cast types for PostgreSQL procedure
        def cast_or_none(val, typ):
            if val is None:
                return None
            if typ == 'str':
                return str(val)
            if typ == 'bool':
                return bool(val)
            if typ == 'list':
                return list(val) if isinstance(val, (list, tuple)) else [val]
            return val

        params = (
            int(request.user.id),
            cast_or_none(data.get('title'), 'str'),
            cast_or_none(data.get('content'), 'str'),
            cast_or_none(data.get('excerpt'), 'str'),
            cast_or_none(data.get('cover_image'), 'str'),
            cast_or_none(data.get('category'), 'str'),
            cast_or_none(data.get('is_published', True), 'bool'),
            cast_or_none(data.get('tags', []), 'list'),
            None,  # out_blog_id
            None,  # out_success
            None   # out_message
        )
        try:
            result=DatabaseManager.execute_procedure('create_blog_post_with_tags', params)
            if not result or not result[0].get('out_success'):
                error_message=result[0].get('out_message','Unknown error') if result else 'Unknown error'
                return Response({'error': error_message}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'message': result[0]['out_message']   , 'blog_id': result[0]['out_blog_id']},status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)        

class BlogPostDetailView(APIView):
    def get(self, request, blog_id):
        query = """
        SELECT b.*, u.name as author_name, u.profile_picture as author_picture,
               ARRAY(SELECT tag_name FROM blog_post_tags WHERE blog_post_id = b.id) as tags,
               (SELECT COUNT(*) FROM blog_comments WHERE blog_id = b.id) as comments_count,
               EXISTS (
                   SELECT 1
                   FROM blog_likes bl
                   WHERE bl.blog_id = b.id AND bl.user_id = %s
               ) AS is_liked
        FROM blog_posts b
        INNER JOIN users u ON b.author_id = u.id
        WHERE b.id = %s
        """
        result = DatabaseManager.execute_query(query, (request.user.id, blog_id))
        
        if not result:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(result[0])

class BlogPostViewTrackView(APIView):
    def post(self, request, blog_id):
        result = DatabaseManager.execute_query(
            """
            UPDATE blog_posts
            SET views_count = views_count + 1
            WHERE id = %s
            RETURNING views_count
            """,
            (blog_id,)
        )

        if not result:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'message': 'Blog view tracked',
            'views_count': result[0].get('views_count', 0),
        })

class PublishedBlogsView(APIView):
    def get(self, request):
        category = request.query_params.get('category')
        tag = request.query_params.get('tag')
        is_published = request.query_params.get('is_published')
        mine = request.query_params.get('mine')

        # Start with all blogs (published_blogs is a view for published only)
        # For drafts or mine, query blog_posts directly
        base_table = 'published_blogs'
        use_blog_posts = False
        if is_published is not None and is_published.lower() == 'false':
            use_blog_posts = True
        if mine == 'true':
            use_blog_posts = True
        table = 'blog_posts' if use_blog_posts else 'published_blogs'

        query = f"SELECT * FROM {table} WHERE 1=1"
        params = []

        if is_published is not None:
            query += " AND is_published = %s"
            params.append(is_published.lower() == 'true')

        if mine == 'true':
            query += " AND author_id = %s"
            params.append(request.user.id)

        if category:
            query += " AND category = %s"
            params.append(category)

        if tag:
            query += " AND %s = ANY(tags)"
            params.append(tag)

        # Use correct ordering column for each table
        if table == 'blog_posts':
            query += " ORDER BY created_at DESC LIMIT 50"
        else:
            query += " ORDER BY published_at DESC LIMIT 50"

        result = DatabaseManager.execute_query(query, tuple(params))
        return Response(result)

class LikeBlogView(APIView):
    def post(self, request, blog_id):
        # Explicitly cast types and add OUT params for the procedure
        def cast_or_none(val, typ):
            if val is None:
                return None
            if typ == 'int':
                return int(val)
            return val

        params = (
            cast_or_none(request.user.id, 'int'),
            cast_or_none(blog_id, 'int'),
            None,  # out_liked
            None,  # out_likes_count
            None,  # out_success
            None   # out_message
        )
        try:
            result = DatabaseManager.execute_procedure(
                'toggle_blog_like_with_notification',
                params
            )
            if not result or not result[0].get('out_success'):
                error_msg = result[0].get('out_message', 'Unknown error') if result else 'Unknown error'
                # If the error is blog not found, return 404, else 400
                if 'not found' in error_msg.lower():
                    return Response({'error': error_msg}, status=status.HTTP_404_NOT_FOUND)
                return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)
            return Response({
                'message': result[0]['out_message'],
                'liked': result[0]['out_liked'],
                'likes_count': result[0]['out_likes_count'],
                'blog_id': blog_id
            })
        except Exception as e:
            return Response({'error': f'Internal error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LikeBlogCommentView(APIView):
    def post(self, request, comment_id):
        _ensure_blog_comment_extensions()

        comment_result = DatabaseManager.execute_query(
            "SELECT id, user_id, blog_id FROM blog_comments WHERE id = %s",
            (comment_id,)
        )
        if not comment_result:
            return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)

        comment = comment_result[0]
        existing = DatabaseManager.execute_query(
            "SELECT id FROM blog_comment_likes WHERE user_id = %s AND comment_id = %s",
            (request.user.id, comment_id)
        )

        if existing:
            DatabaseManager.execute_update(
                "DELETE FROM blog_comment_likes WHERE user_id = %s AND comment_id = %s",
                (request.user.id, comment_id)
            )
            liked = False
        else:
            DatabaseManager.execute_insert(
                "INSERT INTO blog_comment_likes (user_id, comment_id) VALUES (%s, %s)",
                (request.user.id, comment_id)
            )
            liked = True

            if comment['user_id'] != request.user.id:
                DatabaseManager.execute_insert(
                    """
                    INSERT INTO notifications (user_id, actor_id, notification_type, reference_id, content)
                    VALUES (%s, %s, 'blog_comment_like', %s, 'loved your blog comment')
                    """,
                    (comment['user_id'], request.user.id, comment['blog_id'])
                )

        count_result = DatabaseManager.execute_query(
            "SELECT COUNT(*) AS count FROM blog_comment_likes WHERE comment_id = %s",
            (comment_id,)
        )
        likes_count = count_result[0]['count'] if count_result else 0
        return Response({'liked': liked, 'likes_count': likes_count, 'comment_id': comment_id})

class BlogCommentsView(APIView):
    def get(self, request, blog_id):
        _ensure_blog_comment_extensions()
        query = """
        SELECT
            bc.*,
            u.name as user_name,
            u.profile_picture as user_picture,
            COUNT(bcl.id)::INTEGER AS likes_count,
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM blog_comment_likes bcl2
                    WHERE bcl2.comment_id = bc.id
                      AND bcl2.user_id = %s
                ) THEN TRUE
                ELSE FALSE
            END AS liked
        FROM blog_comments bc
        INNER JOIN users u ON bc.user_id = u.id
        LEFT JOIN blog_comment_likes bcl ON bcl.comment_id = bc.id
        WHERE bc.blog_id = %s
        GROUP BY bc.id, u.id, u.name, u.profile_picture
        ORDER BY bc.created_at ASC
        """
        result = DatabaseManager.execute_query(query, (request.user.id, blog_id))
        return Response(result)
    
    def post(self, request, blog_id):
        _ensure_blog_comment_extensions()
        data = request.data

        parent_comment_id = data.get('parent_comment_id')
        if parent_comment_id in ('', None):
            parent_comment_id = None

        # Use the stored procedure for comment creation and notification
        params = (
            int(request.user.id),
            int(blog_id),
            data['content'],
            int(parent_comment_id) if parent_comment_id is not None else None,
            None,  # out_comment_id
            None,  # out_success
            None   # out_message
        )
        result = DatabaseManager.execute_procedure('add_blog_comment_with_notification', params)
        if not result or not result[0].get('out_success'):
            error_message = result[0].get('out_message', 'Unknown error') if result else 'Unknown error'
            return Response({'error': error_message}, status=status.HTTP_400_BAD_REQUEST)
        comment_id = result[0]['out_comment_id']

        return Response({'message': 'Comment added', 'comment_id': comment_id})
