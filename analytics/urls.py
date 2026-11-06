from django.urls import path
from . import views

urlpatterns = [
    path('overview/',  views.OverviewStatsView.as_view()),
    path('knowledge/', views.KnowledgeAnalyticsView.as_view()),
    path('projects/',  views.ProjectsAnalyticsView.as_view()),
    path('teams/',     views.TeamsAnalyticsView.as_view()),
    path('hiring/',    views.HiringAnalyticsView.as_view()),
    path('activity/',  views.RecentActivityView.as_view()),
    # path('candidates/<uuid:job_id>/ranking/',  views.CandidateRankingView.as_view()),
    # path('attrition/',                          views.AttritionRiskView.as_view()),
    # path('project-risks/',                      views.ProjectRiskView.as_view()),
]
