from rest_framework.views import APIView
from rest_framework.response import Response
from utils.database import DatabaseManager
from utils.params import get_int_param, get_limit
from utils.validators import escape_like
from users.views import _normalize_media_url


def _get_search_term(request):
    return (
        request.query_params.get('q')
        or request.query_params.get('query')
        or request.query_params.get('search')
        or ''
    )

class SearchUsersView(APIView):
    def get(self, request):
        search_term = _get_search_term(request)
        department = request.query_params.get('department')
        batch = get_int_param(request.query_params, 'batch', None)
        blood_group = request.query_params.get('blood_group')
        limit = get_limit(request.query_params, 20)
        
        result = DatabaseManager.execute_function(
            'search_users_advanced',
            (search_term, department, batch, blood_group, limit)
        )
        for user in result:
            # Same shape as /api/users/search/ (`id` next to `user_id`, usable media URL).
            user.setdefault('id', user.get('user_id'))
            user['profile_picture'] = _normalize_media_url(user.get('profile_picture'))
        return Response(result)

class SearchPostsView(APIView):
    def get(self, request):
        search_term = _get_search_term(request)
        limit = get_limit(request.query_params, 20)
        
        result = DatabaseManager.execute_function('search_posts', (search_term, limit))
        return Response(result)

class SearchGroupsView(APIView):
    def get(self, request):
        search_term = _get_search_term(request)
        cleaned_term = search_term.strip()

        # Avoid full-table scans on empty queries
        if not cleaned_term:
            return Response([])

        base_query = """
        SELECT 
            g.id,
            g.name,
            g.description,
            g.is_private,
            g.cover_image,
            g.created_at,
            u.id AS admin_id,
            u.name AS admin_name,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.status = 'accepted') AS members_count,
            (SELECT COUNT(*) FROM posts p WHERE p.group_id = g.id) AS posts_count
        FROM groups g
        INNER JOIN users u ON g.admin_id = u.id
        WHERE to_tsvector('english', g.name || ' ' || COALESCE(g.description, ''))
              @@ plainto_tsquery('english', %s)
        ORDER BY members_count DESC
        LIMIT 20
        """

        try:
            result = DatabaseManager.execute_query(base_query, (cleaned_term,))
        except Exception:
            # Fallback to ILIKE in case the text search configuration or view is missing in the DB
            like_term = f"%{escape_like(cleaned_term.lower())}%"
            fallback_query = """
            SELECT 
                g.id,
                g.name,
                g.description,
                g.is_private,
                g.cover_image,
                g.created_at,
                u.id AS admin_id,
                u.name AS admin_name,
                (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.status = 'accepted') AS members_count,
                (SELECT COUNT(*) FROM posts p WHERE p.group_id = g.id) AS posts_count
            FROM groups g
            INNER JOIN users u ON g.admin_id = u.id
            WHERE LOWER(g.name) LIKE %s OR LOWER(COALESCE(g.description, '')) LIKE %s
            ORDER BY members_count DESC
            LIMIT 20
            """
            result = DatabaseManager.execute_query(fallback_query, (like_term, like_term))

        return Response(result)

class GlobalSearchView(APIView):
    def get(self, request):
        search_term = _get_search_term(request)
        cleaned_term = search_term.strip()

        if not cleaned_term:
            return Response({'users': [], 'posts': [], 'groups': []})
        
        users = DatabaseManager.execute_function(
            'search_users_advanced',
            (cleaned_term, None, None, None, 5)
        )
        
        posts = DatabaseManager.execute_function('search_posts', (cleaned_term, 5))

        groups_query = """
        SELECT 
            g.id,
            g.name,
            g.description,
            g.is_private,
            g.cover_image,
            g.created_at,
            u.id AS admin_id,
            u.name AS admin_name,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.status = 'accepted') AS members_count,
            (SELECT COUNT(*) FROM posts p WHERE p.group_id = g.id) AS posts_count
        FROM groups g
        INNER JOIN users u ON g.admin_id = u.id
        WHERE to_tsvector('english', g.name || ' ' || COALESCE(g.description, ''))
              @@ plainto_tsquery('english', %s)
        ORDER BY members_count DESC
        LIMIT 5
        """

        try:
            groups = DatabaseManager.execute_query(groups_query, (cleaned_term,))
        except Exception:
            like_term = f"%{escape_like(cleaned_term.lower())}%"
            fallback_groups_query = """
            SELECT 
                g.id,
                g.name,
                g.description,
                g.is_private,
                g.cover_image,
                g.created_at,
                u.id AS admin_id,
                u.name AS admin_name,
                (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.status = 'accepted') AS members_count,
                (SELECT COUNT(*) FROM posts p WHERE p.group_id = g.id) AS posts_count
            FROM groups g
            INNER JOIN users u ON g.admin_id = u.id
            WHERE LOWER(g.name) LIKE %s OR LOWER(COALESCE(g.description, '')) LIKE %s
            ORDER BY members_count DESC
            LIMIT 5
            """
            groups = DatabaseManager.execute_query(fallback_groups_query, (like_term, like_term))
        
        return Response({
            'users': users,
            'posts': posts,
            'groups': groups
        })
