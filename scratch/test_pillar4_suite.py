import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import RequestFactory
from rest_framework.test import force_authenticate
from accounts.models import User
from teams.models import Department, Employee
from teams.services import OneOnOneService, SkillMatrixService, DepartmentRunbookService
from teams.views import (
    OneOnOneWorkspaceListCreateView, OneOnOneWorkspaceDetailView, OneOnOneConvertTaskView,
    DepartmentSkillMatrixView, DepartmentRunbookExecutionListCreateView, DepartmentRunbookStepToggleView
)

print("=" * 60)
print("RUNNING PILLAR 4 COMPREHENSIVE VERIFICATION SUITE")
print("=" * 60)

user = User.objects.get(email='saumyakesur@gmail.com')
org_id = user.org_id
emp2 = User.objects.filter(org_id=org_id).exclude(id=user.id).first()
if not emp2:
    emp2 = User.objects.create_user(email='direct_report@example.com', password='Password123!', org=user.org, first_name='Direct', last_name='Report', role='employee')

dept = Department.objects.filter(org_id=org_id, is_deleted=False).first()

# ── 1. TEST 1-ON-1 MEETING WORKSPACES ───────────────────────────
one_service = OneOnOneService()
ws = one_service.get_or_create_workspace(org_id=org_id, manager_id=user.id, employee_id=emp2.id, requesting_user=user)
assert ws is not None
assert len(ws.shared_agenda) >= 3, "Default agenda not seeded"
print("[PASS] 1-on-1 Workspace Created & Default Agenda Seeded")

# Update workspace with an action item
import uuid
action_item_id = str(uuid.uuid4())
updated_ws = one_service.update_workspace(org_id, ws.id, user, {
    'cadence': 'weekly',
    'action_items': [
        {
            'id': action_item_id,
            'title': 'Prepare system architecture diagrams for Q4 review',
            'notes': 'Discuss with backend leads and export SVG',
            'assignee_id': str(emp2.id),
            'due_date': '2026-11-20',
            'is_completed': False,
            'converted_to_task_id': None
        }
    ]
})
assert updated_ws.cadence == 'weekly'
assert len(updated_ws.action_items) == 1
print("[PASS] 1-on-1 Workspace Updated (Cadence & Action Items)")

# Convert Action Item to CORE Task
task_res = one_service.convert_action_item_to_task(org_id, ws.id, user, action_item_id)
assert task_res['task_id'] is not None
assert task_res['title'] == 'Prepare system architecture diagrams for Q4 review'
print(f"[PASS] 1-on-1 Action Item Converted directly into CORE Task: {task_res['task_id']}")

# Launch Meeting Room
meet_res = one_service.launch_meeting_room(org_id, ws.id, user)
assert meet_res['room_code'] is not None
print(f"[PASS] 1-on-1 Instant Video Meeting Room Generated: {meet_res['room_code']}")

# ── 2. TEST DEPARTMENT SKILL MATRIX & TALENT DIRECTORY ──────────
skill_service = SkillMatrixService()
emp_profile = Employee.objects.filter(user=emp2).first()
if not emp_profile:
    emp_profile = Employee.objects.create(user=emp2, org_id=org_id, department=dept)
else:
    emp_profile.department = dept
    emp_profile.save()

# Update skills
skill_service.update_employee_skills(org_id, emp_profile.id, ['React', 'PostgreSQL', 'Kubernetes', 'Django'])
print("[PASS] Employee Skills updated with tags: React, PostgreSQL, Kubernetes, Django")

# Query Talent Directory with Natural Query "Engineering Kubernetes"
matrix_res = skill_service.get_skill_matrix(org_id, query=f"{dept.name} Kubernetes" if dept else "Kubernetes")
assert matrix_res['total_matches'] >= 1
matched_emp = next((m for m in matrix_res['matched_members'] if m['user_id'] == str(emp2.id)), None)
assert matched_emp is not None
assert 'Kubernetes' in matched_emp['skills']
print(f"[PASS] Natural Query Talent Search Match: Found {matched_emp['full_name']} with Kubernetes in {matched_emp['department_name']}")

# ── 3. TEST AUTOMATED ONBOARDING / OFFBOARDING RUNBOOKS ──────────
runbook_service = DepartmentRunbookService()
if dept:
    rb_template = runbook_service.get_or_create_default_runbook(org_id, dept.id, runbook_type='onboarding')
    assert len(rb_template.checklist_steps) >= 3
    print(f"[PASS] Default Onboarding Runbook Template Verified ({len(rb_template.checklist_steps)} steps)")

    # Trigger Onboarding Runbook for Employee
    execution = runbook_service.trigger_runbook(org_id, emp_profile.id, runbook_type='onboarding', actor_user=user)
    assert execution.status == 'active'
    assert len(execution.steps) >= 3
    print(f"[PASS] 1-Click Onboarding Runbook Triggered for {emp_profile.get_full_name()} (Status: {execution.status})")

    # Toggle Step 1 to Completed
    step_1_id = execution.steps[0]['id']
    updated_exec = runbook_service.toggle_step(org_id, execution.id, step_1_id, is_completed=True, actor_user=user)
    assert updated_exec.steps[0]['is_completed'] is True
    assert updated_exec.steps[0]['completed_by'] is not None
    print(f"[PASS] Runbook Step 1 Completed by {updated_exec.steps[0]['completed_by']}")

print("=" * 60)
print("ALL PILLAR 4 BACKEND VERIFICATIONS PASSED (100% SUCCESS)")
print("=" * 60)
