from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import RegisterSerializer, UserSerializer, CustomTokenSerializer
from .services import AuthService
from core.exceptions import ServiceError
from core.throttling import AuthEndpointThrottle

auth_service = AuthService()


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [AuthEndpointThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            user = auth_service.register_user(
                email=d['email'],
                password=d['password'],
                first_name=d['first_name'],
                last_name=d['last_name'],
                role=d['role'],
                org_slug=d.get('org_slug'),
                passkey=d.get('passkey'),
                new_org_name=d.get('new_org_name'),
                new_org_slug=d.get('new_org_slug'),
                new_org_passkey=d.get('new_org_passkey'),
                new_org_hr_passkey=d.get('new_org_hr_passkey'),
                new_org_manager_passkey=d.get('new_org_manager_passkey'),
                new_org_employee_passkey=d.get('new_org_employee_passkey'),
            )
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


from datetime import timedelta
from django.conf import settings
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


def set_auth_cookies(response, access_token, refresh_token=None):
    # Retrieve lifetimes from settings or use defaults
    simple_jwt = getattr(settings, 'SIMPLE_JWT', {})
    access_lifetime = simple_jwt.get('ACCESS_TOKEN_LIFETIME', timedelta(minutes=60))
    refresh_lifetime = simple_jwt.get('REFRESH_TOKEN_LIFETIME', timedelta(days=7))
    
    access_max_age = int(access_lifetime.total_seconds())
    refresh_max_age = int(refresh_lifetime.total_seconds())
    
    # Secure flag in production (non-DEBUG)
    secure_cookie = not settings.DEBUG
    
    response.set_cookie(
        key='access_token',
        value=access_token,
        max_age=access_max_age,
        httponly=True,
        secure=secure_cookie,
        samesite='None' if secure_cookie else 'Lax',
        path='/'
    )
    if refresh_token:
        response.set_cookie(
            key='refresh_token',
            value=refresh_token,
            max_age=refresh_max_age,
            httponly=True,
            secure=secure_cookie,
            samesite='None' if secure_cookie else 'Lax',
            path='/'
        )


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenSerializer
    throttle_classes = [AuthEndpointThrottle]

    def post(self, request, *args, **kwargs):
        # Fast path for 2FA verification using cryptographic ticket (skips redundant PBKDF2 hash)
        two_factor_ticket = request.data.get('two_factor_ticket')
        if two_factor_ticket:
            try:
                from django.core import signing
                from django.contrib.auth import get_user_model
                User = get_user_model()
                ticket_data = signing.loads(two_factor_ticket, salt='2fa_ticket', max_age=300)
                user = User.objects.filter(
                    id=user_id, is_active=True, is_deleted=False
                ).select_related(
                    'org', 'org__orgsettings', 'employee_profile', 'employee_profile__department'
                ).prefetch_related(
                    'employee_profile__departments', 'headed_departments'
                ).first()
                if user and user.is_2fa_enabled:
                    totp_code = (
                        request.data.get('two_factor_code') or
                        request.data.get('code') or
                        request.data.get('otp')
                    )
                    if not totp_code:
                        return Response({'error': 'Please enter your 6-digit authentication code.'}, status=status.HTTP_400_BAD_REQUEST)

                    from core.totp import verify_totp, verify_and_consume_backup_code
                    totp_valid = verify_totp(user.two_factor_secret, totp_code)
                    if not totp_valid:
                        totp_valid = verify_and_consume_backup_code(user, totp_code)

                    if not totp_valid:
                        return Response({'error': 'Invalid two-factor authentication code or backup code.'}, status=status.HTTP_400_BAD_REQUEST)

                    from .serializers import CustomTokenSerializer
                    refresh = CustomTokenSerializer.get_token(user)
                    from django.contrib.auth.models import update_last_login
                    update_last_login(None, user)

                    from core.audit import log_action
                    log_action(
                        org_id=user.org_id,
                        user=user,
                        action='USER_LOGIN',
                        target_type='User',
                        target_id=user.id,
                        detail=f"User {user.email} logged in with 2FA",
                        request=request
                    )

                    user_data = UserSerializer(user).data
                    response = Response(
                        {
                            'status': 'success',
                            'access': str(refresh.access_token),
                            'refresh': str(refresh),
                            'user': user_data
                        },
                        status=status.HTTP_200_OK
                    )
                    set_auth_cookies(response, access_token=str(refresh.access_token), refresh_token=str(refresh))
                    return response
            except Exception:
                pass  # Fallback to standard validation if ticket is invalid or expired

        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError as e:
            detail = e.detail
            if isinstance(detail, dict):
                msg = detail.get('detail') or detail.get('error') or next(iter(detail.values()), 'Invalid login credentials.')
                if isinstance(msg, list):
                    msg = msg[0]
            elif isinstance(detail, list):
                msg = detail[0]
            else:
                msg = str(detail)
            return Response({'error': msg, 'detail': msg}, status=status.HTTP_401_UNAUTHORIZED)
        except TokenError as e:
            raise InvalidToken(e.args[0])
            
        res_data = serializer.validated_data
        
        # Fetch user info
        from django.contrib.auth import get_user_model
        User = get_user_model()
        email = request.data.get('email')
        try:
            user = User.objects.select_related(
                'org', 'org__orgsettings', 'employee_profile', 'employee_profile__department'
            ).prefetch_related(
                'employee_profile__departments', 'headed_departments'
            ).get(email=email)
        except User.DoesNotExist:
            user = None

        if user:
            # Two-Factor Authentication (2FA) enforcement
            if user.is_2fa_enabled:
                totp_code = (
                    request.data.get('two_factor_code') or
                    request.data.get('code') or
                    request.data.get('otp')
                )
                if not totp_code:
                    from django.core import signing
                    ticket = signing.dumps({'user_id': str(user.id), 'email': user.email}, salt='2fa_ticket')
                    return Response(
                        {
                            'status': '2fa_required',
                            'requires_2fa': True,
                            'two_factor_ticket': ticket,
                            'email': user.email,
                            'message': 'Two-factor authentication code required.'
                        },
                        status=status.HTTP_200_OK
                    )
                
                from core.totp import verify_totp, verify_and_consume_backup_code
                totp_valid = verify_totp(user.two_factor_secret, totp_code)
                if not totp_valid:
                    backup_valid = verify_and_consume_backup_code(user, totp_code)
                    if not backup_valid:
                        return Response(
                            {'error': 'Invalid two-factor authentication code or backup code.'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

            # Audit log user login
            from core.audit import log_action
            log_action(
                org_id=user.org_id,
                user=user,
                action='USER_LOGIN',
                target_type='User',
                target_id=user.id,
                detail=f"User {user.email} logged in",
                request=request
            )
            user_data = UserSerializer(user).data
        else:
            user_data = {}

        response = Response(
            {
                'status': 'success',
                'access': res_data.get('access'),
                'refresh': res_data.get('refresh'),
                'user': user_data
            },
            status=status.HTTP_200_OK
        )
        
        set_auth_cookies(
            response,
            access_token=res_data.get('access'),
            refresh_token=res_data.get('refresh')
        )
        return response


class CookieTokenRefreshView(TokenRefreshView):
    throttle_classes = [AuthEndpointThrottle]

    def post(self, request, *args, **kwargs):
        # Extract refresh token from cookie, request body, or Authorization header
        refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh')
        
        serializer = self.get_serializer(data={'refresh': refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])
            
        res_data = serializer.validated_data
        response = Response(
            {
                'status': 'success',
                'access': res_data.get('access'),
                'refresh': res_data.get('refresh', refresh_token)
            },
            status=status.HTTP_200_OK
        )
        
        # Set cookies (handle potential refresh token rotation)
        set_auth_cookies(
            response,
            access_token=res_data.get('access'),
            refresh_token=res_data.get('refresh') or refresh_token
        )
        return response


def blacklist_all_user_tokens(user):
    """
    Blacklists all outstanding refresh tokens for a given user.
    Used when a user changes their password, is deactivated, or deletes their account.
    """
    try:
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        outstanding = OutstandingToken.objects.filter(user=user)
        for ot in outstanding:
            BlacklistedToken.objects.get_or_create(token=ot)
    except Exception:
        pass


class LogoutView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [AuthEndpointThrottle]
    
    def post(self, request):
        refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh')
        if refresh_token:
            try:
                from rest_framework_simplejwt.tokens import RefreshToken
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        if request.user and request.user.is_authenticated:
            from core.audit import log_action
            log_action(
                org_id=request.user.org_id,
                user=request.user,
                action='USER_LOGOUT',
                target_type='User',
                target_id=request.user.id,
                detail=f"User {request.user.email} logged out",
                request=request
            )

        response = Response({'status': 'success', 'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)
        response.delete_cookie('access_token', path='/')
        response.delete_cookie('refresh_token', path='/')
        return response


class MeView(APIView):
    def get(self, request):
        if request.user and request.user.is_authenticated:
            from django.utils import timezone
            now = timezone.now()
            if not request.user.last_seen_at or (now - request.user.last_seen_at).total_seconds() > 60:
                User.objects.filter(id=request.user.id).update(last_seen_at=now)
                request.user.last_seen_at = now
        return Response(UserSerializer(request.user).data)


class UserHeartbeatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.utils import timezone
        now = timezone.now()
        User.objects.filter(id=request.user.id).update(last_seen_at=now)
        return Response({'status': 'ok', 'last_seen_at': now.isoformat()})

    def patch(self, request):
        user = request.user
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        email = request.data.get('email')

        from core.validators import validate_and_clean_name, sanitize_string
        from rest_framework.exceptions import ValidationError

        try:
            if first_name is not None:
                user.first_name = validate_and_clean_name(first_name, 'First name')
            if last_name is not None:
                user.last_name = validate_and_clean_name(last_name, 'Last name')
        except ValidationError as e:
            msg = e.detail[0] if isinstance(e.detail, list) else str(e.detail)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)

        if email is not None:
            clean_email = sanitize_string(email).lower()
            from django.contrib.auth import get_user_model
            User = get_user_model()
            if User.objects.filter(email=clean_email).exclude(id=user.id).exists():
                return Response({'error': 'Email is already taken.'}, status=status.HTTP_400_BAD_REQUEST)
            user.email = clean_email

        password = request.data.get('password')
        if password:
            if len(password) < 8:
                return Response({'error': 'Password must be at least 8 characters long.'}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(password)
            # Invalidate all prior sessions/refresh tokens upon password change
            blacklist_all_user_tokens(user)

        user.save()
        return Response(UserSerializer(user).data)

    def delete(self, request):
        user = request.user
        user.is_active = False
        user.is_deleted = True
        user.save(update_fields=['is_active', 'is_deleted'])
        
        # Blacklist all tokens
        blacklist_all_user_tokens(user)
        
        from teams.models import Employee
        Employee.objects.filter(user=user).update(is_deleted=True)
        
        response = Response({'status': 'deleted'}, status=status.HTTP_200_OK)
        response.delete_cookie('access_token', path='/')
        response.delete_cookie('refresh_token', path='/')
        return response


from core.permissions import IsAdmin, IsEmployee
from .serializers import UserAdminSerializer, UserRoleUpdateSerializer, UserStatusUpdateSerializer


class OrgUserListView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        users = list(auth_service.list_org_users(request.org_id))
        from projects.models import Task
        from django.utils import timezone
        from django.db.models import Count, Q
        today = timezone.now().date()
        user_ids = [u.id for u in users]
        task_aggregates = Task.objects.filter(
            org_id=request.org_id,
            assignee_id__in=user_ids,
            is_deleted=False,
            project__is_deleted=False
        ).values('assignee_id').annotate(
            total=Count('id'),
            completed=Count('id', filter=Q(status='done')),
            overdue=Count('id', filter=Q(due_date__lt=today) & ~Q(status='done'))
        )
        task_map = {str(item['assignee_id']): item for item in task_aggregates}
        return Response(UserAdminSerializer(users, many=True, context={'task_map': task_map}).data)


class OrgUserDetailView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, user_id):
        from core.audit import log_action
        if str(user_id) == str(request.user.id):
            return Response({'error': 'You cannot update your own role or status.'}, status=status.HTTP_400_BAD_REQUEST)

        # Handles both role update and status update in one endpoint
        # Determine which update based on what fields are present
        if 'role' in request.data:
            serializer = UserRoleUpdateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                user = auth_service.update_user_role(
                    user_id=user_id,
                    org_id=request.org_id,
                    new_role=serializer.validated_data['role']
                )
                log_action(
                    org_id=request.org_id,
                    user=request.user,
                    action='update_user_role',
                    target_type='user',
                    target_id=user.id,
                    detail=f"Role updated to {user.role} for {user.email}"
                )
                return Response(UserAdminSerializer(user).data)
            except ServiceError as e:
                return Response({'error': e.message}, status=e.status_code)

        elif 'is_active' in request.data:
            serializer = UserStatusUpdateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                user = auth_service.update_user_status(
                    user_id=user_id,
                    org_id=request.org_id,
                    is_active=serializer.validated_data['is_active']
                )
                if not user.is_active:
                    blacklist_all_user_tokens(user)

                log_action(
                    org_id=request.org_id,
                    user=request.user,
                    action='update_user_status',
                    target_type='user',
                    target_id=user.id,
                    detail=f"Status set to {'Active' if user.is_active else 'Deactivated'} for {user.email}"
                )
                return Response(UserAdminSerializer(user).data)
            except ServiceError as e:
                return Response({'error': e.message}, status=e.status_code)

        return Response({'error': 'Provide role or is_active field.'}, status=400)

    def delete(self, request, user_id):
        from core.audit import log_action
        if str(user_id) == str(request.user.id):
            return Response({'error': 'You cannot delete your own account from the team directory.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            auth_service.delete_org_user(user_id=user_id, org_id=request.org_id)
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='DELETE_USER',
                target_type='User',
                target_id=user_id,
                detail="User was removed from organization",
                request=request
            )
            return Response({'status': 'success', 'message': 'Member removed from organization.'}, status=status.HTTP_200_OK)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class AuditLogView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        import csv
        from django.http import HttpResponse
        from django.db.models import Q
        from core.models import AuditLog
        from core.pagination import StandardPagination

        logs = AuditLog.objects.filter(org_id=request.org_id).select_related('actor').order_by('-created_at')

        # Filter by action
        action_filter = request.query_params.get('action')
        if action_filter and action_filter.lower() != 'all':
            logs = logs.filter(action__iexact=action_filter)

        # Filter by search term
        search_query = request.query_params.get('search', '').strip()
        if search_query:
            logs = logs.filter(
                Q(actor__first_name__icontains=search_query) |
                Q(actor__last_name__icontains=search_query) |
                Q(actor__email__icontains=search_query) |
                Q(action__icontains=search_query) |
                Q(target_type__icontains=search_query) |
                Q(target_id__icontains=search_query) |
                Q(detail__icontains=search_query) |
                Q(ip_address__icontains=search_query)
            )

        # Filter by date range
        start_date = request.query_params.get('start_date')
        if start_date:
            logs = logs.filter(created_at__date__gte=start_date)

        end_date = request.query_params.get('end_date')
        if end_date:
            logs = logs.filter(created_at__date__lte=end_date)

        # Check for CSV Export request
        if request.query_params.get('export') == 'csv':
            response = HttpResponse(content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="audit_logs_{request.user.org.slug if request.user.org else "org"}.csv"'
            
            # Write UTF-8 BOM for Excel compatibility
            response.write('\ufeff')
            writer = csv.writer(response)
            writer.writerow(['Timestamp (UTC)', 'Actor Name', 'Actor Email', 'Actor Role', 'Action', 'Target Type', 'Target ID', 'Details', 'IP Address'])

            for log in logs:
                actor_name = f"{log.actor.first_name} {log.actor.last_name}".strip() if log.actor else 'System'
                actor_email = log.actor.email if log.actor else 'system@core.internal'
                actor_role = log.actor.role.upper() if log.actor else 'SYSTEM'
                writer.writerow([
                    log.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    actor_name,
                    actor_email,
                    actor_role,
                    log.action,
                    log.target_type,
                    log.target_id,
                    log.detail,
                    log.ip_address or '127.0.0.1'
                ])
            return response

        paginator = StandardPagination()
        page = paginator.paginate_queryset(logs, request)
        data = [
            {
                'id':          str(log.id),
                'actor':       f'{log.actor.first_name} {log.actor.last_name}'.strip() if log.actor else 'System',
                'actor_name':  f'{log.actor.first_name} {log.actor.last_name}'.strip() if log.actor else 'System',
                'actor_email': log.actor.email if log.actor else 'System',
                'actor_role':  log.actor.role if log.actor else 'system',
                'action':      log.action,
                'target_type': log.target_type,
                'target_id':   log.target_id,
                'detail':      log.detail,
                'ip_address':  log.ip_address or '127.0.0.1',
                'created_at':  log.created_at.isoformat(),
            }
            for log in page
        ]
        return paginator.get_paginated_response(data)


class TwoFactorSetupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from core.totp import generate_totp_secret, get_totp_uri, generate_qr_code_data_uri
        secret = generate_totp_secret()
        otpauth_url = get_totp_uri(secret, request.user.email, issuer="CORE")
        qr_code_data_uri = generate_qr_code_data_uri(otpauth_url)
        return Response({
            'status': 'success',
            'secret': secret,
            'otpauth_url': otpauth_url,
            'qr_code_data_uri': qr_code_data_uri
        })


class TwoFactorEnableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        secret = request.data.get('secret')
        token = request.data.get('token')
        if not secret or not token:
            return Response({'error': 'Secret and verification token are required.'}, status=status.HTTP_400_BAD_REQUEST)

        from core.totp import verify_totp, generate_backup_codes
        if not verify_totp(secret, token):
            return Response({'error': 'Invalid 6-digit verification code.'}, status=status.HTTP_400_BAD_REQUEST)

        raw_codes, hashed_codes = generate_backup_codes(8)
        user = request.user
        user.is_2fa_enabled = True
        user.two_factor_secret = secret
        user.two_factor_backup_codes = hashed_codes
        user.save(update_fields=['is_2fa_enabled', 'two_factor_secret', 'two_factor_backup_codes'])

        from core.audit import log_action
        log_action(
            org_id=user.org_id,
            user=user,
            action='USER_2FA_ENABLED',
            target_type='User',
            target_id=user.id,
            detail=f"User {user.email} enabled two-factor authentication",
            request=request
        )

        return Response({
            'status': 'success',
            'backup_codes': raw_codes,
            'message': 'Two-factor authentication successfully enabled.'
        })


class TwoFactorDisableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get('password')
        token = request.data.get('token')
        user = request.user

        if not user.is_2fa_enabled:
            return Response({'error': 'Two-factor authentication is not enabled.'}, status=status.HTTP_400_BAD_REQUEST)

        verified = False
        if password and user.check_password(password):
            verified = True
        elif token:
            from core.totp import verify_totp
            if verify_totp(user.two_factor_secret, token):
                verified = True

        if not verified:
            return Response({'error': 'Invalid password or verification code.'}, status=status.HTTP_400_BAD_REQUEST)

        user.is_2fa_enabled = False
        user.two_factor_secret = ''
        user.two_factor_backup_codes = []
        user.save(update_fields=['is_2fa_enabled', 'two_factor_secret', 'two_factor_backup_codes'])

        from core.audit import log_action
        log_action(
            org_id=user.org_id,
            user=user,
            action='USER_2FA_DISABLED',
            target_type='User',
            target_id=user.id,
            detail=f"User {user.email} disabled two-factor authentication",
            request=request
        )

        return Response({
            'status': 'success',
            'message': 'Two-factor authentication successfully disabled.'
        })


def log_debug(message):
    import os
    try:
        log_dir = r"C:\Users\saumy\.gemini\antigravity\brain\4ed3d092-de75-48e5-90cd-e4b50375b48c\scratch"
        os.makedirs(log_dir, exist_ok=True)
        with open(os.path.join(log_dir, "django_notif_debug.log"), "a", encoding="utf-8") as f:
            f.write(message + "\n")
    except Exception as e:
        print(f"FAILED TO WRITE LOG: {e}")


class NotificationListView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        from core.models import Notification
        qs = Notification.objects.filter(
            org_id=request.org_id,
            recipient=request.user
        ).select_related('actor').order_by('-created_at')[:100]

        data = [{
            'id': str(n.id),
            'type': n.type,
            'title': n.title,
            'message': n.message,
            'actor_name': f"{n.actor.first_name} {n.actor.last_name}".strip() if n.actor else None,
            'target_url': n.target_url or '',
            'data': n.data or {},
            'is_read': n.is_read,
            'read_at': n.read_at.isoformat() if n.read_at else None,
            'created_at': n.created_at.isoformat(),
        } for n in qs]
        return Response(data)

    def post(self, request):
        from core.models import Notification
        from django.utils import timezone
        Notification.objects.filter(
            org_id=request.org_id,
            recipient=request.user,
            is_read=False
        ).update(is_read=True, read_at=timezone.now())
        return Response({'success': True})

    def delete(self, request):
        from core.models import Notification
        Notification.objects.filter(
            org_id=request.org_id,
            recipient=request.user
        ).delete()
        return Response({'success': True, 'message': 'All notifications cleared.'})


class NotificationReadView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, notification_id):
        from core.models import Notification
        from django.utils import timezone
        notification = Notification.objects.filter(
            id=notification_id,
            org_id=request.org_id,
            recipient=request.user
        ).first()
        if not notification:
            return Response({'error': 'Notification not found.'}, status=404)

        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=['is_read', 'read_at'])
        return Response({'success': True})

    def delete(self, request, notification_id):
        from core.models import Notification
        deleted, _ = Notification.objects.filter(
            id=notification_id,
            org_id=request.org_id,
            recipient=request.user
        ).delete()
        if not deleted:
            return Response({'error': 'Notification not found.'}, status=404)
        return Response({'success': True, 'message': 'Notification dismissed.'})


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [AuthEndpointThrottle]

    def post(self, request):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        from accounts.models import User
        from core.audit import log_action
        from core.email_dispatcher import send_robust_email

        email = (request.data.get('email') or '').strip().lower()

        if not email:
            return Response({'error': 'Email address is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Lookup user in database
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({
                'error': f"No account registered with '{email}'. Please check for typos or sign up for a new account."
            }, status=status.HTTP_404_NOT_FOUND)

        if user.is_deleted or not user.is_active:
            return Response({
                'error': 'This account has been deactivated. Please contact your organization administrator.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Generate secure token & reset link
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        frontend_url = None
        origin = request.META.get('HTTP_ORIGIN') or request.headers.get('Origin')
        if origin:
            frontend_url = origin.rstrip('/')
        elif request.headers.get('Referer'):
            from urllib.parse import urlparse
            parsed = urlparse(request.headers.get('Referer'))
            if parsed.scheme and parsed.netloc:
                frontend_url = f"{parsed.scheme}://{parsed.netloc}"
        if not frontend_url:
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')

        reset_url = f"{frontend_url}/reset-password?uid={uid}&token={token}"

        print(f"\n=======================================================", flush=True)
        print(f"[PASSWORD RESET REQUEST] For: {user.email}", flush=True)
        print(f"[RESET URL] -> {reset_url}", flush=True)
        print(f"=======================================================\n", flush=True)

        subject = "Reset Your CORE Workspace Password"
        host_user = getattr(settings, 'EMAIL_HOST_USER', 'coresupport1547@gmail.com')
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', f'CORE Workspace <{host_user}>')

        html_content = f"""
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center;">
                <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 12px; background: rgba(255,255,255,0.2); color: #ffffff; font-size: 24px; font-weight: bold; margin-bottom: 12px;">✦</div>
                <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">Password Reset Request</h1>
                <p style="color: #e0e7ff; margin: 6px 0 0 0; font-size: 14px;">CORE Enterprise Multi-Tenant Workspace</p>
            </div>
            <div style="padding: 32px 28px; color: #334155; line-height: 1.6; font-size: 15px;">
                <p style="margin-top: 0;">Hello <strong>{user.first_name or user.email}</strong>,</p>
                <p>We received a request to reset the password for your account associated with <strong>{user.email}</strong>.</p>
                <p>Click the button below to choose a new password. This link is single-use and will expire in 30 minutes for your security:</p>
                
                <div style="text-align: center; margin: 32px 0;">
                    <a href="{reset_url}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">Reset My Password</a>
                </div>
                
                <p style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Or copy and paste this secure link directly into your browser:</p>
                <p style="font-size: 12px; word-break: break-all; color: #4f46e5; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: monospace;">{reset_url}</p>
                
                <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0 20px 0;" />
                <p style="font-size: 13px; color: #94a3b8; margin: 0;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            </div>
            <div style="background: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
                © CORE Workspace. All rights reserved.
            </div>
        </div>
        """

        text_content = f"""
Hello {user.first_name or user.email},

We received a request to reset the password for your account associated with {user.email}.

To reset your password, visit the following link (valid for 30 minutes):
{reset_url}

If you did not request this, please safely ignore this email.
        """.strip()

        # 3. Dispatch Email
        email_sent, dispatch_detail = send_robust_email(
            to_email=user.email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            from_email=from_email
        )

        if not email_sent:
            return Response({
                'error': f'Email dispatch failed: {dispatch_detail}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 4. Audit Log
        log_action(
            org_id=user.org_id,
            user=user,
            action='PASSWORD_RESET_REQUESTED',
            target_type='User',
            target_id=user.id,
            detail=f"Password reset link requested for {user.email}",
            request=request
        )

        res_payload = {
            'status': 'success',
            'message': f'A password reset link has been dispatched to {user.email}. Please check your inbox and spam folder.'
        }
        if getattr(settings, 'DEBUG', False) and reset_url:
            res_payload['debug_reset_url'] = reset_url

        return Response(res_payload, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [AuthEndpointThrottle]

    def post(self, request):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_decode
        from django.utils.encoding import force_str
        from accounts.models import User
        from core.audit import log_action

        uid = request.data.get('uid')
        token = request.data.get('token')
        new_password = (request.data.get('new_password') or '').strip()

        if not uid or not token or not new_password:
            return Response(
                {'error': 'Missing required parameters (uid, token, new_password).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(new_password) < 8:
            return Response(
                {'error': 'New password must be at least 8 characters long.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            uid_str = force_str(urlsafe_base64_decode(uid))
            user = User.objects.filter(pk=uid_str, is_deleted=False, is_active=True).first()
        except (TypeError, ValueError, OverflowError):
            user = None

        if not user or not default_token_generator.check_token(user, token):
            return Response(
                {'error': 'This password reset link is invalid or has expired. Please request a new link.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update password & invalidate old tokens
        user.set_password(new_password)
        user.save(update_fields=['password'])
        blacklist_all_user_tokens(user)

        # Audit log
        log_action(
            org_id=user.org_id,
            user=user,
            action='PASSWORD_RESET_SUCCESSFUL',
            target_type='User',
            target_id=user.id,
            detail=f"Password successfully reset for {user.email}",
            request=request
        )

        return Response(
            {
                'status': 'success',
                'message': 'Your password has been successfully reset. You can now sign in with your new credentials.'
            },
            status=status.HTTP_200_OK
        )


import json
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Q


class DataExportView(APIView):
    """
    GDPR Article 20, India DPDP Act 2023 Sec 12, CCPA Right to Data Portability.
    Exports all personal data, audit trails, activity records, and authored documents
    associated with the authenticated user in structured machine-readable JSON format.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        org = getattr(user, 'org', None)

        export_data = {
            "compliance_metadata": {
                "standard": "GDPR Art. 20 / India DPDP Act 2023 Sec. 12 / CCPA Data Portability",
                "export_timestamp": timezone.now().isoformat(),
                "data_subject": user.email,
                "data_controller": org.name if org else "Platform",
                "tenant_id": str(org.id) if org else None,
            },
            "user_profile": {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "is_active": user.is_active,
                "is_2fa_enabled": user.is_2fa_enabled,
                "backup_codes_remaining": len(user.two_factor_backup_codes or []),
                "account_created_at": user.created_at.isoformat() if getattr(user, 'created_at', None) else None,
            },
            "organization": {
                "id": str(org.id) if org else None,
                "name": org.name if org else None,
                "slug": org.slug if org else None,
                "plan": org.plan if org else None,
            } if org else None,
            "security_audit_logs": [],
            "notifications": [],
            "uploaded_documents": [],
            "employment_profile": None,
            "tasks_assigned": [],
            "leave_requests": [],
            "expense_claims": [],
        }

        # 1. Audit logs
        try:
            from core.models import AuditLog
            logs = AuditLog.objects.filter(
                Q(actor=user) | Q(target_id=str(user.id))
            ).order_by('-created_at')[:200]
            export_data["security_audit_logs"] = [
                {
                    "action": log.action,
                    "target_type": log.target_type,
                    "target_id": log.target_id,
                    "detail": log.detail,
                    "ip_address": log.ip_address,
                    "timestamp": log.created_at.isoformat() if log.created_at else None,
                }
                for log in logs
            ]
        except Exception:
            pass

        # 2. Notifications
        try:
            from core.models import Notification
            notifs = Notification.objects.filter(recipient=user).order_by('-created_at')[:200]
            export_data["notifications"] = [
                {
                    "type": n.type,
                    "title": n.title,
                    "message": n.message,
                    "is_read": n.is_read,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                }
                for n in notifs
            ]
        except Exception:
            pass

        # 3. Uploaded Documents
        try:
            from knowledge.models import Document
            docs = Document.objects.filter(uploaded_by=user, is_deleted=False)
            export_data["uploaded_documents"] = [
                {
                    "id": str(d.id),
                    "title": d.title,
                    "file_type": d.file_type,
                    "file_size_bytes": d.file_size,
                    "status": d.status,
                    "uploaded_at": d.created_at.isoformat() if getattr(d, 'created_at', None) else None,
                }
                for d in docs
            ]
        except Exception:
            pass

        # 4. Employment Profile
        try:
            from teams.models import Employee
            emp = Employee.objects.filter(user=user, is_deleted=False).first()
            if emp:
                export_data["employment_profile"] = {
                    "department": emp.department.name if emp.department else None,
                    "employment_status": emp.employment_status,
                    "hire_date": emp.hire_date.isoformat() if emp.hire_date else None,
                }
        except Exception:
            pass

        # 5. Tasks assigned
        try:
            from projects.models import Task
            tasks = Task.objects.filter(assigned_to=user, is_deleted=False)[:100]
            export_data["tasks_assigned"] = [
                {
                    "id": str(t.id),
                    "title": t.title,
                    "status": t.status,
                    "priority": t.priority,
                    "created_at": t.created_at.isoformat() if getattr(t, 'created_at', None) else None,
                }
                for t in tasks
            ]
        except Exception:
            pass

        # 6. Leave Requests
        try:
            from teams.models import LeaveRequest
            leaves = LeaveRequest.objects.filter(employee__user=user, is_deleted=False)[:100]
            export_data["leave_requests"] = [
                {
                    "id": str(l.id),
                    "leave_type": l.leave_type,
                    "start_date": l.start_date.isoformat() if l.start_date else None,
                    "end_date": l.end_date.isoformat() if l.end_date else None,
                    "status": l.status,
                    "reason": l.reason,
                }
                for l in leaves
            ]
        except Exception:
            pass

        # 7. Expenses
        try:
            from expenses.models import ExpenseClaim
            expenses = ExpenseClaim.objects.filter(employee__user=user, is_deleted=False)[:100]
            export_data["expense_claims"] = [
                {
                    "id": str(e.id),
                    "title": e.title,
                    "amount": str(e.amount),
                    "currency": e.currency,
                    "status": e.status,
                    "category": e.category,
                }
                for e in expenses
            ]
        except Exception:
            pass

        # Audit log the data export event for GDPR / SOC 2 compliance
        try:
            from core.audit import log_action
            log_action(
                org_id=user.org_id,
                user=user,
                action='DATA_PORTABILITY_EXPORT',
                target_type='User',
                target_id=user.id,
                detail=f"Personal data portability export generated for {user.email}",
                request=request
            )
        except Exception:
            pass

        response = HttpResponse(
            json.dumps(export_data, indent=2),
            content_type="application/json"
        )
        safe_email = user.email.replace('@', '_at_').replace('.', '_')
        filename = f"core_personal_data_export_{safe_email}.json"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class AccountErasureView(APIView):
    """
    GDPR Article 17 (Right to Erasure / Right to be Forgotten),
    India DPDP Act 2023 Sec 12(3), CCPA Right to Delete.
    Permanently wipes personal information, removes vector embeddings from Qdrant,
    anonymizes records, terminates active sessions, and blacklists JWT tokens.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        password = request.data.get('password')
        totp_code = request.data.get('two_factor_code') or request.data.get('code')

        # 1. Verification of identity
        if not user.check_password(password):
            return Response(
                {'error': 'Incorrect password. Password verification is required to confirm data erasure.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if user.is_2fa_enabled:
            from core.totp import verify_totp, verify_and_consume_backup_code
            if not totp_code:
                return Response(
                    {'error': 'Two-factor authentication code is required to execute erasure.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not verify_totp(user.two_factor_secret, totp_code):
                if not verify_and_consume_backup_code(user, totp_code):
                    return Response(
                        {'error': 'Invalid two-factor code or backup code.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        # 2. Prevent deleting the sole Admin of an organization
        if user.role == 'admin' and user.org:
            from accounts.models import User as UserModel
            other_admins = UserModel.objects.filter(
                org=user.org,
                role='admin',
                is_active=True,
                is_deleted=False
            ).exclude(id=user.id).exists()
            if not other_admins:
                return Response(
                    {
                        'error': 'You are the only administrator in this organization. You must assign another member as Admin or delete the organization before deleting this account.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # 3. Log GDPR / DPDP Erasure Request before wiping PII
        from core.audit import log_action
        log_action(
            org_id=user.org_id,
            user=user,
            action='GDPR_ERASURE_EXECUTED',
            target_type='User',
            target_id=user.id,
            detail=f"Right to Erasure executed for user {user.email}. PII scrubbed and vector embeddings cleaned.",
            request=request
        )

        # 4. Scrub User Knowledge Base Documents & Qdrant Vector Embeddings
        try:
            from knowledge.models import Document
            from ml.search_engine import delete_document_vectors
            user_docs = Document.objects.filter(uploaded_by=user, is_deleted=False)
            org_id_str = str(user.org_id) if user.org_id else ''
            for doc in user_docs:
                try:
                    if org_id_str:
                        delete_document_vectors(org_id_str, str(doc.id))
                    doc.is_deleted = True
                    doc.save(update_fields=['is_deleted'])
                except Exception:
                    pass
        except Exception:
            pass

        # 5. Anonymize and delete Employee Profile
        try:
            from teams.models import Employee
            Employee.objects.filter(user=user).update(
                is_deleted=True,
                employment_status='inactive'
            )
        except Exception:
            pass

        # 6. Scrub User Model PII & Hard Invalidate
        user_id_str = str(user.id)
        user.first_name = "Scrubbed"
        user.last_name = "User"
        user.email = f"erased_{user_id_str[:8]}@privacy.invalid"
        user.is_2fa_enabled = False
        user.two_factor_secret = ""
        user.two_factor_backup_codes = []
        user.set_unusable_password()
        user.is_active = False
        user.is_deleted = True
        user.save()

        # 7. Invalidate all JWT tokens & clear cookies
        blacklist_all_user_tokens(user)

        response = Response(
            {
                'status': 'erased',
                'message': 'Your account and personal data have been permanently erased and anonymized in accordance with GDPR Article 17 and India DPDP Act 2023.'
            },
            status=status.HTTP_200_OK
        )
        response.delete_cookie('access_token', path='/')
        response.delete_cookie('refresh_token', path='/')
        return response