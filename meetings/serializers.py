from rest_framework import serializers
from .models import Meeting, MeetingParticipant
from accounts.models import User


class MeetingParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = MeetingParticipant
        fields = [
            'id', 'email', 'name', 'role', 'invite_status',
            'is_admitted', 'has_joined', 'joined_at', 'left_at', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class MeetingHostSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'role']


class MeetingListSerializer(serializers.ModelSerializer):
    host = MeetingHostSerializer(read_only=True)
    participants_count = serializers.SerializerMethodField()
    has_ai_summary = serializers.SerializerMethodField()
    candidate_name = serializers.SerializerMethodField()

    class Meta:
        model = Meeting
        fields = [
            'id', 'title', 'description', 'host', 'status',
            'scheduled_start', 'scheduled_end', 'actual_start', 'actual_end',
            'is_instant', 'room_code', 'passcode', 'allowed_roles',
            'is_locked', 'waiting_room_enabled', 'template_type',
            'candidate_application', 'candidate_name',
            'agenda_items', 'active_presentation', 'recording_url',
            'participants_count', 'has_ai_summary', 'created_at', 'updated_at'
        ]

    def get_participants_count(self, obj) -> int:
        return obj.participants.count()

    def get_has_ai_summary(self, obj) -> bool:
        return bool(obj.ai_summary and obj.ai_summary.strip())

    def get_candidate_name(self, obj) -> str:
        if obj.candidate_application and obj.candidate_application.candidate:
            return obj.candidate_application.candidate.get_full_name()
        return ''


class MeetingDetailSerializer(serializers.ModelSerializer):
    host = MeetingHostSerializer(read_only=True)
    participants = MeetingParticipantSerializer(many=True, read_only=True)
    recording_file_url = serializers.SerializerMethodField()
    candidate_summary = serializers.SerializerMethodField()

    class Meta:
        model = Meeting
        fields = [
            'id', 'title', 'description', 'host', 'status',
            'scheduled_start', 'scheduled_end', 'actual_start', 'actual_end',
            'is_instant', 'room_code', 'passcode', 'allowed_roles',
            'is_locked', 'waiting_room_enabled', 'template_type',
            'candidate_application', 'candidate_summary',
            'agenda_items', 'raised_hands', 'recent_reactions',
            'active_presentation', 'code_sandbox', 'whiteboard_data', 'framework_data',
            'recording_url', 'recording_file_url',
            'transcript_raw', 'ai_summary', 'key_decisions', 'action_items',
            'participants', 'created_at', 'updated_at'
        ]

    def get_recording_file_url(self, obj) -> str:
        if obj.recording_file:
            return obj.recording_file.url
        return obj.recording_url or ''

    def get_candidate_summary(self, obj) -> dict:
        if not obj.candidate_application:
            return {}
        app = obj.candidate_application
        cand = app.candidate
        return {
            'application_id': str(app.id),
            'candidate_id': str(cand.id),
            'name': cand.get_full_name(),
            'email': cand.email,
            'job_title': app.job_posting.title if app.job_posting else 'General Role',
            'stage': app.stage,
            'match_score': app.match_score,
            'matched_skills': app.matched_skills or [],
            'missing_skills': app.missing_skills or [],
        }



class InviteeItemSerializer(serializers.Serializer):
    email = serializers.EmailField()
    name = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    role = serializers.ChoiceField(choices=['host', 'co-host', 'attendee'], default='attendee')


class MeetingCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    scheduled_start = serializers.DateTimeField(required=False, allow_null=True)
    scheduled_end = serializers.DateTimeField(required=False, allow_null=True)
    is_instant = serializers.BooleanField(default=False)
    passcode = serializers.CharField(max_length=32, required=False, allow_blank=True, default='')
    allowed_roles = serializers.CharField(max_length=100, default='admin,hr,manager,employee')
    is_locked = serializers.BooleanField(default=False, required=False)
    waiting_room_enabled = serializers.BooleanField(default=False, required=False)
    template_type = serializers.CharField(max_length=50, default='general', required=False)
    candidate_application_id = serializers.UUIDField(required=False, allow_null=True)
    framework_data = serializers.DictField(required=False, default=dict)
    agenda_items = serializers.ListField(required=False, default=list)
    send_invitations = serializers.BooleanField(default=True, required=False)
    invitees = InviteeItemSerializer(many=True, required=False, default=list)


class TranscriptPushSerializer(serializers.Serializer):
    entries = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False
    )


class MeetingChatQuerySerializer(serializers.Serializer):
    question = serializers.CharField(max_length=2000)
    history = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
    )
