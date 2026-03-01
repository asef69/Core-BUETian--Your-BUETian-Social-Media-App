from django.urls import path
from .views import (
    NotificationsListView, UnreadNotificationsView,
    NotificationCountView, MarkNotificationReadView, MarkAllReadView
)
from .extended_views import (
    NotificationSummaryView, MarkNotificationsByTypeView,
    ActivityNotificationsView, DeleteNotificationView,
    ClearAllNotificationsView, NotificationPreferencesView
)

urlpatterns = [
    path('', NotificationsListView.as_view()),
    path('unread/', UnreadNotificationsView.as_view()),
    path('count/', NotificationCountView.as_view()),
    path('summary/', NotificationSummaryView.as_view()),
    path('activity/', ActivityNotificationsView.as_view()),
    
    path('<int:notification_id>/read/', MarkNotificationReadView.as_view()),
    path('<int:notification_id>/', DeleteNotificationView.as_view()),
    
    path('read-all/', MarkAllReadView.as_view()),
    path('mark-read/<str:notification_type>/', MarkNotificationsByTypeView.as_view()),
    path('clear/', ClearAllNotificationsView.as_view()),
    
    path('preferences/', NotificationPreferencesView.as_view()),
]