from django.urls import path
from .views import (
    RejectGroupMemberView, CreateGroupView, GroupDetailView, GroupMembersView,
    JoinGroupView, AcceptGroupMemberView, InviteGroupMemberView, LeaveGroupView,
    RemoveGroupMemberView, UpdateGroupView, DeleteGroupView,
    GroupPostsView, CreateGroupPostView, PendingMembersView,
    UserGroupsView, SuggestedGroupsView, SearchGroupsView,
    GroupActivityView, TransferAdminView, PromoteToModeratorView,
    DemoteModeratorView, CancelGroupInvite, InvitedMembersView, UserGroupInvitesView, AcceptGroupInviteView, RejectGroupInviteView
)

urlpatterns = [
    # Group management
    path('create/', CreateGroupView.as_view(), name='create-group'),
    path('<int:group_id>/', GroupDetailView.as_view(), name='group-detail'),
    path('<int:group_id>/update/', UpdateGroupView.as_view(), name='update-group'),
    path('<int:group_id>/delete/', DeleteGroupView.as_view(), name='delete-group'),
    
    # Membership management
    path('<int:group_id>/members/', GroupMembersView.as_view(), name='group-members'),
    path('<int:group_id>/pending/', PendingMembersView.as_view(), name='pending-members'),
    path('<int:group_id>/join/', JoinGroupView.as_view(), name='join-group'),
    path('<int:group_id>/leave/', LeaveGroupView.as_view(), name='leave-group'),
    path('<int:group_id>/accept/<int:user_id>/', AcceptGroupMemberView.as_view(), name='accept-member'),
    path('<int:group_id>/invite/', InviteGroupMemberView.as_view(), name='invite-member'),
    path('<int:group_id>/members/<int:user_id>/', RemoveGroupMemberView.as_view(), name='remove-member'),
    path('<int:group_id>/invited/', InvitedMembersView.as_view(), name='invited-members'),
    path('<int:group_id>/cancel-invite/<int:user_id>/', CancelGroupInvite.as_view(), name='cancel-invite'),
    path('invites/', UserGroupInvitesView.as_view(), name='user-group-invites'),
    path('<int:group_id>/accept/', AcceptGroupInviteView.as_view(), name='accept-group-invite'),
    path('<int:group_id>/reject/', RejectGroupInviteView.as_view(), name='reject-group-invite'),
    
    # Role management
    path('<int:group_id>/transfer-admin/', TransferAdminView.as_view(), name='transfer-admin'),
    path('<int:group_id>/promote/<int:user_id>/', PromoteToModeratorView.as_view(), name='promote-moderator'),
    path('<int:group_id>/demote/<int:user_id>/', DemoteModeratorView.as_view(), name='demote-moderator'),
    
    # Group posts
    path('<int:group_id>/posts/', GroupPostsView.as_view(), name='group-posts'),
    path('<int:group_id>/posts/create/', CreateGroupPostView.as_view(), name='create-group-post'),
    
    # Discovery and activity
    path('my-groups/', UserGroupsView.as_view(), name='user-groups'),
    path('suggested/', SuggestedGroupsView.as_view(), name='suggested-groups'),
    path('search/', SearchGroupsView.as_view(), name='search-groups'),
    path('<int:group_id>/activity/', GroupActivityView.as_view(), name='group-activity'),
    path('<int:group_id>/nonmember/', GroupDetailView.as_view(), name='nonmember-group')
]