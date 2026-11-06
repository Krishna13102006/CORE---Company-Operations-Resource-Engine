from rest_framework import serializers
from .models import Playbook, AutomationExecutionLog


class PlaybookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Playbook
        fields = [
            'id',
            'org_id',
            'name',
            'slug',
            'category',
            'description',
            'trigger_event',
            'is_enabled',
            'config',
            'execution_count',
            'last_triggered_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'org_id', 'slug', 'execution_count', 'last_triggered_at', 'created_at', 'updated_at']


class PlaybookToggleSerializer(serializers.Serializer):
    is_enabled = serializers.BooleanField()


class PlaybookConfigSerializer(serializers.Serializer):
    config = serializers.DictField()


class AutomationExecutionLogSerializer(serializers.ModelSerializer):
    triggered_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AutomationExecutionLog
        fields = [
            'id',
            'org_id',
            'playbook_slug',
            'trigger_source',
            'status',
            'steps_executed',
            'error_message',
            'duration_ms',
            'created_at',
            'triggered_by_name',
        ]
        read_only_fields = fields

    def get_triggered_by_name(self, obj):
        if obj.triggered_by:
            return obj.triggered_by.get_full_name() or obj.triggered_by.email
        return 'System Automated Agent'
