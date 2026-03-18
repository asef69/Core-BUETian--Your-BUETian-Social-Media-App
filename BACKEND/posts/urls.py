from django.urls import path
from .views import (
    CreatePostView, UserFeedView, PostDetailView,
    LikePostView, CommentView, TrendingPostsView,
    UploadPostMediaView, CreatePostWithMediaView, PublicFeedView,
)
from .extended_views import (
    LikeCommentView, PostsByHashtagView, UserLikedPostsView, PostEngagementStatsView,
    TrendingHashtagsView, PostsByMediaTypeView, SearchPostsView,
    DeleteCommentView, UpdateCommentView,LikeCommentView
)

urlpatterns = [
    path('create/', CreatePostView.as_view()),
    path('create-with-media/', CreatePostWithMediaView.as_view()),
    path('upload-media/', UploadPostMediaView.as_view()),
    path('feed/', UserFeedView.as_view()),
    path('public/', PublicFeedView.as_view()),
    path('trending/', TrendingPostsView.as_view()),
    path('search/', SearchPostsView.as_view()),
    
    path('<int:post_id>/', PostDetailView.as_view()),
    path('<int:post_id>/like/', LikePostView.as_view()),
    path('<int:post_id>/comments/', CommentView.as_view()),
    path('<int:post_id>/engagement/', PostEngagementStatsView.as_view()),
    
    path('hashtag/<str:hashtag>/', PostsByHashtagView.as_view()),
    path('hashtags/trending/', TrendingHashtagsView.as_view()),
    path('media/<str:media_type>/', PostsByMediaTypeView.as_view()),
    path('liked/<str:user_id>/', UserLikedPostsView.as_view()),
    
    path('comments/<int:comment_id>/', UpdateCommentView.as_view()),
    path('comments/<int:comment_id>/delete/', DeleteCommentView.as_view()),
    path('comments/<int:comment_id>/like/', LikeCommentView.as_view()),
]