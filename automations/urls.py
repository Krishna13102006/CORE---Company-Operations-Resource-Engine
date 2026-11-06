from django.urls import path
from .views import (
    PlaybookListView,
    PlaybookToggleView,
    PlaybookConfigView,
    PlaybookTestRunView,
    AutomationLogsListView,
    AutomationStatsView,
)

urlpatterns = [
    path('playbooks/', PlaybookListView.as_view(), name='playbook_list'),
    path('playbooks/<str:slug>/toggle/', PlaybookToggleView.as_view(), name='playbook_toggle'),
    path('playbooks/<str:slug>/config/', PlaybookConfigView.as_view(), name='playbook_config'),
    path('playbooks/<str:slug>/test-run/', PlaybookTestRunView.as_view(), name='playbook_test_run'),
    path('logs/', AutomationLogsListView.as_view(), name='automation_logs'),
    path('stats/', AutomationStatsView.as_view(), name='automation_stats'),
]
