import utils.converters  # noqa: F401  (registers <posint:...>)
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
    path('<posint:group_id>/', GroupDetailView.as_view(), name='group-detail'),
    path('<posint:group_id>/update/', UpdateGroupView.as_view(), name='update-group'),
    path('<posint:group_id>/delete/', DeleteGroupView.as_view(), name='delete-group'),
    
    # Membership management
    path('<posint:group_id>/members/', GroupMembersView.as_view(), name='group-members'),
    path('<posint:group_id>/pending/', PendingMembersView.as_view(), name='pending-members'),
    path('<posint:group_id>/join/', JoinGroupView.as_view(), name='join-group'),
    path('<posint:group_id>/leave/', LeaveGroupView.as_view(), name='leave-group'),
    path('<posint:group_id>/accept/<posint:user_id>/', AcceptGroupMemberView.as_view(), name='accept-member'),
    path('<posint:group_id>/reject/<posint:user_id>/', RejectGroupMemberView.as_view(), name='reject-member'),
    path('<posint:group_id>/invite/', InviteGroupMemberView.as_view(), name='invite-member'),
    path('<posint:group_id>/members/<posint:user_id>/', RemoveGroupMemberView.as_view(), name='remove-member'),
    path('<posint:group_id>/invited/', InvitedMembersView.as_view(), name='invited-members'),
    path('<posint:group_id>/cancel-invite/<posint:user_id>/', CancelGroupInvite.as_view(), name='cancel-invite'),
    path('invites/', UserGroupInvitesView.as_view(), name='user-group-invites'),
    path('<posint:group_id>/accept/', AcceptGroupInviteView.as_view(), name='accept-group-invite'),
    path('<posint:group_id>/reject/', RejectGroupInviteView.as_view(), name='reject-group-invite'),
    
    # Role management
    path('<posint:group_id>/transfer-admin/', TransferAdminView.as_view(), name='transfer-admin'),
    path('<posint:group_id>/promote/<posint:user_id>/', PromoteToModeratorView.as_view(), name='promote-moderator'),
    path('<posint:group_id>/demote/<posint:user_id>/', DemoteModeratorView.as_view(), name='demote-moderator'),
    
    # Group posts
    path('<posint:group_id>/posts/', GroupPostsView.as_view(), name='group-posts'),
    path('<posint:group_id>/posts/create/', CreateGroupPostView.as_view(), name='create-group-post'),
    
    # Discovery and activity
    path('my-groups/', UserGroupsView.as_view(), name='user-groups'),
    path('suggested/', SuggestedGroupsView.as_view(), name='suggested-groups'),
    path('search/', SearchGroupsView.as_view(), name='search-groups'),
    path('<posint:group_id>/activity/', GroupActivityView.as_view(), name='group-activity'),
    path('<posint:group_id>/nonmember/', GroupDetailView.as_view(), name='nonmember-group')
]