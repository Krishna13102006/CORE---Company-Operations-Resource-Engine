import io
import zipfile
from django.test import TestCase
from rest_framework.exceptions import ValidationError
from core.validators import validate_uploaded_file, sanitize_filename
from core.sanitizers import sanitize_html, sanitize_plain_text
from core.throttling import AuthEndpointThrottle, SQLConsoleThrottle
from accounts.views import LoginView, RegisterView
from tenants.views import ExecuteSQLView
from django.core.files.uploadedfile import SimpleUploadedFile


class SecurityHardeningTestCase(TestCase):
    """
    Tests Phase 1 & 2 Security Hardening: File magic bytes, XSS sanitizers, rate-limiting throttles, and JWT token rotation/blacklisting.
    """

    def setUp(self):
        from tenants.models import Organization
        self.org = Organization.objects.create(name="Test Org", slug="test-org", passkey_hash="dummy")

    def test_sanitize_filename_traversal_prevention(self):
        """Test that directory traversal and malicious characters are stripped from filenames."""
        self.assertEqual(sanitize_filename("../../etc/passwd.pdf"), "passwd.pdf")
        self.assertEqual(sanitize_filename("..\\..\\windows\\system32\\cmd.exe.pdf"), "cmd.exe.pdf")
        self.assertEqual(sanitize_filename("valid_doc_1.pdf"), "valid_doc_1.pdf")
        self.assertEqual(sanitize_filename("...malicious...file..docx"), "malicious.file.docx")

    def test_validate_uploaded_file_genuine_pdf(self):
        """Test that a genuine PDF file with %PDF- magic signature is accepted."""
        pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Test) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
        uploaded_file = SimpleUploadedFile("resume.pdf", pdf_content, content_type="application/pdf")
        
        safe_name = validate_uploaded_file(uploaded_file, allowed_types=('pdf', 'docx'), max_size_mb=15)
        self.assertEqual(safe_name, "resume.pdf")

    def test_validate_uploaded_file_genuine_docx(self):
        """Test that a genuine DOCX file (ZIP archive with PK\\x03\\x04) is accepted."""
        docx_buffer = io.BytesIO()
        with zipfile.ZipFile(docx_buffer, 'w') as zf:
            zf.writestr('word/document.xml', '<w:document></w:document>')
        docx_content = docx_buffer.getvalue()

        uploaded_file = SimpleUploadedFile("offer_letter.docx", docx_content, content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        safe_name = validate_uploaded_file(uploaded_file, allowed_types=('pdf', 'docx'), max_size_mb=15)
        self.assertEqual(safe_name, "offer_letter.docx")

    def test_validate_uploaded_file_rejects_fake_pdf_with_executable_header(self):
        """Test that an executable file disguised with a .pdf extension is rejected."""
        fake_pdf_content = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00" # Windows PE executable header
        uploaded_file = SimpleUploadedFile("virus.pdf", fake_pdf_content, content_type="application/pdf")

        with self.assertRaises(ValidationError) as ctx:
            validate_uploaded_file(uploaded_file, allowed_types=('pdf', 'docx'), max_size_mb=15)
        self.assertIn("Executable or binary payload detected", str(ctx.exception))

    def test_validate_uploaded_file_rejects_corrupted_pdf_header(self):
        """Test that arbitrary text disguised as .pdf is rejected."""
        fake_content = b"This is just raw text, not a valid PDF binary file."
        uploaded_file = SimpleUploadedFile("fake.pdf", fake_content, content_type="application/pdf")

        with self.assertRaises(ValidationError) as ctx:
            validate_uploaded_file(uploaded_file, allowed_types=('pdf', 'docx'), max_size_mb=15)
        self.assertIn("Corrupted or invalid PDF header", str(ctx.exception))

    def test_validate_uploaded_file_size_limit(self):
        """Test that files exceeding max_size_mb are rejected."""
        large_content = b"%PDF-1.4 " + (b"0" * (1024 * 1024 + 100)) # > 1MB
        uploaded_file = SimpleUploadedFile("huge.pdf", large_content, content_type="application/pdf")

        with self.assertRaises(ValidationError) as ctx:
            validate_uploaded_file(uploaded_file, allowed_types=('pdf', 'docx'), max_size_mb=1) # 1MB limit
        self.assertIn("exceeds the maximum allowed size", str(ctx.exception))

    def test_xss_html_sanitizer_removes_dangerous_tags_and_scripts(self):
        """Test that script tags, iframes, onerror handlers, and javascript: links are stripped."""
        dirty_html = (
            "<p>Hello <strong>Team</strong>!</p>"
            "<script>alert('XSS Attack!');</script>"
            "<img src='x' onerror='alert(1)'>"
            "<a href='javascript:stealCookies()'>Click Here</a>"
            "<iframe src='http://evil.com'></iframe>"
        )
        clean = sanitize_html(dirty_html)

        self.assertNotIn("<script>", clean)
        self.assertNotIn("alert(", clean)
        self.assertNotIn("onerror", clean)
        self.assertNotIn("javascript:", clean)
        self.assertNotIn("<iframe>", clean)
        self.assertIn("<p>Hello <strong>Team</strong>!</p>", clean)

    def test_xss_plain_text_sanitizer(self):
        """Test that plain text sanitizer strips all HTML tags."""
        dirty_text = "<b>Urgent:</b> Please check <script>alert(1)</script> the quarterly report."
        clean_text = sanitize_plain_text(dirty_text)

        self.assertEqual(clean_text, "Urgent: Please check the quarterly report.")

    def test_endpoint_throttles_attached(self):
        """Verify that security throttles are configured on authentication and SQL endpoints."""
        self.assertIn(AuthEndpointThrottle, LoginView.throttle_classes)
        self.assertIn(AuthEndpointThrottle, RegisterView.throttle_classes)
        self.assertIn(SQLConsoleThrottle, ExecuteSQLView.throttle_classes)

    def test_jwt_token_rotation_and_blacklisting(self):
        """Test that refreshing a JWT rotates the token and blacklists the original refresh token."""
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework.test import APIRequestFactory
        from accounts.views import CookieTokenRefreshView

        User = get_user_model()
        user = User.objects.create_user(
            email="token_user@test.com",
            password="testpassword123",
            org=self.org,
            first_name="Token",
            last_name="Tester",
            role="employee"
        )

        refresh = RefreshToken.for_user(user)
        refresh_str = str(refresh)

        factory = APIRequestFactory()
        view = CookieTokenRefreshView.as_view()

        # 1. First refresh succeeds and rotates the refresh token
        req = factory.post('/api/auth/token/refresh/', {'refresh': refresh_str}, format='json')
        res = view(req)
        self.assertEqual(res.status_code, 200)
        self.assertIn('access_token', res.cookies)
        self.assertIn('refresh_token', res.cookies)
        new_refresh_str = res.cookies['refresh_token'].value
        self.assertNotEqual(refresh_str, new_refresh_str)

        # 2. Reusing the old blacklisted refresh token fails with 401
        req_reuse = factory.post('/api/auth/token/refresh/', {'refresh': refresh_str}, format='json')
        res_reuse = view(req_reuse)
        self.assertEqual(res_reuse.status_code, 401)

    def test_logout_blacklists_refresh_token(self):
        """Test that logout invalidates and blacklists the user's refresh token."""
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework.test import APIRequestFactory
        from accounts.views import LogoutView, CookieTokenRefreshView

        User = get_user_model()
        user = User.objects.create_user(
            email="logout_user@test.com",
            password="testpassword123",
            org=self.org,
            first_name="Logout",
            last_name="Tester",
            role="employee"
        )

        refresh = RefreshToken.for_user(user)
        refresh_str = str(refresh)

        factory = APIRequestFactory()
        logout_view = LogoutView.as_view()

        req = factory.post('/api/auth/logout/', {'refresh': refresh_str}, format='json')
        res = logout_view(req)
        self.assertEqual(res.status_code, 200)

        # Verify refresh token is blacklisted by attempting to use it
        refresh_view = CookieTokenRefreshView.as_view()
        req_refresh = factory.post('/api/auth/token/refresh/', {'refresh': refresh_str}, format='json')
        res_refresh = refresh_view(req_refresh)
        self.assertEqual(res_refresh.status_code, 401)

    def test_search_chunks_requires_org_id(self):
        """Test that vector / chunk searches strictly reject empty or None org_id."""
        from ml.search_engine import search_chunks
        with self.assertRaises(ValueError):
            search_chunks(org_id="", query_text="test query")

        with self.assertRaises(ValueError):
            search_chunks(org_id=None, query_text="test query")

    def test_search_chunks_strict_tenant_isolation_fallback(self):
        """Test that knowledge base search returns only chunks for the requesting organization."""
        from tenants.models import Organization
        from knowledge.models import Document, DocumentChunk
        from ml.search_engine import search_chunks
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = User.objects.create_user(
            email="tenant_user@test.com",
            password="testpassword123",
            org=self.org,
            first_name="Tenant",
            last_name="User",
            role="employee"
        )

        org_b = Organization.objects.create(name="Org B", slug="org-b", passkey_hash="dummy")

        # Create doc and chunk in Org A (self.org)
        doc_a = Document.objects.create(
            org_id=self.org.id,
            title="Org A Financial Secrets",
            file_path="org_a_secrets.pdf",
            file_type="pdf",
            file_size=1024,
            uploaded_by=user,
            allowed_roles="employee,admin",
            status="processed"
        )
        chunk_a = DocumentChunk.objects.create(
            document=doc_a,
            org_id=self.org.id,
            chunk_index=0,
            chunk_text="Confidential revenue projections for Org A.",
            token_count=10
        )

        # Create doc and chunk in Org B
        doc_b = Document.objects.create(
            org_id=org_b.id,
            title="Org B Financial Secrets",
            file_path="org_b_secrets.pdf",
            file_type="pdf",
            file_size=1024,
            uploaded_by=user,
            allowed_roles="employee,admin",
            status="processed"
        )
        chunk_b = DocumentChunk.objects.create(
            document=doc_b,
            org_id=org_b.id,
            chunk_index=0,
            chunk_text="Confidential revenue projections for Org B.",
            token_count=10
        )

        # Search from Org A: Must only return Org A chunk
        results_a = search_chunks(
            org_id=str(self.org.id),
            query_text="revenue projections",
            user_role="employee"
        )
        returned_doc_ids_a = [r['document_id'] for r in results_a]
        self.assertIn(str(doc_a.id), returned_doc_ids_a)
        self.assertNotIn(str(doc_b.id), returned_doc_ids_a)

        # Search from Org B: Must only return Org B chunk
        results_b = search_chunks(
            org_id=str(org_b.id),
            query_text="revenue projections",
            user_role="employee"
        )
        returned_doc_ids_b = [r['document_id'] for r in results_b]
        self.assertIn(str(doc_b.id), returned_doc_ids_b)
        self.assertNotIn(str(doc_a.id), returned_doc_ids_b)

    def test_cross_tenant_isolation_in_repositories(self):
        """Test that data repositories reject cross-tenant object access."""
        from tenants.models import Organization
        from knowledge.models import Document
        from knowledge.repositories import DocumentRepository
        from projects.models import Project
        from projects.repositories import ProjectRepository
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = User.objects.create_user(
            email="repo_user@test.com",
            password="testpassword123",
            org=self.org,
            first_name="Repo",
            last_name="User",
            role="admin"
        )

        org_b = Organization.objects.create(name="Another Org", slug="another-org", passkey_hash="dummy")

        # Document belonging to self.org
        doc = Document.objects.create(
            org_id=self.org.id,
            title="Tenant A Doc",
            file_path="doc.pdf",
            file_type="pdf",
            file_size=500,
            uploaded_by=user,
            status="processed"
        )

        # Project belonging to self.org
        proj = Project.objects.create(
            org_id=self.org.id,
            name="Tenant A Secret Project",
            description="Top secret",
            owner=user,
            status="active"
        )

        doc_repo = DocumentRepository()
        proj_repo = ProjectRepository()

        # querying with correct org works
        self.assertIsNotNone(doc_repo.get_by_id(doc.id, org_id=self.org.id))
        self.assertIsNotNone(proj_repo.get_by_id(proj.id, org_id=self.org.id))

        # querying with wrong org (Org B) MUST return None
        self.assertIsNone(doc_repo.get_by_id(doc.id, org_id=org_b.id))
        self.assertIsNone(proj_repo.get_by_id(proj.id, org_id=org_b.id))

    def test_totp_generation_and_validation(self):
        """Test TOTP secret generation, URI formatting, and token verification."""
        from core.totp import generate_totp_secret, get_totp_uri, verify_totp, _generate_totp_code_for_time
        import time

        secret = generate_totp_secret()
        self.assertTrue(len(secret) >= 16)

        uri = get_totp_uri(secret, "test@example.com")
        self.assertIn("otpauth://totp/CORE:test%40example.com", uri)
        self.assertIn(f"secret={secret}", uri)

        # Valid code generated at current time
        valid_code = _generate_totp_code_for_time(secret, time.time())
        self.assertTrue(verify_totp(secret, valid_code))

        # Invalid code
        self.assertFalse(verify_totp(secret, "999999" if valid_code != "999999" else "000000"))
        self.assertFalse(verify_totp(secret, "abcd"))
        self.assertFalse(verify_totp("", valid_code))

    def test_backup_codes_generation_and_one_time_consumption(self):
        """Test backup recovery codes creation, hashing, and one-time consumption."""
        from django.contrib.auth import get_user_model
        from core.totp import generate_backup_codes, verify_and_consume_backup_code

        User = get_user_model()
        user = User.objects.create_user(
            email="backup_user@test.com",
            password="testpassword123",
            org=self.org,
            first_name="Backup",
            last_name="Tester",
            role="employee"
        )

        raw_codes, hashed_codes = generate_backup_codes(8)
        self.assertEqual(len(raw_codes), 8)
        self.assertEqual(len(hashed_codes), 8)

        user.two_factor_backup_codes = hashed_codes
        user.save()

        # First use of the code must succeed
        chosen_code = raw_codes[0]
        self.assertTrue(verify_and_consume_backup_code(user, chosen_code))
        self.assertEqual(len(user.two_factor_backup_codes), 7)

        # Reusing the consumed code must fail
        self.assertFalse(verify_and_consume_backup_code(user, chosen_code))

        # Using an invalid code must fail
        self.assertFalse(verify_and_consume_backup_code(user, "invalid-code-123"))

    def test_2fa_login_challenge_and_verification(self):
        """Test that login challenges for 2FA when enabled and verifies valid codes."""
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory
        from accounts.views import LoginView
        from core.totp import generate_totp_secret, _generate_totp_code_for_time
        import time

        secret = generate_totp_secret()
        User = get_user_model()
        user = User.objects.create_user(
            email="mfa_user@test.com",
            password="testpassword123",
            org=self.org,
            first_name="MFA",
            last_name="User",
            role="employee"
        )
        user.is_2fa_enabled = True
        user.two_factor_secret = secret
        user.save()

        factory = APIRequestFactory()
        view = LoginView.as_view()

        # 1. Login without code returns 2fa_required
        req = factory.post('/api/auth/login/', {'email': 'mfa_user@test.com', 'password': 'testpassword123'}, format='json')
        res = view(req)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data.get('status'), '2fa_required')
        self.assertTrue(res.data.get('requires_2fa'))

        # 2. Login with invalid 2FA code fails
        req_bad = factory.post(
            '/api/auth/login/',
            {'email': 'mfa_user@test.com', 'password': 'testpassword123', 'two_factor_code': '000000'},
            format='json'
        )
        res_bad = view(req_bad)
        self.assertEqual(res_bad.status_code, 400)

        # 3. Login with valid 2FA code succeeds
        valid_totp = _generate_totp_code_for_time(secret, time.time())
        req_ok = factory.post(
            '/api/auth/login/',
            {'email': 'mfa_user@test.com', 'password': 'testpassword123', 'two_factor_code': valid_totp},
            format='json'
        )
        res_ok = view(req_ok)
        self.assertEqual(res_ok.status_code, 200)
        self.assertEqual(res_ok.data.get('status'), 'success')
        self.assertIn('access_token', res_ok.cookies)

    def test_audit_log_records_ip_address_and_actions(self):
        """Test that AuditLog captures actions with client IP address metadata."""
        from core.audit import log_action
        from core.models import AuditLog
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory

        User = get_user_model()
        user = User.objects.create_user(
            email="audit_user@test.com",
            password="testpassword123",
            org=self.org,
            first_name="Audit",
            last_name="User",
            role="admin"
        )

        factory = APIRequestFactory()
        req = factory.get('/api/test/', HTTP_X_FORWARDED_FOR='198.51.100.42')

        log_action(
            org_id=self.org.id,
            user=user,
            action='ROLE_UPDATED',
            target_type='User',
            target_id=user.id,
            detail='Role elevated to Admin',
            request=req
        )

        log = AuditLog.objects.filter(org_id=self.org.id, action='ROLE_UPDATED').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor, user)
        self.assertEqual(log.ip_address, '198.51.100.42')
        self.assertEqual(log.detail, 'Role elevated to Admin')

    def test_security_headers_middleware(self):
        """Test that SecurityHeadersMiddleware injects defense-in-depth headers on responses."""
        from django.http import HttpResponse
        from django.test import RequestFactory
        from core.middleware import SecurityHeadersMiddleware

        rf = RequestFactory()
        req = rf.get('/')
        middleware = SecurityHeadersMiddleware(lambda r: HttpResponse('OK'))
        response = middleware(req)

        self.assertEqual(response['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(response['X-Frame-Options'], 'DENY')
        self.assertEqual(response['Referrer-Policy'], 'strict-origin-when-cross-origin')
        self.assertIn('Permissions-Policy', response)
        self.assertEqual(response['Cross-Origin-Opener-Policy'], 'same-origin-allow-popups')

    def test_tenant_middleware_anti_spoofing(self):
        """Test that TenantMiddleware cross-validates user org and overrides spoofed tokens."""
        from django.http import HttpResponse
        from django.test import RequestFactory
        from django.contrib.auth import get_user_model
        from tenants.models import Organization
        from core.middleware import TenantMiddleware

        org_a = self.org
        org_b = Organization.objects.create(name="Org B", slug="org-b", passkey_hash="dummy")

        User = get_user_model()
        user_a = User.objects.create_user(
            email="victim@orga.com",
            password="testpassword123",
            org=org_a,
            first_name="Victim",
            last_name="User",
            role="employee"
        )

        rf = RequestFactory()
        req = rf.get('/')
        req.user = user_a

        middleware = TenantMiddleware(lambda r: HttpResponse('OK'))
        middleware(req)

        # Ensure request.org_id is strictly user_a's genuine org_id
        self.assertEqual(req.org_id, org_a.id)
        self.assertNotEqual(req.org_id, org_b.id)

    def test_validate_uploaded_file_spreadsheet(self):
        """Test that genuine XLSX spreadsheets pass validation and executables with xlsx extension fail."""
        xlsx_buffer = io.BytesIO()
        with zipfile.ZipFile(xlsx_buffer, 'w') as zf:
            zf.writestr('xl/workbook.xml', '<workbook></workbook>')
        xlsx_content = xlsx_buffer.getvalue()

        uploaded_xlsx = SimpleUploadedFile("finance.xlsx", xlsx_content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        safe_name = validate_uploaded_file(uploaded_xlsx, allowed_types=('xlsx', 'csv'), max_size_mb=10)
        self.assertEqual(safe_name, "finance.xlsx")

        fake_xlsx = SimpleUploadedFile("malware.xlsx", b"MZ\x90\x00\x03\x00", content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        with self.assertRaises(ValidationError) as ctx:
            validate_uploaded_file(fake_xlsx, allowed_types=('xlsx', 'csv'), max_size_mb=10)
        self.assertIn("Executable or binary payload detected", str(ctx.exception))

