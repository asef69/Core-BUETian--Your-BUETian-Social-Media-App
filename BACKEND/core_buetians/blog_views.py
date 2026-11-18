from rest_framework.views import APIView # type: ignore
from rest_framework.response import Response # type: ignore
from rest_framework import status # type: ignore
from rest_framework.permissions import IsAuthenticated # type: ignore
import logging

from rest_framework.exceptions import ValidationError  # type: ignore

from utils.database import DatabaseManager
from utils.validators import (
    clean_datetime, clean_int, clean_str, clean_tags, parse_bool, safe_procedure_message,
)

logger = logging.getLogger(__name__)


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


def _resolve_blog_id(blog_id):
    """Resolve a blog reference that may be a blog id or a blog comment id."""
    direct_blog = DatabaseManager.execute_query(
        "SELECT id FROM blog_posts WHERE id = %s",
        (blog_id,)
    )
    if direct_blog:
        return int(blog_id)

    via_comment = DatabaseManager.execute_query(
        "SELECT blog_id FROM blog_comments WHERE id = %s",
        (blog_id,)
    )
    if via_comment and via_comment[0].get('blog_id') is not None:
        return int(via_comment[0]['blog_id'])

    return None

class CreateBlogPostView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        params = (
            int(request.user.id),
            clean_str(data.get('title'), 'title', 250, required=True, allow_blank=False),
            clean_str(data.get('content'), 'content', 100000, required=True, allow_blank=False),
            clean_str(data.get('excerpt'), 'excerpt', 1000) or None,
            clean_str(data.get('cover_image'), 'cover_image', 500) or None,
            clean_str(data.get('category'), 'category', 100) or None,
            parse_bool(data.get('is_published'), True),
            clean_tags(data.get('tags')) or [],
            clean_datetime(data.get('scheduled_publish_at'), 'scheduled_publish_at'),
            None,  # out_blog_id
            None,  # out_success
            None   # out_message
        )
        try:
            result=DatabaseManager.execute_procedure('create_blog_post_with_tags', params)
            if not result or not result[0].get('out_success'):
                error_message=result[0].get('out_message','Unknown error') if result else 'Unknown error'
                return Response({'error': safe_procedure_message(error_message)}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'message': result[0]['out_message']   , 'blog_id': result[0]['out_blog_id']},status=status.HTTP_201_CREATED)
        except ValidationError:
            raise
        except Exception:
            logger.exception('Blog request failed')
            return Response({'error': 'Something went wrong. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class BlogPostDetailView(APIView):
    def get(self, request, blog_id):
        from datetime import datetime, timezone

        resolved_blog_id = _resolve_blog_id(blog_id)
        if resolved_blog_id is None:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)

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
        result = DatabaseManager.execute_query(query, (request.user.id, resolved_blog_id))
        
        if not result:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)

        blog = result[0]
        viewer_id = getattr(request.user, 'id', None)
        author_id = blog.get('author_id')
        is_author = viewer_id is not None and author_id is not None and str(viewer_id) == str(author_id)
        is_published = bool(blog.get('is_published'))
        scheduled_publish_at = blog.get('scheduled_publish_at')

        # Drafts and future-scheduled posts are only visible to their author.
        if not is_author:
            if not is_published:
                return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)

            if scheduled_publish_at:
                scheduled = scheduled_publish_at
                if getattr(scheduled, 'tzinfo', None) is None:
                    scheduled = scheduled.replace(tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
                if scheduled > now:
                    return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response(blog)

class BlogPostViewTrackView(APIView):
    def post(self, request, blog_id):
        resolved_blog_id = _resolve_blog_id(blog_id)
        if resolved_blog_id is None:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)

        # SQL-level guard avoids timezone parsing mismatches in Python.
        exists = DatabaseManager.execute_query(
            "SELECT 1 FROM blog_posts WHERE id = %s",
            (resolved_blog_id,)
        )
        if not exists:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)

        result = DatabaseManager.execute_query(
            """
            UPDATE blog_posts
            SET views_count = views_count + 1
            WHERE id = %s
              AND is_published = TRUE
              AND (scheduled_publish_at IS NULL OR scheduled_publish_at <= CURRENT_TIMESTAMP)
            RETURNING views_count
            """,
            (resolved_blog_id,)
        )

        if not result:
            return Response({'error': 'Views not allowed for drafts or future scheduled posts'}, status=status.HTTP_403_FORBIDDEN)

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
                "SELECT b.*, u.name as author_name, u.profile_picture as author_picture, "
                "ARRAY(SELECT bt.tag_name FROM blog_post_tags bt WHERE bt.blog_post_id = b.id ORDER BY bt.id) AS tags "
                "FROM blog_posts b INNER JOIN users u ON b.author_id = u.id "
                "WHERE b.author_id = %s AND (b.is_published = false OR (b.is_published = true AND b.scheduled_publish_at > NOW())) "
                "ORDER BY b.created_at DESC LIMIT 50"
            )
            params = [request.user.id]
            result = DatabaseManager.execute_query(query, tuple(params))
            return Response(_attach_edit_delete_flags(result))

        # ...existing code...
        use_blog_posts = False
        if is_published is not None and is_published.lower() == 'false':
            use_blog_posts = True
        if mine == 'true':
            use_blog_posts = True
        table = 'blog_posts' if use_blog_posts else 'published_blogs'
        params = []
        if table == 'blog_posts':
            # Always join users for drafts/scheduled
            query = (
                "SELECT b.*, u.name as author_name, u.profile_picture as author_picture, "
                "ARRAY(SELECT bt.tag_name FROM blog_post_tags bt WHERE bt.blog_post_id = b.id ORDER BY bt.id) AS tags "
                "FROM blog_posts b INNER JOIN users u ON b.author_id = u.id WHERE 1=1"
            )
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
                    "SELECT 1 FROM blog_post_tags bt2 "
                    "WHERE bt2.blog_post_id = b.id "
                    "AND lower(regexp_replace(bt2.tag_name, '^#', '')) = lower(regexp_replace(%s, '^#', ''))"
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
            clean_str(data.get('title'), 'title', 250, allow_blank=False),
            clean_str(data.get('content'), 'content', 100000, allow_blank=False),
            clean_str(data.get('excerpt'), 'excerpt', 1000),
            clean_str(data.get('cover_image'), 'cover_image', 500),
            clean_str(data.get('category'), 'category', 100),
            parse_bool(data.get('is_published')),
            # None (field absent) leaves the existing tags untouched; a list replaces them.
            clean_tags(data.get('tags')),
            clean_datetime(data.get('scheduled_publish_at'), 'scheduled_publish_at'),
            None,  # out_success
            None   # out_message
        )
        try:
            result = DatabaseManager.execute_procedure('update_blog_post_with_tags', params)
            if not result or not result[0].get('out_success'):
                error_message = result[0].get('out_message', 'Unknown error') if result else 'Unknown error'
                return Response({'error': safe_procedure_message(error_message)}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'message': result[0]['out_message']})
        except ValidationError:
            raise
        except Exception:
            logger.exception('Blog request failed')
            return Response({'error': 'Something went wrong. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
                return Response({'error': safe_procedure_message(error_message)}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'message': result[0]['out_message']})
        except ValidationError:
            raise
        except Exception:
            logger.exception('Blog request failed')
            return Response({'error': 'Something went wrong. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
class LikeBlogView(APIView):
    def post(self, request, blog_id):
        resolved_blog_id = _resolve_blog_id(blog_id)
        if resolved_blog_id is None:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)

        # Explicitly cast types and add OUT params for the procedure
        def cast_or_none(val, typ):
            if val is None:
                return None
            if typ == 'int':
                return int(val)
            return val

        blog_exists = DatabaseManager.execute_query(
            "SELECT 1 FROM blog_posts WHERE id = %s",
            (resolved_blog_id,)
        )
        if not blog_exists:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)

        like_allowed = DatabaseManager.execute_query(
            """
            SELECT 1
            FROM blog_posts
            WHERE id = %s
              AND is_published = TRUE
              AND (scheduled_publish_at IS NULL OR scheduled_publish_at <= CURRENT_TIMESTAMP)
            """,
                        (resolved_blog_id,)
        )
        if not like_allowed:
            return Response(
                {'error': 'You have no access to like in draft mode'},
                status=status.HTTP_403_FORBIDDEN,
            )
        params = (
            cast_or_none(request.user.id, 'int'),
            cast_or_none(resolved_blog_id, 'int'),
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
                'blog_id': resolved_blog_id
            })
        except ValidationError:
            raise
        except Exception:
            logger.exception('Blog request failed')
            return Response({'error': 'Something went wrong. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
                return Response({'error': safe_procedure_message(error_message)}, status=status.HTTP_400_BAD_REQUEST)
            return Response({
                'liked': result[0]['out_liked'],
                'likes_count': result[0]['out_likes_count'],
                'comment_id': comment_id,
                'message': result[0]['out_message']
            })
        except ValidationError:
            raise
        except Exception:
            logger.exception('Blog request failed')
            return Response({'error': 'Something went wrong. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class BlogCommentsView(APIView):
    def get(self, request, blog_id):
        _ensure_blog_comment_extensions()
        resolved_blog_id = _resolve_blog_id(blog_id)
        if resolved_blog_id is None:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)

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
        result = DatabaseManager.execute_query(query, (request.user.id, resolved_blog_id))
        return Response(result)
    
    def post(self, request, blog_id):
        _ensure_blog_comment_extensions()
        resolved_blog_id = _resolve_blog_id(blog_id)
        if resolved_blog_id is None:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data

        parent_comment_id = clean_int(data.get('parent_comment_id'), 'parent_comment_id', minimum=1)
        comment_text = clean_str(data.get('content'), 'content', 2000, required=True, allow_blank=False)

        # Use the stored procedure for comment creation and notification
        params = (
            int(request.user.id),
            int(resolved_blog_id),
            comment_text,
            parent_comment_id,
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
