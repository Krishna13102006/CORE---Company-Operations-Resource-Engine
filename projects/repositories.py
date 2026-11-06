from .models import Project, Task, TaskComment
from django.utils import timezone


class ProjectRepository:

    def list_by_org(self, org_id, filters=None):
        qs = Project.objects.filter(
            org_id=org_id,
            is_deleted=False
        ).select_related('owner').prefetch_related('tasks').order_by('-created_at')

        if filters:
            if filters.get('status'):
                qs = qs.filter(status=filters['status'])
            if filters.get('search'):
                qs = qs.filter(name__icontains=filters['search'])
            if filters.get('owner'):
                qs = qs.filter(owner_id=filters['owner'])

        return qs

    def list_by_member(self, org_id, user_id, filters=None):
        # Returns projects where user is owner OR has at least one task assigned
        from django.db.models import Q
        qs = Project.objects.filter(
            org_id=org_id,
            is_deleted=False
        ).filter(
            Q(owner_id=user_id) | Q(tasks__assignee_id=user_id, tasks__is_deleted=False)
        ).distinct().select_related('owner').prefetch_related('tasks').order_by('-created_at')

        if filters:
            if filters.get('status'):
                qs = qs.filter(status=filters['status'])
            if filters.get('search'):
                qs = qs.filter(name__icontains=filters['search'])

        return qs

    def get_by_id(self, project_id, org_id):
        return Project.objects.filter(
            id=project_id,
            org_id=org_id,
            is_deleted=False
        ).select_related('owner').prefetch_related(
            'tasks__assignee',
            'tasks__comments__author'
        ).first()

    def create(self, org_id, name, description, owner, status, start_date, end_date):
        return Project.objects.create(
            org_id=org_id,
            name=name,
            description=description,
            owner=owner,
            status=status,
            start_date=start_date,
            end_date=end_date,
        )

    def update(self, project_id, org_id, **fields):
        Project.objects.filter(id=project_id, org_id=org_id).update(
            updated_at=timezone.now(),
            **fields
        )
        return self.get_by_id(project_id, org_id)

    def soft_delete(self, project_id, org_id):
        project = self.get_by_id(project_id, org_id)
        if project:
            project.soft_delete()
        return project


class TaskRepository:

    def list_by_project(self, project_id, org_id):
        return Task.objects.filter(
            project_id=project_id,
            org_id=org_id,
            is_deleted=False
        ).select_related('assignee', 'project').order_by('created_at')

    def list_assigned_to_user(self, user_id, org_id, filters=None):
        qs = Task.objects.filter(
            assignee_id=user_id,
            org_id=org_id,
            is_deleted=False
        ).select_related('assignee', 'project').order_by('due_date', 'created_at')

        if filters:
            if filters.get('status'):
                qs = qs.filter(status=filters['status'])

        return qs

    def get_by_id(self, task_id, org_id):
        return Task.objects.filter(
            id=task_id,
            org_id=org_id,
            is_deleted=False
        ).select_related('assignee', 'project', 'linked_document', 'linked_meeting').prefetch_related(
            'comments__author',
            'subtasks'
        ).first()

    def create(self, org_id, project, title, description='', assignee=None, status='todo', priority='medium', due_date=None, start_date=None, is_milestone=False, depends_on=None, tags=None, epic='', estimated_hours=None, logged_hours=0.0, linked_document=None, linked_meeting=None):
        return Task.objects.create(
            org_id=org_id,
            project=project,
            title=title,
            description=description or '',
            assignee=assignee,
            status=status or 'todo',
            priority=priority or 'medium',
            due_date=due_date,
            start_date=start_date,
            is_milestone=bool(is_milestone),
            depends_on=depends_on,
            tags=tags or [],
            epic=epic or '',
            estimated_hours=estimated_hours if estimated_hours is not None else 0.0,
            logged_hours=logged_hours if logged_hours is not None else 0.0,
            linked_document=linked_document,
            linked_meeting=linked_meeting,
        )



    def update(self, task_id, org_id, **fields):
        Task.objects.filter(id=task_id, org_id=org_id).update(
            updated_at=timezone.now(),
            **fields
        )
        return self.get_by_id(task_id, org_id)

    def soft_delete(self, task_id, org_id):
        task = self.get_by_id(task_id, org_id)
        if task:
            task.soft_delete()
        return task

    def add_comment(self, task, author, content, org_id):
        return TaskComment.objects.create(
            task=task,
            author=author,
            content=content,
            org_id=org_id,
        )
