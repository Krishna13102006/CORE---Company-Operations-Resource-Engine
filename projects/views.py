from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from core.permissions import IsEmployee, IsManager
from core.exceptions import ServiceError
from core.pagination import StandardPagination
from core.audit import log_action
from .services import ProjectService, TaskService
from .serializers import (
    ProjectSerializer, ProjectCreateSerializer, ProjectUpdateSerializer,
    TaskSerializer, TaskCreateSerializer, TaskUpdateSerializer,
    TaskCommentCreateSerializer, SubtaskSerializer, SubtaskCreateSerializer
)

project_service = ProjectService()
task_service    = TaskService()


class ProjectListView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        filters = {
            'status': request.query_params.get('status'),
            'search': request.query_params.get('search'),
            'owner':  request.query_params.get('owner'),
        }
        filters  = {k: v for k, v in filters.items() if v}
        projects = project_service.list_projects(request.org_id, request.user, filters)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(projects, request)
        return paginator.get_paginated_response(
            ProjectSerializer(page, many=True, context={'request': request}).data
        )

    def post(self, request):
        serializer = ProjectCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            project = project_service.create_project(
                org_id=request.org_id,
                user=request.user,
                name=d['name'],
                description=d.get('description', ''),
                status=d.get('status', 'planning'),
                start_date=d.get('start_date'),
                end_date=d.get('end_date'),
                owner_id=d.get('owner'),
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='create_project',
                target_type='project',
                target_id=project.id,
                detail=f'Created project: {project.name}'
            )
            return Response(
                ProjectSerializer(project).data,
                status=status.HTTP_201_CREATED
            )
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ProjectDetailView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, project_id):
        try:
            project = project_service.get_project(str(project_id), request.org_id, user=request.user)
            return Response(ProjectSerializer(project, context={'request': request}).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def patch(self, request, project_id):
        serializer = ProjectUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            project = project_service.update_project(
                project_id=str(project_id),
                org_id=request.org_id,
                user=request.user,
                **serializer.validated_data
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='update_project',
                target_type='project',
                target_id=project_id,
                detail=f'Updated project: {project.name}'
            )
            return Response(ProjectSerializer(project).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def delete(self, request, project_id):
        try:
            project_service.delete_project(
                str(project_id), request.org_id, request.user
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='delete_project',
                target_type='project',
                target_id=project_id,
                detail=f'Deleted project ID: {project_id}'
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class MyTasksView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        filters = {
            'status': request.query_params.get('status'),
        }
        filters = {k: v for k, v in filters.items() if v}
        tasks   = task_service.list_my_tasks(
            request.user.id, request.org_id, filters
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(tasks, request)
        return paginator.get_paginated_response(
            TaskSerializer(page, many=True).data
        )


class ProjectTaskListView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, project_id):
        try:
            # Verify project exists and belongs to org
            project_service.get_project(str(project_id), request.org_id, user=request.user)
            tasks = task_service.list_tasks_for_project(
                str(project_id), request.org_id, user=request.user
            )
            return Response(TaskSerializer(tasks, many=True).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def post(self, request, project_id):
        serializer = TaskCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            task = task_service.create_task(
                project_id=str(project_id),
                org_id=request.org_id,
                user=request.user,
                title=d['title'],
                description=d.get('description', ''),
                status=d.get('status', 'todo'),
                priority=d.get('priority', 'medium'),
                due_date=d.get('due_date'),
                assignee_id=d.get('assignee'),
                start_date=d.get('start_date'),
                is_milestone=d.get('is_milestone', False),
                depends_on_id=d.get('depends_on'),
                tags=d.get('tags'),
                epic=d.get('epic', ''),
                estimated_hours=d.get('estimated_hours'),
                logged_hours=d.get('logged_hours'),
                linked_document_id=d.get('linked_document'),
                linked_meeting_id=d.get('linked_meeting'),
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='create_task',
                target_type='task',
                target_id=task.id,
                detail=f'Created task: {task.title}'
            )
            return Response(
                TaskSerializer(task).data,
                status=status.HTTP_201_CREATED
            )
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)



class TaskDetailView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, task_id):
        try:
            task = task_service.get_task(str(task_id), request.org_id)
            return Response(TaskSerializer(task).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def patch(self, request, task_id):
        serializer = TaskUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            original_task = task_service.get_task(str(task_id), request.org_id)
            old_status = original_task.status
            old_assignee_id = str(original_task.assignee_id) if original_task.assignee_id else None
            old_title = original_task.title

            task = task_service.update_task(
                task_id=str(task_id),
                org_id=request.org_id,
                user=request.user,
                **serializer.validated_data
            )

            changes = []
            if 'status' in serializer.validated_data and serializer.validated_data['status'] and old_status != task.status:
                changes.append(f"changed status from '{old_status}' to '{task.status}'")
            if 'assignee' in serializer.validated_data and old_assignee_id != (str(task.assignee_id) if task.assignee_id else None):
                new_assignee_name = f'{task.assignee.first_name} {task.assignee.last_name}' if task.assignee else 'Unassigned'
                changes.append(f"reassigned task to {new_assignee_name}")
            if 'title' in serializer.validated_data and serializer.validated_data['title'] and old_title != task.title:
                changes.append(f"renamed task to '{task.title}'")

            detail = f"Updated task: {', '.join(changes)}" if changes else "Updated task configuration"

            log_action(
                org_id=request.org_id,
                user=request.user,
                action='update_task',
                target_type='task',
                target_id=task_id,
                detail=detail
            )
            return Response(TaskSerializer(task).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def delete(self, request, task_id):
        try:
            task_service.delete_task(str(task_id), request.org_id, request.user)
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='delete_task',
                target_type='task',
                target_id=task_id,
                detail=f'Deleted task ID: {task_id}'
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class TaskCommentView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, task_id):
        serializer = TaskCommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from core.sanitizers import sanitize_html
        clean_content = sanitize_html(serializer.validated_data['content'])
        try:
            comment = task_service.add_comment(
                task_id=str(task_id),
                org_id=request.org_id,
                user=request.user,
                content=clean_content
            )
            return Response({
                'id':          str(comment.id),
                'content':     comment.content,
                'author_name': f'{comment.author.first_name} {comment.author.last_name}',
                'created_at':  comment.created_at.isoformat(),
            }, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class TaskActivityListView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, task_id):
        from core.models import AuditLog
        logs = AuditLog.objects.filter(
            org_id=request.org_id,
            target_type='task',
            target_id=str(task_id)
        ).order_by('-created_at')

        data = [{
            'id': str(log.id),
            'actor_name': f'{log.actor.first_name} {log.actor.last_name}' if log.actor else 'System',
            'action': log.action,
            'detail': log.detail,
            'created_at': log.created_at.isoformat(),
        } for log in logs]

        return Response(data)


class TaskSubtaskListView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, task_id):
        serializer = SubtaskCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            subtask = task_service.add_subtask(
                task_id=str(task_id),
                org_id=request.org_id,
                user=request.user,
                title=serializer.validated_data['title']
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='add_subtask',
                target_type='task',
                target_id=task_id,
                detail=f"Added subtask: '{subtask.title}'"
            )
            return Response(SubtaskSerializer(subtask).data, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class SubtaskDetailView(APIView):
    permission_classes = [IsEmployee]

    def patch(self, request, subtask_id):
        is_done = request.data.get('is_done')
        if is_done is None:
            return Response({'error': 'is_done is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            subtask = task_service.toggle_subtask(
                subtask_id=str(subtask_id),
                org_id=request.org_id,
                user=request.user,
                is_done=bool(is_done)
            )
            status_text = 'completed' if subtask.is_done else 'uncompleted'
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='toggle_subtask',
                target_type='task',
                target_id=subtask.task.id,
                detail=f"Marked subtask '{subtask.title}' as {status_text}"
            )
            return Response(SubtaskSerializer(subtask).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def delete(self, request, subtask_id):
        try:
            from .models import Subtask
            subtask = Subtask.objects.filter(id=subtask_id, org_id=request.org_id).first()
            task_id = str(subtask.task.id) if subtask else None
            subtask_title = subtask.title if subtask else ''

            task_service.delete_subtask(str(subtask_id), request.org_id, request.user)

            if task_id:
                log_action(
                    org_id=request.org_id,
                    user=request.user,
                    action='delete_subtask',
                    target_type='task',
                    target_id=task_id,
                    detail=f"Deleted subtask: '{subtask_title}'"
                )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class AITaskBreakdownView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request):
        title = request.data.get('title', '').strip()
        description = request.data.get('description', '').strip()
        project_id = request.data.get('project_id')
        if not title:
            return Response({'error': 'Task title is required for AI breakdown.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            breakdown = task_service.breakdown_task(
                org_id=request.org_id,
                user=request.user,
                title=title,
                description=description,
                project_id=project_id
            )
            return Response(breakdown)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AISprintSummaryView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, project_id):
        try:
            summary = project_service.generate_sprint_summary(
                project_id=str(project_id),
                org_id=request.org_id,
                user=request.user
            )
            return Response(summary)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MeetingActionItemsListView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        try:
            items = project_service.list_meeting_action_items(request.org_id)
            return Response({'action_items': items})
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ImportMeetingActionItemView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request):
        project_id = request.data.get('project_id')
        meeting_id = request.data.get('meeting_id')
        task_text = request.data.get('task_text', '').strip()
        assignee_id = request.data.get('assignee_id')
        priority = request.data.get('priority', 'medium')
        due_date = request.data.get('due_date')
        tags = request.data.get('tags', ['Meeting Action Item'])
        epic = request.data.get('epic', 'Meeting Outcomes')

        if not project_id or not meeting_id or not task_text:
            return Response({'error': 'project_id, meeting_id, and task_text are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            task = project_service.import_meeting_action_item(
                project_id=str(project_id),
                org_id=request.org_id,
                user=request.user,
                meeting_id=str(meeting_id),
                task_text=task_text,
                assignee_id=assignee_id,
                priority=priority,
                due_date=due_date,
                tags=tags,
                epic=epic
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='create_task',
                target_type='task',
                target_id=task.id,
                detail=f'Imported task from meeting action item: {task.title}'
            )
            return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ProjectImportView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request):
        format_type = request.data.get('format', 'json').lower()
        payload = request.data.get('data')
        target_project_id = request.data.get('project_id')
        new_project_name = request.data.get('project_name')

        if not payload:
            return Response({'error': 'data payload is required for import.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = project_service.import_project_data(
                org_id=request.org_id,
                user=request.user,
                format_type=format_type,
                payload=payload,
                target_project_id=target_project_id,
                new_project_name=new_project_name
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='import_project_tasks',
                target_type='project',
                target_id=result.get('project_id'),
                detail=f"Imported {result.get('imported_count')} tasks from {format_type.upper()}"
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


