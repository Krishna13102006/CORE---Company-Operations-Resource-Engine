import uuid
from django.db import models
from django.conf import settings

class MailMessage(models.Model):
    PRIORITY_CHOICES = [
        ('urgent', 'Urgent'),
        ('high', 'High'),
        ('normal', 'Normal'),
        ('low', 'Low'),
    ]

    CATEGORY_CHOICES = [
        ('general', 'General Communication'),
        ('announcement', 'Company Announcement'),
        ('action_required', 'Action Required'),
        ('fyi', 'FYI / Notice'),
        ('compliance', 'Policy & Compliance'),
    ]

    LINKED_ENTITY_CHOICES = [
        ('', 'None'),
        ('project', 'Project'),
        ('meeting', 'Meeting Room'),
        ('expense', 'Expense Claim'),
        ('document', 'Knowledge Document / Article'),
        ('hiring_job', 'Hiring Candidate / Job'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org_id = models.UUIDField(db_index=True)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_mails'
    )
    subject = models.CharField(max_length=300)
    body = models.TextField()
    parent_message = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replies'
    )
    
    # Priority, Categories & Compliance
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='normal')
    category_tag = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='general')
    requires_acknowledgment = models.BooleanField(default=False)
    broadcast_channel = models.CharField(max_length=100, blank=True, default='')

    # Context Linking (CORE Work Graph)
    linked_entity_type = models.CharField(max_length=30, choices=LINKED_ENTITY_CHOICES, blank=True, default='')
    linked_entity_id = models.CharField(max_length=255, blank=True, default='')
    linked_entity_title = models.CharField(max_length=255, blank=True, default='')

    # Management & Scheduling
    is_draft = models.BooleanField(default=False)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    is_sent = models.BooleanField(default=True)
    is_starred_by_sender = models.BooleanField(default=False)
    is_archived_by_sender = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    is_deleted_by_sender = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['org_id', 'created_at']),
            models.Index(fields=['org_id', 'sender']),
            models.Index(fields=['org_id', 'category_tag']),
        ]

    def __str__(self):
        return f"Mail from {self.sender} - {self.subject[:30]}"

class MailAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(
        MailMessage,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(upload_to='mail_attachments/')
    file_name = models.CharField(max_length=255)
    file_size = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attachment {self.file_name} for message {self.message_id}"

class MailRecipientStatus(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(
        MailMessage,
        on_delete=models.CASCADE,
        related_name='recipient_statuses'
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_mail_statuses'
    )
    is_read = models.BooleanField(default=False, db_index=True)
    is_starred = models.BooleanField(default=False, db_index=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    snoozed_until = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    # Compliance acknowledgment
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('message', 'recipient')
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', 'is_starred']),
            models.Index(fields=['recipient', 'is_archived']),
        ]

    def __str__(self):
        return f"Recipient {self.recipient} status for {self.message_id}"


class UserMailPreference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org_id = models.UUIDField(db_index=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mail_preferences'
    )
    # Professional Email Signature
    signature_html = models.TextField(blank=True, default='')
    include_signature_by_default = models.BooleanField(default=True)

    # Out of Office (OOO) Auto-Responder
    is_ooo_enabled = models.BooleanField(default=False)
    ooo_start_date = models.DateField(null=True, blank=True)
    ooo_end_date = models.DateField(null=True, blank=True)
    ooo_message = models.TextField(
        blank=True,
        default='Thank you for reaching out. I am currently out of the office with limited access to email. I will respond to your message upon my return.'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['org_id', 'user']),
        ]

    def __str__(self):
        return f"Mail preferences for {self.user.email}"


class EmailTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org_id = models.UUIDField(db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_templates'
    )
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=100, default='General')
    subject = models.CharField(max_length=300)
    body_html = models.TextField()
    is_shared = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['title']
        indexes = [
            models.Index(fields=['org_id', 'is_shared']),
        ]

    def __str__(self):
        return f"Template: {self.title}"

