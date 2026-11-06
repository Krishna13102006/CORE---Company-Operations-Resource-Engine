import uuid
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status
from tenants.models import Organization
from tenants.views import SchemaMetadataView, ExecuteSQLView

User = get_user_model()

class TenantsDatabaseTestCase(TestCase):
    def setUp(self):
        # 1. Create Organization
        self.org = Organization.objects.create(
            name="DB Corp",
            slug="db-corp",
            passkey_hash="dummy"
        )
        self.org_id = self.org.id

        # 2. Create Admin User
        self.admin = User.objects.create_user(
            email="admin@db.com",
            password="password",
            first_name="Admin",
            last_name="DBA",
            role="admin",
            org=self.org
        )

        # 3. Create Superuser
        self.superuser = User.objects.create_superuser(
            email="super@db.com",
            password="password",
            first_name="Super",
            last_name="Admin"
        )

        self.factory = APIRequestFactory()

    def _setup_request(self, request, user):
        request.org_id = self.org_id
        force_authenticate(request, user=user)
        return request

    def test_schema_metadata_superadmin_access(self):
        """Test retrieving dynamic schema ER metadata with Superuser access."""
        view = SchemaMetadataView.as_view()
        
        # Non-superuser is blocked
        req_admin = self.factory.get('/api/tenants/schema/')
        self._setup_request(req_admin, self.admin)
        res_admin = view(req_admin)
        self.assertEqual(res_admin.status_code, status.HTTP_403_FORBIDDEN)

        # Superuser succeeds
        request = self.factory.get('/api/tenants/schema/')
        self._setup_request(request, self.superuser)
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        schema_tables = [item['table'] for item in response.data]
        self.assertIn('accounts_user', schema_tables)
        self.assertIn('tenants_organization', schema_tables)

        # Check a specific table's fields details
        user_table = next(item for item in response.data if item['table'] == 'accounts_user')
        user_fields = [f['name'] for f in user_table['fields']]
        self.assertIn('email', user_fields)
        self.assertIn('role', user_fields)

        # Check foreign keys structures
        org_fk_field = next(f for f in user_table['fields'] if f['name'] == 'org')
        self.assertIn('foreign_key', org_fk_field)
        self.assertEqual(org_fk_field['foreign_key']['table'], 'tenants_organization')

    def test_execute_sql_console_safeguards_and_masking(self):
        """Test SQL query execution, read-only SELECT enforcement, and sensitive data masking."""
        view = ExecuteSQLView.as_view()

        # 1. Non-superuser permission check (should be forbidden)
        req_non_super = self.factory.post(
            '/api/tenants/execute-sql/',
            {'sql': 'SELECT id, name FROM tenants_organization;'},
            format='json'
        )
        self._setup_request(req_non_super, self.admin)
        res_non_super = view(req_non_super)
        self.assertEqual(res_non_super.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Select query with Superuser (Safe operation with auto-limit)
        request_select = self.factory.post(
            '/api/tenants/execute-sql/',
            {'sql': 'SELECT id, name FROM tenants_organization;'},
            format='json'
        )
        self._setup_request(request_select, self.superuser)
        response_select = view(request_select)

        self.assertEqual(response_select.status_code, status.HTTP_200_OK)
        self.assertIn('columns', response_select.data)
        self.assertIn('rows', response_select.data)
        self.assertIn('execution_time_ms', response_select.data)
        self.assertEqual(response_select.data['columns'], ['id', 'name'])
        self.assertEqual(len(response_select.data['rows']), 1)
        self.assertEqual(response_select.data['rows'][0]['name'], 'DB Corp')

        # 3. Sensitive field masking (password column should be redacted)
        request_mask = self.factory.post(
            '/api/tenants/execute-sql/',
            {'sql': 'SELECT email, password FROM accounts_user;'},
            format='json'
        )
        self._setup_request(request_mask, self.superuser)
        response_mask = view(request_mask)
        self.assertEqual(response_mask.status_code, status.HTTP_200_OK)
        self.assertEqual(response_mask.data['rows'][0]['password'], '•••••••• [REDACTED]')

        # 4. Write query (DELETE) strictly blocked
        request_delete = self.factory.post(
            '/api/tenants/execute-sql/',
            {'sql': 'DELETE FROM tenants_organization WHERE name = \'DB Corp\';'},
            format='json'
        )
        self._setup_request(request_delete, self.superuser)
        response_delete = view(request_delete)
        self.assertEqual(response_delete.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(response_delete.data['error'], ['read_only_violation', 'forbidden_operation'])

        # 5. DDL query (DROP TABLE) strictly blocked
        request_drop = self.factory.post(
            '/api/tenants/execute-sql/',
            {'sql': 'DROP TABLE tenants_organization;'},
            format='json'
        )
        self._setup_request(request_drop, self.superuser)
        response_drop = view(request_drop)
        self.assertEqual(response_drop.status_code, status.HTTP_400_BAD_REQUEST)

        # 6. Multi-statement query blocked
        request_multi = self.factory.post(
            '/api/tenants/execute-sql/',
            {'sql': 'SELECT 1; DROP TABLE tenants_organization;'},
            format='json'
        )
        self._setup_request(request_multi, self.superuser)
        response_multi = view(request_multi)
        self.assertEqual(response_multi.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response_multi.data['error'], 'multi_statement_blocked')

    def test_governance_and_usage_stats(self):
        """Test retrieving org governance, document metrics, AI tokens, and vector infrastructure stats."""
        from tenants.views import GovernanceStatsView
        view = GovernanceStatsView.as_view()

        request = self.factory.get('/api/tenants/governance-stats/')
        self._setup_request(request, self.admin)
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('document_vault', response.data)
        self.assertIn('ai_usage', response.data)
        self.assertIn('infrastructure', response.data)
        self.assertIn('security_compliance', response.data)
        self.assertEqual(response.data['organization']['name'], 'DB Corp')
        self.assertIn('by_feature', response.data['ai_usage'])

    def test_document_vault_list(self):
        """Test retrieving unified document vault items across modules."""
        from tenants.views import DocumentVaultListView
        from knowledge.models import Document

        Document.objects.create(
            org=self.org,
            title="Standard Operating Procedure v1",
            file_path="org_1/knowledge/sop.pdf",
            file_type="pdf",
            file_size=1048576,
            uploaded_by=self.admin
        )

        view = DocumentVaultListView.as_view()
        request = self.factory.get('/api/tenants/document-vault/')
        self._setup_request(request, self.admin)
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) >= 1)
        doc = next((d for d in response.data if d['title'] == "Standard Operating Procedure v1"), None)
        self.assertIsNotNone(doc)
        self.assertEqual(doc['source'], 'knowledge')
        self.assertEqual(doc['sensitivity_level'], 'internal')



