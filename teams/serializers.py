from rest_framework import serializers
from .models import Department, Employee, LeaveRequest, PerformanceReview, PublicHoliday, ApprovalDelegation


class DepartmentSerializer(serializers.ModelSerializer):
    head_name        = serializers.SerializerMethodField()
    parent_name      = serializers.SerializerMethodField()
    employee_count   = serializers.SerializerMethodField()

    class Meta:
        model  = Department
        fields = [
            'id', 'name', 'parent_department', 'parent_name',
            'head', 'head_name', 'employee_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_head_name(self, obj):
        if obj.head:
            return f'{obj.head.first_name} {obj.head.last_name}'
        return None

    def get_parent_name(self, obj):
        return obj.parent_department.name if obj.parent_department else None

    def get_employee_count(self, obj):
        from django.db.models import Q
        return Employee.objects.filter(
            Q(departments=obj) | Q(department=obj),
            is_deleted=False,
            user__is_deleted=False,
            user__is_active=True
        ).distinct().count()


class DepartmentCreateSerializer(serializers.Serializer):
    name                 = serializers.CharField(max_length=200)
    parent_department_id = serializers.UUIDField(required=False, allow_null=True)
    head_id              = serializers.UUIDField(required=False, allow_null=True)
    member_ids           = serializers.ListField(
                             child=serializers.UUIDField(),
                             required=False,
                             allow_empty=True,
                             default=[]
                         )


class EmployeeSerializer(serializers.ModelSerializer):
    full_name         = serializers.SerializerMethodField()
    email             = serializers.SerializerMethodField()
    role              = serializers.SerializerMethodField()
    user_id           = serializers.SerializerMethodField()
    department        = serializers.SerializerMethodField()
    department_id     = serializers.SerializerMethodField()
    department_ids    = serializers.SerializerMethodField()
    department_name   = serializers.SerializerMethodField()
    departments       = serializers.SerializerMethodField()
    manager_name          = serializers.SerializerMethodField()
    manager_id            = serializers.SerializerMethodField()
    calendar_feed_url     = serializers.SerializerMethodField()
    primary_department    = serializers.SerializerMethodField()
    secondary_departments  = serializers.SerializerMethodField()
    workload_stats        = serializers.SerializerMethodField()
    today_attendance      = serializers.SerializerMethodField()
    direct_reports_count  = serializers.SerializerMethodField()
    span_of_control_status = serializers.SerializerMethodField()
    active_delegation     = serializers.SerializerMethodField()
    is_online             = serializers.SerializerMethodField()
    last_seen_at          = serializers.SerializerMethodField()
    last_seen_display     = serializers.SerializerMethodField()

    class Meta:
        model  = Employee
        fields = [
            'id', 'full_name', 'email', 'role', 'user_id',
            'department', 'department_id', 'department_ids',
            'department_name', 'departments',
            'primary_department', 'secondary_departments',
            'manager', 'manager_name', 'manager_id',
            'hire_date', 'employment_status', 'leave_balance',
            'status_message', 'status_emoji', 'status_updated_at',
            'skills', 'workload_stats', 'today_attendance',
            'direct_reports_count', 'span_of_control_status', 'active_delegation',
            'is_online', 'last_seen_at', 'last_seen_display',
            'created_at', 'updated_at', 'calendar_feed_url'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'calendar_feed_url',
            'workload_stats', 'today_attendance',
            'direct_reports_count', 'span_of_control_status', 'active_delegation',
            'is_online', 'last_seen_at', 'last_seen_display'
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_email(self, obj):
        return obj.user.email

    def get_role(self, obj):
        return obj.user.role

    def get_user_id(self, obj):
        return str(obj.user.id)

    def get_department(self, obj):
        if obj.department_id and not (obj.department and obj.department.is_deleted):
            return str(obj.department_id)
        first_m = obj.departments.filter(is_deleted=False).first()
        if first_m:
            return str(first_m.id)
        headed = obj.user.headed_departments.filter(is_deleted=False).first()
        if headed:
            return str(headed.id)
        return None

    def get_department_id(self, obj):
        return self.get_department(obj)

    def get_department_ids(self, obj):
        ids = []
        if obj.department_id and not (obj.department and obj.department.is_deleted):
            ids.append(str(obj.department_id))
        for d in obj.departments.filter(is_deleted=False):
            s_id = str(d.id)
            if s_id not in ids:
                ids.append(s_id)
        for d in obj.user.headed_departments.filter(is_deleted=False):
            s_id = str(d.id)
            if s_id not in ids:
                ids.append(s_id)
        return ids

    def get_department_name(self, obj):
        names = []
        if obj.department and not obj.department.is_deleted:
            names.append(obj.department.name)
        for d in obj.departments.filter(is_deleted=False):
            if d.name not in names:
                names.append(d.name)
        for d in obj.user.headed_departments.filter(is_deleted=False):
            if d.name not in names:
                names.append(d.name)
        return ", ".join(names) if names else None

    def get_departments(self, obj):
        results = []
        seen_ids = set()
        if obj.department and not obj.department.is_deleted:
            results.append({'id': str(obj.department.id), 'name': obj.department.name})
            seen_ids.add(str(obj.department.id))
        for d in obj.departments.filter(is_deleted=False):
            if str(d.id) not in seen_ids:
                results.append({'id': str(d.id), 'name': d.name})
                seen_ids.add(str(d.id))
        for d in obj.user.headed_departments.filter(is_deleted=False):
            if str(d.id) not in seen_ids:
                results.append({'id': str(d.id), 'name': d.name})
                seen_ids.add(str(d.id))
        return results

    def get_manager_name(self, obj):
        return obj.manager.get_full_name() if obj.manager else None

    def get_manager_id(self, obj):
        return str(obj.manager.id) if obj.manager else None

    def get_calendar_feed_url(self, obj):
        import hashlib
        from django.conf import settings
        token = hashlib.sha256(f"{obj.id}-{settings.SECRET_KEY}".encode()).hexdigest()[:16]
        return f"/api/teams/leave/feed/{obj.id}/{token}/"

    def get_primary_department(self, obj):
        if obj.department and not obj.department.is_deleted:
            return {'id': str(obj.department.id), 'name': obj.department.name}
        return None

    def get_secondary_departments(self, obj):
        results = []
        primary_id = str(obj.department.id) if (obj.department and not obj.department.is_deleted) else None
        for d in obj.departments.filter(is_deleted=False):
            if str(d.id) != primary_id:
                results.append({'id': str(d.id), 'name': d.name})
        return results

    def get_workload_stats(self, obj):
        try:
            from projects.models import Task
            from django.utils import timezone
            today = timezone.now().date()
            tasks = Task.objects.filter(org_id=obj.org_id, assignee=obj.user, is_deleted=False).exclude(status='done')
            total = tasks.count()
            high = tasks.filter(priority__in=['high', 'critical']).count()
            overdue = tasks.filter(due_date__lt=today).count()
            burnout = 'high_risk' if high > 6 else ('available' if total == 0 else 'balanced')
            return {
                'total': total,
                'high_priority': high,
                'overdue': overdue,
                'burnout_status': burnout
            }
        except Exception:
            return {'total': 0, 'high_priority': 0, 'overdue': 0, 'burnout_status': 'balanced'}

    def get_today_attendance(self, obj):
        try:
            from django.utils import timezone
            from teams.models import LeaveRequest
            today = timezone.now().date()
            leave = LeaveRequest.objects.filter(
                org_id=obj.org_id,
                employee=obj,
                status='approved',
                start_date__lte=today,
                end_date__gte=today,
                is_deleted=False
            ).first()
            if not leave:
                return {'status': 'present', 'label': 'Present in Office', 'is_wfh': False, 'leave_type': None}
            if leave.leave_type == 'wfh':
                return {'status': 'remote_wfh', 'label': 'Remote / WFH', 'is_wfh': True, 'leave_type': 'wfh'}
            if leave.is_half_day:
                return {'status': 'half_day', 'label': f"Half Day ({leave.get_half_day_period_display()})", 'is_wfh': False, 'leave_type': leave.leave_type}
            return {'status': 'on_leave', 'label': leave.get_leave_type_display(), 'is_wfh': False, 'leave_type': leave.leave_type}
        except Exception:
            return {'status': 'present', 'label': 'Present in Office', 'is_wfh': False, 'leave_type': None}

    def get_direct_reports_count(self, obj):
        try:
            return obj.direct_reports.filter(is_deleted=False, user__is_deleted=False, user__is_active=True).count()
        except Exception:
            return 0

    def get_span_of_control_status(self, obj):
        count = self.get_direct_reports_count(obj)
        if count == 0:
            return None
        if count > 10:
            return 'overloaded'
        elif 5 <= count <= 8:
            return 'optimal'
        elif 9 <= count <= 10:
            return 'elevated'
        else:
            return 'manageable'

    def get_active_delegation(self, obj):
        try:
            from django.utils import timezone
            today = timezone.now().date()
            from teams.models import ApprovalDelegation
            delegation = ApprovalDelegation.objects.filter(
                org_id=obj.org_id,
                delegator_id=obj.user_id,
                is_active=True,
                is_deleted=False,
                start_date__lte=today,
                end_date__gte=today
            ).first()
            if delegation:
                return {
                    'id': str(delegation.id),
                    'delegatee_id': str(delegation.delegatee_id),
                    'delegatee_name': f"{delegation.delegatee.first_name} {delegation.delegatee.last_name}".strip() or delegation.delegatee.email,
                    'delegation_type': delegation.delegation_type,
                    'start_date': delegation.start_date.isoformat(),
                    'end_date': delegation.end_date.isoformat(),
                    'notes': delegation.notes,
                }
            return None
        except Exception:
            return None

    def get_is_online(self, obj):
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and getattr(request.user, 'is_authenticated', False):
            if str(obj.user_id) == str(request.user.id):
                return True
        return obj.user.is_online if obj.user else False

    def get_last_seen_at(self, obj):
        return obj.user.last_seen_at.isoformat() if (obj.user and obj.user.last_seen_at) else None

    def get_last_seen_display(self, obj):
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and getattr(request.user, 'is_authenticated', False):
            if str(obj.user_id) == str(request.user.id):
                return 'Online now'
        if not obj.user or not obj.user.last_seen_at:
            return 'Never'
        from django.utils import timezone
        diff = timezone.now() - obj.user.last_seen_at
        secs = diff.total_seconds()
        if secs < 300:
            return 'Online now'
        elif secs < 3600:
            return f'{max(1, int(secs // 60))}m ago'
        elif secs < 86400:
            return f'{max(1, int(secs // 3600))}h ago'
        else:
            return f'{max(1, int(secs // 86400))}d ago'


class EmployeeCreateSerializer(serializers.Serializer):
    # Account fields — creates a User account
    email      = serializers.EmailField()
    password   = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=100)
    last_name  = serializers.CharField(max_length=100)
    role       = serializers.ChoiceField(choices=['admin', 'hr', 'manager', 'employee'])
    # Employee profile fields
    department_id  = serializers.UUIDField(required=False, allow_null=True)
    department_ids = serializers.ListField(
                       child=serializers.UUIDField(),
                       required=False,
                       allow_empty=True,
                       default=[]
                   )
    manager_id     = serializers.UUIDField(required=False, allow_null=True)
    hire_date      = serializers.DateField(required=False, allow_null=True)
    skills         = serializers.ListField(child=serializers.CharField(), required=False, default=list)


class EmployeeUpdateSerializer(serializers.Serializer):
    department_id     = serializers.UUIDField(required=False, allow_null=True)
    department_ids    = serializers.ListField(
                          child=serializers.UUIDField(),
                          required=False,
                          allow_empty=True
                      )
    manager_id        = serializers.UUIDField(required=False, allow_null=True)
    employment_status = serializers.ChoiceField(
                            choices=['active', 'on_leave', 'inactive'],
                            required=False
                        )
    hire_date         = serializers.DateField(required=False, allow_null=True)
    leave_balance     = serializers.JSONField(required=False)
    status_message    = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    status_emoji      = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    skills            = serializers.ListField(child=serializers.CharField(), required=False)


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name     = serializers.SerializerMethodField()
    employee_email    = serializers.SerializerMethodField()
    employee_id       = serializers.SerializerMethodField()
    department_id     = serializers.SerializerMethodField()
    department_name   = serializers.SerializerMethodField()
    approved_by_name  = serializers.SerializerMethodField()
    duration_days     = serializers.SerializerMethodField()

    class Meta:
        model  = LeaveRequest
        fields = [
            'id', 'employee_id', 'employee_name', 'employee_email',
            'department_id', 'department_name', 'leave_type',
            'start_date', 'end_date', 'is_half_day', 'half_day_period',
            'duration_days', 'status', 'notes', 'rejection_reason',
            'approved_by_name', 'approved_at', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'approved_by_name', 'approved_at']

    def get_employee_name(self, obj):
        return obj.employee.get_full_name()

    def get_employee_email(self, obj):
        return obj.employee.user.email if obj.employee.user else ''

    def get_employee_id(self, obj):
        return str(obj.employee.id)

    def get_department_id(self, obj):
        return str(obj.employee.department_id) if obj.employee.department_id else None

    def get_department_name(self, obj):
        if obj.employee.department and not obj.employee.department.is_deleted:
            return obj.employee.department.name
        first_dept = obj.employee.departments.filter(is_deleted=False).first()
        return first_dept.name if first_dept else None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return f'{obj.approved_by.first_name} {obj.approved_by.last_name}'
        return None

    def get_duration_days(self, obj):
        return obj.duration_days()


class LeaveRequestCreateSerializer(serializers.Serializer):
    leave_type       = serializers.ChoiceField(choices=[
                           'annual', 'sick', 'casual', 'wfh',
                           'maternity_paternity', 'bereavement', 'unpaid'
                       ])
    start_date       = serializers.DateField()
    end_date         = serializers.DateField()
    is_half_day      = serializers.BooleanField(required=False, default=False)
    half_day_period  = serializers.ChoiceField(
                           choices=['morning', 'afternoon'],
                           required=False,
                           allow_null=True
                       )
    notes            = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, data):
        if data['end_date'] < data['start_date']:
            raise serializers.ValidationError(
                {'end_date': 'End date must be on or after start date.'}
            )
        if data.get('is_half_day') and data['start_date'] != data['end_date']:
            raise serializers.ValidationError(
                {'end_date': 'Half-day leaves must have the same start and end date.'}
            )
        return data


class LeaveStatusUpdateSerializer(serializers.Serializer):
    status           = serializers.ChoiceField(choices=['approved', 'rejected'])
    rejection_reason = serializers.CharField(required=False, allow_blank=True, default='')


class LeaveRejectSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default='')


class PublicHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model  = PublicHoliday
        fields = ['id', 'name', 'date', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']


class PublicHolidayCreateSerializer(serializers.Serializer):
    name        = serializers.CharField(max_length=200)
    date        = serializers.DateField()
    description = serializers.CharField(required=False, allow_blank=True, default='')


class LeaveBalanceAdjustSerializer(serializers.Serializer):
    annual   = serializers.FloatField(required=False)
    sick     = serializers.FloatField(required=False)
    casual   = serializers.FloatField(required=False)
    wfh      = serializers.FloatField(required=False)
    unpaid   = serializers.FloatField(required=False)


class LeaveAIDraftSerializer(serializers.Serializer):
    prompt = serializers.CharField(max_length=1000)


class PerformanceReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model  = PerformanceReview
        fields = [
            'id', 'employee', 'reviewer_name',
            'period_start', 'period_end', 'score', 'notes',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_reviewer_name(self, obj):
        if obj.reviewer:
            return f'{obj.reviewer.first_name} {obj.reviewer.last_name}'
        return 'Unknown'


class PerformanceReviewCreateSerializer(serializers.Serializer):
    employee_id  = serializers.UUIDField()
    period_start = serializers.DateField()
    period_end   = serializers.DateField()
    score        = serializers.IntegerField(min_value=1, max_value=5)
    notes        = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, data):
        if data['period_end'] < data['period_start']:
            raise serializers.ValidationError(
                {'period_end': 'Period end must be after period start.'}
            )
        return data


class ApprovalDelegationSerializer(serializers.ModelSerializer):
    delegator_name = serializers.SerializerMethodField()
    delegator_email = serializers.SerializerMethodField()
    delegator_role = serializers.SerializerMethodField()
    delegatee_name = serializers.SerializerMethodField()
    delegatee_email = serializers.SerializerMethodField()
    delegatee_role = serializers.SerializerMethodField()
    is_currently_effective = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalDelegation
        fields = [
            'id', 'delegator', 'delegator_name', 'delegator_email', 'delegator_role',
            'delegatee', 'delegatee_name', 'delegatee_email', 'delegatee_role',
            'delegation_type', 'start_date', 'end_date', 'is_active', 'notes',
            'is_currently_effective', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_currently_effective']

    def get_delegator_name(self, obj):
        return f"{obj.delegator.first_name} {obj.delegator.last_name}".strip() or obj.delegator.email

    def get_delegator_email(self, obj):
        return obj.delegator.email

    def get_delegator_role(self, obj):
        return obj.delegator.role

    def get_delegatee_name(self, obj):
        return f"{obj.delegatee.first_name} {obj.delegatee.last_name}".strip() or obj.delegatee.email

    def get_delegatee_email(self, obj):
        return obj.delegatee.email

    def get_delegatee_role(self, obj):
        return obj.delegatee.role

    def get_is_currently_effective(self, obj):
        val = getattr(obj, 'is_currently_effective', False)
        return val() if callable(val) else bool(val)


class ApprovalDelegationCreateSerializer(serializers.Serializer):
    delegatee_id    = serializers.UUIDField()
    delegation_type = serializers.ChoiceField(
                        choices=['all', 'expenses', 'leaves'],
                        default='all'
                      )
    start_date      = serializers.DateField()
    end_date        = serializers.DateField()
    notes           = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        if attrs['start_date'] > attrs['end_date']:
            raise serializers.ValidationError({"end_date": "End date cannot be earlier than start date."})
        return attrs


class OneOnOneWorkspaceSerializer(serializers.ModelSerializer):
    manager_name     = serializers.SerializerMethodField()
    manager_email    = serializers.SerializerMethodField()
    employee_name    = serializers.SerializerMethodField()
    employee_email   = serializers.SerializerMethodField()
    department_name  = serializers.SerializerMethodField()
    is_manager       = serializers.SerializerMethodField()
    is_employee      = serializers.SerializerMethodField()

    class Meta:
        from teams.models import OneOnOneWorkspace
        model = OneOnOneWorkspace
        fields = [
            'id', 'manager', 'manager_name', 'manager_email',
            'employee', 'employee_name', 'employee_email',
            'department', 'department_name',
            'cadence', 'day_of_week', 'time_of_day', 'next_meeting_date',
            'room_code', 'shared_agenda', 'discussion_topics', 'action_items',
            'notes', 'last_synced_at', 'is_manager', 'is_employee',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_synced_at']

    def get_manager_name(self, obj):
        return obj.manager.get_full_name() if obj.manager else ''

    def get_manager_email(self, obj):
        return obj.manager.email if obj.manager else ''

    def get_employee_name(self, obj):
        return obj.employee.get_full_name() if obj.employee else ''

    def get_employee_email(self, obj):
        return obj.employee.email if obj.employee else ''

    def get_department_name(self, obj):
        return obj.department.name if obj.department else 'General'

    def get_is_manager(self, obj):
        req = self.context.get('request')
        return bool(req and req.user and req.user.id == obj.manager_id)

    def get_is_employee(self, obj):
        req = self.context.get('request')
        return bool(req and req.user and req.user.id == obj.employee_id)


class DepartmentRunbookSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        from teams.models import DepartmentRunbook
        model = DepartmentRunbook
        fields = [
            'id', 'department', 'department_name', 'title', 'type',
            'is_default', 'description', 'checklist_steps', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmployeeRunbookExecutionSerializer(serializers.ModelSerializer):
    employee_name   = serializers.SerializerMethodField()
    employee_email  = serializers.SerializerMethodField()
    department_name = serializers.CharField(source='department.name', read_only=True)
    template_title  = serializers.CharField(source='runbook_template.title', read_only=True)
    progress_stats  = serializers.SerializerMethodField()

    class Meta:
        from teams.models import EmployeeRunbookExecution
        model = EmployeeRunbookExecution
        fields = [
            'id', 'employee', 'employee_name', 'employee_email',
            'department', 'department_name',
            'runbook_template', 'template_title', 'type', 'status',
            'started_at', 'completed_at', 'steps', 'progress_stats',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'started_at', 'completed_at', 'created_at', 'updated_at']

    def get_employee_name(self, obj):
        return obj.employee.get_full_name() if obj.employee else ''

    def get_employee_email(self, obj):
        return obj.employee.user.email if (obj.employee and obj.employee.user) else ''

    def get_progress_stats(self, obj):
        steps = obj.steps or []
        total = len(steps)
        completed = sum(1 for s in steps if s.get('is_completed'))
        percent = int((completed / total) * 100) if total > 0 else 0
        return {
            'total': total,
            'completed': completed,
            'percent': percent
        }

