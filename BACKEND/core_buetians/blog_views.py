from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from utils.database import DatabaseManager

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
               (SELECT COUNT(*) FROM blog_comments WHERE blog_id = b.id) as comments_count
        FROM blog_posts b
        INNER JOIN users u ON b.author_id = u.id
        WHERE b.id = %s
        """
        result = DatabaseManager.execute_query(query, (blog_id,))
        
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
        
        if result:
            DatabaseManager.execute_update(
                "DELETE FROM blog_likes WHERE user_id = %s AND blog_id = %s",
                (request.user.id, blog_id)
            )
            return Response({'message': 'Blog unliked'})
        else:
            DatabaseManager.execute_insert(
                "INSERT INTO blog_likes (user_id, blog_id) VALUES (%s, %s)",
                (request.user.id, blog_id)
            )
            return Response({'message': 'Blog liked'})

class BlogCommentsView(APIView):
    def get(self, request, blog_id):
        query = """
        SELECT bc.*, u.name as user_name, u.profile_picture as user_picture
        FROM blog_comments bc
        INNER JOIN users u ON bc.user_id = u.id
        WHERE bc.blog_id = %s
        ORDER BY bc.created_at DESC
        """
        result = DatabaseManager.execute_query(query, (blog_id,))
        return Response(result)
    
    def post(self, request, blog_id):
        data = request.data
        comment_id = DatabaseManager.execute_insert(
            "INSERT INTO blog_comments (user_id, blog_id, content) VALUES (%s, %s, %s) RETURNING id",
            (request.user.id, blog_id, data['content'])
        )
        return Response({'message': 'Comment added', 'comment_id': comment_id})
