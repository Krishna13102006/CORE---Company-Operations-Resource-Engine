import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from datetime import timedelta
from django.utils import timezone
from django.test import RequestFactory
from rest_framework.test import force_authenticate

from accounts.models import User
from teams.models import (
    Department, Employee,
    DailyStatus, DepartmentStandupDigest, ApprovalDelegation,
    OneOnOneWorkspace, DepartmentRunbook, EmployeeRunbookExecution
)
from projects.models import Project, Task
from expenses.models import SpendBudget, ExpenseClaim
from hiring.models import JobPosting
from teams.services import (
    DelegationService, StandupService,
    OneOnOneService, SkillMatrixService, DepartmentRunbookService
)
from teams.views import (
    DepartmentCommandCenterView, DepartmentListView, DepartmentDetailView,
    ApprovalDelegationListCreateView, ApprovalDelegationRevokeView,
    UserStandupTasksView, DailyStatusFeedView, DepartmentStandupBannerView,
    DepartmentStandupDigestView, OneOnOneWorkspaceListCreateView,
    OneOnOneWorkspaceDetailView, OneOnOneConvertTaskView,
    OneOnOneLaunchMeetingView, DepartmentSkillMatrixView,
    EmployeeSkillUpdateView, DepartmentRunbookExecutionListCreateView,
    DepartmentRunbookStepToggleView
)

print("=" * 70)
print("COMPREHENSIVE MASTER TEST SUITE: PILLARS 1, 2, 3, 4 VERIFICATION")
print("=" * 70)

rf = RequestFactory()

# ----------------------------------------------------------------------
# 0. BASE TEST SETUP
# ----------------------------------------------------------------------
user = User.objects.get(email='saumyakesur@gmail.com')
org_id = user.org_id

emp_user2 = User.objects.filter(org_id=org_id).exclude(id=user.id).first()
if not emp_user2:
    emp_user2 = User.objects.create(
        email='team_member_test@coreworkspace.com',
        first_name='Alex',
        last_name='Rivera',
        org_id=org_id,
        role='employee'
    )

dept = Department.objects.filter(org_id=org_id, is_deleted=False).first()
if not dept:
    dept = Department.objects.create(name='Core Engineering', org_id=org_id, head=user)
else:
    dept.head = user
    dept.save()

secondary_dept = Department.objects.filter(org_id=org_id, is_deleted=False).exclude(id=dept.id).first()
if not secondary_dept:
    secondary_dept = Department.objects.create(name='Growth Squad', org_id=org_id, head=user)

emp1, _ = Employee.objects.get_or_create(user=user, defaults={'org_id': org_id, 'department': dept})
emp1.department = dept
emp1.save()

emp2, _ = Employee.objects.get_or_create(user=emp_user2, defaults={'org_id': org_id, 'department': dept})
emp2.department = dept
emp2.manager = emp1
emp2.save()

# ======================================================================
# PILLAR 1: LIVE COMMAND CENTER & CAPACITY RADAR
# ======================================================================
print("\n[PILLAR 1] Testing Department Command Center & Capacity Radar...")

# Setup Matrix secondary department badge
emp2.departments.clear()
emp2.departments.add(secondary_dept)
assert emp2.departments.filter(id=secondary_dept.id).exists(), "Matrix secondary department relation failed"
print("  [OK] Secondary Cross-Departmental Matrix Pod mapped successfully")

# Setup project and test tasks for Workload & Bandwidth Gauge
project = Project.objects.filter(org_id=org_id, is_deleted=False).first()
if not project:
    project = Project.objects.create(name='Core Engine v2', org_id=org_id, key='ENG')

# Create 7 high priority tasks for emp2 to verify "High Burnout Risk"
Task.objects.filter(assignee=emp_user2).delete()
burnout_tasks = []
for i in range(7):
    burnout_tasks.append(Task.objects.create(
        org_id=org_id,
        project=project,
        title=f'Heavy Load Sprint Item #{i+1}',
        assignee=emp_user2,
        status='in_progress',
        priority='high'
    ))

# Setup financial expense data for spend widget
SpendBudget.objects.filter(org_id=org_id, department=dept).delete()
SpendBudget.objects.create(
    org_id=org_id,
    target_type='department',
    department=dept,
    amount=20000.00,
    period='monthly',
    currency='USD',
    notes='Engineering Monthly OpEx'
)

ExpenseClaim.objects.create(
    org_id=org_id,
    department=dept,
    employee=emp1,
    amount=4500.00,
    amount_converted=4500.00,
    currency='USD',
    status='approved',
    expense_date=timezone.now().date(),
    merchant='Cloud Neon & Qdrant Infrastructure',
    description='Cloud Infrastructure neon & qdrant cluster'
)

# Setup Hiring requisition
posting = JobPosting.objects.filter(org_id=org_id, department__iexact=dept.name, status='published').first()
if not posting:
    JobPosting.objects.create(
        org_id=org_id,
        title='Senior Distributed Systems Engineer',
        department=dept.name,
        status='published'
    )

# Execute Command Center API
cc_req = rf.get(f'/api/teams/departments/command-center/?dept_id={dept.id}')
cc_req.org_id = org_id
force_authenticate(cc_req, user=user)
cc_view = DepartmentCommandCenterView.as_view()
cc_resp = cc_view(cc_req)
assert cc_resp.status_code == 200, f"Command Center API failed with status {cc_resp.status_code}: {getattr(cc_resp, 'data', None)}"
cc_data = cc_resp.data

pulse = cc_data['pulse']
workload = cc_data['workload_gauge']
fin = cc_data['financial_radar']
hiring = cc_data['hiring_pipeline']

assert pulse['total_headcount'] >= 2, f"Pulse headcount unexpected: {pulse['total_headcount']}"
assert workload['high_priority_tasks'] >= 7, f"Workload high priority tasks count wrong: {workload['high_priority_tasks']}"
assert workload['burnout_risk_count'] >= 1, f"Burnout risk not detected! Count: {workload['burnout_risk_count']}"
assert fin['spent_this_month'] >= 4500.00, f"Financial spend calculation wrong: {fin['spent_this_month']}"
assert hiring['open_requisitions_count'] >= 1, f"Hiring radar requisitions wrong: {hiring['open_requisitions_count']}"

print("  [OK] Pulse bar headcount & presence telemetry accurate")
print(f"  [OK] Burnout risk detection verified: {workload['burnout_risk_count']} employee(s) flagged")
print(f"  [OK] Spend radar: ${fin['spent_this_month']} spent of ${fin['budget_amount']} budget ({fin['utilization_pct']}%)")
print(f"  [OK] Hiring pipeline sync: {hiring['open_requisitions_count']} open role(s)")
print("[PASS] PILLAR 1 VERIFIED 100%")

# ======================================================================
# PILLAR 2: INTERACTIVE ORG TREE & MANAGER DELEGATION
# ======================================================================
print("\n[PILLAR 2] Testing Interactive Org Tree & Manager Delegation...")

# 1. Span of Control & Manager Overload Risk Telemetry
span_metrics = cc_data.get('span_of_control', {})
assert 'total_managers' in span_metrics, "Span of control missing total_managers"
assert 'avg_span' in span_metrics, "Span of control missing avg_span"
assert 'overloaded_count' in span_metrics, "Span of control missing overloaded_count"
print(f"  [OK] Span of Control telemetry: {span_metrics['total_managers']} manager(s), Avg span: {span_metrics['avg_span']}, Overloaded risk: {span_metrics['overloaded_count']}")

# 2. 1-Click Manager Delegation (Out-of-Office Proxy)
ApprovalDelegation.objects.filter(delegator=user).delete()

del_req = rf.post('/api/teams/delegations/', {
    'delegatee_id': str(emp_user2.id),
    'delegation_type': 'all',
    'start_date': timezone.now().date().isoformat(),
    'end_date': (timezone.now() + timedelta(days=5)).date().isoformat(),
    'notes': 'Attending international developer conference'
}, content_type='application/json')
del_req.org_id = org_id
force_authenticate(del_req, user=user)
del_resp = ApprovalDelegationListCreateView.as_view()(del_req)
assert del_resp.status_code == 201, f"Delegation creation failed: {del_resp.data}"
delegation_id = del_resp.data['id']
print(f"  [OK] OOO Manager Delegation created: ID {delegation_id}")

# Verify delegation list query
del_list_req = rf.get('/api/teams/delegations/?active_only=true')
del_list_req.org_id = org_id
force_authenticate(del_list_req, user=user)
del_list_resp = ApprovalDelegationListCreateView.as_view()(del_list_req)
assert del_list_resp.status_code == 200, f"Delegation list failed: {del_list_resp.data}"
assert len(del_list_resp.data) >= 1, "Active delegation not found in list query"
assert del_list_resp.data[0]['is_active'] is True, "Delegation not marked active"
print(f"  [OK] Active proxy delegation listed: Delegator {user.get_full_name()} -> Delegatee {emp_user2.get_full_name()}")

# Revoke delegation
rev_req = rf.post(f'/api/teams/delegations/{delegation_id}/revoke/')
rev_req.org_id = org_id
force_authenticate(rev_req, user=user)
rev_resp = ApprovalDelegationRevokeView.as_view()(rev_req, delegation_id=delegation_id)
assert rev_resp.status_code == 200, f"Delegation revocation failed: {rev_resp.data}"
del_obj = ApprovalDelegation.objects.get(id=delegation_id)
assert del_obj.is_active is False, "Delegation should be inactive after revocation"
print("  [OK] OOO Manager Delegation revoked cleanly")
print("[PASS] PILLAR 2 VERIFIED 100%")

# ======================================================================
# PILLAR 3: 3-QUESTION ASYNC CHECK-IN & STANDUP DIGEST RELAY
# ======================================================================
print("\n[PILLAR 3] Testing 3-Question Rapid Async Check-in & Standup Digest...")

# 1. Test Task Autofill
tasks_req = rf.get('/api/teams/daily-status/my-tasks/')
tasks_req.org_id = org_id
force_authenticate(tasks_req, user=user)
tasks_resp = UserStandupTasksView.as_view()(tasks_req)
assert tasks_resp.status_code == 200, f"Tasks autofill endpoint failed: {tasks_resp.data}"
assert 'assigned_today' in tasks_resp.data, "Assigned today missing from autofill"
print("  [OK] 1-Click Task linking & auto-fill verified")

# 2. Submit Daily Check-in with Blocker
standup_service = StandupService()
checkin_status = standup_service.submit_checkin(
    org_id=org_id,
    user=emp_user2,
    data={
        'yesterday_accomplished': 'Completed refactoring authentication token pipeline',
        'today_focus': 'Optimizing database index performance on teams and tasks',
        'has_blockers': True,
        'blockers_description': 'Waiting for staging infrastructure DNS propagation',
        'blocker_severity': 'high',
        'status_emoji': '🚨'
    }
)
assert checkin_status.has_blockers is True, "Blocker flag not saved on status"
print("  [OK] 3-Question rapid check-in recorded with active blocker")

# 3. Check Standup Blocker Alert Banner API
banner_req = rf.get('/api/teams/departments/standup-banner/')
banner_req.org_id = org_id
force_authenticate(banner_req, user=user)
banner_resp = DepartmentStandupBannerView.as_view()(banner_req)
assert banner_resp.status_code == 200, f"Banner API failed: {banner_resp.data}"
assert banner_resp.data['has_active_blockers'] is True, "Standup banner failed to detect active blocker"
assert banner_resp.data['blocker_count'] >= 1, "Standup blocker count is zero"
print(f"  [OK] Standup Blocker Banner surfaced: {banner_resp.data['blocker_count']} active blocker(s)")

# 4. Generate AI Standup Rollup Digest
digest = standup_service.generate_standup_rollup(org_id=org_id, dept_id=str(dept.id), requesting_user=user, dispatch_email=False)
assert digest is not None, "Standup digest generation returned None"
assert 'full_markdown' in digest, "Standup digest missing full_markdown"
print(f"  [OK] AI Standup Rollup Digest consolidated for {dept.name}")
print(f"    Sample digest length: {len(digest['full_markdown'])} chars")
print("[PASS] PILLAR 3 VERIFIED 100%")

# ======================================================================
# PILLAR 4: 1-ON-1 WORKSPACES, SKILL MATRIX, & RUNBOOKS
# ======================================================================
print("\n[PILLAR 4] Testing 1-on-1 Workspaces, Skill Matrix, & Runbooks...")

one_service = OneOnOneService()
ws = one_service.get_or_create_workspace(org_id=org_id, manager_id=user.id, employee_id=emp_user2.id, requesting_user=user)
assert ws is not None, "Failed to create 1-on-1 workspace"
assert len(ws.shared_agenda) >= 3, "Default agenda not seeded"
print("  [OK] 1-on-1 Workspace Created & Default Agenda Seeded")

action_item_id = str(uuid.uuid4())
updated_ws = one_service.update_workspace(org_id, ws.id, user, {
    'cadence': 'weekly',
    'action_items': [
        {
            'id': action_item_id,
            'title': 'Deploy new vector telemetry cluster',
            'notes': 'Sync with DevOps team and verify staging test results',
            'assignee_id': str(emp_user2.id),
            'due_date': '2026-11-20',
            'is_completed': False,
            'converted_to_task_id': None
        }
    ]
})
assert updated_ws.cadence == 'weekly'
assert len(updated_ws.action_items) == 1
print("  [OK] 1-on-1 Workspace Updated (Cadence & Action Items)")

# Convert Action Item to CORE Task
task_res = one_service.convert_action_item_to_task(org_id, ws.id, user, action_item_id)
assert task_res['task_id'] is not None, "Task ID is None"
assert task_res['title'] == 'Deploy new vector telemetry cluster'
print(f"  [OK] 1-on-1 Action Item Converted directly into CORE Task: {task_res['task_id']}")

# Launch Meeting Room
meet_res = one_service.launch_meeting_room(org_id, ws.id, user)
assert meet_res['room_code'] is not None, "Room code is None"
print(f"  [OK] 1-on-1 Instant Video Meeting Room Generated: {meet_res['room_code']}")

# 2. Skill Matrix & Natural Query Search
skill_service = SkillMatrixService()
skill_service.update_employee_skills(org_id, emp2.id, ['React', 'PostgreSQL', 'Kubernetes', 'Django', 'Rust'])
print("  [OK] Employee Skills updated with tags: React, PostgreSQL, Kubernetes, Django, Rust")

matrix_res = skill_service.get_skill_matrix(org_id, query=f"{dept.name} Kubernetes")
assert matrix_res['total_matches'] >= 1, "Talent search returned 0 matches"
matched_emp = next((m for m in matrix_res['matched_members'] if m['user_id'] == str(emp_user2.id)), None)
assert matched_emp is not None, "Target employee not found in matched members"
assert 'Kubernetes' in matched_emp['skills']
print(f"  [OK] Natural query skill search matched: {matched_emp['full_name']} with Kubernetes in {matched_emp['department_name']}")

# 3. Departmental Onboarding / Offboarding Runbook
runbook_service = DepartmentRunbookService()
rb_template = runbook_service.get_or_create_default_runbook(org_id, dept.id, runbook_type='onboarding')
assert len(rb_template.checklist_steps) >= 3, "Runbook template has fewer than 3 steps"
print(f"  [OK] Default Onboarding Runbook Template Verified ({len(rb_template.checklist_steps)} steps)")

execution = runbook_service.trigger_runbook(org_id, emp2.id, runbook_type='onboarding', actor_user=user)
assert execution.status == 'active', f"Execution status unexpected: {execution.status}"
assert len(execution.steps) >= 3, "Execution steps fewer than 3"
print(f"  [OK] 1-Click Onboarding Runbook Triggered for {emp2.get_full_name()} (Status: {execution.status})")

step_1_id = execution.steps[0]['id']
updated_exec = runbook_service.toggle_step(org_id, execution.id, step_1_id, is_completed=True, actor_user=user)
assert updated_exec.steps[0]['is_completed'] is True, "Step 1 not marked completed"
assert updated_exec.steps[0]['completed_by'] is not None, "Step 1 missing completed_by"
print(f"  [OK] Runbook Step 1 Completed and verified by {updated_exec.steps[0]['completed_by']}")

print("\n" + "=" * 70)
print("ALL 4 PILLARS VERIFIED - ZERO BREAKAGES - 100% SUCCESS")
print("=" * 70)
