from django.urls import path
from .views import (
    UserProfileView, UpdateProfileView, FollowUserView,
    AcceptFollowView, SuggestedUsersView, MutualFollowersView,
    UserActivityView, UploadProfilePictureView
)
from .auth_views import RegisterView, LoginView, TokenRefreshView
from .extended_views import (
    UserFollowersView, UserFollowingView, PendingFollowRequestsView,
    RejectFollowRequestView, UserSearchView, UsersByDepartmentView,
    UsersByBloodGroupView, UserEngagementMetricsView, RemoveFollowerView, UserPostsView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    path('profile/<int:user_id>/', UserProfileView.as_view()),
    path('profile/update/', UpdateProfileView.as_view()),
    path('profile/upload-picture/', UploadProfilePictureView.as_view()),
    
    path('follow/<int:user_id>/', FollowUserView.as_view()),
    path('follow/accept/<int:follow_id>/', AcceptFollowView.as_view()),
    path('follow/reject/<int:follow_id>/', RejectFollowRequestView.as_view()),
    path('followers/remove/<int:follower_id>/', RemoveFollowerView.as_view()),
    path('follow-requests/pending/', PendingFollowRequestsView.as_view()),
    
    path('suggestions/', SuggestedUsersView.as_view()),
    path('mutual-followers/', MutualFollowersView.as_view()),
    path('activity/', UserActivityView.as_view()),
    
    path('<int:user_id>/followers/', UserFollowersView.as_view()),
    path('<int:user_id>/following/', UserFollowingView.as_view()),
    path('<int:user_id>/engagement/', UserEngagementMetricsView.as_view()),
    path('<int:user_id>/posts/', UserPostsView.as_view()),
    
    path('search/', UserSearchView.as_view()),
    path('department/<str:department_name>/', UsersByDepartmentView.as_view()),
    path('blood-group/<str:blood_group>/', UsersByBloodGroupView.as_view()),
]