import uuid
import datetime
import hashlib
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.conf import settings
from django.http import HttpResponse
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status

from tenants.models import Organization
from teams.models import Department, Employee, LeaveRequest, PublicHoliday
from teams.views import (
    EmployeeListView, LeaveListView, LeaveDetailView, LeaveCalendarFeedView,
    LeaveMySummaryView, LeaveCancelView, LeaveApproveView, LeaveRejectView,
    LeaveTeamCalendarView, LeaveAIDraftView, EmployeeLeaveBalanceUpdateView,
    PublicHolidayListView, PublicHolidayDetailView
)

User = get_user_model()

class TeamsAdvancedTestCase(TestCase):
    def setUp(self):
        # 1. Create Organization
        self.org = Organization.objects.create(
            name="Test Org",
            slug="test-org",
            passkey_hash="dummy"
        )
        
        # 2. Create Users
        self.admin = User.objects.create_user(
            email="admin@test.com",
            password="password",
            first_name="Admin",
            last_name="User",
            role="admin",
            org=self.org
        )
        self.manager = User.objects.create_user(
            email="manager@test.com",
            password="password",
            first_name="Alice",
            last_name="Manager",
            role="manager",
            org=self.org
        )
        self.employee_user = User.objects.create_user(
            email="employee@test.com",
            password="password",
            first_name="Bob",
            last_name="Employee",
            role="employee",
            org=self.org
        )
        
        # 3. Create Department
        self.dept = Department.objects.create(
            org_id=self.org.id,
            name="Engineering",
            head=self.manager
        )
        
        # 4. Update Employee profiles (automatically created by signals)
        self.manager_profile = self.manager.employee_profile
        self.manager_profile.department = self.dept
        self.manager_profile.save()

        self.employee_profile = self.employee_user.employee_profile
        self.employee_profile.department = self.dept
        self.employee_profile.manager = self.manager_profile
        self.employee_profile.leave_balance = {"annual": 15, "sick": 8, "casual": 5, "wfh": 12, "unpaid": 0}
        self.employee_profile.save()

        self.factory = APIRequestFactory()

    def test_employee_list_pagination_bypass(self):
        view = EmployeeListView.as_view()
        request = self.factory.get('/api/teams/employees/?all=true')
        request.org_id = self.org.id
        request.user = self.admin
        force_authenticate(request, user=self.admin)
        
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 3)
        self.assertIn('calendar_feed_url', response.data[0])
        self.assertTrue(response.data[0]['calendar_feed_url'].startswith('/api/teams/leave/feed/'))

    def test_leave_balance_deductions(self):
        leave = LeaveRequest.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            leave_type="annual",
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2026, 9, 3), # 3 days duration
            status="pending",
            notes="Summer trip"
        )
        
        self.assertEqual(leave.duration_days(), 3)
        
        # Manager approves
        view = LeaveApproveView.as_view()
        request = self.factory.post(f'/api/teams/leave/{leave.id}/approve/')
        request.org_id = self.org.id
        request.user = self.manager
        force_authenticate(request, user=self.manager)
        
        response = view(request, leave_id=leave.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], "approved")
        
        # Verify employee leave balance is deducted: 15 - 3 = 12
        self.employee_profile.refresh_from_db()
        self.assertEqual(self.employee_profile.leave_balance['annual'], 12)

    def test_insufficient_leave_balance(self):
        leave = LeaveRequest.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            leave_type="sick",
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2026, 9, 10), # 10 days duration
            status="pending"
        )
        
        view = LeaveApproveView.as_view()
        request = self.factory.post(f'/api/teams/leave/{leave.id}/approve/')
        request.org_id = self.org.id
        request.user = self.manager
        force_authenticate(request, user=self.manager)
        
        response = view(request, leave_id=leave.id)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertIn("Insufficient sick leave balance", response.data['error'])

    def test_half_day_leave_creation(self):
        view = LeaveListView.as_view()
        data = {
            "leave_type": "casual",
            "start_date": "2026-09-20",
            "end_date": "2026-09-20",
            "is_half_day": True,
            "half_day_period": "morning",
            "notes": "Doctor appointment in morning"
        }
        request = self.factory.post('/api/teams/leave/', data, format='json')
        request.org_id = self.org.id
        request.user = self.employee_user
        force_authenticate(request, user=self.employee_user)

        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['duration_days'], 0.5)
        self.assertTrue(response.data['is_half_day'])
        self.assertEqual(response.data['half_day_period'], 'morning')

    def test_leave_cancellation_and_refund(self):
        # 1. Create approved leave (2 days annual)
        leave = LeaveRequest.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            leave_type="annual",
            start_date=datetime.date(2026, 10, 1),
            end_date=datetime.date(2026, 10, 2),
            status="pending"
        )
        # Approve to deduct 2 days: 15 -> 13
        view_approve = LeaveApproveView.as_view()
        req_app = self.factory.post(f'/api/teams/leave/{leave.id}/approve/')
        req_app.org_id = self.org.id
        req_app.user = self.manager
        force_authenticate(req_app, user=self.manager)
        view_approve(req_app, leave_id=leave.id)

        self.employee_profile.refresh_from_db()
        self.assertEqual(self.employee_profile.leave_balance['annual'], 13)

        # 2. Employee cancels leave
        view_cancel = LeaveCancelView.as_view()
        req_cancel = self.factory.post(f'/api/teams/leave/{leave.id}/cancel/')
        req_cancel.org_id = self.org.id
        req_cancel.user = self.employee_user
        force_authenticate(req_cancel, user=self.employee_user)
        resp_cancel = view_cancel(req_cancel, leave_id=leave.id)

        self.assertEqual(resp_cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_cancel.data['status'], 'cancelled')

        # Balance refunded: 13 + 2 = 15
        self.employee_profile.refresh_from_db()
        self.assertEqual(self.employee_profile.leave_balance['annual'], 15)

    def test_leave_rejection_with_reason(self):
        leave = LeaveRequest.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            leave_type="casual",
            start_date=datetime.date(2026, 9, 25),
            end_date=datetime.date(2026, 9, 25),
            status="pending"
        )

        view = LeaveRejectView.as_view()
        req = self.factory.post(f'/api/teams/leave/{leave.id}/reject/', {'reason': 'Team sprint deadline'}, format='json')
        req.org_id = self.org.id
        req.user = self.manager
        force_authenticate(req, user=self.manager)

        resp = view(req, leave_id=leave.id)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['status'], 'rejected')
        self.assertEqual(resp.data['rejection_reason'], 'Team sprint deadline')

    def test_leave_my_summary(self):
        view = LeaveMySummaryView.as_view()
        req = self.factory.get('/api/teams/leave/my-summary/')
        req.org_id = self.org.id
        req.user = self.employee_user
        force_authenticate(req, user=self.employee_user)

        resp = view(req)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('balances', resp.data)
        self.assertEqual(resp.data['balances']['annual'], 15)
        self.assertEqual(resp.data['balances']['sick'], 8)

    def test_team_calendar_endpoint(self):
        # Create approved leave in Sep 2026
        LeaveRequest.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            leave_type="annual",
            start_date=datetime.date(2026, 9, 15),
            end_date=datetime.date(2026, 9, 16),
            status="approved"
        )
        # Create public holiday
        PublicHoliday.objects.create(
            org_id=self.org.id,
            name="Founders Day",
            date=datetime.date(2026, 9, 18),
            description="Company holiday"
        )

        view = LeaveTeamCalendarView.as_view()
        req = self.factory.get('/api/teams/leave/team-calendar/?year=2026&month=9')
        req.org_id = self.org.id
        req.user = self.employee_user
        force_authenticate(req, user=self.employee_user)

        resp = view(req)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['year'], 2026)
        self.assertEqual(resp.data['month'], 9)
        self.assertEqual(len(resp.data['leaves']), 1)
        self.assertEqual(len(resp.data['holidays']), 1)
        self.assertEqual(resp.data['holidays'][0]['name'], "Founders Day")

    def test_public_holidays_crud(self):
        # Create holiday
        view_list = PublicHolidayListView.as_view()
        req = self.factory.post('/api/teams/leave/holidays/', {
            'name': 'New Year',
            'date': '2027-01-01',
            'description': 'Global Holiday'
        }, format='json')
        req.org_id = self.org.id
        req.user = self.admin
        force_authenticate(req, user=self.admin)

        resp = view_list(req)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        holiday_id = resp.data['id']

        # Delete holiday
        view_detail = PublicHolidayDetailView.as_view()
        req_del = self.factory.delete(f'/api/teams/leave/holidays/{holiday_id}/')
        req_del.org_id = self.org.id
        req_del.user = self.admin
        force_authenticate(req_del, user=self.admin)

        resp_del = view_detail(req_del, holiday_id=holiday_id)
        self.assertEqual(resp_del.status_code, status.HTTP_204_NO_CONTENT)

    def test_hr_adjust_employee_balances(self):
        view = EmployeeLeaveBalanceUpdateView.as_view()
        req = self.factory.patch(f'/api/teams/employees/{self.employee_profile.id}/balances/', {
            'annual': 25,
            'sick': 12
        }, format='json')
        req.org_id = self.org.id
        req.user = self.admin
        force_authenticate(req, user=self.admin)

        resp = view(req, employee_id=self.employee_profile.id)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.employee_profile.refresh_from_db()
        self.assertEqual(self.employee_profile.leave_balance['annual'], 25)
        self.assertEqual(self.employee_profile.leave_balance['sick'], 12)

    def test_ai_leave_draft(self):
        from unittest.mock import patch
        view = LeaveAIDraftView.as_view()
        req = self.factory.post('/api/teams/leave/ai-draft/', {
            'prompt': 'I need sick leave for doctor visit tomorrow'
        }, format='json')
        req.org_id = self.org.id
        req.user = self.employee_user
        force_authenticate(req, user=self.employee_user)

        with patch('teams.views.leave_service.generate_ai_leave_draft', return_value={
            'leave_type': 'sick',
            'start_date': str(datetime.date.today() + datetime.timedelta(days=1)),
            'end_date': str(datetime.date.today() + datetime.timedelta(days=1)),
            'is_half_day': False,
            'half_day_period': None,
            'notes': 'Doctor visit appointment',
            'confidence': 0.95
        }):
            resp = view(req)
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            self.assertIn('leave_type', resp.data)
            self.assertIn('start_date', resp.data)

    def test_calendar_feed_export(self):
        leave = LeaveRequest.objects.create(
            org_id=self.org.id,
            employee=self.employee_profile,
            leave_type="annual",
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2026, 9, 2), # 2 days duration
            status="approved"
        )
        
        emp_id = self.employee_profile.id
        token = hashlib.sha256(f"{emp_id}-{settings.SECRET_KEY}".encode()).hexdigest()[:16]
        
        view = LeaveCalendarFeedView.as_view()
        
        request_bad = self.factory.get(f'/api/teams/leave/feed/{emp_id}/invalidtoken/')
        response_bad = view(request_bad, employee_id=emp_id, token="invalidtoken")
        self.assertEqual(response_bad.status_code, 403)
        
        request_good = self.factory.get(f'/api/teams/leave/feed/{emp_id}/{token}/')
        response_good = view(request_good, employee_id=emp_id, token=token)
        self.assertEqual(response_good.status_code, 200)
        self.assertEqual(response_good['Content-Type'], "text/calendar")
        
        content = response_good.content.decode('utf-8')
        self.assertIn("BEGIN:VCALENDAR", content)
        self.assertIn("METHOD:PUBLISH", content)
        self.assertIn("SUMMARY:OOO: Bob Employee (Annual)", content)
        self.assertIn("DTSTART;VALUE=DATE:20260901", content)
        self.assertIn("DTEND;VALUE=DATE:20260903", content)
        self.assertIn("END:VCALENDAR", content)

