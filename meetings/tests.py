import json
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status
from unittest.mock import patch

from tenants.models import Organization
from projects.models import Project
from meetings.models import Meeting, MeetingParticipant
from meetings.views import (
    MeetingListCreateView,
    MeetingDetailView,
    MeetingByRoomCodeView,
    MeetingJoinView,
    MeetingLeaveView,
    MeetingEndView,
    MeetingTranscriptView,
    MeetingSummarizeView,
    MeetingAIChatStreamView,
    MeetingInviteView,
    MeetingLockToggleView,
    MeetingAgendaUpdateView,
    MeetingAdmitParticipantView,
    MeetingWaitingListView,
    MeetingPresentationSyncView,
    MeetingRecordingUploadView,
    MeetingICSDownloadView,
    MeetingConvertTaskView,
)

User = get_user_model()


class MeetingEndpointsTestCase(TestCase):
    def setUp(self):
        # 1. Organization setup
        self.org = Organization.objects.create(
            name="Acme Corp",
            slug="acme-corp",
            passkey_hash="dummy"
        )

        # 2. Host and Attendees setup
        self.host = User.objects.create_user(
            email="host@acme.com",
            password="password123",
            first_name="Host",
            last_name="Leader",
            role="manager",
            org=self.org
        )

        self.attendee = User.objects.create_user(
            email="attendee@acme.com",
            password="password123",
            first_name="Jane",
            last_name="Attendee",
            role="employee",
            org=self.org
        )

        self.project = Project.objects.create(
            org=self.org,
            name="Alpha Platform Launch",
            description="Core alpha project."
        )

        self.factory = APIRequestFactory()

    @patch('meetings.services._send_meeting_invitations_worker')
    def test_meeting_create_and_list(self, mock_email):
        # 1. Create scheduled meeting with agenda items
        payload = {
            "title": "Quarterly Product Planning",
            "description": "Discuss Q4 objectives and milestones.",
            "scheduled_start": "2026-10-01T10:00:00Z",
            "scheduled_end": "2026-10-01T11:00:00Z",
            "passcode": "secure123",
            "waiting_room_enabled": True,
            "agenda_items": [
                {"id": "ag-1", "text": "Review OKRs", "is_completed": False},
                {"id": "ag-2", "text": "Product Roadmap Q4", "is_completed": False}
            ],
            "invitees": [
                {"email": "attendee@acme.com", "name": "Jane Attendee", "role": "attendee"}
            ]
        }

        request = self.factory.post('/api/meetings/', payload, format='json')
        request.org_id = str(self.org.id)
        force_authenticate(request, user=self.host)

        view = MeetingListCreateView.as_view()
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data
        self.assertEqual(data['title'], "Quarterly Product Planning")
        self.assertEqual(data['status'], "scheduled")
        self.assertTrue(data['room_code'].startswith("meet-"))
        self.assertEqual(len(data['participants']), 2)  # Host + Attendee
        self.assertEqual(len(data['agenda_items']), 2)

        # 2. List meetings
        list_request = self.factory.get('/api/meetings/?status=upcoming')
        list_request.org_id = str(self.org.id)
        force_authenticate(list_request, user=self.attendee)

        list_response = view(list_request)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]['title'], "Quarterly Product Planning")

    def test_instant_meeting_creation(self):
        payload = {
            "title": "Host's Instant Sync",
            "is_instant": True
        }

        request = self.factory.post('/api/meetings/', payload, format='json')
        request.org_id = str(self.org.id)
        force_authenticate(request, user=self.host)

        response = MeetingListCreateView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['is_instant'])
        self.assertEqual(response.data['status'], 'scheduled')

    def test_meeting_join_and_leave_lifecycle(self):
        meeting = Meeting.objects.create(
            title="Passcode Sync",
            host=self.host,
            org=self.org,
            passcode="secret99"
        )

        # 1. Join with incorrect passcode -> 403
        bad_join_req = self.factory.post(f'/api/meetings/room/{meeting.room_code}/join/', {"passcode": "wrong"}, format='json')
        bad_join_req.org_id = str(self.org.id)
        force_authenticate(bad_join_req, user=self.attendee)

        resp = MeetingJoinView.as_view()(bad_join_req, room_code=meeting.room_code)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Join with correct passcode -> 200 & returns STUN ICE servers
        join_req = self.factory.post(f'/api/meetings/room/{meeting.room_code}/join/', {"passcode": "secret99"}, format='json')
        join_req.org_id = str(self.org.id)
        force_authenticate(join_req, user=self.attendee)

        resp = MeetingJoinView.as_view()(join_req, room_code=meeting.room_code)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('ice_servers', resp.data)
        self.assertEqual(resp.data['current_participant']['email'], "attendee@acme.com")
        self.assertTrue(resp.data['current_participant']['has_joined'])

        # Meeting status should transition to 'live'
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, 'live')

        # 3. Leave meeting
        leave_req = self.factory.post(f'/api/meetings/room/{meeting.room_code}/leave/')
        leave_req.org_id = str(self.org.id)
        force_authenticate(leave_req, user=self.attendee)

        leave_resp = MeetingLeaveView.as_view()(leave_req, room_code=meeting.room_code)
        self.assertEqual(leave_resp.status_code, status.HTTP_200_OK)

    def test_transcript_push_and_retrieval(self):
        meeting = Meeting.objects.create(
            title="Sprint Retro",
            host=self.host,
            org=self.org,
            status="live"
        )

        entries = [
            {"speaker_name": "Host Leader", "speaker_email": "host@acme.com", "text": "Let's review the sprint velocity.", "timestamp": "10:01:00"},
            {"speaker_name": "Jane Attendee", "speaker_email": "attendee@acme.com", "text": "All front-end tickets were closed on time.", "timestamp": "10:01:45"}
        ]

        # Push transcript batch
        push_req = self.factory.post(f'/api/meetings/room/{meeting.room_code}/transcript/', {"entries": entries}, format='json')
        push_req.org_id = str(self.org.id)
        force_authenticate(push_req, user=self.host)

        push_resp = MeetingTranscriptView.as_view()(push_req, room_code=meeting.room_code)
        self.assertEqual(push_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(push_resp.data['total_entries'], 2)

        # Get transcript
        get_req = self.factory.get(f'/api/meetings/room/{meeting.room_code}/transcript/')
        get_req.org_id = str(self.org.id)
        force_authenticate(get_req, user=self.attendee)

        get_resp = MeetingTranscriptView.as_view()(get_req, room_code=meeting.room_code)
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(get_resp.data['transcript_raw']), 2)

    @patch('meetings.services.generate_meeting_ai_summary')
    def test_end_meeting_triggers_summary(self, mock_ai_summary):
        meeting = Meeting.objects.create(
            title="Architecture Sync",
            host=self.host,
            org=self.org,
            status="live"
        )

        end_req = self.factory.post(f'/api/meetings/room/{meeting.room_code}/end/')
        end_req.org_id = str(self.org.id)
        force_authenticate(end_req, user=self.host)

        resp = MeetingEndView.as_view()(end_req, room_code=meeting.room_code)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, 'completed')
        self.assertIsNotNone(meeting.actual_end)

    def test_ai_summarization_fallback_generation(self):
        meeting = Meeting.objects.create(
            title="Design System Alignment",
            host=self.host,
            org=self.org,
            transcript_raw=[
                {"speaker_name": "Host", "text": "We need to finalize the dark mode theme colors."}
            ]
        )

        sum_req = self.factory.post(f'/api/meetings/{meeting.id}/summarize/')
        sum_req.org_id = str(self.org.id)
        force_authenticate(sum_req, user=self.host)

        resp = MeetingSummarizeView.as_view()(sum_req, pk=str(meeting.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(len(resp.data['ai_summary']) > 0)
        self.assertIsInstance(resp.data['key_decisions'], list)
        self.assertIsInstance(resp.data['action_items'], list)

    def test_meeting_ai_chat_streaming_endpoint(self):
        meeting = Meeting.objects.create(
            title="Budget Review",
            host=self.host,
            org=self.org,
            ai_summary="The team approved a $50k Q4 marketing budget.",
            transcript_raw=[{"speaker_name": "Host", "text": "Approved $50k for marketing."}]
        )

        chat_req = self.factory.post(
            f'/api/meetings/{meeting.id}/ai-chat/',
            {"question": "How much was approved for marketing?", "history": []},
            format='json'
        )
        chat_req.org_id = str(self.org.id)
        force_authenticate(chat_req, user=self.host)

        resp = MeetingAIChatStreamView.as_view()(chat_req, pk=str(meeting.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp['Content-Type'], 'text/event-stream')

    @patch('meetings.services._send_meeting_invitations_worker')
    def test_mid_meeting_invite(self, mock_email):
        meeting = Meeting.objects.create(
            title="Emergency Incident",
            host=self.host,
            org=self.org,
            status="live"
        )

        invite_req = self.factory.post(
            f'/api/meetings/{meeting.id}/invite/',
            {"invitees": ["newdev@acme.com", "oncall@acme.com"]},
            format='json'
        )
        invite_req.org_id = str(self.org.id)
        force_authenticate(invite_req, user=self.host)

        resp = MeetingInviteView.as_view()(invite_req, pk=str(meeting.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['added_count'], 2)
        self.assertEqual(MeetingParticipant.objects.filter(meeting=meeting).count(), 2)

    def test_meeting_lock_and_unlock_toggle(self):
        meeting = Meeting.objects.create(
            title="Security Sync",
            host=self.host,
            org=self.org,
            is_locked=False
        )

        # 1. Host locks the room
        lock_req = self.factory.post(f'/api/meetings/room/{meeting.room_code}/lock/')
        lock_req.org_id = str(self.org.id)
        force_authenticate(lock_req, user=self.host)

        resp = MeetingLockToggleView.as_view()(lock_req, room_code=meeting.room_code)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['is_locked'])

        meeting.refresh_from_db()
        self.assertTrue(meeting.is_locked)

        # 2. Non-host cannot lock
        non_host_req = self.factory.post(f'/api/meetings/room/{meeting.room_code}/lock/')
        non_host_req.org_id = str(self.org.id)
        force_authenticate(non_host_req, user=self.attendee)

        resp2 = MeetingLockToggleView.as_view()(non_host_req, room_code=meeting.room_code)
        self.assertEqual(resp2.status_code, status.HTTP_403_FORBIDDEN)

    def test_agenda_management_and_tracking(self):
        meeting = Meeting.objects.create(
            title="Product Backlog Grooming",
            host=self.host,
            org=self.org,
            agenda_items=[
                {"id": "ag-1", "text": "Feature Scope", "is_completed": False, "completed_at": None}
            ]
        )

        # 1. Add new agenda item
        add_req = self.factory.post(
            f'/api/meetings/room/{meeting.room_code}/agenda/',
            {"new_item_text": "Security Architecture"},
            format='json'
        )
        add_req.org_id = str(self.org.id)
        force_authenticate(add_req, user=self.host)

        resp = MeetingAgendaUpdateView.as_view()(add_req, room_code=meeting.room_code)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['total_count'], 2)

        # 2. Complete first agenda item
        complete_req = self.factory.post(
            f'/api/meetings/room/{meeting.room_code}/agenda/',
            {"item_id": "ag-1", "is_completed": True},
            format='json'
        )
        complete_req.org_id = str(self.org.id)
        force_authenticate(complete_req, user=self.attendee)

        resp2 = MeetingAgendaUpdateView.as_view()(complete_req, room_code=meeting.room_code)
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(resp2.data['completed_count'], 1)

    def test_waiting_room_and_host_admission(self):
        meeting = Meeting.objects.create(
            title="Board Strategy Review",
            host=self.host,
            org=self.org,
            waiting_room_enabled=True
        )

        # 1. Attendee joins -> routed to waiting room
        join_req = self.factory.post(f'/api/meetings/room/{meeting.room_code}/join/')
        join_req.org_id = str(self.org.id)
        force_authenticate(join_req, user=self.attendee)

        join_resp = MeetingJoinView.as_view()(join_req, room_code=meeting.room_code)
        self.assertEqual(join_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(join_resp.data['status'], 'waiting_room')

        # 2. Host views waiting room
        wait_req = self.factory.get(f'/api/meetings/room/{meeting.room_code}/waiting/')
        wait_req.org_id = str(self.org.id)
        force_authenticate(wait_req, user=self.host)

        wait_resp = MeetingWaitingListView.as_view()(wait_req, room_code=meeting.room_code)
        self.assertEqual(wait_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(wait_resp.data), 1)
        self.assertEqual(wait_resp.data[0]['email'], "attendee@acme.com")

        participant_id = wait_resp.data[0]['id']

        # 3. Host admits participant
        admit_req = self.factory.post(
            f'/api/meetings/room/{meeting.room_code}/admit/',
            {"participant_id": participant_id, "action": "admit"},
            format='json'
        )
        admit_req.org_id = str(self.org.id)
        force_authenticate(admit_req, user=self.host)

        admit_resp = MeetingAdmitParticipantView.as_view()(admit_req, room_code=meeting.room_code)
        self.assertEqual(admit_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(admit_resp.data['status'], 'admitted')

        # 4. Attendee joins again -> successfully entered room
        rejoin_req = self.factory.post(f'/api/meetings/room/{meeting.room_code}/join/')
        rejoin_req.org_id = str(self.org.id)
        force_authenticate(rejoin_req, user=self.attendee)

        rejoin_resp = MeetingJoinView.as_view()(rejoin_req, room_code=meeting.room_code)
        self.assertEqual(rejoin_resp.status_code, status.HTTP_200_OK)
        self.assertIn('ice_servers', rejoin_resp.data)

    def test_in_room_presentation_sync(self):
        meeting = Meeting.objects.create(
            title="Sales Pitch",
            host=self.host,
            org=self.org,
            status="live"
        )

        # 1. Start presentation
        start_payload = {
            "action": "start",
            "title": "Alpha Q4 Deck",
            "url": "https://example.com/alpha_deck.pdf",
            "file_type": "pdf",
            "page": 1
        }
        start_req = self.factory.post(f'/api/meetings/room/{meeting.room_code}/presentation/', start_payload, format='json')
        start_req.org_id = str(self.org.id)
        force_authenticate(start_req, user=self.host)

        start_resp = MeetingPresentationSyncView.as_view()(start_req, room_code=meeting.room_code)
        self.assertEqual(start_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(start_resp.data['active_presentation']['title'], "Alpha Q4 Deck")
        self.assertEqual(start_resp.data['active_presentation']['page'], 1)

        # 2. Update page / slide
        page_req = self.factory.post(
            f'/api/meetings/room/{meeting.room_code}/presentation/',
            {"action": "update_page", "page": 3},
            format='json'
        )
        page_req.org_id = str(self.org.id)
        force_authenticate(page_req, user=self.host)

        page_resp = MeetingPresentationSyncView.as_view()(page_req, room_code=meeting.room_code)
        self.assertEqual(page_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(page_resp.data['active_presentation']['page'], 3)

        # 3. Stop presenting
        stop_req = self.factory.post(
            f'/api/meetings/room/{meeting.room_code}/presentation/',
            {"action": "stop"},
            format='json'
        )
        stop_req.org_id = str(self.org.id)
        force_authenticate(stop_req, user=self.host)

        stop_resp = MeetingPresentationSyncView.as_view()(stop_req, room_code=meeting.room_code)
        self.assertEqual(stop_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(stop_resp.data['active_presentation'], {})

    def test_convert_action_item_to_project_task(self):
        meeting = Meeting.objects.create(
            title="Q4 Sprint Kickoff",
            host=self.host,
            org=self.org,
            action_items=[
                {
                    "task": "Set up staging database cluster",
                    "owner": "Jane Attendee",
                    "priority": "high",
                    "deadline": "2026-10-15",
                    "is_converted": False
                }
            ]
        )

        convert_payload = {
            "project_id": str(self.project.id),
            "title": "Set up staging database cluster",
            "description": "Ensure read replicas and automated backups are configured.",
            "assignee_id": str(self.attendee.id),
            "due_date": "2026-10-15",
            "priority": "high",
            "action_index": 0
        }

        req = self.factory.post(f'/api/meetings/{meeting.id}/convert-task/', convert_payload, format='json')
        req.org_id = str(self.org.id)
        force_authenticate(req, user=self.host)

        resp = MeetingConvertTaskView.as_view()(req, pk=str(meeting.id))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data['success'])
        self.assertEqual(resp.data['title'], "Set up staging database cluster")

        meeting.refresh_from_db()
        self.assertTrue(meeting.action_items[0]['is_converted'])
        self.assertEqual(meeting.action_items[0]['project_name'], self.project.name)

    def test_download_ics_calendar_invite(self):
        meeting = Meeting.objects.create(
            title="Client Quarterly Demo",
            description="Live walkthrough of new dashboard.",
            host=self.host,
            org=self.org,
            scheduled_start="2026-10-10T14:00:00Z",
            scheduled_end="2026-10-10T15:00:00Z"
        )

        req = self.factory.get(f'/api/meetings/{meeting.id}/ics/')
        req.org_id = str(self.org.id)
        force_authenticate(req, user=self.attendee)

        resp = MeetingICSDownloadView.as_view()(req, pk=str(meeting.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp['Content-Type'], 'text/calendar; charset=utf-8')
        content = resp.content.decode('utf-8')
        self.assertIn("BEGIN:VCALENDAR", content)
        self.assertIn("SUMMARY:Client Quarterly Demo", content)
        self.assertIn(f"meeting-{meeting.room_code}.ics", resp['Content-Disposition'])
