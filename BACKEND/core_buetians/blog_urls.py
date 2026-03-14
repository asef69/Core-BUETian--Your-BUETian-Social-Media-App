from django.urls import path
from .blog_views import (
    CreateBlogPostView, BlogPostDetailView, PublishedBlogsView,
    LikeBlogView, BlogCommentsView, BlogPostViewTrackView
)

urlpatterns = [
    path('create/', CreateBlogPostView.as_view()),
    path('<int:blog_id>/', BlogPostDetailView.as_view()),
    path('<int:blog_id>/view/', BlogPostViewTrackView.as_view()),
    path('', PublishedBlogsView.as_view()),
    path('<int:blog_id>/like/', LikeBlogView.as_view()),
    path('<int:blog_id>/comments/', BlogCommentsView.as_view()),
]