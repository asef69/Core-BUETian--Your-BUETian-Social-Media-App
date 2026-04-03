from rest_framework.views import APIView # type: ignore
from rest_framework.response import Response # type: ignore
from rest_framework import status # type: ignore
from rest_framework.permissions import IsAuthenticated # type: ignore
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
    permission_classes = [IsAuthenticated]

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
            cast_or_none(data.get('scheduled_publish_at'), 'str'),
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
        # Only increment views if published and not scheduled for the future
        blog = DatabaseManager.execute_query(
            "SELECT is_published, scheduled_publish_at FROM blog_posts WHERE id = %s",
            (blog_id,)
        )
        if not blog:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)
        is_published = blog[0]['is_published']
        scheduled = blog[0]['scheduled_publish_at']
        from django.utils import timezone
        now = timezone.now()
        # Ensure scheduled is timezone-aware for comparison
        if scheduled is not None and timezone.is_naive(scheduled):
            scheduled = timezone.make_aware(scheduled, timezone.get_default_timezone())
        if not is_published or (scheduled and scheduled > now):
            return Response({'error': 'Views not allowed for drafts or future scheduled posts'}, status=status.HTTP_403_FORBIDDEN)
        result = DatabaseManager.execute_query(
            """
            UPDATE blog_posts
            SET views_count = views_count + 1
            WHERE id = %s
            RETURNING views_count
            """,
            (blog_id,)
        )
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
        drafts_tab = request.query_params.get('drafts_tab')

        def _attach_edit_delete_flags(rows):
            request_user_id = getattr(request.user, 'id', None)

            if not request_user_id:
                for blog in rows:
                    blog['can_edit'] = False
                    blog['can_delete'] = False
                return rows

            owner_by_blog_id = {}
            unresolved_blog_ids = []

            for blog in rows:
                blog_id = blog.get('id') or blog.get('blog_id')
                if not blog_id:
                    continue

                author_id = blog.get('author_id')
                if author_id is not None:
                    owner_by_blog_id[int(blog_id)] = int(author_id) == int(request_user_id)
                else:
                    unresolved_blog_ids.append(int(blog_id))

            if unresolved_blog_ids:
                ownership_rows = DatabaseManager.execute_query(
                    "SELECT id, author_id FROM blog_posts WHERE id = ANY(%s)",
                    (unresolved_blog_ids,)
                )
                for row in ownership_rows:
                    owner_by_blog_id[int(row['id'])] = int(row['author_id']) == int(request_user_id)

            for blog in rows:
                blog_id = blog.get('id') or blog.get('blog_id')
                can_manage = bool(blog_id) and owner_by_blog_id.get(int(blog_id), False)
                blog['can_edit'] = can_manage
                blog['can_delete'] = can_manage

            return rows

        # Special logic for drafts tab: show both drafts and scheduled (future) posts for the user
        if mine == 'true' and drafts_tab == 'true':
            query = (
                "SELECT b.*, u.name as author_name, u.profile_picture as author_picture "
                "FROM blog_posts b INNER JOIN users u ON b.author_id = u.id "
                "WHERE b.author_id = %s AND (b.is_published = false OR (b.is_published = true AND b.scheduled_publish_at > NOW())) "
                "ORDER BY b.created_at DESC LIMIT 50"
            )
            params = [request.user.id]
            result = DatabaseManager.execute_query(query, tuple(params))
            return Response(_attach_edit_delete_flags(result))

        # ...existing code...
        base_table = 'published_blogs'
        use_blog_posts = False
        if is_published is not None and is_published.lower() == 'false':
            use_blog_posts = True
        if mine == 'true':
            use_blog_posts = True
        table = 'blog_posts' if use_blog_posts else 'published_blogs'
        params = []
        if table == 'blog_posts':
            # Always join users for drafts/scheduled
            query = f"SELECT b.*, u.name as author_name, u.profile_picture as author_picture FROM blog_posts b INNER JOIN users u ON b.author_id = u.id WHERE 1=1"
        else:
            # Only show published and scheduled posts that are due
            query = f"SELECT * FROM published_blogs WHERE (scheduled_publish_at IS NULL OR scheduled_publish_at <= NOW()) AND is_published = true"

        if is_published is not None:
            query += " AND b.is_published = %s" if table == 'blog_posts' else " AND is_published = %s"
            params.append(is_published.lower() == 'true')

        if mine == 'true':
            query += " AND b.author_id = %s" if table == 'blog_posts' else " AND author_id = %s"
            params.append(request.user.id)

        if category:
            query += " AND b.category = %s" if table == 'blog_posts' else " AND category = %s"
            params.append(category)

        if tag:
            if table == 'blog_posts':
                query += (
                    " AND EXISTS ("
                    "SELECT 1 FROM unnest(b.tags) AS t(tag_name) "
                    "WHERE lower(regexp_replace(t.tag_name, '^#', '')) = lower(regexp_replace(%s, '^#', ''))"
                    ")"
                )
            else:
                query += (
                    " AND EXISTS ("
                    "SELECT 1 FROM unnest(tags) AS t(tag_name) "
                    "WHERE lower(regexp_replace(t.tag_name, '^#', '')) = lower(regexp_replace(%s, '^#', ''))"
                    ")"
                )
            params.append(tag)

        # Use correct ordering column for each table
        if table == 'blog_posts':
            query += " ORDER BY b.created_at DESC LIMIT 50"
        else:
            query += " ORDER BY published_at DESC LIMIT 50"

        result = DatabaseManager.execute_query(query, tuple(params))
        return Response(_attach_edit_delete_flags(result))
class UpdateBlogPostView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, blog_id):
        data = request.data
        blog = DatabaseManager.execute_query("SELECT author_id FROM blog_posts WHERE id = %s", (blog_id,))
        if not blog:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)
        if blog[0]['author_id'] != request.user.id:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

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
            int(blog_id),
            int(request.user.id),
            cast_or_none(data.get('title'), 'str'),
            cast_or_none(data.get('content'), 'str'),
            cast_or_none(data.get('excerpt'), 'str'),
            cast_or_none(data.get('cover_image'), 'str'),
            cast_or_none(data.get('category'), 'str'),
            cast_or_none(data.get('is_published'), 'bool'),
            cast_or_none(data.get('tags', []), 'list'),
            cast_or_none(data.get('scheduled_publish_at'), 'str'),
            None,  # out_success
            None   # out_message
        )
        try:
            result = DatabaseManager.execute_procedure('update_blog_post_with_tags', params)
            if not result or not result[0].get('out_success'):
                error_message = result[0].get('out_message', 'Unknown error') if result else 'Unknown error'
                return Response({'error': error_message}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'message': result[0]['out_message']})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, blog_id):
        return self.put(request, blog_id)

class DeleteBlogPostView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, blog_id):
        blog = DatabaseManager.execute_query("SELECT author_id FROM blog_posts WHERE id = %s", (blog_id,))
        if not blog:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)
        if blog[0]['author_id'] != request.user.id:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        params = (
            int(blog_id),
            int(request.user.id),
            None,  # out_success
            None   # out_message
        )
        try:
            result = DatabaseManager.execute_procedure('delete_blog_post', params)
            if not result or not result[0].get('out_success'):
                error_message = result[0].get('out_message', 'Unknown error') if result else 'Unknown error'
                return Response({'error': error_message}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'message': result[0]['out_message']})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
class LikeBlogView(APIView):
    def post(self, request, blog_id):
        # Explicitly cast types and add OUT params for the procedure
        def cast_or_none(val, typ):
            if val is None:
                return None
            if typ == 'int':
                return int(val)
            return val

        # Only allow likes if published and not scheduled for the future
        blog = DatabaseManager.execute_query(
            "SELECT is_published, scheduled_publish_at FROM blog_posts WHERE id = %s",
            (blog_id,)
        )
        if not blog:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)
        is_published = blog[0]['is_published']
        scheduled = blog[0]['scheduled_publish_at']
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        if not is_published or (scheduled and scheduled > now):
            return Response({'error': 'Likes not allowed for drafts or future scheduled posts'}, status=status.HTTP_403_FORBIDDEN)
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

        # Use the new procedure for toggling comment like and notification
        params = (
            int(request.user.id),
            int(comment_id),
            None,  # out_liked
            None,  # out_likes_count
            None,  # out_success
            None   # out_message
        )
        try:
            result = DatabaseManager.execute_procedure('toggle_blog_comment_like_with_notification', params)
            if not result or not result[0].get('out_success'):
                error_message = result[0].get('out_message', 'Unknown error') if result else 'Unknown error'
                return Response({'error': error_message}, status=status.HTTP_400_BAD_REQUEST)
            return Response({
                'liked': result[0]['out_liked'],
                'likes_count': result[0]['out_likes_count'],
                'comment_id': comment_id,
                'message': result[0]['out_message']
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
