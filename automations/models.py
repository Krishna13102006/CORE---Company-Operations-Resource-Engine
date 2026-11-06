import uuid
from django.db import models
from core.models import BaseModel


class Playbook(BaseModel):
    name = models.CharField(max_length=255)
    slug = models.CharField(max_length=100, db_index=True)
    category = models.CharField(max_length=100, default='lifecycle')
    description = models.TextField(blank=True, default='')
    trigger_event = models.CharField(max_length=255)
    is_enabled = models.BooleanField(default=False)
    config = models.JSONField(default=dict, blank=True)
    execution_count = models.IntegerField(default=0)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_playbooks'
    )

    class Meta:
        ordering = ['name']
        unique_together = ('org_id', 'slug')

    def __str__(self):
        return f"{self.name} ({'Enabled' if self.is_enabled else 'Disabled'})"


class AutomationExecutionLog(BaseModel):
    STATUS_CHOICES = [
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('running', 'Running'),
        ('skipped', 'Skipped'),
    ]

    playbook = models.ForeignKey(
        Playbook,
        on_delete=models.CASCADE,
        related_name='execution_logs',
        null=True,
        blank=True
    )
    playbook_slug = models.CharField(max_length=100, db_index=True)
    trigger_source = models.CharField(max_length=255)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='success', db_index=True)
    steps_executed = models.JSONField(default=list, blank=True)
    error_message = models.TextField(blank=True, default='')
    duration_ms = models.IntegerField(default=0)
    triggered_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='automation_executions'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Execution of {self.playbook_slug} - {self.status} at {self.created_at}"
