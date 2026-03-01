from django.urls import path
from .views import (
    CreateBloodRequestView, BloodRequestDetailView, ActiveBloodRequestsView,
    CreateTuitionPostView, TuitionPostDetailView, ActiveTuitionPostsView
)
from .extended_views import (
    UpdateBloodRequestStatusView, SearchBloodRequestsByLocationView,
    UserBloodRequestsView, UpdateTuitionPostStatusView,
    SearchTuitionPostsView, UserTuitionPostsView,
    TuitionStatsBySubjectView
)

urlpatterns = [
    path('blood/create/', CreateBloodRequestView.as_view()),
    path('blood/<int:request_id>/', BloodRequestDetailView.as_view()),
    path('blood/<int:request_id>/status/', UpdateBloodRequestStatusView.as_view()),
    path('blood/', ActiveBloodRequestsView.as_view()),
    path('blood/search/location/', SearchBloodRequestsByLocationView.as_view()),
    path('blood/my-requests/', UserBloodRequestsView.as_view()),
    
    path('tuition/create/', CreateTuitionPostView.as_view()),
    path('tuition/<int:post_id>/', TuitionPostDetailView.as_view()),
    path('tuition/<int:post_id>/status/', UpdateTuitionPostStatusView.as_view()),
    path('tuition/', ActiveTuitionPostsView.as_view()),
    path('tuition/search/', SearchTuitionPostsView.as_view()),
    path('tuition/my-posts/', UserTuitionPostsView.as_view()),
    path('tuition/stats/subjects/', TuitionStatsBySubjectView.as_view()),
]