import uuid
from django.db import models
from core.models import BaseModel


class Document(BaseModel):
    PROCESSING_STATUS = [
        ('uploaded',    'Uploaded'),
        ('processing',  'Processing'),
        ('searchable',  'Searchable'),
        ('failed',      'Failed'),
    ]

    FILE_TYPE_CHOICES = [
        ('pdf',   'PDF'),
        ('docx',  'DOCX'),
        ('txt',   'TXT'),
        ('md',    'Markdown Article'),
        ('audio', 'Voice Memo'),
    ]

    title              = models.CharField(max_length=500)
    file_path          = models.CharField(max_length=1000, blank=True, default='')
    file_type          = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES)
    file_size          = models.BigIntegerField(default=0)
    uploaded_by        = models.ForeignKey(
                             'accounts.User',
                             on_delete=models.SET_NULL,
                             null=True,
                             related_name='uploaded_documents'
                         )
    status             = models.CharField(
                             max_length=20,
                             choices=PROCESSING_STATUS,
                             default='uploaded'
                         )
    allowed_roles      = models.CharField(
                             max_length=255,
                             default='admin,hr,manager,employee',
                             help_text='Comma-separated user roles allowed to access this document'
                         )
    is_article         = models.BooleanField(default=False)
    article_content    = models.TextField(blank=True, default='')
    is_audio           = models.BooleanField(default=False)
    audio_transcript   = models.TextField(blank=True, default='')
    external_source    = models.CharField(max_length=50, blank=True, default='upload')
    external_source_id = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['org', 'status', '-created_at']),
            models.Index(fields=['org', 'is_article']),
            models.Index(fields=['org', 'external_source']),
        ]

    def __str__(self):
        return self.title


class DocumentMetadata(models.Model):
    document   = models.OneToOneField(
                     Document,
                     on_delete=models.CASCADE,
                     related_name='metadata'
                 )
    category   = models.CharField(max_length=100, blank=True, default='')
    keywords   = models.JSONField(default=list)
    entities   = models.JSONField(default=dict)
    summary    = models.TextField(blank=True, default='', help_text='3-bullet AI executive summary')
    faq_list   = models.JSONField(default=list, help_text='List of 5 generated FAQ questions & answers')
    qdrant_id  = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Metadata for {self.document.title}'


class CloudConnector(BaseModel):
    CONNECTOR_TYPES = [
        ('gdrive',   'Google Drive Folder'),
        ('notion',   'Notion Workspace / Database'),
        ('onedrive', 'Microsoft OneDrive'),
    ]
    name                = models.CharField(max_length=200)
    connector_type      = models.CharField(max_length=20, choices=CONNECTOR_TYPES)
    target_url          = models.CharField(max_length=1000, blank=True, default='')
    access_token        = models.CharField(max_length=1000, blank=True, default='')
    folder_id           = models.CharField(max_length=255, blank=True, default='')
    auto_sync           = models.BooleanField(default=True)
    sync_interval_hours = models.IntegerField(default=24)
    last_synced_at      = models.DateTimeField(null=True, blank=True)
    sync_status         = models.CharField(max_length=50, default='idle')
    last_sync_log       = models.TextField(blank=True, default='')
    documents_imported  = models.IntegerField(default=0)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['org', 'connector_type']),
            models.Index(fields=['org', 'sync_status']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_connector_type_display()})"


class DocumentChunk(models.Model):
    # Does not inherit BaseModel — it is a child of Document,
    # not a standalone tenant entity. Shares Document's lifecycle.
    # When Document is soft-deleted, its chunks become unreachable
    # (queries always join through Document's is_deleted=False filter).

    id          = models.UUIDField(
                      primary_key=True,
                      default=uuid.uuid4,
                      editable=False
                  )
    document    = models.ForeignKey(
                      Document,
                      on_delete=models.CASCADE,
                      related_name='chunks'
                  )
    org         = models.ForeignKey(
                      'tenants.Organization',
                      on_delete=models.CASCADE
                  )
    chunk_index = models.IntegerField(
                      help_text='Sequential index of this chunk within the document (0-based)'
                  )
    page_number = models.IntegerField(
                      null=True,
                      blank=True,
                      help_text='Sequential page number of this chunk (1-based)'
                  )
    chunk_text  = models.TextField(
                      help_text='Raw text content of this chunk'
                  )
    token_count = models.IntegerField(
                      default=0,
                      help_text='Approximate token count of this chunk'
                  )
    qdrant_id   = models.CharField(
                      max_length=255,
                      blank=True,
                      default='',
                      help_text='Vector ID in Qdrant — populated in Phase 3'
                  )
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['document', 'chunk_index']
        unique_together = [['document', 'chunk_index']]

    def __str__(self):
        return f'Chunk {self.chunk_index} of {self.document.title}'

