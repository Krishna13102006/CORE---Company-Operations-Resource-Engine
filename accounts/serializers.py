from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User


class RegisterSerializer(serializers.Serializer):
    email       = serializers.EmailField()
    password    = serializers.CharField(write_only=True, min_length=8)
    first_name  = serializers.CharField(max_length=100)
    last_name   = serializers.CharField(max_length=100)
    role        = serializers.ChoiceField(choices=['admin', 'hr', 'manager', 'employee'])

    # admin signup fields
    new_org_name             = serializers.CharField(max_length=255, required=False, allow_blank=True)
    new_org_slug             = serializers.SlugField(max_length=100, required=False, allow_blank=True)
    new_org_passkey          = serializers.CharField(min_length=6, write_only=True, required=False, allow_blank=True)
    new_org_hr_passkey       = serializers.CharField(min_length=6, write_only=True, required=False, allow_blank=True)
    new_org_manager_passkey  = serializers.CharField(min_length=6, write_only=True, required=False, allow_blank=True)
    new_org_employee_passkey = serializers.CharField(min_length=6, write_only=True, required=False, allow_blank=True)

    # non-admin signup fields
    org_slug = serializers.SlugField(required=False, allow_blank=True)
    passkey  = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate_first_name(self, value):
        from core.validators import validate_and_clean_name
        return validate_and_clean_name(value, 'First name')

    def validate_last_name(self, value):
        from core.validators import validate_and_clean_name
        return validate_and_clean_name(value, 'Last name')

    def validate_new_org_name(self, value):
        if value:
            from core.validators import validate_and_clean_org_name
            return validate_and_clean_org_name(value, 'Organization name')
        return value

    def validate_email(self, value):
        from accounts.models import User
        from core.validators import sanitize_string
        value = sanitize_string(value).lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email address already exists.")
        return value

    def validate_role(self, value):
        valid_roles = ['admin', 'hr', 'manager', 'employee']
        if value not in valid_roles:
            raise serializers.ValidationError(
                f"Role must be one of: {', '.join(valid_roles)}"
            )
        return value

    def validate(self, data):
        role = data.get('role')
        is_admin_joining = (role == 'admin' and data.get('org_slug'))

        if role == 'admin' and not is_admin_joining:
            if not data.get('new_org_name'):
                raise serializers.ValidationError({'new_org_name': 'Required for admin signup.'})
            if not data.get('new_org_slug'):
                raise serializers.ValidationError({'new_org_slug': 'Required for admin signup.'})
            if not data.get('new_org_passkey'):
                raise serializers.ValidationError({'new_org_passkey': 'Admin passkey is required.'})
            if not data.get('new_org_hr_passkey'):
                raise serializers.ValidationError({'new_org_hr_passkey': 'HR passkey is required.'})
            if not data.get('new_org_manager_passkey'):
                raise serializers.ValidationError({'new_org_manager_passkey': 'Manager passkey is required.'})
            if not data.get('new_org_employee_passkey'):
                raise serializers.ValidationError({'new_org_employee_passkey': 'Employee passkey is required.'})
            
            slug = data.get('new_org_slug')
            from tenants.models import Organization
            if Organization.objects.filter(slug=slug).exists():
                raise serializers.ValidationError({'new_org_slug': 'An organization with this slug already exists.'})
        else:
            if not data.get('org_slug'):
                raise serializers.ValidationError({'org_slug': 'Required for non-admin signup.'})
            if not data.get('passkey'):
                raise serializers.ValidationError({'passkey': 'Required for non-admin signup.'})
        return data


class UserSerializer(serializers.ModelSerializer):
    org_name = serializers.SerializerMethodField()
    org_slug = serializers.SerializerMethodField()
    department_id = serializers.SerializerMethodField()
    department_ids = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    employee_profile_id = serializers.SerializerMethodField()
    status_message = serializers.SerializerMethodField()
    status_emoji = serializers.SerializerMethodField()
    status_updated_at = serializers.SerializerMethodField()
    calendar_feed_url = serializers.SerializerMethodField()
    org_enforce_2fa = serializers.SerializerMethodField()
    session_idle_timeout_minutes = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()
    last_seen_display = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'role', 'is_superuser', 'is_2fa_enabled', 'org', 'org_name', 'org_slug',
            'department_id', 'department_ids', 'department_name', 'employee_profile_id',
            'status_message', 'status_emoji', 'status_updated_at', 'calendar_feed_url',
            'org_enforce_2fa', 'session_idle_timeout_minutes', 'is_online', 'last_seen_at', 'last_seen_display'
        ]
        read_only_fields = [
            'id', 'is_superuser', 'is_2fa_enabled', 'org', 'org_name', 'org_slug', 'department_id', 'department_ids', 'department_name',
            'employee_profile_id', 'status_message', 'status_emoji', 'status_updated_at', 'calendar_feed_url',
            'org_enforce_2fa', 'session_idle_timeout_minutes', 'is_online', 'last_seen_at', 'last_seen_display'
        ]

    def get_is_online(self, obj):
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and getattr(request.user, 'is_authenticated', False):
            if str(obj.id) == str(request.user.id):
                return True
        return obj.is_online

    def get_last_seen_display(self, obj):
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and getattr(request.user, 'is_authenticated', False):
            if str(obj.id) == str(request.user.id):
                return 'Online now'
        if not obj.last_seen_at:
            return 'Never'
        from django.utils import timezone
        diff = timezone.now() - obj.last_seen_at
        secs = diff.total_seconds()
        if secs < 300:
            return 'Online now'
        elif secs < 3600:
            return f'{max(1, int(secs // 60))}m ago'
        elif secs < 86400:
            return f'{max(1, int(secs // 3600))}h ago'
        else:
            return f'{max(1, int(secs // 86400))}d ago'

    def get_org_name(self, obj):
        return obj.org.name if obj.org else None

    def get_org_slug(self, obj):
        return obj.org.slug if obj.org else None

    def get_department_id(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            dept = obj.employee_profile.department
            if dept and not dept.is_deleted:
                return str(dept.id)
            first_m = obj.employee_profile.departments.filter(is_deleted=False).first()
            if first_m:
                return str(first_m.id)
        
        headed_dept = obj.headed_departments.filter(is_deleted=False).first()
        if headed_dept:
            return str(headed_dept.id)

        return None

    def get_department_ids(self, obj):
        ids = []
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            dept = obj.employee_profile.department
            if dept and not dept.is_deleted:
                ids.append(str(dept.id))
            for d in obj.employee_profile.departments.filter(is_deleted=False):
                s_id = str(d.id)
                if s_id not in ids:
                    ids.append(s_id)
        
        for d in obj.headed_departments.filter(is_deleted=False):
            s_id = str(d.id)
            if s_id not in ids:
                ids.append(s_id)
        return ids

    def get_department_name(self, obj):
        depts = []
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            dept = obj.employee_profile.department
            if dept and not dept.is_deleted:
                depts.append(dept.name)
            for d in obj.employee_profile.departments.filter(is_deleted=False):
                if d.name not in depts:
                    depts.append(d.name)
        
        headed_depts = obj.headed_departments.filter(is_deleted=False)
        for dept in headed_depts:
            if dept.name not in depts:
                depts.append(dept.name)

        if depts:
            return ", ".join(depts)
        return 'Unassigned'

    def get_employee_profile_id(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            return str(obj.employee_profile.id)
        return None

    def get_status_message(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            return obj.employee_profile.status_message
        return None

    def get_status_emoji(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            return obj.employee_profile.status_emoji
        return None

    def get_status_updated_at(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            val = obj.employee_profile.status_updated_at
            return val.isoformat() if val else None
        return None

    def get_calendar_feed_url(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            emp_id = obj.employee_profile.id
            import hashlib
            from django.conf import settings
            token = hashlib.sha256(f"{emp_id}-{settings.SECRET_KEY}".encode()).hexdigest()[:16]
            return f"/api/teams/leave/feed/{emp_id}/{token}/"
        return None

    def get_org_enforce_2fa(self, obj):
        if obj.org and hasattr(obj.org, 'orgsettings'):
            return obj.org.orgsettings.enforce_2fa
        return False

    def get_session_idle_timeout_minutes(self, obj):
        if obj.org and hasattr(obj.org, 'orgsettings'):
            return getattr(obj.org.orgsettings, 'session_idle_timeout_minutes', 30)
        return 30


class CustomTokenSerializer(TokenObtainPairSerializer):
    # adds org_id and role into the JWT payload
    @classmethod
    def get_token(cls, user):
        token          = super().get_token(user)
        token['role']  = user.role
        token['org_id'] = str(user.org_id) if user.org_id else None
        return token

    def validate(self, attrs):
        email = (attrs.get('email') or attrs.get(self.username_field) or '').strip()
        password = attrs.get('password') or ''

        if not email:
            raise serializers.ValidationError({
                'detail': 'Please enter your email address.'
            })
        if not password:
            raise serializers.ValidationError({
                'detail': 'Please enter your password.'
            })

        from accounts.models import User
        user = User.objects.filter(email__iexact=email).first()

        if not user:
            raise serializers.ValidationError({
                'detail': 'No account exists with this email address. Please check your email or create an account.'
            })

        if not user.is_active or user.is_deleted:
            raise serializers.ValidationError({
                'detail': 'This account has been deactivated. Please contact your organization administrator.'
            })

        if not user.check_password(password):
            raise serializers.ValidationError({
                'detail': 'Incorrect password. Please try again or click "Forgot password?" to reset it.'
            })

        # Set user and generate tokens directly (eliminates redundant DB query & duplicate PBKDF2 hash)
        self.user = user
        refresh = self.get_token(self.user)

        from django.contrib.auth.models import update_last_login
        update_last_login(None, self.user)

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }



class UserAdminSerializer(serializers.ModelSerializer):
    org_name = serializers.SerializerMethodField()
    task_stats = serializers.SerializerMethodField()
    department_id = serializers.SerializerMethodField()
    department_ids = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    employee_profile_id = serializers.SerializerMethodField()
    status_message = serializers.SerializerMethodField()
    status_emoji = serializers.SerializerMethodField()
    status_updated_at = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()
    last_seen_display = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'role', 'is_active',
            'created_at', 'org_name', 'task_stats', 'department_id', 'department_ids',
            'department_name', 'employee_profile_id',
            'status_message', 'status_emoji', 'status_updated_at',
            'is_online', 'last_seen_at', 'last_seen_display'
        ]
        read_only_fields = [
            'id', 'email', 'created_at', 'org_name', 'task_stats',
            'department_id', 'department_ids', 'department_name', 'employee_profile_id',
            'status_message', 'status_emoji', 'status_updated_at',
            'is_online', 'last_seen_at', 'last_seen_display'
        ]

    def get_is_online(self, obj):
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and getattr(request.user, 'is_authenticated', False):
            if str(obj.id) == str(request.user.id):
                return True
        return obj.is_online

    def get_last_seen_display(self, obj):
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and getattr(request.user, 'is_authenticated', False):
            if str(obj.id) == str(request.user.id):
                return 'Online now'
        if not obj.last_seen_at:
            return 'Never'
        from django.utils import timezone
        diff = timezone.now() - obj.last_seen_at
        secs = diff.total_seconds()
        if secs < 300:
            return 'Online now'
        elif secs < 3600:
            return f'{max(1, int(secs // 60))}m ago'
        elif secs < 86400:
            return f'{max(1, int(secs // 3600))}h ago'
        else:
            return f'{max(1, int(secs // 86400))}d ago'

    def get_org_name(self, obj):
        return obj.org.name if obj.org else None

    def get_department_id(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            dept = obj.employee_profile.department
            if dept and not dept.is_deleted:
                return str(dept.id)
            first_m = obj.employee_profile.departments.filter(is_deleted=False).first()
            if first_m:
                return str(first_m.id)
        
        headed_dept = obj.headed_departments.filter(is_deleted=False).first()
        if headed_dept:
            return str(headed_dept.id)

        return None

    def get_department_ids(self, obj):
        ids = []
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            dept = obj.employee_profile.department
            if dept and not dept.is_deleted:
                ids.append(str(dept.id))
            for d in obj.employee_profile.departments.filter(is_deleted=False):
                s_id = str(d.id)
                if s_id not in ids:
                    ids.append(s_id)
        
        for d in obj.headed_departments.filter(is_deleted=False):
            s_id = str(d.id)
            if s_id not in ids:
                ids.append(s_id)
        return ids

    def get_department_name(self, obj):
        depts = []
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            dept = obj.employee_profile.department
            if dept and not dept.is_deleted:
                depts.append(dept.name)
            for d in obj.employee_profile.departments.filter(is_deleted=False):
                if d.name not in depts:
                    depts.append(d.name)
        
        # Add departments the user heads
        headed_depts = obj.headed_departments.filter(is_deleted=False)
        for dept in headed_depts:
            if dept.name not in depts:
                depts.append(dept.name)

        if depts:
            return ", ".join(depts)
        return 'Unassigned'

    def get_employee_profile_id(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            return str(obj.employee_profile.id)
        return None

    def get_status_message(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            return obj.employee_profile.status_message
        return None

    def get_status_emoji(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            return obj.employee_profile.status_emoji
        return None

    def get_status_updated_at(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            val = obj.employee_profile.status_updated_at
            return val.isoformat() if val else None
        return None

    def get_task_stats(self, obj):
        task_map = getattr(self, 'context', {}).get('task_map')
        if task_map is not None:
            stats = task_map.get(str(obj.id), {})
            return {
                'total': stats.get('total', 0),
                'completed': stats.get('completed', 0),
                'overdue': stats.get('overdue', 0),
            }

        # Fallback for single-user serializer contexts
        from projects.models import Task
        from django.utils import timezone
        from django.db.models import Count, Q
        today = timezone.now().date()
        stats = Task.objects.filter(
            assignee=obj,
            is_deleted=False,
            project__is_deleted=False
        ).aggregate(
            total=Count('id'),
            completed=Count('id', filter=Q(status='done')),
            overdue=Count('id', filter=Q(due_date__lt=today) & ~Q(status='done'))
        )
        return {
            'total': stats.get('total') or 0,
            'completed': stats.get('completed') or 0,
            'overdue': stats.get('overdue') or 0,
        }


class UserRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=['admin', 'hr', 'manager', 'employee'])


class UserStatusUpdateSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()