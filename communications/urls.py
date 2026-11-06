from django.urls import path
from . import views

urlpatterns = [
    path('inbox/', views.InboxListView.as_view(), name='mail-inbox'),
    path('sent/', views.SentListView.as_view(), name='mail-sent'),
    path('compose/', views.MailComposeView.as_view(), name='mail-compose'),
    path('channels-meta/', views.BroadcastChannelsMetaView.as_view(), name='mail-channels-meta'),
    path('ai-compose/', views.AISmartComposeView.as_view(), name='mail-ai-compose'),
    path('convert-task/', views.AIConvertTaskView.as_view(), name='mail-convert-task'),
    path('messages/<uuid:pk>/', views.MailActionView.as_view(), name='mail-action'),
    path('messages/<uuid:pk>/acknowledge/', views.MailAcknowledgeView.as_view(), name='mail-acknowledge'),
    path('messages/<uuid:pk>/star/', views.MailStarToggleView.as_view(), name='mail-star-toggle'),
    path('messages/<uuid:pk>/archive/', views.MailArchiveToggleView.as_view(), name='mail-archive-toggle'),
    path('messages/<uuid:pk>/snooze/', views.MailSnoozeView.as_view(), name='mail-snooze'),
    path('messages/<uuid:pk>/ai-summary/', views.AIThreadSummaryView.as_view(), name='mail-ai-summary'),
    path('messages/<uuid:pk>/smart-replies/', views.AISmartRepliesView.as_view(), name='mail-smart-replies'),
    path('messages/<uuid:pk>/intent/', views.AIEmailIntentView.as_view(), name='mail-intent'),
    path('attachment/<uuid:pk>/', views.MailAttachmentDownloadView.as_view(), name='mail-attachment-download'),
    path('preferences/', views.MailPreferencesView.as_view(), name='mail-preferences'),
    path('templates/', views.EmailTemplatesView.as_view(), name='mail-templates'),
    path('ooo-check/', views.RecipientOOOCheckView.as_view(), name='mail-ooo-check'),
    path('translate/', views.AITranslateView.as_view(), name='mail-translate'),
    path('workgraph-card/', views.MailWorkGraphCardView.as_view(), name='mail-workgraph-card'),
    path('messages/<uuid:pk>/instant-meeting/', views.MailSpawnInstantMeetingView.as_view(), name='mail-instant-meeting'),
    path('presence/', views.MailUserPresenceView.as_view(), name='mail-presence'),
    path('verify-document-access/', views.MailVerifyDocumentAccessView.as_view(), name='mail-verify-doc-access'),
    path('grant-document-roles/', views.MailGrantDocumentRolesView.as_view(), name='mail-grant-doc-roles'),
]
