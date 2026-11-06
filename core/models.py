import uuid
from django.db import models


class BaseModel(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    # org foreign key commented out for now
    # added after tenants app is created
    org = models.ForeignKey(
        'tenants.Organization',
        on_delete=models.CASCADE,
        related_name='%(class)s_set'
    )
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True  # no table created for this model itself

    def soft_delete(self):
        from django.utils import timezone
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()


class BaseManager(models.Manager):
    # automatically excludes soft-deleted rows from every query
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class AuditLog(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org         = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE)
    actor       = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    action      = models.CharField(max_length=100)
    target_type = models.CharField(max_length=100)
    target_id   = models.CharField(max_length=255)
    detail      = models.TextField(blank=True, default='')
    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['org', '-created_at']),
            models.Index(fields=['org', 'action', '-created_at']),
        ]


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('SYSTEM', 'System Alert'),
        ('TASK_ASSIGNED', 'Task Assigned'),
        ('TASK_COMPLETED', 'Task Completed'),
        ('TASK_OVERDUE', 'Task Overdue'),
        ('LEAVE_REQUESTED', 'Leave Requested'),
        ('LEAVE_APPROVED', 'Leave Approved'),
        ('LEAVE_REJECTED', 'Leave Rejected'),
        ('INVITATION_ACCEPTED', 'Invitation Accepted'),
        ('MENTION', 'Mention / Comment'),
    ]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org        = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE)
    recipient  = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='notifications')
    actor      = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications_triggered')
    type       = models.CharField(max_length=50, choices=NOTIFICATION_TYPES, default='SYSTEM')
    title      = models.CharField(max_length=300)
    message    = models.TextField()
    target_url = models.CharField(max_length=500, blank=True, default='')
    data       = models.JSONField(default=dict, blank=True)
    is_read    = models.BooleanField(default=False)
    read_at    = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read', '-created_at']),
        ]