import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate
from accounts.models import User
from hiring.models import Candidate, JobPosting, Application, Scorecard, InterviewNote
from meetings.models import Meeting, MeetingParticipant
from meetings.views import (
    CandidateDossierView,
    CandidateScorecardSubmitView,
    MeetingCodeSandboxView,
    MeetingCodeRunView,
    MeetingWhiteboardView,
    MeetingFrameworkView,
    MeetingByRoomCodeView
)

def run_tests():
    print("=== Testing High-Value Meeting Features Suite ===")

    host = User.objects.filter(is_superuser=True, org_id__isnull=False).first()
    if not host:
        host = User.objects.filter(org_id__isnull=False).first()
    assert host is not None, "Host user required"
    org = host.org

    # Create dummy candidate & job posting
    job, _ = JobPosting.objects.get_or_create(
        org=org,
        title="Principal Distributed Systems Architect",
        defaults={
            'department': 'Engineering',
            'requirements': 'Python, Distributed Systems, Kafka, High Concurrency, Microservices',
            'status': 'open'
        }
    )

    candidate, _ = Candidate.objects.get_or_create(
        org=org,
        email="alex.dev@example.com",
        defaults={
            'first_name': 'Alex',
            'last_name': 'Vance',
            'parsed_skills': ['Python', 'Docker', 'Distributed Systems', 'PostgreSQL', 'Redis'],
            'parsed_experience': ['Staff Engineer at CloudCorp (4 yrs)', 'Senior Backend Dev (3 yrs)'],
            'parsed_education': ['B.S. in Computer Science, Stanford University']
        }
    )

    app, _ = Application.objects.get_or_create(
        candidate=candidate,
        job_posting=job,
        defaults={
            'org': org,
            'stage': 'interview',
            'match_score': 0.94,
            'matched_skills': ['Python', 'Distributed Systems'],
            'missing_skills': ['Kafka']
        }
    )

    # Create meeting with template_type="interview" linked to this application
    meeting = Meeting.objects.create(
        title="Technical Interview: Alex Vance",
        host=host,
        org=org,
        org_id=str(org.id),
        status="live",
        room_code="meet-arch-test-99",
        template_type="interview",
        candidate_application=app,
        code_sandbox={
            'language': 'python',
            'code': 'def solve(): return 42\nprint(solve())',
            'output': '42\n',
            'updated_by': host.get_full_name()
        },
        whiteboard_data={'elements': [{'type': 'rect', 'x': 50, 'y': 50, 'w': 100, 'h': 60}], 'version': 1},
        framework_data={'type': 'interview', 'evaluation_submitted': False}
    )

    MeetingParticipant.objects.create(
        meeting=meeting,
        org=org,
        user=host,
        email=host.email,
        name=host.get_full_name() or host.email,
        role="host",
        has_joined=True,
        is_admitted=True
    )

    rf = APIRequestFactory()

    # 1. Test Feature 1: Candidate Dossier
    print("\n1. Testing In-Meeting Candidate Dossier & Access Restrictions...")
    req = rf.get(f'/api/meetings/room/{meeting.room_code}/candidate-dossier/')
    force_authenticate(req, user=host)
    req.org_id = str(org.id)
    res = CandidateDossierView.as_view()(req, room_code=meeting.room_code)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    assert res.data['has_linked_candidate'] is True
    assert res.data['name'] == 'Alex Vance'
    assert len(res.data['standardized_questions']) >= 3
    print("   [PASS] Interviewer successfully loaded Candidate Dossier with standardized questions & match data.")

    # Test candidate privacy protection
    cand_user, _ = User.objects.get_or_create(
        email=candidate.email,
        defaults={'first_name': 'Alex', 'last_name': 'Vance', 'org': org}
    )
    req_cand = rf.get(f'/api/meetings/room/{meeting.room_code}/candidate-dossier/')
    force_authenticate(req_cand, user=cand_user)
    req_cand.org_id = str(org.id)
    res_cand = CandidateDossierView.as_view()(req_cand, room_code=meeting.room_code)
    assert res_cand.status_code == 403, f"Expected 403 forbidden for candidate, got {res_cand.status_code}"
    print("   [PASS] Candidate strictly blocked from viewing private dossier/scorecard.")

    # 2. Test Feature 1: Live Scorecard Submission
    print("\n2. Testing In-Meeting Live Scorecard Submission...")
    score_payload = {
        'scores': {
            'technical_depth': 5,
            'problem_solving': 4,
            'communication': 5,
            'culture_fit': 5,
            'overall': 5
        },
        'recommendation': 'strong_yes',
        'strengths': 'Exceptional understanding of cache invalidation and database partitioning.',
        'concerns': 'None observed.',
        'private_notes': 'Strong hire recommendation for Staff tier.',
        'advance_stage': 'offer'
    }
    req = rf.post(f'/api/meetings/room/{meeting.room_code}/candidate-scorecard/', score_payload, format='json')
    force_authenticate(req, user=host)
    req.org_id = str(org.id)
    res = CandidateScorecardSubmitView.as_view()(req, room_code=meeting.room_code)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    assert res.data['status'] == 'success'
    
    # Verify DB update in Hiring panel
    app.refresh_from_db()
    assert app.stage == 'offer', f"Expected stage offer, got {app.stage}"
    assert Scorecard.objects.filter(application=app).count() >= 1
    assert InterviewNote.objects.filter(application=app).count() >= 1
    print("   [PASS] Scorecard submitted directly from Meeting Room; candidate stage updated to 'offer' in Hiring Panel!")

    # 3. Test Feature 2: Code Sandbox Sync & Runner
    print("\n3. Testing Built-in Collaborative Code Sandbox & Runner...")
    req = rf.get(f'/api/meetings/room/{meeting.room_code}/code/')
    force_authenticate(req, user=host)
    req.org_id = str(org.id)
    res = MeetingCodeSandboxView.as_view()(req, room_code=meeting.room_code)
    assert res.status_code == 200
    assert 'language' in res.data

    # Test run code
    code_to_run = 'nums = [3, 2, 4]\nprint("Sum:", sum(nums))'
    req = rf.post(f'/api/meetings/room/{meeting.room_code}/code/run/', {'code': code_to_run, 'language': 'python'}, format='json')
    force_authenticate(req, user=host)
    req.org_id = str(org.id)
    res = MeetingCodeRunView.as_view()(req, room_code=meeting.room_code)
    assert res.status_code == 200
    assert 'Sum: 9' in res.data['output']
    print(f"   [PASS] Code Sandbox successfully executed Python snippet! Output: {res.data['output'].strip()}")

    # 4. Test Feature 3: Whiteboard Canvas Sync
    print("\n4. Testing Real-Time Collaborative Whiteboard Sync...")
    whiteboard_payload = {
        'elements': [
            {'id': 'e1', 'type': 'rect', 'x': 100, 'y': 150, 'w': 200, 'h': 120, 'label': 'API Gateway'},
            {'id': 'e2', 'type': 'arrow', 'from': 'e1', 'to': 'e3'},
            {'id': 'e3', 'type': 'rect', 'x': 400, 'y': 150, 'w': 200, 'h': 120, 'label': 'Auth Service'}
        ],
        'version': 2
    }
    req = rf.post(f'/api/meetings/room/{meeting.room_code}/whiteboard/', whiteboard_payload, format='json')
    force_authenticate(req, user=host)
    req.org_id = str(org.id)
    res = MeetingWhiteboardView.as_view()(req, room_code=meeting.room_code)
    assert res.status_code == 200
    assert len(res.data['elements']) == 3
    assert res.data['version'] == 2
    print("   [PASS] Whiteboard elements and diagrams persisted and synchronized successfully.")

    # 5. Test Feature 4: Structured Meeting Frameworks (Retro & 1-on-1)
    print("\n5. Testing Structured Meeting Frameworks (Retro & 1-on-1)...")
    # Change template to retro
    meeting.template_type = 'retro'
    meeting.framework_data = {
        'type': 'retro',
        'columns': {'keep': [], 'stop': [], 'start': []}
    }
    meeting.save()

    # Add card
    req = rf.post(f'/api/meetings/room/{meeting.room_code}/framework/', {
        'action': 'add_retro_card',
        'column': 'start',
        'text': 'Automate canary deployment rollouts'
    }, format='json')
    force_authenticate(req, user=host)
    req.org_id = str(org.id)
    res = MeetingFrameworkView.as_view()(req, room_code=meeting.room_code)
    assert res.status_code == 200
    assert len(res.data['framework_data']['columns']['start']) == 1
    card_id = res.data['framework_data']['columns']['start'][0]['id']

    # Vote on card
    req = rf.post(f'/api/meetings/room/{meeting.room_code}/framework/', {
        'action': 'vote_retro_card',
        'card_id': card_id
    }, format='json')
    force_authenticate(req, user=host)
    req.org_id = str(org.id)
    res = MeetingFrameworkView.as_view()(req, room_code=meeting.room_code)
    assert res.status_code == 200
    assert res.data['framework_data']['columns']['start'][0]['votes'] == 1
    print("   [PASS] Retro sticky card added and upvoted successfully.")

    # 6. Test Room Detail Serializer contains all 4 features
    print("\n6. Testing Meeting Detail Serializer Payload...")
    req = rf.get(f'/api/meetings/room/{meeting.room_code}/')
    force_authenticate(req, user=host)
    req.org_id = str(org.id)
    res = MeetingByRoomCodeView.as_view()(req, room_code=meeting.room_code)
    assert res.status_code == 200
    data = res.data
    assert 'template_type' in data
    assert 'candidate_summary' in data
    assert 'code_sandbox' in data
    assert 'whiteboard_data' in data
    assert 'framework_data' in data
    print("   [PASS] Complete meeting room response contains all 4 high-value feature configurations.")

    print("\n=== ALL 4 HIGH-VALUE FEATURE BACKEND TESTS PASSED 100%! ===\n")

if __name__ == '__main__':
    run_tests()
