from rest_framework import serializers
from .models import Document, DocumentMetadata


class DocumentMetadataSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DocumentMetadata
        fields = ['category', 'keywords', 'entities', 'summary', 'faq_list', 'qdrant_id']
        read_only_fields = ['entities', 'qdrant_id']


class DocumentSerializer(serializers.ModelSerializer):
    metadata        = DocumentMetadataSerializer(read_only=True)
    uploaded_by_name = serializers.SerializerMethodField()
    file_size_display = serializers.SerializerMethodField()
    chunk_count     = serializers.SerializerMethodField()

    class Meta:
        model  = Document
        fields = [
            'id', 'title', 'file_type', 'file_size', 'file_size_display',
            'status', 'uploaded_by', 'uploaded_by_name', 'allowed_roles',
            'is_article', 'article_content', 'is_audio', 'audio_transcript',
            'external_source', 'created_at', 'updated_at', 'metadata', 'chunk_count'
        ]
        read_only_fields = ['id', 'file_type', 'file_size', 'status', 'uploaded_by', 'created_at', 'updated_at', 'chunk_count']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f'{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}'
        return 'Unknown'

    def get_file_size_display(self, obj):
        size = obj.file_size
        if size < 1024:
            return f'{size} B'
        elif size < 1024 * 1024:
            return f'{size / 1024:.1f} KB'
        else:
            return f'{size / (1024 * 1024):.1f} MB'

    def get_chunk_count(self, obj):
        return obj.chunks.count() if hasattr(obj, 'chunks') else 0



class DocumentUpdateSerializer(serializers.Serializer):
    title         = serializers.CharField(max_length=500, required=False)
    category      = serializers.CharField(max_length=100, required=False, allow_blank=True)
    allowed_roles = serializers.CharField(max_length=255, required=False, allow_blank=True)
    keywords      = serializers.ListField(
                       child=serializers.CharField(max_length=100),
                       required=False
                   )


class DocumentUploadSerializer(serializers.Serializer):
    title    = serializers.CharField(max_length=500)
    category = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    file     = serializers.FileField()
    allowed_roles = serializers.CharField(max_length=255, required=False, default='admin,hr,manager,employee')

    def validate_file(self, value):
        allowed_types = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
        allowed_extensions = ['.pdf', '.docx', '.txt']
        import os
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in allowed_extensions:
            raise serializers.ValidationError('Only PDF, DOCX, and TXT files are allowed.')
        max_size = 50 * 1024 * 1024  # 50MB
        if value.size > max_size:
            raise serializers.ValidationError('File size must not exceed 50MB.')
        return value


class ArticleSerializer(serializers.Serializer):
    id            = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    title         = serializers.CharField(max_length=500)
    content       = serializers.CharField()
    category      = serializers.CharField(max_length=100, required=False, default='Wiki', allow_blank=True)
    allowed_roles = serializers.CharField(max_length=255, required=False, default='admin,hr,manager,employee')


class AudioUploadSerializer(serializers.Serializer):
    title         = serializers.CharField(max_length=500, required=False, allow_blank=True)
    audio_file    = serializers.FileField()
    category      = serializers.CharField(max_length=100, required=False, default='Voice Memos', allow_blank=True)
    allowed_roles = serializers.CharField(max_length=255, required=False, default='admin,hr,manager,employee')

    def validate_audio_file(self, value):
        allowed_extensions = ['.mp3', '.wav', '.m4a', '.ogg', '.webm']
        import os
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in allowed_extensions:
            raise serializers.ValidationError('Only MP3, WAV, M4A, OGG, and WEBM audio files are allowed.')
        max_size = 30 * 1024 * 1024  # 30MB
        if value.size > max_size:
            raise serializers.ValidationError('Audio file size must not exceed 30MB.')
        return value


class CloudConnectorSerializer(serializers.ModelSerializer):
    connector_type_display = serializers.CharField(source='get_connector_type_display', read_only=True)

    class Meta:
        from .models import CloudConnector
        model  = CloudConnector
        fields = [
            'id', 'name', 'connector_type', 'connector_type_display',
            'target_url', 'access_token', 'folder_id', 'auto_sync',
            'sync_interval_hours', 'last_synced_at', 'sync_status',
            'last_sync_log', 'documents_imported', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'sync_status', 'last_synced_at', 'last_sync_log', 'documents_imported', 'created_at', 'updated_at']
        extra_kwargs = {
            'access_token': {'write_only': True}
        }

