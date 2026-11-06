import uuid
from django.db import models
from core.models import BaseModel


class Department(BaseModel):
    name              = models.CharField(max_length=200)
    parent_department = models.ForeignKey(
                            'self',
                            on_delete=models.SET_NULL,
                            null=True,
                            blank=True,
                            related_name='sub_departments'
                        )
    head              = models.ForeignKey(
                            'accounts.User',
                            on_delete=models.SET_NULL,
                            null=True,
                            blank=True,
                            related_name='headed_departments'
                        )

    class Meta:
        ordering = ['name']

    def soft_delete(self):
        self.employees.update(department=None)
        self.members.clear()
        self.sub_departments.update(parent_department=None)
        super().soft_delete()

    def __str__(self):
        return self.name


class Employee(BaseModel):
    EMPLOYMENT_STATUS = [
        ('active',    'Active'),
        ('on_leave',  'On Leave'),
        ('inactive',  'Inactive'),
    ]

    user             = models.OneToOneField(
                           'accounts.User',
                           on_delete=models.CASCADE,
                           related_name='employee_profile'
                       )
    department       = models.ForeignKey(
                           Department,
                           on_delete=models.SET_NULL,
                           null=True,
                           blank=True,
                           related_name='employees'
                       )
    departments      = models.ManyToManyField(
                           Department,
                           blank=True,
                           related_name='members'
                       )
    manager          = models.ForeignKey(
                           'self',
                           on_delete=models.SET_NULL,
                           null=True,
                           blank=True,
                           related_name='direct_reports'
                       )
    hire_date        = models.DateField(null=True, blank=True)
    employment_status = models.CharField(
                            max_length=20,
                            choices=EMPLOYMENT_STATUS,
                            default='active'
                        )
    leave_balance    = models.JSONField(
                           default=dict,
                           help_text='e.g. {"annual": 20, "sick": 10, "unpaid": 0}'
                       )
    status_message   = models.CharField(max_length=255, null=True, blank=True)
    status_emoji     = models.CharField(max_length=50, null=True, blank=True)
    status_updated_at = models.DateTimeField(null=True, blank=True)
    skills           = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['user__first_name', 'user__last_name']
        indexes = [
            models.Index(fields=['org', 'employment_status']),
            models.Index(fields=['department', 'employment_status']),
        ]

    def __str__(self):
        return f'{self.user.first_name} {self.user.last_name}'

    def get_full_name(self):
        return f'{self.user.first_name} {self.user.last_name}'

    def save(self, *args, **kwargs):
        # Ensure default leave balance structure on first save
        if not self.leave_balance:
            self.leave_balance = {'annual': 20, 'sick': 10, 'casual': 5, 'wfh': 12, 'unpaid': 0}
        super().save(*args, **kwargs)


class LeaveRequest(BaseModel):
    LEAVE_TYPE_CHOICES = [
        ('annual',              'Annual / Vacation'),
        ('sick',                'Sick Leave'),
        ('casual',              'Casual / Personal'),
        ('wfh',                 'Remote / WFH Day'),
        ('maternity_paternity', 'Parental Leave'),
        ('bereavement',         'Bereavement Leave'),
        ('unpaid',              'Unpaid Leave'),
    ]

    STATUS_CHOICES = [
        ('pending',   'Pending'),
        ('approved',  'Approved'),
        ('rejected',  'Rejected'),
        ('cancelled', 'Cancelled'),
    ]

    HALF_DAY_PERIOD_CHOICES = [
        ('morning',   'First Half / Morning'),
        ('afternoon', 'Second Half / Afternoon'),
    ]

    employee         = models.ForeignKey(
                           Employee,
                           on_delete=models.CASCADE,
                           related_name='leave_requests'
                       )
    leave_type       = models.CharField(max_length=30, choices=LEAVE_TYPE_CHOICES)
    start_date       = models.DateField()
    end_date         = models.DateField()
    is_half_day      = models.BooleanField(default=False)
    half_day_period  = models.CharField(
                           max_length=20,
                           choices=HALF_DAY_PERIOD_CHOICES,
                           null=True,
                           blank=True
                       )
    status           = models.CharField(
                           max_length=20,
                           choices=STATUS_CHOICES,
                           default='pending'
                       )
    notes            = models.TextField(blank=True, default='')
    rejection_reason = models.TextField(blank=True, default='')
    approved_by      = models.ForeignKey(
                           'accounts.User',
                           on_delete=models.SET_NULL,
                           null=True,
                           blank=True,
                           related_name='approved_leaves'
                       )
    approved_at      = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['org', 'status', '-created_at']),
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['start_date', 'end_date']),
        ]

    def duration_days(self):
        if self.is_half_day:
            return 0.5
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days + 1
        return 0


class PublicHoliday(BaseModel):
    name        = models.CharField(max_length=200)
    date        = models.DateField()
    description = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f"{self.name} ({self.date})"


class PerformanceReview(BaseModel):
    employee     = models.ForeignKey(
                       Employee,
                       on_delete=models.CASCADE,
                       related_name='performance_reviews'
                   )
    reviewer     = models.ForeignKey(
                       'accounts.User',
                       on_delete=models.SET_NULL,
                       null=True,
                       related_name='given_reviews'
                   )
    period_start = models.DateField()
    period_end   = models.DateField()
    score        = models.IntegerField(
                       help_text='Score from 1 to 5'
                   )
    notes        = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-period_end']


class DailyStatus(BaseModel):
    BLOCKER_SEVERITY_CHOICES = [
        ('none', 'No Blocker'),
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical / Urgent'),
    ]

    employee                = models.ForeignKey(
                                Employee,
                                on_delete=models.CASCADE,
                                related_name='daily_statuses'
                             )
    status_message          = models.CharField(max_length=500)
    status_emoji            = models.CharField(max_length=50, null=True, blank=True)

    # Pillar 3: 3-Question Rapid Async Check-in
    yesterday_accomplished  = models.TextField(blank=True, default='')
    yesterday_task_ids      = models.JSONField(default=list, blank=True)
    today_focus             = models.TextField(blank=True, default='')
    today_task_ids          = models.JSONField(default=list, blank=True)
    has_blockers            = models.BooleanField(default=False, db_index=True)
    blockers_description   = models.TextField(blank=True, default='')
    blocker_severity        = models.CharField(max_length=20, choices=BLOCKER_SEVERITY_CHOICES, default='none')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['org', 'has_blockers', 'created_at']),
        ]

    def __str__(self):
        return f'{self.employee.get_full_name()} - {self.status_message} ({self.created_at})'


class DepartmentStandupDigest(BaseModel):
    department            = models.ForeignKey(
                                'Department',
                                on_delete=models.CASCADE,
                                null=True,
                                blank=True,
                                related_name='standup_digests'
                            )
    digest_date           = models.DateField(db_index=True)
    shipped_summary       = models.JSONField(default=list, blank=True)
    in_flight_summary     = models.JSONField(default=list, blank=True)
    blockers_summary      = models.JSONField(default=list, blank=True)
    full_markdown         = models.TextField(blank=True, default='')
    team_mood             = models.CharField(max_length=50, default='Steady')
    active_blockers_count = models.IntegerField(default=0)
    total_checkins_count  = models.IntegerField(default=0)
    email_sent_to         = models.ForeignKey(
                                'accounts.User',
                                null=True,
                                blank=True,
                                on_delete=models.SET_NULL,
                                related_name='received_standup_digests'
                            )
    email_sent_at         = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-digest_date', '-created_at']
        indexes = [
            models.Index(fields=['org', 'department', 'digest_date']),
        ]

    def __str__(self):
        dept_label = self.department.name if self.department else 'All Departments'
        return f"{dept_label} Digest - {self.digest_date} ({self.total_checkins_count} check-ins, {self.active_blockers_count} blockers)"


class ApprovalDelegation(BaseModel):
    DELEGATION_TYPE_CHOICES = [
        ('all', 'All Approvals (Expenses & Leaves)'),
        ('expenses', 'Expense Claims Only'),
        ('leaves', 'Leave Requests Only'),
    ]

    delegator       = models.ForeignKey(
                        'accounts.User',
                        on_delete=models.CASCADE,
                        related_name='delegations_granted'
                      )
    delegatee       = models.ForeignKey(
                        'accounts.User',
                        on_delete=models.CASCADE,
                        related_name='delegations_received'
                      )
    delegation_type = models.CharField(
                        max_length=20,
                        choices=DELEGATION_TYPE_CHOICES,
                        default='all'
                      )
    start_date      = models.DateField()
    end_date        = models.DateField()
    is_active       = models.BooleanField(default=True)
    notes           = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['org', 'delegator', 'is_active']),
            models.Index(fields=['org', 'delegatee', 'is_active']),
            models.Index(fields=['start_date', 'end_date', 'is_active']),
        ]

    def __str__(self):
        return f"{self.delegator.email} -> {self.delegatee.email} ({self.delegation_type}) [{self.start_date} to {self.end_date}]"

    @property
    def is_currently_effective(self):
        from django.utils import timezone
        today = timezone.now().date()
        return self.is_active and not self.is_deleted and (self.start_date <= today <= self.end_date)


class OneOnOneWorkspace(BaseModel):
    CADENCE_CHOICES = [
        ('weekly', 'Weekly'),
        ('biweekly', 'Bi-Weekly'),
        ('monthly', 'Monthly'),
    ]

    manager           = models.ForeignKey(
                            'accounts.User',
                            on_delete=models.CASCADE,
                            related_name='one_on_one_as_manager'
                        )
    employee          = models.ForeignKey(
                            'accounts.User',
                            on_delete=models.CASCADE,
                            related_name='one_on_one_as_employee'
                        )
    department        = models.ForeignKey(
                            'Department',
                            null=True,
                            blank=True,
                            on_delete=models.SET_NULL,
                            related_name='one_on_one_workspaces'
                        )
    cadence           = models.CharField(max_length=20, choices=CADENCE_CHOICES, default='biweekly')
    day_of_week       = models.CharField(max_length=20, default='Thursday')
    time_of_day       = models.CharField(max_length=20, default='14:00')
    next_meeting_date = models.DateField(null=True, blank=True)
    room_code         = models.CharField(max_length=64, blank=True, default='')

    # Shared Agenda & Collaboration State
    shared_agenda     = models.JSONField(default=list, blank=True)
    discussion_topics = models.JSONField(default=list, blank=True)
    action_items      = models.JSONField(default=list, blank=True)
    notes             = models.TextField(blank=True, default='')
    last_synced_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['org', 'manager']),
            models.Index(fields=['org', 'employee']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['org', 'manager', 'employee'], name='unique_manager_employee_1on1')
        ]

    def __str__(self):
        return f"1-on-1: {self.manager.email} & {self.employee.email} ({self.cadence})"


class DepartmentRunbook(BaseModel):
    RUNBOOK_TYPE_CHOICES = [
        ('onboarding', 'Onboarding Runbook'),
        ('offboarding', 'Offboarding Runbook'),
    ]

    department      = models.ForeignKey(
                        'Department',
                        on_delete=models.CASCADE,
                        related_name='runbooks'
                    )
    title           = models.CharField(max_length=255)
    type            = models.CharField(max_length=20, choices=RUNBOOK_TYPE_CHOICES, default='onboarding')
    is_default      = models.BooleanField(default=True)
    description     = models.TextField(blank=True, default='')
    checklist_steps = models.JSONField(
                        default=list,
                        help_text='[{"id": 1, "phase": "Day 1", "title": "...", "required": true}]'
                    )

    class Meta:
        ordering = ['department', 'type', 'title']

    def __str__(self):
        return f"{self.department.name} - {self.title} ({self.type})"


class EmployeeRunbookExecution(BaseModel):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('archived', 'Archived'),
    ]

    employee         = models.ForeignKey(
                        Employee,
                        on_delete=models.CASCADE,
                        related_name='runbook_instances'
                     )
    department       = models.ForeignKey(
                        'Department',
                        on_delete=models.CASCADE,
                        related_name='active_runbook_instances'
                     )
    runbook_template = models.ForeignKey(
                        DepartmentRunbook,
                        null=True,
                        blank=True,
                        on_delete=models.SET_NULL,
                        related_name='executions'
                     )
    type             = models.CharField(max_length=20, default='onboarding')
    status           = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    started_at       = models.DateTimeField(auto_now_add=True)
    completed_at     = models.DateTimeField(null=True, blank=True)
    steps            = models.JSONField(
                        default=list,
                        help_text='[{"id": 1, "phase": "Day 1", "title": "...", "is_completed": false, "completed_at": null, "completed_by": null, "converted_task_id": null}]'
                     )

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['org', 'employee', 'status']),
        ]

    def __str__(self):
        return f"{self.employee.get_full_name()} - {self.type} ({self.status})"



from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender='accounts.User')
def create_employee_profile(sender, instance, created, **kwargs):
    if created and instance.org_id:
        if not hasattr(instance, 'employee_profile'):
            Employee.objects.get_or_create(
                user=instance,
                defaults={
                    'org_id': instance.org_id,
                    'employment_status': 'active',
                    'leave_balance': {'annual': 20, 'sick': 10, 'casual': 5, 'wfh': 12, 'unpaid': 0}
                }
            )

