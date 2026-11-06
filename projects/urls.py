from django.urls import path
from . import views

urlpatterns = [
    # AI & Integration endpoints
    path('ai/breakdown/',                       views.AITaskBreakdownView.as_view()),
    path('meetings/action-items/',              views.MeetingActionItemsListView.as_view()),
    path('meetings/import-action-item/',        views.ImportMeetingActionItemView.as_view()),
    path('import/',                             views.ProjectImportView.as_view()),

    # Project endpoints
    path('',                                    views.ProjectListView.as_view()),
    path('<uuid:project_id>/',                  views.ProjectDetailView.as_view()),
    path('<uuid:project_id>/tasks/',            views.ProjectTaskListView.as_view()),
    path('<uuid:project_id>/ai/sprint-summary/', views.AISprintSummaryView.as_view()),

    # Task endpoints
    path('tasks/mine/',                         views.MyTasksView.as_view()),
    path('tasks/<uuid:task_id>/',               views.TaskDetailView.as_view()),
    path('tasks/<uuid:task_id>/comments/',      views.TaskCommentView.as_view()),
    path('tasks/<uuid:task_id>/activity/',      views.TaskActivityListView.as_view()),
    path('tasks/<uuid:task_id>/subtasks/',      views.TaskSubtaskListView.as_view()),
    path('subtasks/<uuid:subtask_id>/',         views.SubtaskDetailView.as_view()),
]

