from typing import Optional, List, Dict, Any
from django.db.models import Q
from django.utils import timezone
from .models import Meeting, MeetingParticipant


class MeetingRepository:
    @staticmethod
    def get_by_id(meeting_id: str, org_id: Optional[str] = None) -> Optional[Meeting]:
        qs = Meeting.objects.all()
        if org_id:
            qs = qs.filter(org_id=org_id)
        return qs.filter(id=meeting_id).first()

    @staticmethod
    def get_by_room_code(room_code: str, org_id: Optional[str] = None) -> Optional[Meeting]:
        qs = Meeting.objects.all()
        if org_id:
            qs = qs.filter(org_id=org_id)
        return qs.filter(room_code=room_code).first()

    @staticmethod
    def list_for_user(user, org_id: Optional[str] = None, status_filter: Optional[str] = None):
        qs = Meeting.objects.all()
        target_org = org_id or getattr(user, 'org_id', None)
        if target_org:
            qs = qs.filter(org_id=target_org)

        # User is either the host or listed as participant, or admin/HR viewing org meetings
        if not (user.is_superuser or getattr(user, 'role', '') in ['admin', 'hr']):
            qs = qs.filter(
                Q(host=user) | Q(participants__email=user.email)
            ).distinct()

        if status_filter == 'upcoming':
            qs = qs.filter(status__in=['scheduled', 'live']).order_by('scheduled_start', 'created_at')
        elif status_filter == 'past':
            qs = qs.filter(status__in=['completed', 'cancelled']).order_by('-actual_end', '-updated_at')
        elif status_filter:
            qs = qs.filter(status=status_filter)

        return qs

    @staticmethod
    def create_meeting(data: Dict[str, Any], host_user, org_id: Optional[str] = None) -> Meeting:
        target_org = org_id or getattr(host_user, 'org_id', None) or host_user.org
        raw_agenda = data.get('agenda_items', [])
        formatted_agenda = []
        if isinstance(raw_agenda, list):
            for idx, item in enumerate(raw_agenda):
                if isinstance(item, str) and item.strip():
                    formatted_agenda.append({
                        'id': f"ag-{idx+1}",
                        'text': item.strip(),
                        'is_completed': False,
                        'completed_at': None
                    })
                elif isinstance(item, dict):
                    formatted_agenda.append(item)

        template_type = data.get('template_type', 'general')
        candidate_app_id = data.get('candidate_application_id')
        candidate_app = None
        if candidate_app_id:
            from hiring.models import Application
            candidate_app = Application.objects.filter(id=candidate_app_id).first()

        # Pre-seed template framework data if not provided
        framework_data = data.get('framework_data') or {}
        if not framework_data:
            if template_type == 'retro':
                framework_data = {
                    'type': 'retro',
                    'columns': {
                        'keep': [{'id': 'r-1', 'text': 'Strong team delivery velocity and clean code review', 'author': host_user.get_full_name() or 'Host', 'votes': 2}],
                        'stop': [{'id': 'r-2', 'text': 'Unplanned scope creeps mid-sprint', 'author': host_user.get_full_name() or 'Host', 'votes': 1}],
                        'start': [{'id': 'r-3', 'text': 'Pair-programming for complex modules', 'author': host_user.get_full_name() or 'Host', 'votes': 3}]
                    },
                    'action_items': []
                }
                if not formatted_agenda:
                    formatted_agenda = [
                        {'id': 'ag-1', 'text': 'Review Sprint KPIs & Velocity', 'is_completed': False, 'completed_at': None},
                        {'id': 'ag-2', 'text': 'Keep / Stop / Start Sticky Brainstorming', 'is_completed': False, 'completed_at': None},
                        {'id': 'ag-3', 'text': 'Vote and Prioritize Action Items', 'is_completed': False, 'completed_at': None}
                    ]
            elif template_type == '1on1':
                framework_data = {
                    'type': '1on1',
                    'wins': 'Recent achievements & positive milestones...',
                    'blockers': 'Current obstacles & dependencies...',
                    'growth': 'Quarterly career objectives...',
                    'private_notes': '',
                    'action_items': []
                }
                if not formatted_agenda:
                    formatted_agenda = [
                        {'id': 'ag-1', 'text': 'Personal Check-in & Well-being', 'is_completed': False, 'completed_at': None},
                        {'id': 'ag-2', 'text': 'Wins & Achievements this Period', 'is_completed': False, 'completed_at': None},
                        {'id': 'ag-3', 'text': 'Blockers & How I can help', 'is_completed': False, 'completed_at': None},
                        {'id': 'ag-4', 'text': 'Career Growth & Strategic Feedback', 'is_completed': False, 'completed_at': None}
                    ]
            elif template_type == 'standup':
                framework_data = {
                    'type': 'standup',
                    'timer_seconds': 60,
                    'current_speaker_idx': 0,
                    'speakers': []
                }
                if not formatted_agenda:
                    formatted_agenda = [
                        {'id': 'ag-1', 'text': 'Round-robin: What did you accomplish yesterday?', 'is_completed': False, 'completed_at': None},
                        {'id': 'ag-2', 'text': 'Round-robin: What are you working on today?', 'is_completed': False, 'completed_at': None},
                        {'id': 'ag-3', 'text': 'Review blockers & cross-team assistance', 'is_completed': False, 'completed_at': None}
                    ]
            elif template_type == 'interview':
                framework_data = {
                    'type': 'interview',
                    'evaluation_submitted': False
                }
                if not formatted_agenda:
                    formatted_agenda = [
                        {'id': 'ag-1', 'text': 'Welcome & Interviewer Introductions (5 min)', 'is_completed': False, 'completed_at': None},
                        {'id': 'ag-2', 'text': 'Candidate Background & Resume Deep-dive (10 min)', 'is_completed': False, 'completed_at': None},
                        {'id': 'ag-3', 'text': 'Technical Problem Solving / Live Code Sandbox (30 min)', 'is_completed': False, 'completed_at': None},
                        {'id': 'ag-4', 'text': 'Candidate Questions & Next Steps (10 min)', 'is_completed': False, 'completed_at': None}
                    ]

        default_code_sandbox = {
            'language': 'python',
            'code': '# Collaborative Code Sandbox\n# Real-time pair-programming & live code execution\n\ndef solution(nums, target):\n    lookup = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in lookup:\n            return [lookup[complement], i]\n        lookup[num] = i\n    return []\n\n# Test execution\nprint("Target [9] indices:", solution([2, 7, 11, 15], 9))\n',
            'output': 'Target [9] indices: [0, 1]\n',
            'updated_by': host_user.get_full_name() or host_user.email
        }

        meeting = Meeting.objects.create(
            title=data['title'],
            description=data.get('description', ''),
            host=host_user,
            org=host_user.org if hasattr(host_user, 'org') and host_user.org else None,
            org_id=target_org if isinstance(target_org, str) else getattr(target_org, 'id', None),
            status=data.get('status', 'scheduled'),
            scheduled_start=data.get('scheduled_start'),
            scheduled_end=data.get('scheduled_end'),
            is_instant=data.get('is_instant', False),
            passcode=data.get('passcode', ''),
            allowed_roles=data.get('allowed_roles', 'admin,hr,manager,employee'),
            is_locked=data.get('is_locked', False),
            waiting_room_enabled=data.get('waiting_room_enabled', False),
            template_type=template_type,
            candidate_application=candidate_app,
            code_sandbox=default_code_sandbox,
            whiteboard_data={'elements': [], 'version': 1},
            framework_data=framework_data,
            agenda_items=formatted_agenda
        )
        return meeting

    @staticmethod
    def add_participant(meeting: Meeting, email: str, name: str, user=None, role: str = 'attendee') -> MeetingParticipant:
        participant, created = MeetingParticipant.objects.get_or_create(
            meeting=meeting,
            email=email.strip().lower(),
            org=meeting.org,
            defaults={
                'name': name.strip() or email.split('@')[0],
                'user': user,
                'role': role,
                'invite_status': 'invited'
            }
        )
        if not created and user and not participant.user:
            participant.user = user
            participant.save(update_fields=['user'])
        return participant

    @staticmethod
    def append_transcript(meeting: Meeting, entries: List[Dict[str, Any]]) -> Meeting:
        current = list(meeting.transcript_raw or [])
        current.extend(entries)
        meeting.transcript_raw = current
        meeting.save(update_fields=['transcript_raw', 'updated_at'])
        return meeting

    @staticmethod
    def update_ai_notes(meeting: Meeting, summary: str, decisions: List[str], actions: List[Dict[str, Any]]) -> Meeting:
        meeting.ai_summary = summary
        meeting.key_decisions = decisions
        meeting.action_items = actions
        meeting.save(update_fields=['ai_summary', 'key_decisions', 'action_items', 'updated_at'])
        return meeting
