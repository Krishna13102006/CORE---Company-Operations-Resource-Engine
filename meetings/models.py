import uuid
from django.db import models
from core.models import BaseModel, BaseManager


def generate_room_code():
    """Generates a clean room code like meet-abc-xyz."""
    u = str(uuid.uuid4()).replace('-', '')
    return f"meet-{u[:3]}-{u[3:7]}"


class Meeting(BaseModel):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('live', 'Live'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    host = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='hosted_meetings')
    status = models.CharField(max_length=20, default='scheduled', choices=STATUS_CHOICES, db_index=True)
    scheduled_start = models.DateTimeField(null=True, blank=True, db_index=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    is_instant = models.BooleanField(default=False)
    room_code = models.CharField(max_length=64, default=generate_room_code, db_index=True)
    passcode = models.CharField(max_length=32, blank=True, default='')
    allowed_roles = models.CharField(max_length=100, default='admin,hr,manager,employee')
    is_locked = models.BooleanField(default=False)
    waiting_room_enabled = models.BooleanField(default=False)
    
    # Presentation & Screen Sync
    active_presentation = models.JSONField(default=dict, blank=True)
    
    # Video / Audio Recording
    recording_file = models.FileField(upload_to='meeting_recordings/', null=True, blank=True)
    recording_url = models.TextField(blank=True, default='')

    # Structured Templates & Interactivity
    template_type = models.CharField(max_length=50, default='general', db_index=True)
    candidate_application = models.ForeignKey(
        'hiring.Application',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='linked_meetings'
    )
    code_sandbox = models.JSONField(default=dict, blank=True)
    whiteboard_data = models.JSONField(default=dict, blank=True)
    framework_data = models.JSONField(default=dict, blank=True)

    # Agenda and Checklists
    agenda_items = models.JSONField(default=list, blank=True)

    # In-Meeting Interactivity (Hand Raising Queue & Reactions)
    raised_hands = models.JSONField(default=list, blank=True)
    recent_reactions = models.JSONField(default=list, blank=True)
    
    # AI Transcripts and Notes
    transcript_raw = models.JSONField(default=list, blank=True)
    ai_summary = models.TextField(blank=True, default='')
    key_decisions = models.JSONField(default=list, blank=True)
    action_items = models.JSONField(default=list, blank=True)

    objects = BaseManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ['-scheduled_start', '-created_at']

    def __str__(self):
        return f"{self.title} ({self.room_code})"


class MeetingParticipant(BaseModel):
    ROLE_CHOICES = [
        ('host', 'Host'),
        ('co-host', 'Co-Host'),
        ('attendee', 'Attendee'),
    ]
    INVITE_STATUS_CHOICES = [
        ('invited', 'Invited'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    ]

    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='meeting_participations')
    email = models.EmailField(db_index=True)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, default='attendee', choices=ROLE_CHOICES)
    invite_status = models.CharField(max_length=20, default='invited', choices=INVITE_STATUS_CHOICES)
    is_admitted = models.BooleanField(default=True)
    has_joined = models.BooleanField(default=False)
    joined_at = models.DateTimeField(null=True, blank=True)
    left_at = models.DateTimeField(null=True, blank=True)

    objects = BaseManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ['created_at']
        unique_together = ('meeting', 'email')

    def __str__(self):
        return f"{self.name} <{self.email}> in {self.meeting.title}"

