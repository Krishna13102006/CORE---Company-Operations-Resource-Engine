from django.urls import path
from . import views

urlpatterns = [
    path('public/',           views.OrganizationPublicListView.as_view()),
    path('me/',               views.OrgDetailView.as_view()),
    path('settings/',         views.OrgSettingsView.as_view()),
    path('governance-stats/', views.GovernanceStatsView.as_view()),
    path('document-vault/',   views.DocumentVaultListView.as_view()),
    path('schema/',           views.SchemaMetadataView.as_view(), name='database-schema'),
    path('execute-sql/',      views.ExecuteSQLView.as_view(), name='execute-sql'),
    path('purge-test-storage/', views.PurgeTestStorageView.as_view(), name='purge-test-storage'),

    # Organization Invitations & Magic Link Onboarding
    path('invitations/',                   views.InvitationListCreateView.as_view(), name='invitation-list-create'),
    path('invitations/<uuid:pk>/resend/',  views.InvitationResendView.as_view(),     name='invitation-resend'),
    path('invitations/<uuid:pk>/revoke/',  views.InvitationRevokeView.as_view(),     name='invitation-revoke'),
    path('invitations/verify/',            views.InvitationVerifyView.as_view(),     name='invitation-verify'),
    path('invitations/accept/',            views.InvitationAcceptView.as_view(),     name='invitation-accept'),
]

