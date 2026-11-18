import utils.converters  # noqa: F401  (registers <posint:...>)
from django.urls import path
from .blog_views import (
    CreateBlogPostView, BlogPostDetailView, PublishedBlogsView,
    LikeBlogView, BlogCommentsView, BlogPostViewTrackView, LikeBlogCommentView,
    UpdateBlogPostView, DeleteBlogPostView
)

urlpatterns = [
    path('create/', CreateBlogPostView.as_view()),
    path('<posint:blog_id>/', BlogPostDetailView.as_view()),
    path('<posint:blog_id>/update/', UpdateBlogPostView.as_view()),
    path('<posint:blog_id>/delete/', DeleteBlogPostView.as_view()),
    path('<posint:blog_id>/view/', BlogPostViewTrackView.as_view()),
    path('', PublishedBlogsView.as_view()),
    path('<posint:blog_id>/like/', LikeBlogView.as_view()),
    path('<posint:blog_id>/comments/', BlogCommentsView.as_view()),
    path('comments/<posint:comment_id>/like/', LikeBlogCommentView.as_view()),
]