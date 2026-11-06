import uuid
from django.db import models
from core.models import BaseModel


class Project(BaseModel):
    STATUS_CHOICES = [
        ('planning',    'Planning'),
        ('active',      'Active'),
        ('on_hold',     'On Hold'),
        ('done',        'Done'),
    ]

    name        = models.CharField(max_length=300)
    description = models.TextField(blank=True, default='')
    owner       = models.ForeignKey(
                      'accounts.User',
                      on_delete=models.SET_NULL,
                      null=True,
                      related_name='owned_projects'
                  )
    status      = models.CharField(
                      max_length=20,
                      choices=STATUS_CHOICES,
                      default='planning'
                  )
    start_date  = models.DateField(null=True, blank=True)
    end_date    = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['org', 'status', '-created_at']),
        ]

    def __str__(self):
        return self.name

    def soft_delete(self):
        super().soft_delete()
        self.tasks.filter(is_deleted=False).update(
            is_deleted=True,
            deleted_at=self.deleted_at
        )


class Task(BaseModel):
    STATUS_CHOICES = [
        ('todo',        'To Do'),
        ('in_progress', 'In Progress'),
        ('blocked',     'Blocked'),
        ('done',        'Done'),
    ]

    PRIORITY_CHOICES = [
        ('low',      'Low'),
        ('medium',   'Medium'),
        ('high',     'High'),
        ('critical', 'Critical'),
    ]

    project     = models.ForeignKey(
                      Project,
                      on_delete=models.CASCADE,
                      related_name='tasks'
                  )
    title       = models.CharField(max_length=500)
    description = models.TextField(blank=True, default='')
    assignee    = models.ForeignKey(
                      'accounts.User',
                      on_delete=models.SET_NULL,
                      null=True,
                      blank=True,
                      related_name='assigned_tasks'
                  )
    status      = models.CharField(
                      max_length=20,
                      choices=STATUS_CHOICES,
                      default='todo'
                  )
    priority    = models.CharField(
                      max_length=20,
                      choices=PRIORITY_CHOICES,
                      default='medium'
                  )
    due_date     = models.DateField(null=True, blank=True)
    start_date   = models.DateField(null=True, blank=True)
    is_milestone = models.BooleanField(default=False)
    depends_on   = models.ForeignKey(
                       'self',
                       on_delete=models.SET_NULL,
                       null=True,
                       blank=True,
                       related_name='blocked_tasks'
                   )
    tags            = models.JSONField(default=list, blank=True)
    epic            = models.CharField(max_length=200, blank=True, default='')
    estimated_hours = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, default=0.0)
    logged_hours    = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, default=0.0)

    linked_document = models.ForeignKey(
                       'knowledge.Document',
                       on_delete=models.SET_NULL,
                       null=True,
                       blank=True,
                       related_name='linked_tasks'
                   )
    linked_meeting  = models.ForeignKey(
                       'meetings.Meeting',
                       on_delete=models.SET_NULL,
                       null=True,
                       blank=True,
                       related_name='linked_tasks'
                   )

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['org', 'status', 'priority']),
            models.Index(fields=['project', 'status']),
            models.Index(fields=['assignee', 'status']),
        ]

    def __str__(self):
        return self.title


class TaskComment(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org        = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE)
    task       = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    author     = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    content    = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class Subtask(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org        = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE)
    task       = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='subtasks')
    title      = models.CharField(max_length=500)
    is_done    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.title
