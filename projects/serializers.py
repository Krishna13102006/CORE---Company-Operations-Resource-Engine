from rest_framework import serializers
from .models import Project, Task, TaskComment, Subtask


class SubtaskSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Subtask
        fields = ['id', 'title', 'is_done', 'created_at']


class TaskCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model  = TaskComment
        fields = ['id', 'content', 'author_name', 'created_at']

    def get_author_name(self, obj):
        if obj.author:
            return f'{obj.author.first_name} {obj.author.last_name}'
        return 'Unknown'


class TaskSerializer(serializers.ModelSerializer):
    assignee_name         = serializers.SerializerMethodField()
    project_name          = serializers.SerializerMethodField()
    comments              = TaskCommentSerializer(many=True, read_only=True)
    subtasks              = SubtaskSerializer(many=True, read_only=True)
    is_overdue            = serializers.SerializerMethodField()
    linked_document_title = serializers.SerializerMethodField()
    linked_meeting_title  = serializers.SerializerMethodField()
    assignee_ooo_info     = serializers.SerializerMethodField()

    class Meta:
        model  = Task
        fields = [
            'id', 'title', 'description', 'status', 'priority',
            'due_date', 'start_date', 'is_milestone', 'depends_on', 'assignee', 'assignee_name', 'project',
            'project_name', 'comments', 'subtasks', 'is_overdue',
            'tags', 'epic', 'estimated_hours', 'logged_hours',
            'linked_document', 'linked_document_title', 'linked_meeting', 'linked_meeting_title',
            'assignee_ooo_info',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'project', 'created_at', 'updated_at']

    def get_assignee_name(self, obj):
        if obj.assignee:
            return f'{obj.assignee.first_name} {obj.assignee.last_name}'
        return 'Unassigned'

    def get_project_name(self, obj):
        return obj.project.name if obj.project else ''

    def get_is_overdue(self, obj):
        from django.utils import timezone
        if obj.due_date and obj.status != 'done':
            return obj.due_date < timezone.now().date()
        return False

    def get_linked_document_title(self, obj):
        return obj.linked_document.title if obj.linked_document else None

    def get_linked_meeting_title(self, obj):
        return obj.linked_meeting.title if obj.linked_meeting else None

    def get_assignee_ooo_info(self, obj):
        if not obj.assignee or obj.status == 'done':
            return None
        from django.utils import timezone
        today = timezone.now().date()
        try:
            from teams.models import LeaveRequest
            target_dates = [today]
            if obj.due_date:
                target_dates.append(obj.due_date)

            leave = LeaveRequest.objects.filter(
                employee__user=obj.assignee,
                status='approved',
                is_deleted=False,
                start_date__lte=max(target_dates),
                end_date__gte=min(target_dates)
            ).order_by('start_date').first()

            if leave:
                return {
                    'leave_type': leave.leave_type,
                    'start_date': str(leave.start_date),
                    'end_date': str(leave.end_date),
                    'duration_days': leave.duration_days(),
                    'manager_name': leave.employee.manager.get_full_name() if leave.employee.manager else None,
                    'manager_user_id': str(leave.employee.manager.user_id) if (leave.employee.manager and leave.employee.manager.user_id) else None,
                }
        except Exception:
            pass
        return None


class TaskSummarySerializer(serializers.ModelSerializer):
    assignee_name = serializers.SerializerMethodField()
    is_overdue    = serializers.SerializerMethodField()

    class Meta:
        model  = Task
        fields = [
            'id', 'title', 'status', 'priority',
            'due_date', 'assignee', 'assignee_name', 'is_overdue'
        ]

    def get_assignee_name(self, obj):
        if obj.assignee:
            return f'{obj.assignee.first_name} {obj.assignee.last_name}'
        return 'Unassigned'

    def get_is_overdue(self, obj):
        from django.utils import timezone
        if obj.due_date and obj.status != 'done':
            return obj.due_date < timezone.now().date()
        return False


class ProjectSerializer(serializers.ModelSerializer):
    owner_name        = serializers.SerializerMethodField()
    task_count        = serializers.SerializerMethodField()
    completed_count   = serializers.SerializerMethodField()
    overdue_count     = serializers.SerializerMethodField()
    tasks             = serializers.SerializerMethodField()

    class Meta:
        model  = Project
        fields = [
            'id', 'name', 'description', 'status',
            'start_date', 'end_date', 'owner', 'owner_name',
            'task_count', 'completed_count', 'overdue_count',
            'tasks', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_owner_name(self, obj):
        if obj.owner:
            return f'{obj.owner.first_name} {obj.owner.last_name}'
        return 'No Owner'

    def get_task_count(self, obj):
        request = self.context.get('request')
        user = request.user if request else None
        qs = obj.tasks.filter(is_deleted=False)
        if user and user.role == 'employee':
            qs = qs.filter(assignee_id=user.id)
        return qs.count()

    def get_completed_count(self, obj):
        request = self.context.get('request')
        user = request.user if request else None
        qs = obj.tasks.filter(status='done', is_deleted=False)
        if user and user.role == 'employee':
            qs = qs.filter(assignee_id=user.id)
        return qs.count()

    def get_overdue_count(self, obj):
        request = self.context.get('request')
        user = request.user if request else None
        from django.utils import timezone
        qs = obj.tasks.filter(is_deleted=False).exclude(status='done')
        qs = qs.filter(due_date__lt=timezone.now().date())
        if user and user.role == 'employee':
            qs = qs.filter(assignee_id=user.id)
        return qs.count()

    def get_tasks(self, obj):
        request = self.context.get('request')
        user = request.user if request else None
        qs = obj.tasks.filter(is_deleted=False)
        if user and user.role == 'employee':
            qs = qs.filter(assignee_id=user.id)
        return TaskSummarySerializer(qs, many=True).data


class ProjectCreateSerializer(serializers.Serializer):
    name        = serializers.CharField(max_length=300)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    status      = serializers.ChoiceField(
                      choices=['planning', 'active', 'on_hold', 'done'],
                      default='planning'
                  )
    start_date  = serializers.DateField(required=False, allow_null=True)
    end_date    = serializers.DateField(required=False, allow_null=True)
    owner       = serializers.UUIDField(required=False, allow_null=True)


class ProjectUpdateSerializer(serializers.Serializer):
    name        = serializers.CharField(max_length=300, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    status      = serializers.ChoiceField(
                      choices=['planning', 'active', 'on_hold', 'done'],
                      required=False
                  )
    start_date  = serializers.DateField(required=False, allow_null=True)
    end_date    = serializers.DateField(required=False, allow_null=True)
    owner       = serializers.UUIDField(required=False, allow_null=True)


class TaskCreateSerializer(serializers.Serializer):
    title           = serializers.CharField(max_length=500)
    description     = serializers.CharField(required=False, allow_blank=True, default='')
    status          = serializers.ChoiceField(
                          choices=['todo', 'in_progress', 'blocked', 'done'],
                          default='todo'
                      )
    priority        = serializers.ChoiceField(
                          choices=['low', 'medium', 'high', 'critical'],
                          default='medium'
                      )
    due_date        = serializers.DateField(required=False, allow_null=True)
    assignee        = serializers.UUIDField(required=False, allow_null=True)
    start_date      = serializers.DateField(required=False, allow_null=True)
    is_milestone    = serializers.BooleanField(required=False, default=False)
    depends_on      = serializers.UUIDField(required=False, allow_null=True)
    tags            = serializers.ListField(child=serializers.CharField(max_length=50), required=False, default=list)
    epic            = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    estimated_hours = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True, default=None)
    logged_hours    = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True, default=0.0)
    linked_document = serializers.UUIDField(required=False, allow_null=True)
    linked_meeting  = serializers.UUIDField(required=False, allow_null=True)


class TaskUpdateSerializer(serializers.Serializer):
    title           = serializers.CharField(max_length=500, required=False)
    description     = serializers.CharField(required=False, allow_blank=True)
    status          = serializers.ChoiceField(
                          choices=['todo', 'in_progress', 'blocked', 'done'],
                          required=False
                      )
    priority        = serializers.ChoiceField(
                          choices=['low', 'medium', 'high', 'critical'],
                          required=False
                      )
    due_date        = serializers.DateField(required=False, allow_null=True)
    assignee        = serializers.UUIDField(required=False, allow_null=True)
    start_date      = serializers.DateField(required=False, allow_null=True)
    is_milestone    = serializers.BooleanField(required=False)
    depends_on      = serializers.UUIDField(required=False, allow_null=True)
    tags            = serializers.ListField(child=serializers.CharField(max_length=50), required=False)
    epic            = serializers.CharField(max_length=200, required=False, allow_blank=True)
    estimated_hours = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    logged_hours    = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    linked_document = serializers.UUIDField(required=False, allow_null=True)
    linked_meeting  = serializers.UUIDField(required=False, allow_null=True)



class TaskCommentCreateSerializer(serializers.Serializer):
    content = serializers.CharField(min_length=1)


class SubtaskCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=500, min_length=1)
