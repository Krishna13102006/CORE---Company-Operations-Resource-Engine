from django.urls import path
from . import views

urlpatterns = [
    # Stats
    path('stats/',
         views.HiringStatsView.as_view()),

    # Job postings
    path('jobs/',
         views.JobPostingListView.as_view()),
    path('jobs/<uuid:job_id>/',
         views.JobPostingDetailView.as_view()),
    path('jobs/<uuid:job_id>/applications/',
         views.ApplicationListView.as_view()),

    # Applications
    path('applications/<uuid:application_id>/',
         views.ApplicationDetailView.as_view()),
    path('applications/<uuid:application_id>/stage/',
         views.ApplicationStageView.as_view()),
    path('applications/<uuid:application_id>/notes/',
         views.InterviewNoteView.as_view()),
    path('applications/<uuid:application_id>/interviews/',
         views.InterviewScheduleView.as_view()),
    path('applications/<uuid:application_id>/interviews/<uuid:schedule_id>/',
         views.InterviewScheduleDetailView.as_view()),
    path('applications/<uuid:application_id>/interviews/<uuid:schedule_id>/ics/',
         views.InterviewScheduleICSView.as_view()),
    path('applications/<uuid:application_id>/scorecards/',
         views.ScorecardView.as_view()),

    # Candidates & Resumes
    path('candidates/<uuid:candidate_id>/',
         views.CandidateDetailView.as_view()),
    path('candidates/<uuid:candidate_id>/resume/',
         views.ResumeDownloadView.as_view()),
    path('applications/<uuid:application_id>/match/',
         views.ResumeMatchView.as_view()),
    path('jobs/<uuid:job_id>/chat/',
         views.JobChatView.as_view()),
    path('jobs/<uuid:job_id>/bulk-upload/',
         views.BulkUploadView.as_view()),

    # Email communication
    path('email-templates/',
         views.EmailTemplateListView.as_view()),
    path('applications/<uuid:application_id>/emails/',
         views.EmailLogView.as_view()),
    path('applications/<uuid:application_id>/emails/send/',
         views.EmailComposeView.as_view()),
    path('applications/<uuid:application_id>/emails/simulate-reply/',
         views.SimulateInboundReplyView.as_view()),
    path('inbound/',
         views.InboundEmailWebhookView.as_view(), name='hiring-inbound-email'),
    path('emails/inbound/',
         views.InboundEmailWebhookView.as_view()),

    # Custom Job Pipeline Stages
    path('jobs/<uuid:job_id>/stages/',
         views.JobPostingStagesView.as_view()),

    # Self-Service Interview Invitations
    path('applications/<uuid:application_id>/invitations/',
         views.InterviewInvitationListCreateView.as_view()),
    path('invitations/<uuid:token>/',
         views.PublicInterviewInvitationDetailView.as_view()),
    path('invitations/<uuid:token>/book/',
         views.PublicInterviewBookingView.as_view()),

    # Offers
    path('applications/<uuid:application_id>/offer/',
         views.OfferDetailView.as_view()),
    path('applications/<uuid:application_id>/offer/pdf/',
         views.OfferPDFDownloadView.as_view()),
    path('applications/<uuid:application_id>/offer/send-email/',
         views.OfferEmailSendView.as_view()),
    path('applications/<uuid:application_id>/offer/extend/',
         views.OfferExtendView.as_view()),
    path('applications/<uuid:application_id>/offer/respond/',
         views.OfferRespondView.as_view()),

    # Onboarding & AI Interview Tools
    path('applications/<uuid:application_id>/onboard/',
         views.ApplicationOnboardView.as_view()),
    path('applications/<uuid:application_id>/generate-questions/',
         views.ApplicationGenerateQuestionsView.as_view()),

    # Public Careers Portal
    path('public/careers/<str:slug>/',
         views.PublicCareersPortalView.as_view()),
    path('public/careers/<str:slug>/jobs/<uuid:job_id>/',
         views.PublicJobDetailView.as_view()),
    path('public/careers/<str:slug>/jobs/<uuid:job_id>/apply/',
         views.PublicJobApplyView.as_view()),

    # Analytics
    path('analytics/',
         views.AnalyticsView.as_view()),
    path('jobs/<uuid:job_id>/analytics/',
         views.AnalyticsView.as_view()),
]
