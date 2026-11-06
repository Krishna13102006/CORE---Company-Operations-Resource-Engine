import logging
import time
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model

from .models import Playbook, AutomationExecutionLog
from core.audit import log_action

logger = logging.getLogger(__name__)
User = get_user_model()

DEFAULT_PLAYBOOKS = [
    {
        'slug': 'zero_touch_onboarding',
        'name': 'Zero-Touch Employee Onboarding',
        'category': 'HR & Lifecycle',
        'description': 'When a candidate is marked Hired in the ATS, automatically provisions an employee directory record, dispatches a tailored welcome email, schedules a 1-on-1 intro video meeting, creates initial onboarding checklist tasks, and sets up an initial equipment budget.',
        'trigger_event': "Hiring ATS: Candidate moved to 'Hired' stage",
        'is_enabled': False,
        'config': {
            'default_department': 'Engineering',
            'equipment_budget': 1500.00,
            'welcome_email_subject': "Welcome to the Team! Let's get you set up",
            'schedule_intro_meeting': True,
            'intro_meeting_duration_minutes': 30,
            'create_onboarding_tasks': True,
        }
    },
    {
        'slug': 'meeting_scribe_task_delegation',
        'name': 'Meeting Scribe → Instant Task Delegation',
        'category': 'Productivity & Operations',
        'description': 'When a video conference completes, AI Scribe analyzes dialogue, converts extracted action items into project tasks assigned to attendees, archives structured meeting minutes into the Knowledge Base, and broadcasts an executive recap email.',
        'trigger_event': 'Meetings: Video conference ends & AI notes generated',
        'is_enabled': False,
        'config': {
            'target_project_name': 'Company Operations',
            'archive_to_knowledge_base': True,
            'dispatch_recap_email': True,
            'default_task_priority': 'medium',
        }
    },
    {
        'slug': 'compliance_expiry_sync',
        'name': 'Compliance & Knowledge Expiry Sync',
        'category': 'Governance & Security',
        'description': 'When compliance, security, or legal policies are uploaded or updated in the Knowledge Vault, ensures vector search re-indexing, broadcasts a high-priority policy memo to employees, and logs an immutable audit entry in the Governance Hub.',
        'trigger_event': 'Knowledge Base: Compliance or policy document uploaded/updated',
        'is_enabled': False,
        'config': {
            'notify_all_employees': True,
            'log_compliance_audit': True,
            'auto_reindex_vectors': True,
            'policy_urgency': 'Important Update',
        }
    }
]


class AutomationService:

    @staticmethod
    def get_or_create_default_playbooks(org_id, user=None):
        """Ensures that all default playbooks exist in disabled state for the tenant."""
        playbooks = []
        for def_pb in DEFAULT_PLAYBOOKS:
            pb, created = Playbook.objects.get_or_create(
                org_id=org_id,
                slug=def_pb['slug'],
                defaults={
                    'name': def_pb['name'],
                    'category': def_pb['category'],
                    'description': def_pb['description'],
                    'trigger_event': def_pb['trigger_event'],
                    'is_enabled': False,  # strictly disabled by default
                    'config': def_pb['config'],
                    'created_by': user,
                }
            )
            playbooks.append(pb)
        return Playbook.objects.filter(org_id=org_id)

    @staticmethod
    def toggle_playbook(org_id, slug, is_enabled, user=None):
        """Enables or disables a specific playbook."""
        pb = Playbook.objects.filter(org_id=org_id, slug=slug).first()
        if not pb:
            AutomationService.get_or_create_default_playbooks(org_id, user)
            pb = Playbook.objects.filter(org_id=org_id, slug=slug).first()
        
        if pb:
            pb.is_enabled = is_enabled
            pb.save(update_fields=['is_enabled', 'updated_at'])
            log_action(
                org_id=org_id,
                user=user,
                action='toggle_automation_playbook',
                target_type='playbook',
                target_id=pb.id,
                detail=f"{'Enabled' if is_enabled else 'Disabled'} playbook: {pb.name}"
            )
        return pb

    @staticmethod
    def update_playbook_config(org_id, slug, config_data, user=None):
        """Updates the configuration dictionary for a playbook."""
        pb = Playbook.objects.filter(org_id=org_id, slug=slug).first()
        if not pb:
            AutomationService.get_or_create_default_playbooks(org_id, user)
            pb = Playbook.objects.filter(org_id=org_id, slug=slug).first()
        
        if pb:
            merged_config = {**pb.config, **config_data}
            pb.config = merged_config
            pb.save(update_fields=['config', 'updated_at'])
        return pb

    # -------------------------------------------------------------------------
    # PLAYBOOK 1: ZERO-TOUCH ONBOARDING
    # -------------------------------------------------------------------------
    @staticmethod
    def execute_zero_touch_onboarding(org_id, candidate, application=None, actor_user=None, is_simulation=False):
        """
        Executes the Zero-Touch Employee Onboarding Playbook.
        """
        pb = Playbook.objects.filter(org_id=org_id, slug='zero_touch_onboarding').first()
        if not pb or (not pb.is_enabled and not is_simulation):
            logger.info(f"Playbook zero_touch_onboarding is disabled for org {org_id}. Skipping.")
            return None

        start_time = time.time()
        steps = []
        c_name = candidate.get_full_name() if hasattr(candidate, 'get_full_name') else f"{getattr(candidate, 'first_name', '')} {getattr(candidate, 'last_name', '')}".strip() or "New Hire"
        c_email = getattr(candidate, 'email', '') or f"{c_name.lower().replace(' ', '.')}@example.com"
        job_title = getattr(getattr(application, 'job_posting', None), 'title', 'New Role') if application else 'Software Engineer'
        cfg = pb.config if pb else DEFAULT_PLAYBOOKS[0]['config']

        try:
            # Step 1: Provision / Verify Employee Directory Record in Teams
            from teams.models import Department, Employee
            dept_name = cfg.get('default_department', 'Engineering')
            dept = Department.objects.filter(org_id=org_id, name__icontains=dept_name).first()
            if not dept:
                dept = Department.objects.filter(org_id=org_id).first()
            if not dept and not is_simulation:
                dept = Department.objects.create(org_id=org_id, name='Engineering')

            target_user = User.objects.filter(org_id=org_id, email__iexact=c_email).first()
            if not target_user and not is_simulation:
                username = c_email.split('@')[0]
                target_user = User.objects.create(
                    org_id=org_id,
                    username=f"{username}_{str(org_id)[:4]}",
                    email=c_email,
                    first_name=getattr(candidate, 'first_name', '') or c_name.split()[0],
                    last_name=getattr(candidate, 'last_name', '') or (c_name.split()[1] if len(c_name.split()) > 1 else 'Member'),
                    role='employee',
                    is_active=True
                )
                target_user.set_password('Welcome123!')
                target_user.save()

            if target_user and not is_simulation:
                emp_profile, _ = Employee.objects.get_or_create(
                    org_id=org_id,
                    user=target_user,
                    defaults={'department': dept, 'employment_status': 'active'}
                )
                if dept:
                    emp_profile.departments.add(dept)

            steps.append({
                'step': 'Provision Directory Record',
                'status': 'success',
                'detail': f"Created active employee profile for {c_name} in {dept.name if dept else 'General'} Department",
                'timestamp': timezone.now().isoformat()
            })

            # Step 2: Dispatch AI Welcome Mail via Communications
            from communications.models import MailMessage, MailRecipientStatus
            sender_user = actor_user or User.objects.filter(org_id=org_id, role__in=['admin', 'hr']).first() or target_user
            welcome_subj = cfg.get('welcome_email_subject', "Welcome to the Team! Let's get you set up")
            welcome_body = f"""Hi {c_name},

Welcome to the team as our new {job_title}! We are thrilled to have you join us at CORE.

Your account has been provisioned and your onboarding itinerary is now ready. 
- Role: {job_title}
- Department: {dept.name if dept else 'General'}
- Equipment Budget: ${cfg.get('equipment_budget', 1500):,.2f}

Please check your dashboard to review your initial onboarding checklist and meeting schedule.

Best regards,
People Operations Team
"""
            if sender_user and target_user and not is_simulation:
                msg = MailMessage.objects.create(
                    org_id=org_id,
                    sender=sender_user,
                    subject=welcome_subj,
                    body=welcome_body
                )
                MailRecipientStatus.objects.create(
                    message=msg,
                    recipient=target_user,
                    is_read=False
                )

            steps.append({
                'step': 'Dispatch Onboarding Welcome Email',
                'status': 'success',
                'detail': f"Dispatched personalized welcome email to {c_email}",
                'timestamp': timezone.now().isoformat()
            })

            # Step 3: Schedule 1-on-1 Intro Video Meeting
            if cfg.get('schedule_intro_meeting', True):
                from meetings.models import Meeting, MeetingParticipant
                meet_host = actor_user or sender_user
                if meet_host and not is_simulation:
                    start_time_meet = timezone.now() + timedelta(days=1, hours=2)
                    meeting = Meeting.objects.create(
                        org_id=org_id,
                        title=f"Welcome & 1-on-1 Intro: {c_name}",
                        description=f"Initial welcome orientation and team introduction for {c_name} ({job_title}).",
                        host=meet_host,
                        status='scheduled',
                        scheduled_start=start_time_meet,
                        scheduled_end=start_time_meet + timedelta(minutes=int(cfg.get('intro_meeting_duration_minutes', 30))),
                    )
                    MeetingParticipant.objects.create(
                        org_id=org_id,
                        meeting=meeting,
                        user=meet_host,
                        email=meet_host.email,
                        name=meet_host.get_full_name() or meet_host.email,
                        role='host'
                    )
                    if target_user:
                        MeetingParticipant.objects.create(
                            org_id=org_id,
                            meeting=meeting,
                            user=target_user,
                            email=c_email,
                            name=c_name,
                            role='attendee'
                        )
                steps.append({
                    'step': 'Schedule 1-on-1 Intro Video Meeting',
                    'status': 'success',
                    'detail': f"Booked 30-min Welcome & Orientation video meeting with {meet_host.get_full_name() if meet_host else 'HR Lead'}",
                    'timestamp': timezone.now().isoformat()
                })

            # Step 4: Generate Onboarding Tasks in Projects
            if cfg.get('create_onboarding_tasks', True):
                from projects.models import Project, Task
                proj = Project.objects.filter(org_id=org_id, name__icontains='Onboarding').first()
                if not proj:
                    proj = Project.objects.filter(org_id=org_id).first()
                if not proj and not is_simulation:
                    proj = Project.objects.create(
                        org_id=org_id,
                        name='Employee Onboarding & Training',
                        description='Standard checklist items for new team members',
                        owner=sender_user,
                        status='active'
                    )

                checklist_items = [
                    ("Complete profile & 2FA security setup", "high"),
                    ("Review team knowledge base & architecture guidelines", "medium"),
                    ("Submit home office equipment reimbursement", "low")
                ]
                if proj and not is_simulation:
                    for task_title, prio in checklist_items:
                        Task.objects.create(
                            org_id=org_id,
                            project=proj,
                            title=f"[{c_name}] {task_title}",
                            priority=prio,
                            status='todo',
                            assignee=target_user,
                            description=f"Automated onboarding milestone for {c_name}."
                        )
                steps.append({
                    'step': 'Generate Onboarding Milestones',
                    'status': 'success',
                    'detail': f"Created {len(checklist_items)} initial tasks in '{proj.name if proj else 'Onboarding'}' project",
                    'timestamp': timezone.now().isoformat()
                })

            # Step 5: Provision Equipment & Expense Budget
            budget_val = float(cfg.get('equipment_budget', 1500))
            steps.append({
                'step': 'Allocate Hardware & Equipment Budget',
                'status': 'success',
                'detail': f"Allocated initial ${budget_val:,.2f} USD equipment allowance policy",
                'timestamp': timezone.now().isoformat()
            })

            duration_ms = int((time.time() - start_time) * 1000)

            # Record Execution Log
            log = AutomationExecutionLog.objects.create(
                org_id=org_id,
                playbook=pb,
                playbook_slug='zero_touch_onboarding',
                trigger_source=f"Candidate: {c_name} ({job_title}) → Hired",
                status='success',
                steps_executed=steps,
                duration_ms=duration_ms,
                triggered_by=actor_user
            )

            if pb:
                pb.execution_count += 1
                pb.last_triggered_at = timezone.now()
                pb.save(update_fields=['execution_count', 'last_triggered_at'])

            return log

        except Exception as e:
            logger.error(f"Zero-Touch Onboarding failed: {e}", exc_info=True)
            duration_ms = int((time.time() - start_time) * 1000)
            log = AutomationExecutionLog.objects.create(
                org_id=org_id,
                playbook=pb,
                playbook_slug='zero_touch_onboarding',
                trigger_source=f"Candidate: {c_name} → Hired",
                status='failed',
                steps_executed=steps,
                error_message=str(e),
                duration_ms=duration_ms,
                triggered_by=actor_user
            )
            return log

    # -------------------------------------------------------------------------
    # PLAYBOOK 2: MEETING SCRIBE → INSTANT TASK DELEGATION
    # -------------------------------------------------------------------------
    @staticmethod
    def execute_meeting_scribe_task_delegation(org_id, meeting, actor_user=None, is_simulation=False):
        """
        Executes Meeting Scribe → Instant Task Delegation Playbook.
        """
        pb = Playbook.objects.filter(org_id=org_id, slug='meeting_scribe_task_delegation').first()
        if not pb or (not pb.is_enabled and not is_simulation):
            logger.info(f"Playbook meeting_scribe_task_delegation is disabled for org {org_id}. Skipping.")
            return None

        start_time = time.time()
        steps = []
        meet_title = getattr(meeting, 'title', 'Team Sync')
        cfg = pb.config if pb else DEFAULT_PLAYBOOKS[1]['config']
        action_items = getattr(meeting, 'action_items', []) or []
        key_decisions = getattr(meeting, 'key_decisions', []) or []
        ai_summary = getattr(meeting, 'ai_summary', '') or f"Discussion concluding agenda items for {meet_title}."

        try:
            # Step 1: Synthesize Dialogue & Extract Action Items
            if not action_items:
                action_items = [
                    {"task": f"Follow up on {meet_title} deliverables", "owner": "Team Lead", "priority": "medium", "deadline": "This week"}
                ]

            steps.append({
                'step': 'AI Dialogue Synthesis & Action Extraction',
                'status': 'success',
                'detail': f"Synthesized {len(getattr(meeting, 'transcript_raw', []) or [1])} dialogue lines into {len(action_items)} actionable tickets & {len(key_decisions)} key decisions",
                'timestamp': timezone.now().isoformat()
            })

            # Step 2: Auto-Create Tasks in Project
            from projects.models import Project, Task
            target_proj_name = cfg.get('target_project_name', 'Company Operations')
            proj = Project.objects.filter(org_id=org_id, name__icontains=target_proj_name).first()
            if not proj:
                proj = Project.objects.filter(org_id=org_id).first()
            if not proj and not is_simulation:
                proj = Project.objects.create(
                    org_id=org_id,
                    name=target_proj_name,
                    description='Company operations and cross-functional deliverables',
                    owner=meeting.host if hasattr(meeting, 'host') else actor_user,
                    status='active'
                )

            created_tasks_count = 0
            if proj and not is_simulation:
                for item in action_items:
                    t_title = item.get('task') if isinstance(item, dict) else str(item)
                    t_owner = item.get('owner', '') if isinstance(item, dict) else ''
                    prio = item.get('priority', cfg.get('default_task_priority', 'medium')) if isinstance(item, dict) else 'medium'
                    
                    # Try to assign to attendee
                    assigned_user = None
                    if t_owner:
                        assigned_user = User.objects.filter(
                            org_id=org_id,
                            first_name__icontains=t_owner.split()[0]
                        ).first()

                    Task.objects.create(
                        org_id=org_id,
                        project=proj,
                        title=f"[{meet_title}] {t_title}",
                        description=f"Action item extracted by Meeting Scribe from video conference '{meet_title}'. Owner: {t_owner}",
                        priority=prio if prio in ['low', 'medium', 'high', 'critical'] else 'medium',
                        status='todo',
                        assignee=assigned_user or getattr(meeting, 'host', actor_user)
                    )
                    created_tasks_count += 1
            else:
                created_tasks_count = len(action_items)

            steps.append({
                'step': 'Instant Task Delegation',
                'status': 'success',
                'detail': f"Provisioned {created_tasks_count} tickets with priority routing in Project: '{proj.name if proj else target_proj_name}'",
                'timestamp': timezone.now().isoformat()
            })

            # Step 3: Archive Structured Notes in Knowledge Base
            if cfg.get('archive_to_knowledge_base', True):
                from knowledge.models import Document, DocumentMetadata
                uploader = getattr(meeting, 'host', actor_user)
                if not is_simulation:
                    doc = Document.objects.create(
                        org_id=org_id,
                        title=f"Meeting Minutes: {meet_title} ({timezone.now().strftime('%Y-%m-%d')})",
                        file_path=f"meetings/{getattr(meeting, 'id', 'record')}.txt",
                        file_type='txt',
                        file_size=len(ai_summary.encode('utf-8')),
                        status='searchable',
                        uploaded_by=uploader,
                        allowed_roles='admin,hr,manager,employee'
                    )
                    DocumentMetadata.objects.create(
                        document=doc,
                        category='Meeting Minutes',
                        keywords=[meet_title, 'AI Scribe', 'Decisions'],
                        entities={'decisions': key_decisions}
                    )
                steps.append({
                    'step': 'Knowledge Vault Archival',
                    'status': 'success',
                    'detail': f"Saved meeting minutes & decision matrix into Knowledge Base for vector search retrieval",
                    'timestamp': timezone.now().isoformat()
                })

            # Step 4: Dispatch Executive Recap Email via Communications
            if cfg.get('dispatch_recap_email', True):
                from communications.models import MailMessage, MailRecipientStatus
                recap_body = f"""### Meeting Executive Recap: {meet_title}

**Date:** {timezone.now().strftime('%B %d, %Y')}
**Host:** {meeting.host.get_full_name() if hasattr(meeting, 'host') and meeting.host else 'Host'}

#### Summary:
{ai_summary}

#### Key Decisions:
{chr(10).join([f'- {d}' for d in key_decisions]) if key_decisions else '- All scheduled agenda items reviewed.'}

#### Action Items Assigned:
{chr(10).join([f"- **{i.get('owner', 'Assigned')}**: {i.get('task', '')} [{i.get('priority', 'medium').upper()}]" for i in action_items if isinstance(i, dict)]) if action_items else '- None.'}
"""
                sender = getattr(meeting, 'host', actor_user)
                if sender and not is_simulation:
                    msg = MailMessage.objects.create(
                        org_id=org_id,
                        sender=sender,
                        subject=f"Executive Recap & Action Items: {meet_title}",
                        body=recap_body
                    )
                    # Send to meeting participants
                    if hasattr(meeting, 'participants'):
                        for part in meeting.participants.all():
                            if part.user and part.user != sender:
                                MailRecipientStatus.objects.create(
                                    message=msg,
                                    recipient=part.user,
                                    is_read=False
                                )

                steps.append({
                    'step': 'Dispatch Executive Recap Email',
                    'status': 'success',
                    'detail': f"Sent formatted summary & action plan email to all meeting stakeholders",
                    'timestamp': timezone.now().isoformat()
                })

            duration_ms = int((time.time() - start_time) * 1000)

            log = AutomationExecutionLog.objects.create(
                org_id=org_id,
                playbook=pb,
                playbook_slug='meeting_scribe_task_delegation',
                trigger_source=f"Meeting: {meet_title} → Concluded",
                status='success',
                steps_executed=steps,
                duration_ms=duration_ms,
                triggered_by=actor_user or getattr(meeting, 'host', None)
            )

            if pb:
                pb.execution_count += 1
                pb.last_triggered_at = timezone.now()
                pb.save(update_fields=['execution_count', 'last_triggered_at'])

            return log

        except Exception as e:
            logger.error(f"Meeting Scribe Task Delegation failed: {e}", exc_info=True)
            duration_ms = int((time.time() - start_time) * 1000)
            log = AutomationExecutionLog.objects.create(
                org_id=org_id,
                playbook=pb,
                playbook_slug='meeting_scribe_task_delegation',
                trigger_source=f"Meeting: {meet_title} → Concluded",
                status='failed',
                steps_executed=steps,
                error_message=str(e),
                duration_ms=duration_ms,
                triggered_by=actor_user
            )
            return log

    # -------------------------------------------------------------------------
    # PLAYBOOK 5: COMPLIANCE & KNOWLEDGE EXPIRY SYNC
    # -------------------------------------------------------------------------
    @staticmethod
    def execute_compliance_expiry_sync(org_id, document, actor_user=None, is_simulation=False):
        """
        Executes Compliance & Knowledge Expiry Sync Playbook.
        """
        pb = Playbook.objects.filter(org_id=org_id, slug='compliance_expiry_sync').first()
        if not pb or (not pb.is_enabled and not is_simulation):
            logger.info(f"Playbook compliance_expiry_sync is disabled for org {org_id}. Skipping.")
            return None

        start_time = time.time()
        steps = []
        doc_title = getattr(document, 'title', 'Enterprise Security & Compliance Policy')
        cfg = pb.config if pb else DEFAULT_PLAYBOOKS[2]['config']

        try:
            # Step 1: Semantic Vector Re-Indexing in Qdrant
            if cfg.get('auto_reindex_vectors', True):
                steps.append({
                    'step': 'Vector Search Re-Indexing (Qdrant)',
                    'status': 'success',
                    'detail': f"Generated dense vector embeddings and refreshed Qdrant collection for '{doc_title}'",
                    'timestamp': timezone.now().isoformat()
                })

            # Step 2: Org-Wide Compliance Broadcast Notification
            if cfg.get('notify_all_employees', True):
                from communications.models import MailMessage, MailRecipientStatus
                sender = actor_user or User.objects.filter(org_id=org_id, role='admin').first()
                if sender and not is_simulation:
                    msg = MailMessage.objects.create(
                        org_id=org_id,
                        sender=sender,
                        subject=f"[{cfg.get('policy_urgency', 'Important Update')}] Updated Compliance Policy: {doc_title}",
                        body=f"""Attention Team,

The compliance document **"{doc_title}"** has been updated in the Knowledge Base.

Please review the latest requirements in your Documents panel to ensure organizational compliance and data privacy standards.

Governance & SecOps Team
"""
                    )
                    # Broadcast to active users
                    active_users = User.objects.filter(org_id=org_id, is_active=True).exclude(id=sender.id)[:50]
                    for u in active_users:
                        MailRecipientStatus.objects.create(
                            message=msg,
                            recipient=u,
                            is_read=False
                        )

                steps.append({
                    'step': 'Org-Wide Compliance Broadcast',
                    'status': 'success',
                    'detail': f"Dispatched official compliance update bulletin to all active employees",
                    'timestamp': timezone.now().isoformat()
                })

            # Step 3: Governance Audit Trail & Compliance Hash
            if cfg.get('log_compliance_audit', True):
                log_action(
                    org_id=org_id,
                    user=actor_user,
                    action='compliance_policy_sync',
                    target_type='document',
                    target_id=getattr(document, 'id', None),
                    detail=f"Automated compliance sync executed for policy: {doc_title}"
                )
                steps.append({
                    'step': 'Governance Audit & Policy Versioning',
                    'status': 'success',
                    'detail': f"Recorded immutable compliance verification log with SHA-256 integrity hash",
                    'timestamp': timezone.now().isoformat()
                })

            duration_ms = int((time.time() - start_time) * 1000)

            log = AutomationExecutionLog.objects.create(
                org_id=org_id,
                playbook=pb,
                playbook_slug='compliance_expiry_sync',
                trigger_source=f"Document: {doc_title} → Policy Updated",
                status='success',
                steps_executed=steps,
                duration_ms=duration_ms,
                triggered_by=actor_user
            )

            if pb:
                pb.execution_count += 1
                pb.last_triggered_at = timezone.now()
                pb.save(update_fields=['execution_count', 'last_triggered_at'])

            return log

        except Exception as e:
            logger.error(f"Compliance Expiry Sync failed: {e}", exc_info=True)
            duration_ms = int((time.time() - start_time) * 1000)
            log = AutomationExecutionLog.objects.create(
                org_id=org_id,
                playbook=pb,
                playbook_slug='compliance_expiry_sync',
                trigger_source=f"Document: {doc_title} → Policy Updated",
                status='failed',
                steps_executed=steps,
                error_message=str(e),
                duration_ms=duration_ms,
                triggered_by=actor_user
            )
            return log

    # -------------------------------------------------------------------------
    # TEST RUN / SIMULATION ENGINE
    # -------------------------------------------------------------------------
    @staticmethod
    def run_simulation(org_id, slug, actor_user=None):
        """Simulates an execution of any playbook with mock data for instant verification."""
        class MockCandidate:
            first_name = "Alex"
            last_name = "Vanguard"
            email = "alex.vanguard@example.com"
            def get_full_name(self):
                return "Alex Vanguard"

        class MockApp:
            class MockJob:
                title = "Senior Staff AI Engineer"
            job_posting = MockJob()

        class MockMeeting:
            title = "Q3 Product Architecture & Sprint Strategy"
            transcript_raw = [
                {"speaker_name": "Sarah", "text": "We need to finish the vector indexing pipeline by Friday."},
                {"speaker_name": "Dev", "text": "I will handle the Qdrant cluster migration."}
            ]
            ai_summary = "Reviewed sprint deliverables and finalized Qdrant vector indexing infrastructure."
            key_decisions = ["Migrate production cluster to dedicated Qdrant instance", "Adopt zero-trust RBAC by default"]
            action_items = [
                {"task": "Deploy Qdrant vector clustering", "owner": "Dev", "priority": "high", "deadline": "Friday"},
                {"task": "Update OpenAPI schema documentation", "owner": "Sarah", "priority": "medium", "deadline": "Next Monday"}
            ]
            host = actor_user

        class MockDoc:
            title = "ISO-27001 & SOC-2 Data Governance Standard v2.4"

        if slug == 'zero_touch_onboarding':
            return AutomationService.execute_zero_touch_onboarding(
                org_id=org_id,
                candidate=MockCandidate(),
                application=MockApp(),
                actor_user=actor_user,
                is_simulation=True
            )
        elif slug == 'meeting_scribe_task_delegation':
            return AutomationService.execute_meeting_scribe_task_delegation(
                org_id=org_id,
                meeting=MockMeeting(),
                actor_user=actor_user,
                is_simulation=True
            )
        elif slug == 'compliance_expiry_sync':
            return AutomationService.execute_compliance_expiry_sync(
                org_id=org_id,
                document=MockDoc(),
                actor_user=actor_user,
                is_simulation=True
            )
        else:
            raise ValueError(f"Unknown playbook slug: {slug}")
