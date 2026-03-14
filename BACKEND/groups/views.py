from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.utils import ProgrammingError
from utils.database import DatabaseManager


def _get_group_role(group_id, user_id):
    role_query = """
    SELECT role FROM group_members
    WHERE group_id = %s AND user_id = %s AND status = 'accepted'
    """
    result = DatabaseManager.execute_query(role_query, (group_id, user_id))
    if result:
        return result[0]['role']

    admin_query = "SELECT 1 FROM groups WHERE id = %s AND admin_id = %s"
    admin_result = DatabaseManager.execute_query(admin_query, (group_id, user_id))
    if admin_result:
        return 'admin'
    return None


def _is_admin_or_moderator(group_id, user_id):
    role = _get_group_role(group_id, user_id)
    return role in ['admin', 'moderator']

class CreateGroupView(APIView):
    """
    Create a new group.
    
    API Endpoint: POST /api/groups/create/
    Authentication: Required (JWT Token)
    
    Request Body:
        {
            "name": "BUET Photographic Society",
            "description": "A group for photography enthusiasts",
            "is_private": false,
            "cover_image": "path/to/image.jpg"
        }
    
    Response (201 Created):
        {
            "message": "Group created successfully",
            "group_id": 1
        }
    
    Database Operations:
        - Inserts new group into groups table
        - Automatically adds creator as admin in group_members table
        - Creator's membership status is 'accepted'
    
    Notes:
        - User creating the group becomes admin automatically
        - Private groups require approval to join
        - Public groups allow anyone to join
    """
    permission_classes = [IsAuthenticated]
    
    def post(self,request):
        data=request.data
        query="""
        INSERT INTO groups(name,description,admin_id,is_private,cover_image)
        VALUES (%s,%s,%s,%s,%s)
        RETURNING id
        """

        group_id=DatabaseManager.execute_insert(
            query,
            (
                data['name'],
                data.get('description'),
                request.user.id,
                data.get('is_private', False),
                data.get('cover_image')
            )
        )
        DatabaseManager.execute_insert(
            "INSERT INTO group_members (group_id, user_id, role, status) VALUES (%s, %s, 'admin', 'accepted')",
            (group_id, request.user.id)
        )
        
        return Response({
            'message': 'Group created successfully',
            'group_id': group_id
        }, status=status.HTTP_201_CREATED)
    
class GroupDetailView(APIView):
    """
    Get detailed information about a specific group.
    
    API Endpoint: GET /api/groups/<group_id>/
    Authentication: Required (JWT Token)
    
    Response (200 OK):
        {
            "group_id": 1,
            "name": "BUET Photographic Society",
            "description": "A group for photography enthusiasts",
            "admin_id": 5,
            "admin_name": "John Doe",
            "is_private": false,
            "cover_image": "path/to/image.jpg",
            "members_count": 45,
            "posts_count": 128,
            "is_member": true,
            "member_status": "accepted",
            "created_at": "2025-01-15T10:30:00"
        }
    
    Response (404 Not Found):
        {"error": "Group not found"}
    
    Database Operations:
        - Calls get_group_details() function with group_id and user_id
        - Returns group info, member status, and statistics
    
    Notes:
        - Shows if current user is a member
        - Displays member and post counts
        - Includes admin information
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, group_id):
        try:
            result = DatabaseManager.execute_function(
                'get_group_details',
                (group_id, request.user.id)
            )
        except ProgrammingError:
            result = DatabaseManager.execute_query(
                """
                SELECT
                    g.id as group_id,
                    g.name,
                    g.description,
                    g.admin_id,
                    u.name as admin_name,
                    g.is_private,
                    g.cover_image,
                    (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.status = 'accepted') as members_count,
                    (SELECT COUNT(*) FROM posts p WHERE p.group_id = g.id) as posts_count,
                    EXISTS(
                        SELECT 1 FROM group_members gm
                        WHERE gm.group_id = g.id AND gm.user_id = %s AND gm.status = 'accepted'
                    ) as is_member,
                    COALESCE(
                        (
                            SELECT gm.status FROM group_members gm
                            WHERE gm.group_id = g.id AND gm.user_id = %s
                            ORDER BY gm.joined_at DESC
                            LIMIT 1
                        ),
                        'none'
                    ) as member_status,
                    g.created_at
                FROM groups g
                INNER JOIN users u ON u.id = g.admin_id
                WHERE g.id = %s
                """,
                (request.user.id, request.user.id, group_id)
            )
        if not result:
            return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(result[0])
    
class GroupMembersView(APIView):
    """
    Get list of all accepted members in a group.
    
    API Endpoint: GET /api/groups/<group_id>/members/
    Authentication: Required (JWT Token)
    
    Response (200 OK):
        [
            {
                "user_id": 5,
                "name": "John Doe",
                "profile_picture": "path/to/profile.jpg",
                "role": "admin",
                "joined_at": "2025-01-15T10:30:00"
            },
            {
                "user_id": 12,
                "name": "Jane Smith",
                "profile_picture": "path/to/profile2.jpg",
                "role": "moderator",
                "joined_at": "2025-01-16T14:20:00"
            }
        ]
    
    Database Operations:
        - Calls get_group_members_list() function
        - Returns only accepted members
        - Ordered by role (admin > moderator > member) then by joined_at
    
    Notes:
        - Only shows accepted members, not pending requests
        - Members sorted by role hierarchy
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, group_id):
        result = DatabaseManager.execute_function('get_group_members_list', (group_id,))
        return Response(result)

class JoinGroupView(APIView):
    """
    Request to join a group.
    
    API Endpoint: POST /api/groups/<group_id>/join/
    Authentication: Required (JWT Token)
    
    Response (200 OK):
        {"message": "Join request sent"}
    
    Database Operations:
        - Inserts new row in group_members table
        - Status set to 'pending' for private groups
        - Role set to 'member'
        - Uses ON CONFLICT DO NOTHING to prevent duplicates
    
    Notes:
        - For private groups: Request requires admin/moderator approval
        - For public groups: Can be auto-accepted (modify status to 'accepted')
        - Duplicate requests are ignored
        - User cannot join same group twice
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, group_id):
        query = """
        INSERT INTO group_members (group_id, user_id, role, status)
        VALUES (%s, %s, 'member', 'pending')
        ON CONFLICT (group_id, user_id) DO NOTHING
        """
        DatabaseManager.execute_insert(query, (group_id, request.user.id))
        return Response({'message': 'Join request sent'})

class AcceptGroupMemberView(APIView):
    """
    Accept a pending member request (Admin/Moderator only).
    
    API Endpoint: POST /api/groups/<group_id>/accept/<user_id>/
    Authentication: Required (JWT Token)
    Authorization: Admin or Moderator only
    
    Response (200 OK):
        {"message": "Member accepted"}
    
    Response (403 Forbidden):
        {"error": "Unauthorized"}
    
    Database Operations:
        - Verifies current user is admin or moderator
        - Updates member status from 'pending' to 'accepted'
    
    Notes:
        - Only admins and moderators can accept members
        - Changes status of pending requests
        - Rejected if requester is not admin/moderator
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, group_id, user_id):
        if not _is_admin_or_moderator(group_id, request.user.id):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        update_query = """
        UPDATE group_members SET status = 'accepted'
        WHERE group_id = %s AND user_id = %s
        """
        DatabaseManager.execute_update(update_query, (group_id, user_id))
        return Response({'message': 'Member accepted'})


class InviteGroupMemberView(APIView):
    """
    Invite/add a user to group (Admin/Moderator only).

    API Endpoint: POST /api/groups/<group_id>/invite/
    Authentication: Required (JWT Token)
    Authorization: Admin or Moderator only

    Request Body:
        {
            "user_id": 15
        }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        actor_role = _get_group_role(group_id, request.user.id)
        if actor_role not in ['admin', 'moderator']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        target_user_id = request.data.get('user_id')
        if not target_user_id:
            return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user_id = int(target_user_id)
        except (TypeError, ValueError):
            return Response({'error': 'user_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

        user_exists = DatabaseManager.execute_query(
            "SELECT 1 FROM users WHERE id = %s AND is_active = TRUE",
            (target_user_id,)
        )
        if not user_exists:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        existing = DatabaseManager.execute_query(
            "SELECT role, status FROM group_members WHERE group_id = %s AND user_id = %s",
            (group_id, target_user_id)
        )

        if existing:
            existing_role = existing[0]['role']
            existing_status = existing[0]['status']

            if existing_status == 'accepted':
                return Response({'message': 'User is already a member'})

            if existing_role in ['admin', 'moderator']:
                return Response({'message': 'User is already part of group'})

            DatabaseManager.execute_update(
                "UPDATE group_members SET status = 'accepted', role = 'member' WHERE group_id = %s AND user_id = %s",
                (group_id, target_user_id)
            )
            return Response({'message': 'User invited successfully'})

        DatabaseManager.execute_insert(
            "INSERT INTO group_members (group_id, user_id, role, status) VALUES (%s, %s, 'member', 'accepted')",
            (group_id, target_user_id)
        )
        return Response({'message': 'User invited successfully'})

class LeaveGroupView(APIView):
    """
    Leave a group (member removes themselves).
    
    API Endpoint: POST /api/groups/<group_id>/leave/
    Authentication: Required (JWT Token)
    
    Response (200 OK):
        {"message": "You have left the group"}
    
    Response (403 Forbidden):
        {"error": "Admin cannot leave group. Transfer admin rights first or delete the group."}
    
    Database Operations:
        - Checks if user is admin (admins cannot leave without transferring rights)
        - Deletes user's membership from group_members table
    
    Notes:
        - Admin must transfer rights before leaving
        - Member is completely removed from group
        - Can rejoin by requesting again
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, group_id):
        # Check if user is admin
        check_query = """
        SELECT role FROM group_members
        WHERE group_id = %s AND user_id = %s AND status = 'accepted'
        """
        result = DatabaseManager.execute_query(check_query, (group_id, request.user.id))
        
        if result and result[0]['role'] == 'admin':
            return Response(
                {'error': 'Admin cannot leave group. Transfer admin rights first or delete the group.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        delete_query = "DELETE FROM group_members WHERE group_id = %s AND user_id = %s"
        DatabaseManager.execute_update(delete_query, (group_id, request.user.id))
        return Response({'message': 'You have left the group'})

class RemoveGroupMemberView(APIView):
    """
    Remove a member from group (Admin/Moderator only).
    
    API Endpoint: DELETE /api/groups/<group_id>/members/<user_id>/
    Authentication: Required (JWT Token)
    Authorization: Admin or Moderator only
    
    Response (200 OK):
        {"message": "Member removed successfully"}
    
    Response (403 Forbidden):
        {"error": "Unauthorized"}
    
    Response (400 Bad Request):
        {"error": "Cannot remove admin. Transfer admin rights first."}
    
    Database Operations:
        - Verifies current user is admin or moderator
        - Checks target user is not admin
        - Deletes member from group_members table
    
    Notes:
        - Only admins/moderators can remove members
        - Cannot remove admin (must transfer rights first)
        - Moderators can remove regular members only
    """
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, group_id, user_id):
        actor_role = _get_group_role(group_id, request.user.id)
        if actor_role not in ['admin', 'moderator']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        if user_id == request.user.id:
            return Response({'error': 'Use leave group to remove yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        check_query = """
        SELECT role, status FROM group_members
        WHERE group_id = %s AND user_id = %s
        """
        
        target_result = DatabaseManager.execute_query(check_query, (group_id, user_id))
        if not target_result:
            return Response({'error': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)

        target_role = target_result[0]['role']

        if target_role == 'admin':
            return Response(
                {'error': 'Cannot remove admin. Transfer admin rights first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if actor_role == 'moderator' and target_role in ['moderator', 'admin']:
            return Response(
                {'error': 'Moderators can only remove regular members.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        delete_query = "DELETE FROM group_members WHERE group_id = %s AND user_id = %s"
        DatabaseManager.execute_update(delete_query, (group_id, user_id))
        return Response({'message': 'Member removed successfully'})

class UpdateGroupView(APIView):
    """
    Update group information (Admin only).
    
    API Endpoint: PUT /api/groups/<group_id>/update/
    Authentication: Required (JWT Token)
    Authorization: Admin only
    
    Request Body (all fields optional):
        {
            "name": "Updated Group Name",
            "description": "Updated description",
            "is_private": true,
            "cover_image": "path/to/new/image.jpg"
        }
    
    Response (200 OK):
        {"message": "Group updated successfully"}
    
    Response (403 Forbidden):
        {"error": "Only admin can update group"}
    
    Database Operations:
        - Verifies current user is admin
        - Updates only provided fields
        - Sets updated_at timestamp
    
    Notes:
        - Only admin can update group details
        - Partial updates supported
        - Cover image can be changed
    """
    permission_classes = [IsAuthenticated]
    
    def put(self, request, group_id):
        # Check if user is admin
        check_query = """
        SELECT admin_id FROM groups WHERE id = %s
        """
        result = DatabaseManager.execute_query(check_query, (group_id,))
        
        if not result or result[0]['admin_id'] != request.user.id:
            return Response({'error': 'Only admin can update group'}, status=status.HTTP_403_FORBIDDEN)
        
        data = request.data
        update_fields = []
        params = []
        
        if 'name' in data:
            update_fields.append("name = %s")
            params.append(data['name'])
        if 'description' in data:
            update_fields.append("description = %s")
            params.append(data['description'])
        if 'is_private' in data:
            update_fields.append("is_private = %s")
            params.append(data['is_private'])
        if 'cover_image' in data:
            update_fields.append("cover_image = %s")
            params.append(data['cover_image'])
        
        if update_fields:
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            params.append(group_id)
            update_query = f"UPDATE groups SET {', '.join(update_fields)} WHERE id = %s"
            DatabaseManager.execute_update(update_query, tuple(params))
        
        return Response({'message': 'Group updated successfully'})

    def patch(self, request, group_id):
        return self.put(request, group_id)

class DeleteGroupView(APIView):
    """
    Delete a group (Admin only).
    
    API Endpoint: DELETE /api/groups/<group_id>/delete/
    Authentication: Required (JWT Token)
    Authorization: Admin only
    
    Response (200 OK):
        {"message": "Group deleted successfully"}
    
    Response (403 Forbidden):
        {"error": "Only admin can delete group"}
    
    Database Operations:
        - Verifies current user is admin
        - Cascades deletion to group_members and posts
        - Removes group from groups table
    
    Notes:
        - Only admin can delete group
        - All members, posts, and related data are deleted (CASCADE)
        - Action cannot be undone
    """
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, group_id):
        # Check if user is admin
        check_query = "SELECT admin_id FROM groups WHERE id = %s"
        result = DatabaseManager.execute_query(check_query, (group_id,))
        
        if not result or result[0]['admin_id'] != request.user.id:
            return Response({'error': 'Only admin can delete group'}, status=status.HTTP_403_FORBIDDEN)
        
        delete_query = "DELETE FROM groups WHERE id = %s"
        DatabaseManager.execute_update(delete_query, (group_id,))
        return Response({'message': 'Group deleted successfully'})

class GroupPostsView(APIView):
    """
    Get all posts in a group (members only for private groups).
    
    API Endpoint: GET /api/groups/<group_id>/posts/
    Authentication: Required (JWT Token)
    
    Query Parameters:
        - page (int, default=1): Page number for pagination
        - limit (int, default=20): Posts per page
    
    Response (200 OK):
        {
            "posts": [
                {
                    "id": 1,
                    "user_id": 5,
                    "user_name": "John Doe",
                    "profile_picture": "path/to/profile.jpg",
                    "content": "Check out this photo!",
                    "media_urls": ["path/to/image1.jpg"],
                    "likes_count": 15,
                    "comments_count": 3,
                    "created_at": "2025-12-20T14:30:00"
                }
            ],
            "total": 45,
            "page": 1,
            "limit": 20
        }
    
    Response (403 Forbidden):
        {"error": "You must be a member to view posts in this private group"}
    
    Database Operations:
        - Checks if group is private and user is member
        - Fetches posts with user info and media
        - Supports pagination
    
    Notes:
        - Public groups: Anyone can view posts
        - Private groups: Only accepted members can view
        - Posts ordered by created_at DESC
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, group_id):
        # Check if group is private and user is member
        group_query = "SELECT is_private FROM groups WHERE id = %s"
        group_result = DatabaseManager.execute_query(group_query, (group_id,))
        
        if not group_result:
            return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if group_result[0]['is_private']:
            member_query = """
            SELECT 1 FROM group_members 
            WHERE group_id = %s AND user_id = %s AND status = 'accepted'
            """
            member_result = DatabaseManager.execute_query(member_query, (group_id, request.user.id))
            if not member_result:
                return Response(
                    {'error': 'You must be a member to view posts in this private group'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        page = int(request.GET.get('page', 1))
        limit = int(request.GET.get('limit', 20))
        offset = (page - 1) * limit
        
        # Get posts with user info
        posts_query = """
        SELECT 
            p.id,
            p.user_id,
            u.name as user_name,
            u.profile_picture,
            p.content,
            p.likes_count,
            p.comments_count,
            p.created_at,
            COALESCE(
                (SELECT json_agg(media_url) FROM media_urls WHERE post_id = p.id),
                '[]'::json
            ) as media_urls
        FROM posts p
        INNER JOIN users u ON p.user_id = u.id
        WHERE p.group_id = %s
        ORDER BY p.created_at DESC
        LIMIT %s OFFSET %s
        """
        posts = DatabaseManager.execute_query(posts_query, (group_id, limit, offset))
        
        # Get total count
        count_query = "SELECT COUNT(*) as total FROM posts WHERE group_id = %s"
        count_result = DatabaseManager.execute_query(count_query, (group_id,))
        total = count_result[0]['total'] if count_result else 0
        
        return Response({
            'posts': posts,
            'total': total,
            'page': page,
            'limit': limit
        })

class CreateGroupPostView(APIView):
    """
    Create a post in a group (members only).
    
    API Endpoint: POST /api/groups/<group_id>/posts/create/
    Authentication: Required (JWT Token)
    Authorization: Group members only
    
    Request Body:
        {
            "content": "Post content here",
            "media_urls": ["path/to/image1.jpg", "path/to/image2.jpg"],
            "visibility": "public"
        }
    
    Response (201 Created):
        {
            "message": "Post created successfully",
            "post_id": 123
        }
    
    Response (403 Forbidden):
        {"error": "You must be a member to post in this group"}
    
    Database Operations:
        - Verifies user is accepted member
        - Inserts post into posts table with group_id
        - Inserts media URLs into media_urls table
    
    Notes:
        - Only accepted members can create posts
        - Multiple media files supported
        - Post is associated with group_id
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, group_id):
        # Check if user is member
        member_query = """
        SELECT 1 FROM group_members 
        WHERE group_id = %s AND user_id = %s AND status = 'accepted'
        """
        member_result = DatabaseManager.execute_query(member_query, (group_id, request.user.id))
        
        if not member_result:
            return Response(
                {'error': 'You must be a member to post in this group'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        data = request.data
        
        # Insert post
        post_query = """
        INSERT INTO posts(user_id, content, group_id, visibility, media_type)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
        """
        
        media_urls = data.get('media_urls', [])
        media_type = 'image' if media_urls else 'text'
        
        post_id = DatabaseManager.execute_insert(
            post_query,
            (
                request.user.id,
                data.get('content', ''),
                group_id,
                data.get('visibility', 'public'),
                media_type
            )
        )
        
        # Insert media URLs
        if media_urls:
            for media_url in media_urls:
                media_insert = "INSERT INTO media_urls(post_id, media_url, media_type) VALUES (%s, %s, %s)"
                # Determine media type from URL extension
                file_media_type = 'video' if media_url.endswith(('.mp4', '.avi', '.mov')) else 'image'
                DatabaseManager.execute_insert(media_insert, (post_id, media_url, file_media_type))
        
        return Response({
            'message': 'Post created successfully',
            'post_id': post_id
        }, status=status.HTTP_201_CREATED)

class PendingMembersView(APIView):
    """
    Get list of pending member requests (Admin/Moderator only).
    
    API Endpoint: GET /api/groups/<group_id>/pending/
    Authentication: Required (JWT Token)
    Authorization: Admin or Moderator only
    
    Response (200 OK):
        [
            {
                "user_id": 15,
                "name": "Alice Johnson",
                "profile_picture": "path/to/profile.jpg",
                "department_name": "CSE",
                "batch": 18,
                "requested_at": "2025-12-28T10:30:00"
            }
        ]
    
    Response (403 Forbidden):
        {"error": "Unauthorized"}
    
    Database Operations:
        - Verifies current user is admin or moderator
        - Fetches all pending join requests
        - Includes user profile information
    
    Notes:
        - Only admins and moderators can view pending requests
        - Useful for managing group membership
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, group_id):
        if not _is_admin_or_moderator(group_id, request.user.id):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get pending members
        pending_query = """
        SELECT 
            u.id as user_id,
            u.name,
            u.profile_picture,
            u.department_name,
            u.batch,
            gm.joined_at as requested_at
        FROM group_members gm
        INNER JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = %s AND gm.status = 'pending'
        ORDER BY gm.joined_at DESC
        """
        pending_members = DatabaseManager.execute_query(pending_query, (group_id,))
        
        return Response(pending_members)

class UserGroupsView(APIView):
    """
    Get all groups where user is an accepted member.
    
    API Endpoint: GET /api/groups/my-groups/
    Authentication: Required (JWT Token)
    
    Response (200 OK):
        [
            {
                "group_id": 1,
                "name": "BUET Photography Club",
                "description": "For photography enthusiasts",
                "cover_image": "path/to/image.jpg",
                "role": "admin",
                "members_count": 45,
                "is_private": false,
                "joined_at": "2025-01-15T10:30:00"
            }
        ]
    
    Database Operations:
        - Calls get_user_groups() function with user_id
        - Returns all groups where user is accepted member
        - Includes role and membership info
    
    Notes:
        - Shows user's role in each group
        - Ordered by joined_at DESC (newest first)
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            result = DatabaseManager.execute_function('get_user_groups', (request.user.id,))
        except ProgrammingError:
            result = DatabaseManager.execute_query(
                """
                SELECT
                    g.id as group_id,
                    g.name,
                    g.description,
                    g.cover_image,
                    gm.role,
                    (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.status = 'accepted') as members_count,
                    g.is_private,
                    gm.joined_at
                FROM groups g
                INNER JOIN group_members gm ON g.id = gm.group_id
                WHERE gm.user_id = %s
                  AND gm.status = 'accepted'
                ORDER BY gm.joined_at DESC
                """,
                (request.user.id,)
            )
        return Response(result)

class SuggestedGroupsView(APIView):
    """
    Get suggested groups for user based on interests and connections.
    
    API Endpoint: GET /api/groups/suggested/
    Authentication: Required (JWT Token)
    
    Query Parameters:
        - limit (int, default=10): Number of suggestions to return
    
    Response (200 OK):
        [
            {
                "group_id": 5,
                "name": "CSE Study Group",
                "description": "Study group for CSE students",
                "cover_image": "path/to/image.jpg",
                "members_count": 30,
                "is_private": false,
                "common_members_count": 5
            }
        ]
    
    Database Operations:
        - Calls get_suggested_groups() function
        - Suggests public groups user hasn't joined
        - Considers common members with user's following
    
    Notes:
        - Only suggests public groups
        - Prioritizes groups with mutual connections
        - Excludes groups user already joined
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        limit = int(request.GET.get('limit', 10))
        result = DatabaseManager.execute_function('get_suggested_groups', (request.user.id, limit))
        return Response(result)

class SearchGroupsView(APIView):
    """
    Search groups by name or description.
    
    API Endpoint: GET /api/groups/search/
    Authentication: Required (JWT Token)
    
    Query Parameters:
        - q (str, required): Search term
        - limit (int, default=20): Maximum results to return
    
    Response (200 OK):
        [
            {
                "group_id": 3,
                "name": "BUET Photography",
                "description": "Photography enthusiasts group",
                "cover_image": "path/to/image.jpg",
                "members_count": 42,
                "is_private": false,
                "admin_name": "John Doe"
            }
        ]
    
    Response (400 Bad Request):
        {"error": "Search term is required"}
    
    Database Operations:
        - Calls search_groups() function
        - Searches name and description (case-insensitive)
        - Orders by relevance and popularity
    
    Notes:
        - Results ranked by match quality
        - Exact matches ranked higher
        - Popular groups (more members) ranked higher
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        search_term = (
            request.GET.get('q')
            or request.GET.get('query')
            or request.GET.get('search')
            or ''
        ).strip()
        if not search_term:
            return Response({'error': 'Search term is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        limit = int(request.GET.get('limit', 20))
        result = DatabaseManager.execute_function('search_groups', (search_term, limit))
        return Response({'results': result or []})

class GroupActivityView(APIView):
    """
    Get activity summary for a group.
    
    API Endpoint: GET /api/groups/<group_id>/activity/
    Authentication: Required (JWT Token)
    Authorization: Group members only (for private groups)
    
    Query Parameters:
        - days (int, default=30): Number of days to analyze
    
    Response (200 OK):
        {
            "posts_count": 25,
            "active_members_count": 12,
            "new_members_count": 5,
            "total_likes": 145,
            "total_comments": 68
        }
    
    Response (403 Forbidden):
        {"error": "You must be a member to view activity in this private group"}
    
    Database Operations:
        - Verifies membership for private groups
        - Calls get_group_activity() function
        - Analyzes activity for specified time period
    
    Notes:
        - Useful for group admins to track engagement
        - Shows new member growth
        - Displays content engagement metrics
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, group_id):
        # Check if group is private and user is member
        group_query = "SELECT is_private FROM groups WHERE id = %s"
        group_result = DatabaseManager.execute_query(group_query, (group_id,))
        
        if not group_result:
            return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if group_result[0]['is_private']:
            member_query = """
            SELECT 1 FROM group_members 
            WHERE group_id = %s AND user_id = %s AND status = 'accepted'
            """
            member_result = DatabaseManager.execute_query(member_query, (group_id, request.user.id))
            if not member_result:
                return Response(
                    {'error': 'You must be a member to view activity in this private group'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        days = int(request.GET.get('days', 30))
        result = DatabaseManager.execute_function('get_group_activity', (group_id, days))
        return Response(result[0] if result else {})

class TransferAdminView(APIView):
    """
    Transfer admin rights to another member (Current Admin only).
    
    API Endpoint: POST /api/groups/<group_id>/transfer-admin/
    Authentication: Required (JWT Token)
    Authorization: Current Admin only
    
    Request Body:
        {
            "new_admin_id": 15
        }
    
    Response (200 OK):
        {"message": "Admin rights transferred successfully"}
    
    Response (400 Bad Request):
        {
            "error": "New admin must be an accepted member" 
            OR "Transfer failed"
        }
    
    Database Operations:
        - Calls transfer_group_admin() function
        - Verifies new admin is accepted member
        - Updates group admin_id
        - Changes roles in group_members
    
    Notes:
        - Only current admin can transfer rights
        - New admin must be accepted member
        - Old admin becomes regular member
        - New admin's role becomes 'admin'
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, group_id):
        new_admin_id = request.data.get('new_admin_id')
        if not new_admin_id:
            return Response({'error': 'new_admin_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        result = DatabaseManager.execute_function(
            'transfer_group_admin',
            (group_id, request.user.id, new_admin_id)
        )
        
        if result and result[0].get('transfer_group_admin'):
            return Response({'message': 'Admin rights transferred successfully'})
        return Response({'error': 'Transfer failed. You must be admin and new admin must be a member.'}, 
                       status=status.HTTP_400_BAD_REQUEST)

class PromoteToModeratorView(APIView):
    """
    Promote a member to moderator role (Admin only).
    
    API Endpoint: POST /api/groups/<group_id>/promote/<user_id>/
    Authentication: Required (JWT Token)
    Authorization: Admin only
    
    Response (200 OK):
        {"message": "Member promoted to moderator"}
    
    Response (400 Bad Request):
        {"error": "Promotion failed"}
    
    Database Operations:
        - Calls promote_to_moderator() function
        - Verifies current user is admin
        - Updates member role to 'moderator'
    
    Notes:
        - Only admin can promote members
        - Target must be accepted member
        - Moderators can accept join requests and remove members
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, group_id, user_id):
        result = DatabaseManager.execute_function(
            'promote_to_moderator',
            (group_id, request.user.id, user_id)
        )
        
        if result and result[0].get('promote_to_moderator'):
            return Response({'message': 'Member promoted to moderator'})
        return Response({'error': 'Promotion failed. You must be admin.'}, 
                       status=status.HTTP_400_BAD_REQUEST)

class DemoteModeratorView(APIView):
    """
    Demote a moderator to regular member (Admin only).
    
    API Endpoint: POST /api/groups/<group_id>/demote/<user_id>/
    Authentication: Required (JWT Token)
    Authorization: Admin only
    
    Response (200 OK):
        {"message": "Moderator demoted to member"}
    
    Response (400 Bad Request):
        {"error": "Demotion failed"}
    
    Database Operations:
        - Calls demote_moderator() function
        - Verifies current user is admin
        - Updates moderator role to 'member'
    
    Notes:
        - Only admin can demote moderators
        - Target must currently be a moderator
        - Loses moderator privileges
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, group_id, user_id):
        result = DatabaseManager.execute_function(
            'demote_moderator',
            (group_id, request.user.id, user_id)
        )
        
        if result and result[0].get('demote_moderator'):
            return Response({'message': 'Moderator demoted to member'})
        return Response({'error': 'Demotion failed. You must be admin and target must be moderator.'}, 
                       status=status.HTTP_400_BAD_REQUEST)
