from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .services import OrgService
from .serializers import OrganizationPublicSerializer

org_service = OrgService()


class OrganizationPublicListView(APIView):
    permission_classes = [AllowAny]  # the only endpoint in the system with no auth

    def get(self, request):
        orgs = org_service.get_public_list()
        serializer = OrganizationPublicSerializer(orgs, many=True)
        return Response(serializer.data)


from core.permissions import IsAdmin, IsEmployee
from core.exceptions import ServiceError
from .serializers import OrganizationAdminSerializer, OrgSettingsSerializer


class OrgDetailView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        try:
            org = org_service.get_org_detail(request.org_id)
            return Response(OrganizationAdminSerializer(org).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class OrgSettingsView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request):
        from core.audit import log_action
        try:
            org_service.update_org_settings(
                org_id=request.org_id,
                max_documents=request.data.get('max_documents'),
                max_users=request.data.get('max_users'),
                allowed_domains=request.data.get('allowed_domains'),
                enforce_2fa=request.data.get('enforce_2fa'),
                session_idle_timeout_minutes=request.data.get('session_idle_timeout_minutes'),
            )
            org = org_service.get_org_detail(request.org_id)
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='update_org_settings',
                target_type='org_settings',
                target_id=org.id,
                detail=f"2FA Enforced: {request.data.get('enforce_2fa')}, Session Timeout: {request.data.get('session_idle_timeout_minutes')}m, Max users: {request.data.get('max_users')}, Max docs: {request.data.get('max_documents')}"
            )
            return Response(OrganizationAdminSerializer(org).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class PurgeTestStorageView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        try:
            from tenants.models import Organization
            org_id = getattr(request, 'org_id', None) or getattr(request.user, 'org_id', None)
            if not org_id and (request.user.is_superuser or request.user.role == 'admin'):
                first_org = Organization.objects.first()
                if first_org:
                    org_id = first_org.id

            if not org_id:
                return Response({'error': 'Organization not found for current session.'}, status=404)

            purged_stats = org_service.purge_test_storage(
                org_id=org_id,
                user=request.user
            )
            return Response({
                'message': 'Test storage and vector embeddings purged successfully.',
                'stats': purged_stats
            })
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class GovernanceStatsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        try:
            stats = org_service.get_governance_and_usage_stats(request.org_id, request.user)
            return Response(stats)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DocumentVaultListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        try:
            items = org_service.list_unified_document_vault(request.org_id, request.user)
            return Response(items)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


import time
import re
import uuid
import datetime
from django.apps import apps
from django.db import connection
from rest_framework import status
from core.permissions import IsSuperUser
from core.throttling import SQLConsoleThrottle

# Sensitive column identifiers to automatically mask
SENSITIVE_COLUMN_PATTERNS = [
    'password', 'passwd', 'secret', 'token', 'api_key', 'apikey',
    'auth_token', 'access_token', 'refresh_token', 'private_key',
    'credential', 'passkey', 'salt', 'hash'
]

# Disallowed write, DDL, and dangerous SQL keywords/functions
DISALLOWED_SQL_PATTERNS = [
    r'\bINSERT\b', r'\bUPDATE\b', r'\bDELETE\b', r'\bDROP\b', r'\bALTER\b',
    r'\bTRUNCATE\b', r'\bGRANT\b', r'\bREVOKE\b', r'\bCREATE\b', r'\bREPLACE\b',
    r'\bEXEC\b', r'\bEXECUTE\b', r'\bCALL\b', r'\bCOPY\b', r'\bVACUUM\b',
    r'\bMERGE\b', r'\bUPSERT\b', r'\bREINDEX\b', r'\bLOCK\b',
    r'\bINTO\s+OUTFILE\b', r'\bINTO\s+DUMPFILE\b',
    r'\bSELECT\b[\s\S]*?\bINTO\b',
    # Dangerous system functions & routines
    r'\bPG_SLEEP\b', r'\bPG_READ_FILE\b', r'\bPG_WRITE_FILE\b', r'\bPG_LS_DIR\b',
    r'\bXP_CMDSHELL\b', r'\bLOAD_FILE\b', r'\bBENCHMARK\b', r'\bSLEEP\b',
    r'\bSYS_EVAL\b', r'\bSYS_EXEC\b', r'\bSH\b'
]


class SchemaMetadataView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request):
        schema = []
        custom_apps = ['accounts', 'tenants', 'hiring', 'projects', 'teams', 'knowledge', 'communications']
        
        for app_name in custom_apps:
            try:
                app_config = apps.get_app_config(app_name)
            except LookupError:
                continue
                
            for model in app_config.get_models():
                table_name = model._meta.db_table
                fields = []
                for field in model._meta.get_fields():
                    if not field.concrete:
                        continue
                    
                    field_data = {
                        'name': field.name,
                        'type': field.get_internal_type(),
                        'primary_key': getattr(field, 'primary_key', False),
                    }
                    
                    if field.is_relation and field.many_to_one:
                        field_data['foreign_key'] = {
                            'table': field.related_model._meta.db_table,
                            'column': field.target_field.name
                        }
                    fields.append(field_data)
                
                schema.append({
                    'table': table_name,
                    'model': model.__name__,
                    'app': app_name,
                    'fields': fields
                })
        return Response(schema)


class ExecuteSQLView(APIView):
    permission_classes = [IsSuperUser]
    throttle_classes = [SQLConsoleThrottle]

    def post(self, request):
        raw_sql = request.data.get('sql', '').strip()

        if not raw_sql:
            return Response({'error': 'SQL query is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Strip comments (both /* */ and --)
        clean_sql = re.sub(r'/\*.*?\*/', '', raw_sql, flags=re.DOTALL)
        clean_sql = re.sub(r'--.*$', '', clean_sql, flags=re.MULTILINE).strip()

        if not clean_sql:
            return Response({'error': 'SQL query contains only comments.'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Block multi-statement queries (detect semicolons before end of statement)
        trimmed_semis = clean_sql.rstrip(';').strip()
        if ';' in trimmed_semis:
            return Response({
                'error': 'multi_statement_blocked',
                'message': 'Multi-statement SQL execution is strictly forbidden. Run only one query at a time.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Enforce that query starts with SELECT, WITH, or EXPLAIN
        first_token_match = re.match(r'^\s*([A-Za-z]+)', trimmed_semis)
        first_token = first_token_match.group(1).upper() if first_token_match else ''
        if first_token not in ['SELECT', 'WITH', 'EXPLAIN']:
            return Response({
                'error': 'read_only_violation',
                'message': f"Operation '{first_token}' is not allowed. Only read-only SELECT queries are permitted in the SQL Console."
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Check for any disallowed DDL, DML, or dangerous routines
        for pattern in DISALLOWED_SQL_PATTERNS:
            if re.search(pattern, trimmed_semis, re.IGNORECASE):
                clean_name = pattern.replace(r'\b', '').replace(r'\s+', ' ')
                return Response({
                    'error': 'forbidden_operation',
                    'message': f"Strict Security Violation: Forbidden keyword or function '{clean_name}' detected. All write, DDL, and administrative functions are strictly blocked."
                }, status=status.HTTP_400_BAD_REQUEST)

        # 5. Enforce automatic LIMIT 100 if no LIMIT is specified
        final_sql = trimmed_semis
        if not re.search(r'\bLIMIT\s+\d+', final_sql, re.IGNORECASE):
            final_sql = f"{final_sql} LIMIT 100;"
        else:
            final_sql = f"{final_sql};"

        start_time = time.perf_counter()
        try:
            with connection.cursor() as cursor:
                # Set statement timeout for PostgreSQL if applicable
                engine = connection.settings_dict.get('ENGINE', '')
                if 'postgresql' in engine:
                    cursor.execute("SET statement_timeout = 3000;")

                cursor.execute(final_sql)
                execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

                if cursor.description:
                    columns = [col[0] for col in cursor.description]
                    rows = cursor.fetchall()
                    
                    results = []
                    for row in rows:
                        row_dict = {}
                        for idx, col in enumerate(columns):
                            val = row[idx]
                            # Mask sensitive column values
                            is_sensitive = any(s in col.lower() for s in SENSITIVE_COLUMN_PATTERNS)
                            if is_sensitive and val is not None:
                                val = '•••••••• [REDACTED]'
                            elif isinstance(val, (datetime.date, datetime.datetime)):
                                val = val.isoformat()
                            elif isinstance(val, uuid.UUID):
                                val = str(val)
                            row_dict[col] = val
                        results.append(row_dict)

                    return Response({
                        'columns': columns,
                        'rows': results,
                        'row_count': len(results),
                        'execution_time_ms': execution_time_ms,
                        'query_executed': final_sql
                    })
                else:
                    return Response({
                        'message': 'Query executed successfully with 0 returned rows.',
                        'row_count': 0,
                        'execution_time_ms': execution_time_ms,
                        'query_executed': final_sql
                    })
        except Exception as e:
            return Response({
                'error': 'query_failed',
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


from .services import InvitationService
from .serializers import (
    OrganizationInvitationSerializer,
    InviteMemberCreateSerializer,
    AcceptInvitationSerializer
)
from core.permissions import IsHR, IsManager
from accounts.views import set_auth_cookies

invitation_service = InvitationService()


class InvitationListCreateView(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        invites = invitation_service.list_invitations(request.org_id)
        serializer = OrganizationInvitationSerializer(invites, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = InviteMemberCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            invite = invitation_service.create_invitation(
                org_id=request.org_id,
                inviter_user=request.user,
                email=d['email'],
                role=d['role'],
                department_id=d.get('department_id'),
                request=request
            )
            return Response(
                OrganizationInvitationSerializer(invite).data,
                status=status.HTTP_201_CREATED
            )
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class InvitationResendView(APIView):
    permission_classes = [IsManager]

    def post(self, request, pk):
        try:
            invite = invitation_service.resend_invitation(
                org_id=request.org_id,
                invitation_id=pk,
                inviter_user=request.user,
                request=request
            )
            return Response(
                OrganizationInvitationSerializer(invite).data,
                status=status.HTTP_200_OK
            )
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class InvitationRevokeView(APIView):
    permission_classes = [IsManager]

    def post(self, request, pk):
        try:
            invite = invitation_service.revoke_invitation(
                org_id=request.org_id,
                invitation_id=pk,
                inviter_user=request.user,
                request=request
            )
            return Response(
                OrganizationInvitationSerializer(invite).data,
                status=status.HTTP_200_OK
            )
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class InvitationVerifyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get('token')
        try:
            data = invitation_service.verify_invitation_token(token)
            return Response(data, status=status.HTTP_200_OK)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class InvitationAcceptView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            result = invitation_service.accept_invitation(
                token=d['token'],
                first_name=d['first_name'],
                last_name=d['last_name'],
                password=d['password'],
                request=request
            )
            response = Response(result, status=status.HTTP_200_OK)
            set_auth_cookies(
                response,
                access_token=result['access'],
                refresh_token=result['refresh']
            )
            return response
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


