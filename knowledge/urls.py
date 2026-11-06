from django.urls import path
from . import views

urlpatterns = [
    # Admin panel endpoints — IsAdmin permission
    path('documents/',
         views.DocumentListView.as_view()),
    path('documents/upload/',
         views.DocumentUploadView.as_view()),
    path('documents/stats/',
         views.DocumentStatsView.as_view()),
    path('documents/<str:document_id>/',
         views.DocumentDetailView.as_view()),
    path('documents/<str:document_id>/reprocess/',
         views.DocumentReprocessView.as_view()),

    # Knowledge panel endpoints — IsEmployee permission
    path('upload/',
         views.KnowledgeUploadView.as_view()),
    path('stats/',
         views.KnowledgeStatsView.as_view()),
    path('documents/<str:document_id>/download/',
         views.DocumentDownloadView.as_view()),
    path('documents/<str:document_id>/content/',
         views.DocumentContentView.as_view()),
    path('documents/<str:document_id>/pages/<int:page_index>/',
         views.DocumentPageView.as_view()),

    # Phase 3 — AI endpoints
    path('search/',
         views.SemanticSearchView.as_view()),
    path('ask/',
         views.RAGAskView.as_view()),
    path('ask-stream/',
         views.RAGStreamView.as_view()),
    path('documents/<str:document_id>/recommendations/',
         views.DocumentRecommendationsView.as_view()),
    path('articles/',
         views.ArticleAPIView.as_view()),
    path('articles/<str:document_id>/',
         views.ArticleAPIView.as_view()),
    path('wiki/article/',
         views.ArticleCreateOrUpdateView.as_view()),
    path('documents/<str:document_id>/summary/',
         views.DocumentSummaryView.as_view()),
    path('audio/upload/',
         views.AudioUploadView.as_view()),
    path('connectors/',
         views.CloudConnectorListView.as_view()),
    path('connectors/<str:connector_id>/sync/',
         views.CloudConnectorSyncView.as_view()),
    path('connectors/<str:connector_id>/',
         views.CloudConnectorDeleteView.as_view()),
]
