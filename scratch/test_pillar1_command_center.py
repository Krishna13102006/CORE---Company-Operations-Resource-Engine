import os
import sys
from datetime import date, timedelta
from decimal import Decimal

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set up Django environment using SQLite for isolated, fast verification
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
from django.conf import settings

settings.DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}
django.setup()

from django.core.management import call_command
call_command('migrate', verbosity=0)

from django.test import RequestFactory
from django.utils import timezone
from accounts.models import User
from tenants.models import Organization
from teams.models import Department, Employee, LeaveRequest
from projects.models import Project, Task
from expenses.models import SpendBudget, ExpenseClaim
from hiring.models import JobPosting
from teams.services import DepartmentService, EmployeeService
from teams.views import DepartmentCommandCenterView

def run_pillar1_tests():
    print("--- [TEST] Starting Pillar 1 Dynamic Department Command Center & Capacity Radar Test Suite ---")

    # 1. Setup Organization & Admin User
    org = Organization.objects.create(name="Apex HyperScale Corp")
    admin_user = User.objects.create_user(
        email="cfo@apex.com",
        password="Password123!",
        role="admin",
        first_name="Eleanor",
        last_name="Vance",
        org=org
    )
    admin_emp, _ = Employee.objects.get_or_create(user=admin_user, defaults={'org_id': org.id, 'employment_status': 'active'})

    # 2. Setup Departments
    eng_dept = Department.objects.create(name="Core Engineering", org_id=org.id, head=admin_user)
    growth_dept = Department.objects.create(name="Growth Pod", org_id=org.id, head=admin_user)

    # 3. Setup Employees:
    # Employee 1: In Core Eng, Burnout Risk (>6 high priority tasks)
    burnout_user = User.objects.create_user(
        email="alex.backend@apex.com",
        password="Password123!",
        role="employee",
        first_name="Alex",
        last_name="Chen",
        org=org
    )
    burnout_emp, _ = Employee.objects.get_or_create(user=burnout_user, defaults={'org_id': org.id})
    burnout_emp.department = eng_dept
    burnout_emp.employment_status = "active"
    burnout_emp.save()
    burnout_emp.departments.add(eng_dept, growth_dept) # Primary Eng, Secondary Growth Matrix

    # Employee 2: In Core Eng, Available Capacity (0 tasks)
    idle_user = User.objects.create_user(
        email="sara.qa@apex.com",
        password="Password123!",
        role="employee",
        first_name="Sara",
        last_name="Connor",
        org=org
    )
    idle_emp, _ = Employee.objects.get_or_create(user=idle_user, defaults={'org_id': org.id})
    idle_emp.department = eng_dept
    idle_emp.employment_status = "active"
    idle_emp.save()

    # Employee 3: Remote / WFH Today
    remote_user = User.objects.create_user(
        email="jordan.wfh@apex.com",
        password="Password123!",
        role="employee",
        first_name="Jordan",
        last_name="Lee",
        org=org
    )
    remote_emp, _ = Employee.objects.get_or_create(user=remote_user, defaults={'org_id': org.id})
    remote_emp.department = eng_dept
    remote_emp.employment_status = "active"
    remote_emp.save()
    today = timezone.now().date()
    LeaveRequest.objects.create(
        org_id=org.id,
        employee=remote_emp,
        leave_type="wfh",
        start_date=today,
        end_date=today,
        status="approved",
        notes="Home fiber setup"
    )

    # Employee 4: On Annual Leave Today
    leave_user = User.objects.create_user(
        email="elena.vacation@apex.com",
        password="Password123!",
        role="employee",
        first_name="Elena",
        last_name="Rostova",
        org=org
    )
    leave_emp, _ = Employee.objects.get_or_create(user=leave_user, defaults={'org_id': org.id})
    leave_emp.department = eng_dept
    leave_emp.employment_status = "active"
    leave_emp.save()
    LeaveRequest.objects.create(
        org_id=org.id,
        employee=leave_emp,
        leave_type="annual",
        start_date=today,
        end_date=today + timedelta(days=3),
        status="approved",
        notes="Alpine Trek"
    )

    # 4. Setup Tasks for Burnout Employee: 7 high/critical tasks
    proj = Project.objects.create(name="Infrastructure Scale", org_id=org.id)
    for i in range(7):
        Task.objects.create(
            org_id=org.id,
            project=proj,
            title=f"Critical Migrations Phase {i+1}",
            assignee=burnout_user,
            priority="critical",
            status="in_progress"
        )

    # 5. Setup Expenses & Budget (Connected Pillar 3)
    eng_budget = SpendBudget.objects.create(
        org_id=org.id,
        amount=Decimal("25000.00"),
        target_type="department",
        department=eng_dept
    )
    ExpenseClaim.objects.create(
        org_id=org.id,
        employee=burnout_emp,
        department=eng_dept,
        amount=Decimal("14250.00"),
        amount_converted=Decimal("14250.00"),
        status="approved",
        expense_date=today
    )

    # 6. Setup CORE Hiring Open Requisition
    JobPosting.objects.create(
        org_id=org.id,
        title="Senior Distributed Systems Architect",
        department=eng_dept.name,
        status="published"
    )

    # TEST 1: DepartmentCommandCenterView execution
    from rest_framework.test import APIRequestFactory, force_authenticate
    factory = APIRequestFactory()
    view = DepartmentCommandCenterView.as_view()

    # Scope: All Departments
    req_all = factory.get('/api/teams/departments/command-center/')
    force_authenticate(req_all, user=admin_user)
    req_all.org_id = org.id
    resp_all = view(req_all)
    assert resp_all.status_code == 200, f"Expected 200, got {resp_all.status_code}"
    data_all = resp_all.data
    
    print("[PASS] Command Center HTTP 200 OK")
    print(f"       Pulse: {data_all['pulse']['present_count']} Present, {data_all['pulse']['remote_wfh_count']} Remote/WFH, {data_all['pulse']['on_leave_count']} On Leave")
    assert data_all['pulse']['remote_wfh_count'] == 1, "Expected 1 Remote/WFH employee"
    assert data_all['pulse']['on_leave_count'] == 1, "Expected 1 employee on leave"

    # TEST 2: Workload & Bandwidth Gauge Verification
    workload = data_all['workload_gauge']
    print(f"       Workload: Burnout Risk={workload['burnout_risk_count']}, Available Capacity={workload['available_capacity_count']}")
    assert workload['burnout_risk_count'] >= 1, "Burnout risk count should be >= 1"
    assert any(e['employee_id'] == str(burnout_emp.id) for e in workload['burnout_risk_employees']), "Alex Chen must be flagged as Burnout Risk"
    assert workload['available_capacity_count'] >= 1, "Available capacity count should be >= 1"
    assert any(e['employee_id'] == str(idle_emp.id) for e in workload['available_capacity_employees']), "Sara Connor must be flagged as Available Capacity"
    print("[PASS] Burnout Risk (>6 high-pri tasks) and Available Capacity (0 tasks) flagged accurately")

    # TEST 3: Integrated Financial Spend Radar Verification
    fin = data_all['financial_radar']
    print(f"       Financial: ${fin['spent_this_month']} spent / ${fin['budget_amount']} budget ({fin['utilization_pct']}%, status: {fin['status']})")
    assert fin['spent_this_month'] == 14250.0, f"Expected 14250.0, got {fin['spent_this_month']}"
    assert fin['budget_amount'] == 25000.0, f"Expected 25000.0, got {fin['budget_amount']}"
    assert fin['utilization_pct'] == 57.0, f"Expected 57.0%, got {fin['utilization_pct']}"
    assert fin['status'] == 'healthy', f"Expected healthy, got {fin['status']}"
    print("[PASS] Pillar 3 Expense Engine Spend & Budget calculation verified")

    # TEST 4: Hiring Open Requisitions Sync
    hiring = data_all['hiring_pipeline']
    print(f"       Hiring: {hiring['open_requisitions_count']} open role(s): {[r['title'] for r in hiring['open_roles']]}")
    assert hiring['open_requisitions_count'] >= 1, "Expected at least 1 open job requisition"
    print("[PASS] CORE Hiring requisition pipeline synced")

    # TEST 5: Cross-Departmental Matrix Badges in Serializer
    from teams.serializers import EmployeeSerializer
    emp_ser = EmployeeSerializer(burnout_emp).data
    print(f"       Matrix Badges: Primary={emp_ser.get('primary_department')}, Secondary={emp_ser.get('secondary_departments')}")
    assert emp_ser['primary_department']['id'] == str(eng_dept.id), "Primary department mismatch"
    assert any(d['id'] == str(growth_dept.id) for d in emp_ser['secondary_departments']), "Secondary matrix pod mismatch"
    assert emp_ser['workload_stats']['burnout_status'] == 'high_risk', "Employee serializer workload status mismatch"
    print("[PASS] Cross-Departmental Matrix badges & employee workload stats verified")

    # TEST 6: Employee Multi-Department & Matrix Pod Update
    emp_service = EmployeeService()
    updated_emp = emp_service.update_employee(
        employee_id=str(idle_emp.id),
        org_id=org.id,
        requesting_user=admin_user,
        department_id=str(eng_dept.id),
        department_ids=[str(eng_dept.id), str(growth_dept.id)]
    )
    assert updated_emp.department_id == eng_dept.id, "Primary department update failed"
    matrix_ids = [d.id for d in updated_emp.departments.all()]
    assert eng_dept.id in matrix_ids and growth_dept.id in matrix_ids, "Matrix pods update failed"
    print("[PASS] Primary + Secondary Matrix Pod assignment update verified")

    print("\n>>> ALL PILLAR 1 ENHANCEMENTS VERIFIED SUCCESSFULLY AND PASS WITH 100% ACCURACY! <<<")

if __name__ == '__main__':
    run_pillar1_tests()
