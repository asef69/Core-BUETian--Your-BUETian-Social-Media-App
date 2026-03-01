from rest_framework import permissions
from utils.database import DatabaseManager

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to allow read access to anyone, but write access only to the owner.
    
    Usage:
        Apply to views where users should be able to read content but only modify their own.
    
    Permission Logic:
        - GET, HEAD, OPTIONS requests: Always allowed (SAFE_METHODS)
        - POST, PUT, PATCH, DELETE requests: Only allowed if user_id matches requester
    
    Example:
        class UpdatePostView(APIView):
            permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    
    Methods:
        has_object_permission(request, view, obj):
            Checks if user owns the object being accessed.
            
            Args:
                request: The HTTP request
                view: The view being accessed
                obj (dict): Object containing 'user_id' field
            
            Returns:
                bool: True if safe method or user owns object, False otherwise
    """
    def has_object_permission(self,request,view,obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.get('user_id')==request.user.id
    

class IsGroupMember(permissions.BasePermission):
    """
    Custom permission to check if user is an accepted member of a group.
    
    Usage:
        Apply to group-related views where only members should have access.
    
    Permission Logic:
        - Checks if user is in group_members table with status='accepted'
        - Uses is_group_member() database function
        - Returns True if no group_id specified (for non-group operations)
    
    Example:
        class GroupPostsView(APIView):
            permission_classes = [IsAuthenticated, IsGroupMember]
    
    Methods:
        has_permission(request, view):
            Checks if user is accepted member of the group.
            
            Args:
                request: The HTTP request containing user info
                view: The view being accessed (must have group_id in kwargs or request.data)
            
            Returns:
                bool: True if no group_id or user is accepted member, False otherwise
            
            Database:
                Calls: is_group_member(user_id, group_id)
                Returns: Boolean indicating membership status
    """
    def has_permission(self,request,view): # type: ignore
        group_id=view.kwargs.get('group_id') or request.data.get('group_id')
        if not group_id:
            return True
        
        result=DatabaseManager.execute_function(
            'is_group_member',
            (request.user.id,group_id)
        )
        return result[0]['is_group_member'] if result else False
