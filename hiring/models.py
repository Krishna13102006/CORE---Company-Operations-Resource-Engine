import uuid
from django.db import models
from core.models import BaseModel


class JobPosting(BaseModel):
    STATUS_CHOICES = [
        ('draft',  'Draft'),
        ('open',   'Open'),
        ('closed', 'Closed'),
    ]

    title                  = models.CharField(max_length=300)
    department             = models.CharField(max_length=200, blank=True, default='')
    description            = models.TextField(blank=True, default='')
    requirements           = models.TextField(blank=True, default='')
    experience_requirements = models.TextField(
                                 blank=True,
                                 default='',
                                 help_text='Experience expectations: years, roles, domains (used for AI matching)'
                             )
    status      = models.CharField(
                      max_length=20,
                      choices=STATUS_CHOICES,
                      default='draft'
                  )
    created_by  = models.ForeignKey(
                      'accounts.User',
                      on_delete=models.SET_NULL,
                      null=True,
                      related_name='created_job_postings'
                  )
    closed_at   = models.DateTimeField(null=True, blank=True)
    pipeline_stages = models.JSONField(
                      default=list,
                      blank=True,
                      help_text='Custom stages for this job e.g. [{"id": "applied", "label": "Applied"}, ...]'
                  )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['org', 'status', 'is_deleted'], name='hiring_job_org_status_idx'),
            models.Index(fields=['org', 'is_deleted', '-created_at'], name='hiring_job_org_created_idx'),
        ]

    def __str__(self):
        return self.title


class Candidate(BaseModel):
    first_name  = models.CharField(max_length=100)
    last_name   = models.CharField(max_length=100)
    email       = models.EmailField()
    phone       = models.CharField(max_length=30, blank=True, default='')
    resume_path = models.CharField(
                      max_length=1000,
                      blank=True,
                      default='',
                      help_text='Relative path under MEDIA_ROOT: hiring/<org_id>/<uuid>.pdf'
                  )
    resume_data = models.BinaryField(
                      blank=True,
                      null=True,
                      help_text='Binary PDF content stored directly in Postgres for durable cloud persistence'
                  )

    # Phase 4 — populated by the async resume processing pipeline
    parsed_skills      = models.JSONField(
                             default=list,
                             help_text='List of skill strings extracted from resume'
                         )
    parsed_experience  = models.JSONField(
                             default=list,
                             help_text='List of experience summary strings'
                         )
    parsed_education   = models.JSONField(
                             default=list,
                             help_text='List of education strings'
                         )
    parsed_projects    = models.JSONField(
                             default=list,
                             help_text='List of project entries extracted from resume'
                         )
    parsed_name        = models.CharField(
                             max_length=200,
                             blank=True,
                             default='',
                             help_text='Candidate name as extracted from resume'
                         )
    resume_embedding_id = models.CharField(
                              max_length=255,
                              blank=True,
                              default='',
                              help_text='Qdrant vector ID for this resume in hiring_<org_id> collection'
                          )
    resume_processed   = models.BooleanField(
                             default=False,
                             help_text='True once the async processing pipeline has completed'
                         )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['org', 'email', 'is_deleted'], name='hiring_cand_org_email_idx'),
            models.Index(fields=['org', 'is_deleted', '-created_at'], name='hiring_cand_org_created_idx'),
        ]

    def get_full_name(self):
        full = f'{self.first_name} {self.last_name}'.strip()
        # If full name is just a placeholder like Senior Software Engineer or generic
        if full and full not in ('Senior Software Engineer', 'Candidate Unknown', 'Candidate'):
            return full
        if self.parsed_name and self.parsed_name.strip():
            return self.parsed_name.strip()
        return full or 'Candidate'

    def __str__(self):
        return self.get_full_name()



class Application(BaseModel):
    STAGE_CHOICES = [
        ('applied',    'Applied'),
        ('screening',  'Screening'),
        ('interview',  'Interview'),
        ('offer',      'Offer'),
        ('hired',      'Hired'),
        ('rejected',   'Rejected'),
    ]

    candidate   = models.ForeignKey(
                      Candidate,
                      on_delete=models.CASCADE,
                      related_name='applications'
                  )
    job_posting = models.ForeignKey(
                      JobPosting,
                      on_delete=models.CASCADE,
                      related_name='applications'
                  )
    stage           = models.CharField(
                          max_length=60,
                          default='applied'
                      )
    rejection_reason = models.CharField(
                           max_length=200,
                           blank=True,
                           default=''
                       )
    source           = models.CharField(
                           max_length=50,
                           blank=True,
                           default='other',
                           help_text='Sourcing channel: linkedin, indeed, referral, careers_page, direct, other'
                       )
    source_details   = models.CharField(
                           max_length=255,
                           blank=True,
                           default='',
                           help_text='Referrer name or specific posting details'
                       )

    # Phase 4 — populated on-demand when HR views the candidate drawer
    match_score        = models.FloatField(
                             null=True,
                             blank=True,
                             help_text='Overall weighted match score 0.0-1.0'
                         )
    matched_skills     = models.JSONField(
                             default=list,
                             help_text='Skills found in both resume and job requirements'
                         )
    missing_skills     = models.JSONField(
                             default=list,
                             help_text='Required skills not found in the resume'
                         )
    # 4-category breakdown scores (0.0 - 1.0 each)
    score_skills       = models.FloatField(null=True, blank=True, help_text='Skills category score 0-1')
    score_experience   = models.FloatField(null=True, blank=True, help_text='Experience category score 0-1')
    score_projects     = models.FloatField(null=True, blank=True, help_text='Projects category score 0-1')
    score_education    = models.FloatField(null=True, blank=True, help_text='Education category score 0-1')
    match_computed_at  = models.DateTimeField(
                             null=True,
                             blank=True,
                             help_text='When the match score was last computed'
                         )

    class Meta:
        ordering = ['-created_at']
        unique_together = [['candidate', 'job_posting']]
        indexes = [
            models.Index(fields=['org', 'job_posting', 'stage', 'is_deleted'], name='hiring_app_org_job_stage_idx'),
            models.Index(fields=['org', 'stage', 'is_deleted'], name='hiring_app_org_stage_idx'),
            models.Index(fields=['org', 'candidate', 'is_deleted'], name='hiring_app_org_cand_idx'),
            models.Index(fields=['org', 'is_deleted', '-created_at'], name='hiring_app_org_created_idx'),
        ]

    def __str__(self):
        return f'{self.candidate.get_full_name()} → {self.job_posting.title}'


class StageHistory(models.Model):
    # Immutable audit trail — no soft delete, no BaseModel
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org         = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE)
    application = models.ForeignKey(
                      Application,
                      on_delete=models.CASCADE,
                      related_name='stage_history'
                  )
    from_stage  = models.CharField(max_length=60, blank=True, default='')
    to_stage    = models.CharField(max_length=60)
    moved_by    = models.ForeignKey(
                      'accounts.User',
                      on_delete=models.SET_NULL,
                      null=True
                  )
    moved_at    = models.DateTimeField(auto_now_add=True)
    notes       = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['moved_at']
        indexes = [
            models.Index(fields=['application', 'moved_at'], name='hiring_stage_app_moved_idx'),
            models.Index(fields=['org', 'to_stage', 'moved_at'], name='hiring_stage_org_to_idx'),
        ]


class InterviewNote(models.Model):
    # Append-only — no soft delete, no BaseModel
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org         = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE)
    application = models.ForeignKey(
                      Application,
                      on_delete=models.CASCADE,
                      related_name='interview_notes'
                  )
    interviewer = models.ForeignKey(
                      'accounts.User',
                      on_delete=models.SET_NULL,
                      null=True
                  )
    score       = models.IntegerField(
                      null=True,
                      blank=True,
                      help_text='Score from 1 to 5'
                  )
    notes       = models.TextField()
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class InterviewSchedule(models.Model):
    """Scheduled interview sessions for a candidate application."""
    INTERVIEW_TYPES = [
        ('video',      'Video Call'),
        ('phone',      'Phone Screen'),
        ('in_person',  'In Person'),
        ('technical',  'Technical Round'),
    ]
    STATUS_CHOICES = [
        ('scheduled',   'Scheduled'),
        ('completed',   'Completed'),
        ('cancelled',   'Cancelled'),
        ('rescheduled', 'Rescheduled'),
    ]

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org            = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE)
    application    = models.ForeignKey(
                         Application,
                         on_delete=models.CASCADE,
                         related_name='interview_schedules'
                     )
    scheduled_at   = models.DateTimeField(help_text='UTC datetime of the interview')
    duration_min   = models.IntegerField(default=60, help_text='Duration in minutes')
    interview_type = models.CharField(max_length=20, choices=INTERVIEW_TYPES, default='video')
    meeting_link   = models.URLField(blank=True, default='')
    interviewers   = models.JSONField(
                         default=list,
                         help_text='List of interviewer names e.g. ["Alice Smith", "Bob Lee"]'
                     )
    agenda         = models.TextField(blank=True, default='')
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    created_by     = models.ForeignKey(
                         'accounts.User',
                         on_delete=models.SET_NULL,
                         null=True,
                         related_name='created_interviews'
                     )
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['scheduled_at']
        indexes = [
            models.Index(fields=['application', 'status'], name='hiring_sched_app_status_idx'),
            models.Index(fields=['org', 'status', 'scheduled_at'], name='hiring_sched_org_sched_idx'),
        ]

    def __str__(self):
        return f'{self.interview_type} — {self.application} @ {self.scheduled_at}'


class Scorecard(models.Model):
    """
    Structured evaluation scorecard submitted by a reviewer for a specific pipeline stage.
    Multiple reviewers can each submit their own scorecard for the same application+stage.
    Dimensions stored in JSON so they can vary by stage without extra columns.
    """
    RECOMMENDATION_CHOICES = [
        ('strong_yes', 'Strong Yes'),
        ('yes',        'Yes'),
        ('maybe',      'Maybe / Neutral'),
        ('no',         'No'),
        ('strong_no',  'Strong No'),
    ]

    # Stage → dimension labels mapping (used by frontend for rendering)
    STAGE_DIMENSIONS = {
        'screening':  ['communication', 'role_understanding', 'motivation', 'culture_fit'],
        'interview':  ['problem_solving', 'technical_depth', 'experience_relevance', 'communication'],
        'technical':  ['code_quality', 'system_design', 'debugging', 'technical_depth'],
        'offer':      ['leadership', 'culture_fit', 'growth_potential', 'overall'],
        'default':    ['communication', 'technical_depth', 'culture_fit', 'overall'],
    }

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org            = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE)
    application    = models.ForeignKey(
                         Application,
                         on_delete=models.CASCADE,
                         related_name='scorecards'
                     )
    stage          = models.CharField(max_length=20, help_text='Pipeline stage this scorecard is for')
    reviewer       = models.ForeignKey(
                         'accounts.User',
                         on_delete=models.SET_NULL,
                         null=True,
                         related_name='submitted_scorecards'
                     )
    # e.g. {"communication": 4, "technical_depth": 3, "culture_fit": 5, "overall": 4}
    scores         = models.JSONField(default=dict)
    recommendation = models.CharField(max_length=20, choices=RECOMMENDATION_CHOICES)
    strengths      = models.TextField(blank=True, default='')
    concerns       = models.TextField(blank=True, default='')
    submitted_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['submitted_at']
        indexes = [
            models.Index(fields=['application', 'stage'], name='hiring_score_app_stage_idx'),
            models.Index(fields=['org', 'stage'], name='hiring_score_org_stage_idx'),
        ]

    def __str__(self):
        reviewer_name = self.reviewer.get_full_name() if self.reviewer else 'Unknown'
        return f'Scorecard by {reviewer_name} — {self.stage}'


class EmailTemplate(BaseModel):
    TEMPLATE_TYPES = [
        ('applied',   'Application Received'),
        ('interview', 'Interview Scheduled'),
        ('offer',     'Offer Extended'),
        ('rejected',  'Application Rejected'),
    ]
    name          = models.CharField(max_length=200)
    template_type = models.CharField(max_length=20, choices=TEMPLATE_TYPES)
    subject       = models.CharField(max_length=300)
    body          = models.TextField(help_text='Variables: {candidate_name}, {job_title}, {company_name}')

    class Meta:
        ordering = ['name']
        unique_together = [['org', 'template_type']]

    def __str__(self):
        return f'{self.name} ({self.template_type})'


class EmailLog(models.Model):
    DIRECTION_CHOICES = [
        ('outbound', 'Outbound'),
        ('inbound',  'Inbound'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org          = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE)
    application  = models.ForeignKey(
                       Application,
                       on_delete=models.CASCADE,
                       related_name='emails'
                   )
    direction    = models.CharField(max_length=10, choices=DIRECTION_CHOICES, default='outbound')
    from_email   = models.EmailField(blank=True, default='')
    to_email     = models.EmailField()
    subject      = models.CharField(max_length=300)
    body         = models.TextField()
    message_id   = models.CharField(max_length=255, blank=True, default='')
    sent_at      = models.DateTimeField(auto_now_add=True)
    status       = models.CharField(max_length=20, default='sent')

    class Meta:
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['application', 'org', 'sent_at'], name='hiring_email_app_org_sent_idx'),
            models.Index(fields=['org', 'direction', 'sent_at'], name='hiring_email_org_dir_sent_idx'),
        ]

    def __str__(self):
        return f'Email to {self.to_email} — {self.subject} @ {self.sent_at}'


class Offer(BaseModel):
    STATUS_CHOICES = [
        ('draft',     'Draft'),
        ('extended',  'Extended / Sent'),
        ('accepted',  'Accepted'),
        ('declined',  'Declined'),
        ('cancelled', 'Cancelled'),
    ]
    application       = models.OneToOneField(
                            Application,
                            on_delete=models.CASCADE,
                            related_name='offer'
                        )
    salary            = models.DecimalField(max_digits=12, decimal_places=2, help_text='Annual base salary')
    start_date        = models.DateField()
    expiration_date   = models.DateField(null=True, blank=True)
    notes             = models.TextField(blank=True, default='')
    status            = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    extended_at       = models.DateTimeField(null=True, blank=True)
    signed_at         = models.DateTimeField(null=True, blank=True)
    offer_letter_text = models.TextField(blank=True, default='')
    benefits_summary  = models.TextField(
                            blank=True,
                            default='Comprehensive Health, Dental, Vision & 401(k) retirement match',
                            help_text='Summary of benefits offered or custom terms'
                        )
    work_location     = models.CharField(
                            max_length=255,
                            blank=True,
                            default='Remote',
                            help_text='Office address or Remote work status'
                        )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Offer for {self.application.candidate.get_full_name()} — {self.status}'


class InterviewInvitation(models.Model):
    """
    Self-service interview scheduling invitation link (Calendly-style).
    Allows a candidate to pick an interview slot from available interviewer times.
    """
    STATUS_CHOICES = [
        ('pending',   'Pending'),
        ('booked',    'Booked'),
        ('expired',   'Expired'),
        ('cancelled', 'Cancelled'),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org             = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE)
    application     = models.ForeignKey(
                          Application,
                          on_delete=models.CASCADE,
                          related_name='interview_invitations'
                      )
    token           = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    interviewer     = models.ForeignKey(
                          'accounts.User',
                          on_delete=models.SET_NULL,
                          null=True,
                          blank=True,
                          related_name='interview_invitations'
                      )
    interview_type  = models.CharField(max_length=20, default='video')
    duration_min    = models.IntegerField(default=45, help_text='Duration in minutes')
    title           = models.CharField(max_length=255, default='Interview Session')
    notes           = models.TextField(blank=True, default='')
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    booked_schedule = models.OneToOneField(
                          InterviewSchedule,
                          on_delete=models.SET_NULL,
                          null=True,
                          blank=True,
                          related_name='invitation'
                      )
    expires_at      = models.DateTimeField(null=True, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['application', 'status'], name='hiring_inv_app_status_idx'),
            models.Index(fields=['org', 'status'], name='hiring_inv_org_status_idx'),
        ]

    def __str__(self):
        return f'Invitation {self.token} for {self.application.candidate.get_full_name()} ({self.status})'


