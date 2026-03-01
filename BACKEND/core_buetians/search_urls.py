from django.urls import path
from .search_views import (
    SearchUsersView, SearchPostsView, SearchGroupsView, GlobalSearchView
)

urlpatterns = [
    path('users/', SearchUsersView.as_view()),
    path('posts/', SearchPostsView.as_view()),
    path('groups/', SearchGroupsView.as_view()),
    path('global/', GlobalSearchView.as_view()),
]