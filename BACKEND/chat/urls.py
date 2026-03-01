from django.urls import path

from chat.message_view import MarkAsReadView
from .views import (
    ConversationListView, MessageListView, SendMessageView,
    UploadChatImageView, UploadChatVideoView, SendMessageWithImageView
)
from .message_view import (
    ConversationView, RecentConversationsView)
from .extended_views import (
    UnreadMessagesCountView, TotalUnreadMessagesView,
    SearchMessagesView, DeleteConversationView,
    MarkConversationReadView, UserMessageStatsView,
    ConversationParticipantsView, CanSendMessageView
)


urlpatterns = [
    path('conversations/', ConversationListView.as_view(), name='conversations'),
    path('messages/<int:other_user_id>/', MessageListView.as_view(), name='messages'),
    path('send/', SendMessageView.as_view(), name='send_message'),
    path('upload-image/', UploadChatImageView.as_view(), name='upload_chat_image'),
    path('upload-video/', UploadChatVideoView.as_view(), name='upload_chat_video'),
    path('send-with-image/', SendMessageWithImageView.as_view(), name='send_with_image'),
    path('messages/send/', SendMessageView.as_view()),
    path('messages/conversation/<int:user_id>/', ConversationView.as_view()),
    path('messages/conversations/', RecentConversationsView.as_view()),
    path('messages/<int:message_id>/read/', MarkAsReadView.as_view()),
    
    path('unread/count/', UnreadMessagesCountView.as_view()),
    path('unread/total/', TotalUnreadMessagesView.as_view()),
    path('search/', SearchMessagesView.as_view()),
    path('conversation/<int:user_id>/delete/', DeleteConversationView.as_view()),
    path('conversation/<int:user_id>/read/', MarkConversationReadView.as_view()),
    path('conversation/<int:user_id>/participants/', ConversationParticipantsView.as_view()),
    path('stats/', UserMessageStatsView.as_view()),
    path('can-message/<int:user_id>/', CanSendMessageView.as_view()),

]

