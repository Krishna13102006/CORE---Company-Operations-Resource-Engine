from rest_framework import serializers
from .models import Organization, OrgSettings


class OrganizationPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['name', 'slug']


class OrganizationCreateSerializer(serializers.ModelSerializer):
    passkey = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = Organization
        fields = ['name', 'slug', 'passkey']

    def validate_slug(self, value):
        if Organization.objects.filter(slug=value).exists():
            raise serializers.ValidationError('An organization with this slug already exists.')
        return value

    def create(self, validated_data):
        from django.contrib.auth.hashers import make_password
        raw_passkey = validated_data.pop('passkey')
        validated_data['passkey_hash'] = make_password(raw_passkey)
        return Organization.objects.create(**validated_data)


class OrgSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = OrgSettings
        fields = ['max_documents', 'max_users', 'allowed_domains', 'enforce_2fa', 'session_idle_timeout_minutes']


class OrganizationAdminSerializer(serializers.ModelSerializer):
    settings = OrgSettingsSerializer(source='orgsettings', read_only=True)

    class Meta:
        model  = Organization
        fields = ['id', 'name', 'slug', 'plan', 'is_active', 'created_at', 'settings']
        read_only_fields = ['id', 'slug', 'plan', 'created_at']


from .models import OrganizationInvitation


class OrganizationInvitationSerializer(serializers.ModelSerializer):
    inviter_name = serializers.SerializerMethodField()
    invited_by_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = OrganizationInvitation
        fields = [
            'id', 'email', 'first_name', 'last_name', 'role', 'role_display', 'department', 'department_name',
            'manager_email', 'skills', 'inviter', 'inviter_name', 'invited_by_name', 'status', 'expires_at', 'accepted_at',
            'created_at', 'is_valid'
        ]
        read_only_fields = ['id', 'inviter', 'inviter_name', 'invited_by_name', 'status', 'expires_at', 'accepted_at', 'created_at', 'is_valid']

    def get_inviter_name(self, obj):
        if obj.inviter:
            name = f"{obj.inviter.first_name} {obj.inviter.last_name}".strip()
            return name or obj.inviter.email
        return "Administrator"

    def get_invited_by_name(self, obj):
        return self.get_inviter_name(obj)

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None


class InviteMemberCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=['admin', 'hr', 'manager', 'employee'], default='employee')
    department_id = serializers.UUIDField(required=False, allow_null=True)


class AcceptInvitationSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=128)
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    password = serializers.CharField(min_length=8, write_only=True)

    def validate_first_name(self, value):
        from core.validators import validate_and_clean_name
        return validate_and_clean_name(value, 'First name')

    def validate_last_name(self, value):
        from core.validators import validate_and_clean_name
        return validate_and_clean_name(value, 'Last name')

