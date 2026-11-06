import io
import datetime
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status

from tenants.models import Organization
from teams.models import Department, Employee
from expenses.models import ExpenseClaim
from expenses.views import (
    ExpenseListView, ExpenseDetailView, ExpenseApproveView,
    ExpenseRejectView, ExpenseReimburseView, ExpenseMySummaryView,
    ExpenseAnalyticsView, ExpenseExportCSVView, ReceiptScanView
)

User = get_user_model()


class ExpensesTestCase(TestCase):
    def setUp(self):
        # 1. Organization
        self.org = Organization.objects.create(
            name="Acme Corp",
            slug="acme-corp",
            passkey_hash="dummy"
        )

        # 2. Users
        self.admin = User.objects.create_user(
            email="admin@acme.com", password="password",
            first_name="Admin", last_name="Boss", role="admin", org=self.org
        )
        self.manager = User.objects.create_user(
            email="manager@acme.com", password="password",
            first_name="Mary", last_name="Manager", role="manager", org=self.org
        )
        self.employee = User.objects.create_user(
            email="dev@acme.com", password="password",
            first_name="Dan", last_name="Developer", role="employee", org=self.org
        )

        # 3. Department
        self.dept = Department.objects.create(
            org_id=self.org.id, name="Engineering", head=self.manager
        )

        # 4. Profiles
        self.manager_profile = self.manager.employee_profile
        self.manager_profile.department = self.dept
        self.manager_profile.save()

        self.employee_profile = self.employee.employee_profile
        self.employee_profile.department = self.dept
        self.employee_profile.manager = self.manager_profile
        self.employee_profile.save()

        self.factory = APIRequestFactory()

    def test_expense_creation_and_lifecycle(self):
        # 1. Employee submits expense claim
        view_list = ExpenseListView.as_view()
        data = {
            "title": "AWS Cloud Hosting Q3",
            "merchant": "Amazon Web Services",
            "expense_date": "2026-09-01",
            "category": "software_subscriptions",
            "amount": "149.99",
            "currency": "USD",
            "tax_amount": "12.50",
            "description": "Monthly server hosting bill"
        }
        req_create = self.factory.post('/api/expenses/', data, format='json')
        req_create.org_id = self.org.id
        req_create.user = self.employee
        force_authenticate(req_create, user=self.employee)

        resp_create = view_list(req_create)
        self.assertEqual(resp_create.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp_create.data['status'], 'submitted')
        claim_id = resp_create.data['id']

        # 2. Manager approves claim
        view_approve = ExpenseApproveView.as_view()
        req_app = self.factory.post(f'/api/expenses/{claim_id}/approve/')
        req_app.org_id = self.org.id
        req_app.user = self.manager
        force_authenticate(req_app, user=self.manager)

        resp_app = view_approve(req_app, expense_id=claim_id)
        self.assertEqual(resp_app.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_app.data['status'], 'approved')
        self.assertEqual(resp_app.data['approved_by_name'], 'Mary Manager')

        # 3. Finance/Admin marks as reimbursed
        view_reimb = ExpenseReimburseView.as_view()
        req_reimb = self.factory.post(f'/api/expenses/{claim_id}/reimburse/', {'payout_reference': 'ACH-9921'}, format='json')
        req_reimb.org_id = self.org.id
        req_reimb.user = self.admin
        force_authenticate(req_reimb, user=self.admin)

        resp_reimb = view_reimb(req_reimb, expense_id=claim_id)
        self.assertEqual(resp_reimb.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_reimb.data['status'], 'reimbursed')
        self.assertEqual(resp_reimb.data['payout_reference'], 'ACH-9921')

    def test_expense_rejection_with_reason(self):
        claim = ExpenseClaim.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            title="Weekend Dinner",
            merchant="Steakhouse",
            expense_date=datetime.date(2026, 9, 2),
            category="meals_entertainment",
            amount=Decimal("120.00"),
            currency="USD",
            status="submitted"
        )

        view = ExpenseRejectView.as_view()
        req = self.factory.post(f'/api/expenses/{claim.id}/reject/', {'reason': 'Non-business personal dinner'}, format='json')
        req.org_id = self.org.id
        req.user = self.manager
        force_authenticate(req, user=self.manager)

        resp = view(req, expense_id=claim.id)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['status'], 'rejected')
        self.assertEqual(resp.data['rejection_reason'], 'Non-business personal dinner')

    def test_employee_cannot_approve_expense(self):
        claim = ExpenseClaim.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            title="Monitor Stand",
            expense_date=datetime.date(2026, 9, 2),
            amount=Decimal("45.00"),
            currency="USD",
            status="submitted"
        )

        view = ExpenseApproveView.as_view()
        req = self.factory.post(f'/api/expenses/{claim.id}/approve/')
        req.org_id = self.org.id
        req.user = self.employee
        force_authenticate(req, user=self.employee)

        resp = view(req, expense_id=claim.id)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_my_expense_summary(self):
        ExpenseClaim.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            title="Uber to airport",
            expense_date=datetime.date.today(),
            amount=Decimal("50.00"),
            amount_converted=Decimal("50.00"),
            currency="USD",
            status="submitted"
        )
        ExpenseClaim.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            title="Team Coffee",
            expense_date=datetime.date.today(),
            amount=Decimal("25.00"),
            amount_converted=Decimal("25.00"),
            currency="USD",
            status="reimbursed"
        )

        view = ExpenseMySummaryView.as_view()
        req = self.factory.get('/api/expenses/my-summary/')
        req.org_id = self.org.id
        req.user = self.employee
        force_authenticate(req, user=self.employee)

        resp = view(req)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['pending_total'], 50.0)
        self.assertEqual(resp.data['reimbursed_ytd'], 25.0)
        self.assertEqual(resp.data['total_claims_count'], 2)

    def test_spend_analytics(self):
        ExpenseClaim.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            title="Flight Ticket",
            merchant="Delta Airlines",
            expense_date=datetime.date.today(),
            category="travel_transport",
            amount=Decimal("450.00"),
            amount_converted=Decimal("450.00"),
            currency="USD",
            status="approved"
        )

        view = ExpenseAnalyticsView.as_view()
        req = self.factory.get('/api/expenses/analytics/')
        req.org_id = self.org.id
        req.user = self.admin
        force_authenticate(req, user=self.admin)

        resp = view(req)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('total_spend_ytd', resp.data)
        self.assertIn('by_category', resp.data)
        self.assertEqual(resp.data['pending_payout'], 450.0)

    def test_export_csv(self):
        ExpenseClaim.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            title="Figma License",
            merchant="Figma Inc",
            expense_date=datetime.date(2026, 9, 1),
            category="software_subscriptions",
            amount=Decimal("75.00"),
            amount_converted=Decimal("75.00"),
            currency="USD",
            status="reimbursed"
        )

        view = ExpenseExportCSVView.as_view()
        req = self.factory.get('/api/expenses/export-csv/')
        req.org_id = self.org.id
        req.user = self.admin
        force_authenticate(req, user=self.admin)

        resp = view(req)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp['Content-Type'], 'text/csv')
        csv_content = resp.content.decode('utf-8')
        self.assertIn('Claim ID,Employee Name,Employee Email', csv_content)
        self.assertIn('Figma License', csv_content)
        self.assertIn('Figma Inc', csv_content)

    def test_receipt_scan_endpoint(self):
        view = ReceiptScanView.as_view()
        dummy_file = io.BytesIO(b"fake-image-bytes")
        dummy_file.name = "test_receipt.jpg"

        req = self.factory.post('/api/expenses/scan-receipt/', {'receipt': dummy_file}, format='multipart')
        req.org_id = self.org.id
        req.user = self.employee
        force_authenticate(req, user=self.employee)

        resp = view(req)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('merchant', resp.data)
        self.assertIn('amount', resp.data)
        self.assertIn('category', resp.data)

    def test_spreadsheet_analyze_and_query(self):
        from expenses.views import SpreadsheetAnalyzeView, SpreadsheetQueryView
        
        sample_csv = "Region,Product,Sales,Cost,Date\nNorth,SaaS Basic,1200,400,2026-08-01\nSouth,SaaS Pro,3400,900,2026-08-02\nEast,Enterprise,8500,2100,2026-08-03\n"
        
        # 1. Analyze Sheet
        view_analyze = SpreadsheetAnalyzeView.as_view()
        req = self.factory.post('/api/expenses/analyze-sheet/', {'csv_text': sample_csv}, format='json')
        req.org_id = self.org.id
        req.user = self.employee
        force_authenticate(req, user=self.employee)

        resp_analyze = view_analyze(req)
        self.assertEqual(resp_analyze.status_code, status.HTTP_200_OK)
        self.assertIn('summary_title', resp_analyze.data)
        self.assertIn('columns', resp_analyze.data)
        self.assertIn('kpis', resp_analyze.data)

        # 2. Query Sheet
        view_query = SpreadsheetQueryView.as_view()
        req_q = self.factory.post('/api/expenses/query-sheet/', {'csv_text': sample_csv, 'query': 'What is the top sale?'}, format='json')
        req_q.org_id = self.org.id
        req_q.user = self.employee
        force_authenticate(req_q, user=self.employee)

        resp_q = view_query(req_q)
        self.assertEqual(resp_q.status_code, status.HTTP_200_OK)
        self.assertIn('answer', resp_q.data)

    def test_batch_payout(self):
        from expenses.views import ExpenseBatchPayoutView

        c1 = ExpenseClaim.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            title="Team Lunch",
            merchant="Chipotle",
            expense_date=datetime.date.today(),
            category="meals_entertainment",
            amount=Decimal("45.00"),
            amount_converted=Decimal("45.00"),
            currency="USD",
            status="approved"
        )
        c2 = ExpenseClaim.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            title="Taxi to Airport",
            merchant="Uber",
            expense_date=datetime.date.today(),
            category="travel_transport",
            amount=Decimal("35.00"),
            amount_converted=Decimal("35.00"),
            currency="USD",
            status="approved"
        )

        view = ExpenseBatchPayoutView.as_view()
        req = self.factory.post('/api/expenses/batch-payout/', {
            'claim_ids': [str(c1.id), str(c2.id)],
            'payout_reference': 'ACH-BATCH-001'
        }, format='json')
        req.org_id = self.org.id
        req.user = self.admin
        force_authenticate(req, user=self.admin)

        resp = view(req)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['count'], 2)
        self.assertEqual(resp.data['total_amount'], 80.0)

        c1.refresh_from_db()
        c2.refresh_from_db()
        self.assertEqual(c1.status, 'reimbursed')
        self.assertEqual(c2.status, 'reimbursed')
        self.assertEqual(c1.payout_reference, 'ACH-BATCH-001')
