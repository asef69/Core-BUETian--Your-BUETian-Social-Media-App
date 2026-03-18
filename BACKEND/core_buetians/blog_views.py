from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
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
        query = """
        INSERT INTO blog_posts (
            author_id, title, content, excerpt, cover_image,
            category, is_published
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """
        
        blog_id = DatabaseManager.execute_insert(
            query,
            (request.user.id, data['title'], data['content'],
             data.get('excerpt'), data.get('cover_image'),
             data.get('category'), data.get('is_published', True))
        )
        
        tags = data.get('tags', [])
        for tag in tags:
            DatabaseManager.execute_insert(
                "INSERT INTO blog_post_tags (blog_post_id, tag_name) VALUES (%s, %s)",
                (blog_id, tag)
            )
        
        return Response({
            'message': 'Blog post created successfully',
            'blog_id': blog_id
        }, status=status.HTTP_201_CREATED)

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
        
        query = "SELECT * FROM published_blogs WHERE 1=1"
        params = []
        
        if category:
            query += " AND category = %s"
            params.append(category)
        
        if tag:
            query += " AND %s = ANY(tags)"
            params.append(tag)
        
        query += " LIMIT 50"
        result = DatabaseManager.execute_query(query, tuple(params))
        return Response(result)

class LikeBlogView(APIView):
    def post(self, request, blog_id):
        check_query = "SELECT id FROM blog_likes WHERE user_id = %s AND blog_id = %s"
        result = DatabaseManager.execute_query(check_query, (request.user.id, blog_id))

        owner_result = DatabaseManager.execute_query(
            "SELECT author_id FROM blog_posts WHERE id = %s",
            (blog_id,)
        )
        if not owner_result:
            return Response({'error': 'Blog post not found'}, status=status.HTTP_404_NOT_FOUND)
        blog_author_id = owner_result[0]['author_id']
        
        if result:
            DatabaseManager.execute_update(
                "DELETE FROM blog_likes WHERE user_id = %s AND blog_id = %s",
                (request.user.id, blog_id)
            )
            liked = False
            message = 'Blog unliked'
        else:
            DatabaseManager.execute_insert(
                "INSERT INTO blog_likes (user_id, blog_id) VALUES (%s, %s)",
                (request.user.id, blog_id)
            )
            liked = True
            message = 'Blog liked'

            if blog_author_id != request.user.id:
                DatabaseManager.execute_insert(
                    """
                    INSERT INTO notifications (user_id, actor_id, notification_type, reference_id, content)
                    VALUES (%s, %s, 'blog_like', %s, 'liked your blog post')
                    """,
                    (blog_author_id, request.user.id, blog_id)
                )

        count_result = DatabaseManager.execute_query(
            "SELECT COUNT(*) AS count FROM blog_likes WHERE blog_id = %s",
            (blog_id,)
        )
        likes_count = count_result[0]['count'] if count_result else 0
        return Response({'message': message, 'liked': liked, 'likes_count': likes_count, 'blog_id': blog_id})


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

        if parent_comment_id is not None:
            parent_result = DatabaseManager.execute_query(
                "SELECT id, user_id FROM blog_comments WHERE id = %s AND blog_id = %s",
                (parent_comment_id, blog_id)
            )
            if not parent_result:
                return Response({'error': 'Parent comment not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            parent_result = []

        comment_id = DatabaseManager.execute_insert(
            """
            INSERT INTO blog_comments (user_id, blog_id, content, parent_comment_id)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (request.user.id, blog_id, data['content'], parent_comment_id)
        )

        blog_owner_result = DatabaseManager.execute_query(
            "SELECT author_id FROM blog_posts WHERE id = %s",
            (blog_id,)
        )
        blog_owner_id = blog_owner_result[0]['author_id'] if blog_owner_result else None

        if parent_comment_id is None:
            if blog_owner_id and blog_owner_id != request.user.id:
                DatabaseManager.execute_insert(
                    """
                    INSERT INTO notifications (user_id, actor_id, notification_type, reference_id, content)
                    VALUES (%s, %s, 'blog_comment', %s, 'commented on your blog post')
                    """,
                    (blog_owner_id, request.user.id, blog_id)
                )
        else:
            parent_owner_id = parent_result[0]['user_id'] if parent_result else None
            if parent_owner_id and parent_owner_id != request.user.id:
                DatabaseManager.execute_insert(
                    """
                    INSERT INTO notifications (user_id, actor_id, notification_type, reference_id, content)
                    VALUES (%s, %s, 'blog_reply', %s, 'replied to your blog comment')
                    """,
                    (parent_owner_id, request.user.id, blog_id)
                )

        return Response({'message': 'Comment added', 'comment_id': comment_id})
