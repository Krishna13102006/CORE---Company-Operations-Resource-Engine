from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import MailMessage, MailRecipientStatus, MailAttachment

User = get_user_model()

class UserMailSummarySerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'role']

    def get_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.email

class MailAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MailAttachment
        fields = ['id', 'file', 'file_name', 'file_size', 'created_at']

class MailMessageListSerializer(serializers.ModelSerializer):
    sender = UserMailSummarySerializer(read_only=True)
    is_read = serializers.SerializerMethodField()
    is_starred = serializers.SerializerMethodField()
    is_archived = serializers.SerializerMethodField()
    is_acknowledged = serializers.SerializerMethodField()
    recipients = serializers.SerializerMethodField()
    attachments_count = serializers.SerializerMethodField()

    class Meta:
        model = MailMessage
        fields = [
            'id', 'sender', 'subject', 'body', 'created_at', 'is_read', 
            'is_starred', 'is_archived', 'is_acknowledged',
            'priority', 'category_tag', 'requires_acknowledgment',
            'broadcast_channel', 'linked_entity_type', 'linked_entity_id', 'linked_entity_title',
            'is_draft', 'scheduled_for', 'is_sent',
            'recipients', 'parent_message', 'attachments_count'
        ]

    def _get_user_status(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return None
        if not hasattr(obj, '_cached_user_status'):
            obj._cached_user_status = obj.recipient_statuses.filter(recipient=request.user).first()
        return obj._cached_user_status

    def get_is_read(self, obj):
        request = self.context.get('request')
        if request and obj.sender_id == request.user.id:
            return True
        status = self._get_user_status(obj)
        return status.is_read if status else True

    def get_is_starred(self, obj):
        request = self.context.get('request')
        if request and obj.sender_id == request.user.id:
            return obj.is_starred_by_sender
        status = self._get_user_status(obj)
        return status.is_starred if status else False

    def get_is_archived(self, obj):
        request = self.context.get('request')
        if request and obj.sender_id == request.user.id:
            return obj.is_archived_by_sender
        status = self._get_user_status(obj)
        return status.is_archived if status else False

    def get_is_acknowledged(self, obj):
        status = self._get_user_status(obj)
        return status.is_acknowledged if status else False

    def get_recipients(self, obj):
        statuses = obj.recipient_statuses.all().select_related('recipient')
        return [UserMailSummarySerializer(s.recipient).data for s in statuses]

    def get_attachments_count(self, obj):
        return obj.attachments.count()

class MailMessageDetailSerializer(serializers.ModelSerializer):
    sender = UserMailSummarySerializer(read_only=True)
    recipients = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()
    is_starred = serializers.SerializerMethodField()
    is_archived = serializers.SerializerMethodField()
    is_acknowledged = serializers.SerializerMethodField()
    acknowledged_at = serializers.SerializerMethodField()
    attachments = MailAttachmentSerializer(many=True, read_only=True)
    replies = serializers.SerializerMethodField()
    read_receipts = serializers.SerializerMethodField()

    class Meta:
        model = MailMessage
        fields = [
            'id', 'sender', 'subject', 'body', 'created_at', 
            'is_read', 'is_starred', 'is_archived', 'is_acknowledged', 'acknowledged_at',
            'priority', 'category_tag', 'requires_acknowledgment',
            'broadcast_channel', 'linked_entity_type', 'linked_entity_id', 'linked_entity_title',
            'is_draft', 'scheduled_for', 'is_sent',
            'recipients', 'parent_message', 'attachments', 'replies', 'read_receipts'
        ]

    def _get_user_status(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return None
        return obj.recipient_statuses.filter(recipient=request.user).first()

    def get_is_read(self, obj):
        request = self.context.get('request')
        if request and obj.sender_id == request.user.id:
            return True
        status = self._get_user_status(obj)
        return status.is_read if status else True

    def get_is_starred(self, obj):
        request = self.context.get('request')
        if request and obj.sender_id == request.user.id:
            return obj.is_starred_by_sender
        status = self._get_user_status(obj)
        return status.is_starred if status else False

    def get_is_archived(self, obj):
        request = self.context.get('request')
        if request and obj.sender_id == request.user.id:
            return obj.is_archived_by_sender
        status = self._get_user_status(obj)
        return status.is_archived if status else False

    def get_is_acknowledged(self, obj):
        status = self._get_user_status(obj)
        return status.is_acknowledged if status else False

    def get_acknowledged_at(self, obj):
        status = self._get_user_status(obj)
        return status.acknowledged_at if status else None

    def get_recipients(self, obj):
        statuses = obj.recipient_statuses.all().select_related('recipient')
        return [UserMailSummarySerializer(s.recipient).data for s in statuses]

    def get_replies(self, obj):
        if obj.parent_message_id is None:
            child_replies = obj.replies.all().order_by('created_at')
            return MailMessageDetailSerializer(child_replies, many=True, context=self.context).data
        return []

    def get_read_receipts(self, obj):
        request = self.context.get('request')
        # Only sender or admin can view the full read receipts breakdown
        if request and (obj.sender_id == request.user.id or getattr(request.user, 'role', '') in ['admin', 'hr']):
            from .services import communication_service
            return communication_service.get_read_receipts_stats(obj, request.user)
        return None

class ListOrStringField(serializers.Field):
    def to_internal_value(self, data):
        return data
    def to_representation(self, value):
        return value

class MailComposeSerializer(serializers.Serializer):
    target_mode = serializers.ChoiceField(
        choices=['individual', 'all', 'department', 'role', 'project'], 
        default='individual', 
        required=False
    )
    send_to_all = serializers.BooleanField(required=False, default=False)
    department_id = serializers.UUIDField(required=False, allow_null=True)
    target_role = serializers.CharField(max_length=50, required=False, allow_blank=True)
    project_id = serializers.UUIDField(required=False, allow_null=True)
    recipient_ids = ListOrStringField(required=False, default=list)
    draft_id = serializers.UUIDField(required=False, allow_null=True)
    subject = serializers.CharField(max_length=300, required=False, allow_blank=True, default='')
    body = serializers.CharField(required=False, allow_blank=True, default='')
    parent_message_id = serializers.UUIDField(required=False, allow_null=True)

    priority = serializers.ChoiceField(choices=['urgent', 'high', 'normal', 'low'], default='normal', required=False)
    category_tag = serializers.ChoiceField(
        choices=['general', 'announcement', 'action_required', 'fyi', 'compliance'], 
        default='general', 
        required=False
    )
    requires_acknowledgment = serializers.BooleanField(default=False, required=False)

    linked_entity_type = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')
    linked_entity_id = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    linked_entity_title = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')

    is_draft = serializers.BooleanField(default=False, required=False)
    scheduled_for = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        is_draft = attrs.get('is_draft', False)
        if not is_draft:
            if not attrs.get('subject', '').strip():
                raise serializers.ValidationError({"subject": "Subject is required."})
            if not attrs.get('body', '').strip():
                raise serializers.ValidationError({"body": "Body content is required."})

        send_to_all = attrs.get('send_to_all', False)
        target_mode = attrs.get('target_mode', 'individual')
        if send_to_all:
            target_mode = 'all'
            attrs['target_mode'] = 'all'

        recipient_ids_val = attrs.get('recipient_ids')
        attrs['recipient_ids_list'] = []

        if target_mode == 'individual' and not attrs.get('is_draft', False):
            if not recipient_ids_val:
                raise serializers.ValidationError("Please specify at least one recipient or select a broadcast channel.")
            
            if isinstance(recipient_ids_val, list):
                attrs['recipient_ids_list'] = [str(x).strip() for x in recipient_ids_val if str(x).strip()]
            elif isinstance(recipient_ids_val, str):
                import json
                try:
                    val_str = recipient_ids_val.strip()
                    if val_str.startswith('['):
                        attrs['recipient_ids_list'] = json.loads(val_str)
                    else:
                        attrs['recipient_ids_list'] = [x.strip() for x in val_str.split(',') if x.strip()]
                except Exception:
                    raise serializers.ValidationError("Invalid recipient_ids format.")
            else:
                raise serializers.ValidationError("recipient_ids must be a list or comma-separated string.")
        return attrs
