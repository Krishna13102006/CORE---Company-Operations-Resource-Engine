import uuid
import datetime
from django.test import TestCase
from django.contrib.auth import get_user_model
from tenants.models import Organization
from hiring.models import JobPosting, Candidate, Application, InterviewSchedule, Scorecard, EmailTemplate, EmailLog, Offer
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status
from hiring.views import (
    HiringStatsView, JobPostingListView, JobPostingDetailView, ApplicationListView,
    ApplicationDetailView, ApplicationStageView, InterviewScheduleView,
    InterviewScheduleDetailView, ScorecardView, EmailTemplateListView,
    EmailLogView, EmailComposeView, OfferDetailView, OfferExtendView,
    OfferRespondView, AnalyticsView, InboundEmailWebhookView,
    ApplicationOnboardView, ApplicationGenerateQuestionsView,
    PublicCareersPortalView, PublicJobDetailView, PublicJobApplyView
)

User = get_user_model()

class HiringATSIntegrationTestCase(TestCase):
    def setUp(self):
        # 1. Create Organization
        self.org = Organization.objects.create(
            name="Test Corp",
            slug="test-corp",
            passkey_hash="dummy"
        )
        self.org_id = self.org.id

        # 2. Create Users (Admin & regular)
        self.admin = User.objects.create_user(
            email="admin@test.com",
            password="password",
            first_name="Admin",
            last_name="Recruiter",
            role="admin",
            org=self.org
        )
        self.admin.organization = self.org
        self.admin.save()

        # 3. Create Job Posting
        self.job = JobPosting.objects.create(
            org=self.org,
            title="Senior Data Scientist",
            department="Data Science",
            description="Llama models tuning",
            requirements="PyTorch, Transformers",
            experience_requirements="5+ years experience",
            status="open",
            created_by=self.admin
        )

        # 4. Seed Email Templates
        self.template_applied = EmailTemplate.objects.create(
            org=self.org,
            name="Application Received",
            template_type="applied",
            subject="Applied for {job_title}",
            body="Hi {candidate_name}, thanks for applying!"
        )
        self.template_interview = EmailTemplate.objects.create(
            org=self.org,
            name="Interview Invitation",
            template_type="interview",
            subject="Interview for {job_title}",
            body="Hi {candidate_name}, let's schedule a chat."
        )

        self.factory = APIRequestFactory()

    def _setup_request(self, request, user):
        request.org_id = self.org_id
        force_authenticate(request, user=user)
        return request

    def test_job_sourcing_and_tracking(self):
        """Feature 7: Test candidate creation with source tracking."""
        view = ApplicationListView.as_view()
        request = self.factory.post(
            f'/api/hiring/jobs/{self.job.id}/applications/',
            {
                'first_name': 'Nora',
                'last_name': 'Patel',
                'email': 'nora.patel@example.com',
                'phone': '123-456-7890',
                'source': 'linkedin',
                'source_details': 'Direct connection'
            }
        )
        self._setup_request(request, self.admin)
        response = view(request, job_id=self.job.id)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['source'], 'linkedin')
        self.assertEqual(response.data['source_details'], 'Direct connection')

        # Check database directly
        app = Application.objects.get(id=response.data['id'])
        self.assertEqual(app.source, 'linkedin')
        self.assertEqual(app.source_details, 'Direct connection')

    def test_interview_scheduling(self):
        """Feature 2: Test schedule round creation, completion, and deletion."""
        # Setup application
        candidate = Candidate.objects.create(
            org_id=self.org_id,
            first_name="Marcus",
            last_name="Johnson",
            email="marcus@test.com"
        )
        app = Application.objects.create(
            org_id=self.org_id,
            candidate=candidate,
            job_posting=self.job,
            stage="screening"
        )

        # 1. Schedule Interview
        view = InterviewScheduleView.as_view()
        sched_time = (datetime.datetime.now() + datetime.timedelta(days=2)).isoformat()
        request = self.factory.post(
            f'/api/hiring/applications/{app.id}/interviews/',
            {
                'scheduled_at': sched_time,
                'duration_min': 45,
                'interview_type': 'technical',
                'meeting_link': 'https://meet.google.com/abc-defg-hij',
                'interviewers': ['Alice Recruiter', 'Bob Dev'],
                'agenda': 'System design and coding'
            },
            format='json'
        )
        self._setup_request(request, self.admin)
        response = view(request, application_id=app.id)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sched_id = response.data['id']
        self.assertEqual(response.data['status'], 'scheduled')
        self.assertEqual(response.data['interview_type'], 'technical')

        # 2. Complete Interview
        detail_view = InterviewScheduleDetailView.as_view()
        request_complete = self.factory.patch(
            f'/api/hiring/applications/{app.id}/interviews/{sched_id}/',
            {'status': 'completed'}
        )
        self._setup_request(request_complete, self.admin)
        response_complete = detail_view(request_complete, application_id=app.id, schedule_id=sched_id)

        self.assertEqual(response_complete.status_code, status.HTTP_200_OK)
        self.assertEqual(response_complete.data['status'], 'completed')

        # 3. Delete Schedule
        request_delete = self.factory.delete(f'/api/hiring/applications/{app.id}/interviews/{sched_id}/')
        self._setup_request(request_delete, self.admin)
        response_delete = detail_view(request_delete, application_id=app.id, schedule_id=sched_id)
        self.assertEqual(response_delete.status_code, status.HTTP_204_NO_CONTENT)

    def test_structured_scorecards(self):
        """Feature 3: Test structured scorecard submission and averages."""
        candidate = Candidate.objects.create(
            org_id=self.org_id,
            first_name="Marcus",
            last_name="Johnson",
            email="marcus@test.com"
        )
        app = Application.objects.create(
            org_id=self.org_id,
            candidate=candidate,
            job_posting=self.job,
            stage="screening"
        )

        view = ScorecardView.as_view()
        request = self.factory.post(
            f'/api/hiring/applications/{app.id}/scorecards/',
            {
                'stage': 'screening',
                'scores': {
                    'communication': 4,
                    'role_understanding': 5,
                    'motivation': 3,
                    'culture_fit': 4
                },
                'recommendation': 'yes',
                'strengths': 'Very articulate',
                'concerns': 'None'
            },
            format='json'
        )
        self._setup_request(request, self.admin)
        response = view(request, application_id=app.id)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['reviewer_name'], 'Admin Recruiter')
        self.assertEqual(response.data['recommendation'], 'yes')

        # Retrieve Scorecards list
        request_get = self.factory.get(f'/api/hiring/applications/{app.id}/scorecards/')
        self._setup_request(request_get, self.admin)
        response_get = view(request_get, application_id=app.id)
        self.assertEqual(response_get.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_get.data), 1)

    def test_candidate_communication_emails(self):
        """Feature 4: Test email template list, composition, and logs."""
        candidate = Candidate.objects.create(
            org_id=self.org_id,
            first_name="Nora",
            last_name="Patel",
            email="nora@test.com"
        )
        app = Application.objects.create(
            org_id=self.org_id,
            candidate=candidate,
            job_posting=self.job,
            stage="screening"
        )

        # 1. Fetch Email Templates
        temp_view = EmailTemplateListView.as_view()
        request_temp = self.factory.get('/api/hiring/email-templates/')
        self._setup_request(request_temp, self.admin)
        response_temp = temp_view(request_temp)
        self.assertEqual(response_temp.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response_temp.data) >= 2)

        # 2. Compose and Send Email (Console mail dispatcher)
        compose_view = EmailComposeView.as_view()
        request_send = self.factory.post(
            f'/api/hiring/applications/{app.id}/emails/send/',
            {
                'subject': 'Interview Invitation - Senior Data Scientist',
                'body': 'Hi Nora Patel, we would love to schedule a technical chat for the Data Scientist role.'
            }
        )
        self._setup_request(request_send, self.admin)
        response_send = compose_view(request_send, application_id=app.id)

        self.assertEqual(response_send.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response_send.data['subject'], 'Interview Invitation - Senior Data Scientist')

        # 3. Check logs
        log_view = EmailLogView.as_view()
        request_log = self.factory.get(f'/api/hiring/applications/{app.id}/emails/')
        self._setup_request(request_log, self.admin)
        response_log = log_view(request_log, application_id=app.id)
        self.assertEqual(response_log.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_log.data), 1)
        self.assertEqual(response_log.data[0]['to_email'], 'nora@test.com')

    def test_offer_management_and_transitions(self):
        """Feature 6: Test drafting, extending, and simulated accept/decline workflows."""
        candidate = Candidate.objects.create(
            org_id=self.org_id,
            first_name="Marcus",
            last_name="Johnson",
            email="marcus@test.com"
        )
        app = Application.objects.create(
            org_id=self.org_id,
            candidate=candidate,
            job_posting=self.job,
            stage="interview"
        )

        # 1. Draft Offer
        offer_view = OfferDetailView.as_view()
        start_date = (datetime.date.today() + datetime.timedelta(days=14)).isoformat()
        request_draft = self.factory.post(
            f'/api/hiring/applications/{app.id}/offer/',
            {
                'salary': 95000,
                'start_date': start_date,
                'expiration_date': (datetime.date.today() + datetime.timedelta(days=21)).isoformat(),
                'notes': 'Negotiated stock options',
                'offer_letter_text': 'Dear Marcus, we are pleased to offer you...'
            }
        )
        self._setup_request(request_draft, self.admin)
        response_draft = offer_view(request_draft, application_id=app.id)

        self.assertEqual(response_draft.status_code, status.HTTP_200_OK)
        self.assertEqual(response_draft.data['status'], 'draft')
        self.assertEqual(float(response_draft.data['salary']), 95000.0)

        # 2. Extend Offer (Status shifts to Extended)
        extend_view = OfferExtendView.as_view()
        request_extend = self.factory.post(f'/api/hiring/applications/{app.id}/offer/extend/')
        self._setup_request(request_extend, self.admin)
        response_extend = extend_view(request_extend, application_id=app.id)

        self.assertEqual(response_extend.status_code, status.HTTP_200_OK)
        self.assertEqual(response_extend.data['status'], 'extended')

        # 3. Simulate Accept Response (Application transitions to Hired stage)
        respond_view = OfferRespondView.as_view()
        request_respond = self.factory.post(
            f'/api/hiring/applications/{app.id}/offer/respond/',
            {'response': 'accepted'}
        )
        self._setup_request(request_respond, self.admin)
        response_respond = respond_view(request_respond, application_id=app.id)

        self.assertEqual(response_respond.status_code, status.HTTP_200_OK)
        self.assertEqual(response_respond.data['status'], 'accepted')

        # Check Application stage directly: must be HIRED
        app.refresh_from_db()
        self.assertEqual(app.stage, 'hired')

    def test_analytics_funnel_and_velocity(self):
        """Feature 5: Test retrieval of cumulative conversion funnel, velocity metrics and channel metrics."""
        # Create some candidate applications with various sources
        candidate1 = Candidate.objects.create(org_id=self.org_id, first_name="A", last_name="B", email="a@test.com")
        candidate2 = Candidate.objects.create(org_id=self.org_id, first_name="C", last_name="D", email="c@test.com")
        candidate3 = Candidate.objects.create(org_id=self.org_id, first_name="E", last_name="F", email="e@test.com")

        # LinkedIn Sourced (Hired)
        app1 = Application.objects.create(org_id=self.org_id, candidate=candidate1, job_posting=self.job, stage='hired', source='linkedin')
        # Indeed Sourced (Screening)
        app2 = Application.objects.create(org_id=self.org_id, candidate=candidate2, job_posting=self.job, stage='screening', source='indeed')
        # Referral Sourced (Interview)
        app3 = Application.objects.create(org_id=self.org_id, candidate=candidate3, job_posting=self.job, stage='interview', source='referral')

        # Retrieve Analytics
        view = AnalyticsView.as_view()
        request = self.factory.get('/api/hiring/analytics/')
        self._setup_request(request, self.admin)
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_applications'], 3)
        self.assertTrue('stage_funnel' in response.data)
        self.assertTrue('avg_stage_time' in response.data)
        self.assertTrue('source_metrics' in response.data)

        # Check sourcing counts
        sources = {item['source']: item for item in response.data['source_metrics']}
        self.assertEqual(sources['Linkedin']['count'], 1)
        self.assertEqual(sources['Linkedin']['hired_count'], 1)
        self.assertEqual(sources['Linkedin']['conversion_rate'], 1.0)
        self.assertEqual(sources['Indeed']['count'], 1)
        self.assertEqual(sources['Indeed']['hired_count'], 0)
        self.assertEqual(sources['Indeed']['conversion_rate'], 0.0)

    def test_interview_calendar_sync_and_meeting_link_generation(self):
        """Test calendar synchronization, conflict checks, and meeting link generation."""
        # 1. Create a candidate and application
        cand = Candidate.objects.create(org_id=self.org_id, first_name="John", last_name="Doe", email="jdoe@test.com")
        app = Application.objects.create(org_id=self.org_id, candidate=cand, job_posting=self.job, stage='screening')
        
        # Schedule first interview
        view = InterviewScheduleView.as_view()
        data1 = {
            "scheduled_at": "2026-10-15T10:00:00Z",
            "duration_min": 60,
            "interview_type": "video",
            "interviewers": ["Alice Recruiter", "Bob Eng"]
        }
        
        request1 = self.factory.post(f'/api/hiring/applications/{app.id}/interviews/', data1, format='json')
        self._setup_request(request1, self.admin)
        response1 = view(request1, application_id=app.id)
        
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        self.assertIn('meeting_link', response1.data)
        self.assertTrue('/meetings/room/' in response1.data['meeting_link'] or response1.data['meeting_link'].startswith('https://meet.google.com/'))

        # 2. Try scheduling overlapping interview with same interviewer
        data2 = {
            "scheduled_at": "2026-10-15T10:30:00Z", # Starts during first interview duration
            "duration_min": 45,
            "interview_type": "video",
            "interviewers": ["Alice Recruiter"]
        }
        
        request2 = self.factory.post(f'/api/hiring/applications/{app.id}/interviews/', data2, format='json')
        self._setup_request(request2, self.admin)
        response2 = view(request2, application_id=app.id)
        
        # Verify it raises conflict error
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response2.data)
        self.assertIn('Interviewer conflict: Alice Recruiter', response2.data['error'])

    def test_inbound_email_syncing(self):
        """Test candidate email reply webhook syncs into candidate email log feed."""
        # 1. Create candidate and application
        cand = Candidate.objects.create(org_id=self.org_id, first_name="Jane", last_name="Smith", email="jsmith@test.com")
        app = Application.objects.create(org_id=self.org_id, candidate=cand, job_posting=self.job, stage='interview')
        
        # 2. Simulate webhook POST
        webhook_view = InboundEmailWebhookView.as_view()
        webhook_data = {
            "sender": "jsmith@test.com",
            "recipient": "jobs-reply@test.com",
            "subject": "Re: Technical Round Interview",
            "body": "I am confirmed for 2 PM. Thanks!"
        }
        
        request_webhook = self.factory.post('/api/hiring/inbound/', webhook_data, format='json')
        response_webhook = webhook_view(request_webhook)
        
        self.assertEqual(response_webhook.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response_webhook.data['log']['status'], 'received')
        
        # 3. Verify it shows up in application email log view
        log_view = EmailLogView.as_view()
        request_logs = self.factory.get(f'/api/hiring/applications/{app.id}/emails/')
        self._setup_request(request_logs, self.admin)
        response_logs = log_view(request_logs, application_id=app.id)
        
        self.assertEqual(response_logs.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_logs.data), 1)
        self.assertEqual(response_logs.data[0]['status'], 'received')
        self.assertEqual(response_logs.data[0]['body'], "I am confirmed for 2 PM. Thanks!")

    def test_onboard_candidate_as_employee(self):
        """Test 1-Click Convert Hired Candidate to Employee with project tasks & orientation meeting."""
        cand = Candidate.objects.create(
            org_id=self.org_id,
            first_name="Alex",
            last_name="Onboard",
            email="alex.onboard@example.com",
            phone="+1234567890"
        )
        app = Application.objects.create(
            org_id=self.org_id,
            candidate=cand,
            job_posting=self.job,
            stage='offer'
        )

        from teams.models import Department
        dept = Department.objects.create(org_id=self.org_id, name="Engineering")

        view = ApplicationOnboardView.as_view()
        payload = {
            "role": "employee",
            "department_id": str(dept.id),
            "job_title": "Lead Software Engineer",
            "start_date": "2026-11-01",
            "create_onboarding_tasks": True,
            "schedule_orientation_meeting": True
        }

        request = self.factory.post(f'/api/hiring/applications/{app.id}/onboard/', payload, format='json')
        self._setup_request(request, self.admin)
        response = view(request, application_id=app.id)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['email'], "alex.onboard@example.com")
        self.assertIsNotNone(response.data['project_id'])
        self.assertIsNotNone(response.data['meeting_room_code'])

        # Verify created user in database
        new_user = User.objects.get(email="alex.onboard@example.com")
        self.assertEqual(new_user.first_name, "Alex")
        self.assertEqual(new_user.last_name, "Onboard")
        self.assertEqual(new_user.role, "employee")

        # Verify application stage moved to hired
        app.refresh_from_db()
        self.assertEqual(app.stage, "hired")

    def test_generate_ai_interview_questions(self):
        """Test AI interview questions generator returns structured questions."""
        cand = Candidate.objects.create(
            org_id=self.org_id,
            first_name="Sarah",
            last_name="Connor",
            email="sconnor@test.com",
            parsed_skills=["Python", "SQL"],
            parsed_experience=["3 years data analytics at TechCorp"]
        )
        app = Application.objects.create(
            org_id=self.org_id,
            candidate=cand,
            job_posting=self.job,
            stage='interview'
        )

        view = ApplicationGenerateQuestionsView.as_view()
        request = self.factory.post(f'/api/hiring/applications/{app.id}/generate-questions/', {}, format='json')
        self._setup_request(request, self.admin)
        response = view(request, application_id=app.id)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('questions', response.data)
        self.assertTrue(len(response.data['questions']) >= 3)
        self.assertIn('question', response.data['questions'][0])
        self.assertIn('category', response.data['questions'][0])

    def test_public_careers_portal_and_application_flow(self):
        """Test public-facing careers portal listing and unauthenticated candidate application."""
        # 1. Test public careers portal listing
        portal_view = PublicCareersPortalView.as_view()
        request_portal = self.factory.get(f'/api/hiring/public/careers/{self.org.slug}/')
        response_portal = portal_view(request_portal, slug=self.org.slug)

        self.assertEqual(response_portal.status_code, status.HTTP_200_OK)
        self.assertEqual(response_portal.data['slug'], self.org.slug)
        self.assertTrue(len(response_portal.data['jobs']) >= 1)

        # 2. Test public job detail view
        job_view = PublicJobDetailView.as_view()
        request_job = self.factory.get(f'/api/hiring/public/careers/{self.org.slug}/jobs/{self.job.id}/')
        response_job = job_view(request_job, slug=self.org.slug, job_id=self.job.id)

        self.assertEqual(response_job.status_code, status.HTTP_200_OK)
        self.assertEqual(response_job.data['job']['title'], "Senior Data Scientist")

        # 3. Test public application submission
        apply_view = PublicJobApplyView.as_view()
        apply_payload = {
            "first_name": "Marcus",
            "last_name": "Aurelius",
            "email": "marcus.aurelius@example.com",
            "phone": "+1999888777"
        }
        request_apply = self.factory.post(f'/api/hiring/public/careers/{self.org.slug}/jobs/{self.job.id}/apply/', apply_payload, format='multipart')
        response_apply = apply_view(request_apply, slug=self.org.slug, job_id=self.job.id)

        self.assertEqual(response_apply.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response_apply.data['success'])

        # Verify candidate and application created with careers_page source
        app = Application.objects.get(id=response_apply.data['application_id'])
        self.assertEqual(app.source, 'careers_page')
        self.assertEqual(app.candidate.email, 'marcus.aurelius@example.com')


