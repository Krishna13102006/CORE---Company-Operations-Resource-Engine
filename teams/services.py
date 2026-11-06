import os
import json
import logging
import datetime
import httpx
from django.db import transaction
from django.db.models import Q
from django.conf import settings
from django.utils import timezone
from core.exceptions import ServiceError
from .models import Employee, PublicHoliday, LeaveRequest
from .repositories import (
    DepartmentRepository, EmployeeRepository,
    LeaveRepository, ReviewRepository, PublicHolidayRepository
)

logger = logging.getLogger(__name__)

dept_repo     = DepartmentRepository()
employee_repo = EmployeeRepository()
leave_repo    = LeaveRepository()
review_repo   = ReviewRepository()
holiday_repo  = PublicHolidayRepository()


class DepartmentService:

    def list_departments(self, org_id):
        return dept_repo.list_by_org(org_id)

    def get_department(self, dept_id, org_id):
        dept = dept_repo.get_by_id(dept_id, org_id)
        if not dept:
            raise ServiceError('Department not found.', 404)
        return dept

    def create_department(self, org_id, user, name,
                          parent_department_id=None, head_id=None):
        if user.role not in ['admin', 'hr', 'manager']:
            raise ServiceError(
                'Only HR, Manager, and Admin can create departments.', 403
            )
        from core.validators import validate_and_clean_org_name
        try:
            name = validate_and_clean_org_name(name, 'Department name')
        except Exception as e:
            raise ServiceError(str(e), 400)

        return dept_repo.create(
            org_id=org_id,
            name=name,
            parent_department_id=parent_department_id if parent_department_id != '' else None,
            head_id=head_id if head_id != '' else None,
        )

    def delete_department(self, dept_id, org_id, user):
        if user.role not in ['admin', 'hr', 'manager']:
            raise ServiceError(
                'Only HR, Manager, and Admin can delete departments.', 403
            )
        dept = dept_repo.get_by_id(dept_id, org_id)
        if not dept:
            raise ServiceError('Department not found.', 404)
        dept_repo.soft_delete(dept_id, org_id)
        return True

    def update_department(self, dept_id, org_id, user, name=None,
                          parent_department_id=None, head_id=None):
        if user.role not in ['admin', 'hr', 'manager']:
            raise ServiceError(
                'Only HR, Manager, and Admin can update departments.', 403
            )
        dept = dept_repo.get_by_id(dept_id, org_id)
        if not dept:
            raise ServiceError('Department not found.', 404)

        fields = {}
        if name is not None:
            from core.validators import validate_and_clean_org_name
            try:
                fields['name'] = validate_and_clean_org_name(name, 'Department name')
            except Exception as e:
                raise ServiceError(str(e), 400)
        if parent_department_id is not None:
            fields['parent_department_id'] = parent_department_id if parent_department_id != '' else None
        if head_id is not None:
            fields['head_id'] = head_id if head_id != '' else None

        return dept_repo.update(dept_id, org_id, **fields)

    def get_command_center_metrics(self, org_id, dept_id=None, current_user_id=None):
        from teams.models import Employee, Department, LeaveRequest
        from django.utils import timezone
        from django.db.models import Q

        today = timezone.now().date()

        # 1. Resolve Target Departments
        all_depts = list(Department.objects.filter(org_id=org_id, is_deleted=False).select_related('parent_department', 'head').order_by('name'))
        selected_dept = None
        if dept_id and dept_id != 'all':
            selected_dept = next((d for d in all_depts if str(d.id) == str(dept_id)), None)

        # 2. Scope Employees
        emp_qs = Employee.objects.filter(
            org_id=org_id,
            is_deleted=False,
            user__is_deleted=False,
            user__is_active=True
        ).select_related('user', 'department', 'manager__user').prefetch_related('departments')

        if selected_dept:
            scoped_emps = list(emp_qs.filter(
                Q(department=selected_dept) | Q(departments=selected_dept)
            ).distinct())
        else:
            scoped_emps = list(emp_qs)

        total_headcount = len(scoped_emps)
        emp_ids = [e.id for e in scoped_emps]
        user_ids = [e.user_id for e in scoped_emps]

        # 3. Live Attendance / Pulse Engine
        active_leaves = list(LeaveRequest.objects.filter(
            org_id=org_id,
            is_deleted=False,
            status='approved',
            start_date__lte=today,
            end_date__gte=today,
            employee_id__in=emp_ids
        ).select_related('employee__user'))

        leave_map = {l.employee_id: l for l in active_leaves}

        # Real-time Online Presence Telemetry (Active within last 5 minutes or viewing right now)
        online_count = sum(1 for e in scoped_emps if (
            (e.user and e.user.is_online) or
            (current_user_id and str(e.user_id) == str(current_user_id))
        ))

        present_count = 0
        remote_wfh_count = 0
        on_leave_count = 0
        half_day_count = 0
        leave_details = []

        for emp in scoped_emps:
            if emp.id in leave_map:
                l = leave_map[emp.id]
                leave_type = l.leave_type
                is_wfh = (leave_type == 'wfh')
                if is_wfh:
                    remote_wfh_count += 1
                elif l.is_half_day:
                    half_day_count += 1
                    present_count += 1
                else:
                    on_leave_count += 1

                leave_details.append({
                    'employee_id': str(emp.id),
                    'full_name': emp.get_full_name(),
                    'role': emp.user.role,
                    'leave_type': leave_type,
                    'leave_type_display': l.get_leave_type_display(),
                    'is_wfh': is_wfh,
                    'is_half_day': l.is_half_day,
                    'half_day_period': l.get_half_day_period_display() if l.is_half_day else None,
                    'start_date': l.start_date.isoformat(),
                    'end_date': l.end_date.isoformat(),
                    'notes': l.notes,
                })
            else:
                present_count += 1

        # 4. Workload & Bandwidth Gauge (Real-Time Task Calculation)
        from projects.models import Task
        tasks = list(Task.objects.filter(
            org_id=org_id,
            is_deleted=False,
            assignee_id__in=user_ids
        ).exclude(status='done'))

        user_task_map = {}
        for t in tasks:
            u_id = str(t.assignee_id)
            if u_id not in user_task_map:
                user_task_map[u_id] = {'total': 0, 'high_priority': 0, 'overdue': 0}
            user_task_map[u_id]['total'] += 1
            if t.priority in ['high', 'critical']:
                user_task_map[u_id]['high_priority'] += 1
            if t.due_date and t.due_date < today:
                user_task_map[u_id]['overdue'] += 1

        burnout_risk_employees = []
        available_capacity_employees = []
        balanced_employees = []

        for emp in scoped_emps:
            u_id = str(emp.user_id)
            stats = user_task_map.get(u_id, {'total': 0, 'high_priority': 0, 'overdue': 0})
            emp_info = {
                'employee_id': str(emp.id),
                'user_id': u_id,
                'full_name': emp.get_full_name(),
                'email': emp.user.email,
                'department_name': emp.department.name if emp.department else 'General',
                'total_tasks': stats['total'],
                'high_priority_tasks': stats['high_priority'],
                'overdue_tasks': stats['overdue'],
            }

            if stats['high_priority'] > 6:
                emp_info['status'] = 'high_risk'
                burnout_risk_employees.append(emp_info)
            elif stats['total'] == 0:
                emp_info['status'] = 'available'
                available_capacity_employees.append(emp_info)
            else:
                emp_info['status'] = 'balanced'
                balanced_employees.append(emp_info)

        total_open_tasks = len(tasks)
        high_priority_tasks = sum(1 for t in tasks if t.priority in ['high', 'critical'])

        # 5. Integrated Departmental Spend & Budget Widget
        from expenses.models import SpendBudget, ExpenseClaim
        budget_qs = SpendBudget.objects.filter(org_id=org_id, is_deleted=False, target_type='department')
        if selected_dept:
            budget_qs = budget_qs.filter(department=selected_dept)

        dept_budgets = list(budget_qs)
        total_budget_amount = sum(float(b.amount) for b in dept_budgets)

        # Performance optimization: prefetch all approved/settled month claims once
        all_month_claims = list(ExpenseClaim.objects.filter(
            org_id=org_id,
            is_deleted=False,
            status__in=['approved', 'payment_queued', 'reimbursed'],
            expense_date__year=today.year,
            expense_date__month=today.month
        ))

        claims_by_dept = {}
        for c in all_month_claims:
            if c.department_id:
                d_id = str(c.department_id)
                claims_by_dept[d_id] = claims_by_dept.get(d_id, 0.0) + float(c.amount_converted or c.amount or 0)

        if selected_dept:
            total_spent_month = claims_by_dept.get(str(selected_dept.id), 0.0)
        else:
            total_spent_month = sum(float(c.amount_converted or c.amount or 0) for c in all_month_claims)

        utilization_pct = round((total_spent_month / total_budget_amount * 100), 1) if total_budget_amount > 0 else 0.0

        if total_budget_amount == 0:
            budget_health = 'unallocated'
        elif utilization_pct > 100:
            budget_health = 'exceeded'
        elif utilization_pct >= 80:
            budget_health = 'warning'
        else:
            budget_health = 'healthy'

        # 6. Integrated CORE Hiring Open Requisitions Widget
        from hiring.models import JobPosting
        jobs_qs = JobPosting.objects.filter(org_id=org_id, is_deleted=False, status='published')
        if selected_dept:
            jobs_qs = jobs_qs.filter(
                Q(department__iexact=selected_dept.name) | Q(department__iexact=str(selected_dept.id))
            )

        open_jobs = list(jobs_qs)
        open_roles = [
            {
                'id': str(j.id),
                'title': j.title,
                'department': j.department,
                'employment_type': j.employment_type if hasattr(j, 'employment_type') else 'Full-time',
                'location': j.location if hasattr(j, 'location') else 'Remote / Hybrid',
            }
            for j in open_jobs
        ]

        # 7. Department Cards Overview (for all departments in org)
        all_org_emps = list(emp_qs)
        emp_depts_map = {
            e.id: set([e.department_id] + [x.id for x in e.departments.all()]) if e.department_id else set([x.id for x in e.departments.all()])
            for e in all_org_emps
        }

        dept_cards = []
        for d in all_depts:
            d_emps = [e for e in all_org_emps if d.id in emp_depts_map.get(e.id, set())]
            d_user_ids = [e.user_id for e in d_emps]
            d_present = sum(1 for e in d_emps if e.id not in leave_map)
            d_remote = sum(1 for e in d_emps if e.id in leave_map and leave_map[e.id].leave_type == 'wfh')
            d_leave = sum(1 for e in d_emps if e.id in leave_map and leave_map[e.id].leave_type != 'wfh')
            d_burnout = sum(1 for u in d_user_ids if user_task_map.get(str(u), {}).get('high_priority', 0) > 6)

            d_b = next((b for b in dept_budgets if b.department_id == d.id), None)
            d_budget_amt = float(d_b.amount) if d_b else 0.0
            d_spent = claims_by_dept.get(str(d.id), 0.0)
            d_util = round((d_spent / d_budget_amt * 100), 1) if d_budget_amt > 0 else 0.0

            d_roles = [j for j in open_jobs if j.department.lower() == d.name.lower() or j.department == str(d.id)]

            dept_cards.append({
                'id': str(d.id),
                'name': d.name,
                'parent_name': d.parent_department.name if d.parent_department else None,
                'head_name': f"{d.head.first_name} {d.head.last_name}".strip() if d.head else None,
                'head_email': d.head.email if d.head else None,
                'head_id': str(d.head.id) if d.head else None,
                'employee_count': len(d_emps),
                'present_count': d_present,
                'remote_count': d_remote,
                'leave_count': d_leave,
                'burnout_count': d_burnout,
                'budget_amount': d_budget_amt,
                'spent_this_month': d_spent,
                'utilization_pct': d_util,
                'open_roles_count': len(d_roles),
                'open_roles': [{'id': str(j.id), 'title': j.title} for j in d_roles[:3]],
            })

        # 8. Span of Control & Manager Direct Reports Telemetry (Pillar 2)
        manager_reports_map = {}
        for emp in scoped_emps:
            if emp.manager_id:
                m_id = str(emp.manager_id)
                manager_reports_map[m_id] = manager_reports_map.get(m_id, 0) + 1

        manager_metrics_list = []
        overloaded_managers = []
        optimal_managers = []

        for m_id, count in manager_reports_map.items():
            mgr_emp = next((e for e in emp_qs if str(e.id) == m_id), None)
            if mgr_emp:
                status = 'overloaded' if count > 10 else ('optimal' if 5 <= count <= 8 else ('elevated' if count in [9, 10] else 'manageable'))
                info = {
                    'employee_id': str(mgr_emp.id),
                    'user_id': str(mgr_emp.user_id),
                    'name': mgr_emp.get_full_name(),
                    'email': mgr_emp.user.email,
                    'department_name': mgr_emp.department.name if mgr_emp.department else 'General',
                    'direct_reports_count': count,
                    'status': status,
                }
                manager_metrics_list.append(info)
                if status == 'overloaded':
                    overloaded_managers.append(info)
                elif status == 'optimal':
                    optimal_managers.append(info)

        total_managers = len(manager_reports_map)
        avg_span = round(sum(manager_reports_map.values()) / total_managers, 1) if total_managers > 0 else 0.0
        max_span = max(manager_reports_map.values()) if manager_reports_map else 0

        # 9. Active Manager Delegations (Pillar 2)
        from teams.models import ApprovalDelegation
        active_delegations_qs = ApprovalDelegation.objects.filter(
            org_id=org_id,
            is_active=True,
            is_deleted=False,
            start_date__lte=today,
            end_date__gte=today
        )
        if selected_dept:
            active_delegations_qs = active_delegations_qs.filter(
                Q(delegator__employee_profile__department=selected_dept) |
                Q(delegatee__employee_profile__department=selected_dept)
            )

        active_delegations = [
            {
                'id': str(d.id),
                'delegator_id': str(d.delegator.id),
                'delegator_name': d.delegator.get_full_name(),
                'delegator_email': d.delegator.email,
                'delegatee_id': str(d.delegatee.id),
                'delegatee_name': d.delegatee.get_full_name(),
                'delegatee_email': d.delegatee.email,
                'delegation_type': d.delegation_type,
                'start_date': d.start_date.isoformat(),
                'end_date': d.end_date.isoformat(),
                'notes': d.notes,
            }
            for d in active_delegations_qs
        ]

        return {
            'selected_department': {
                'id': str(selected_dept.id),
                'name': selected_dept.name,
                'head_name': f"{selected_dept.head.first_name} {selected_dept.head.last_name}".strip() if selected_dept.head else None,
            } if selected_dept else None,
            'pulse': {
                'total_headcount': total_headcount,
                'online_count': online_count,
                'present_count': present_count,
                'remote_wfh_count': remote_wfh_count,
                'on_leave_count': on_leave_count,
                'half_day_count': half_day_count,
                'leave_details': leave_details,
            },
            'workload_gauge': {
                'total_open_tasks': total_open_tasks,
                'high_priority_tasks': high_priority_tasks,
                'burnout_risk_count': len(burnout_risk_employees),
                'burnout_risk_employees': burnout_risk_employees,
                'available_capacity_count': len(available_capacity_employees),
                'available_capacity_employees': available_capacity_employees,
                'balanced_count': len(balanced_employees),
                'avg_tasks_per_employee': round(total_open_tasks / total_headcount, 1) if total_headcount > 0 else 0.0,
            },
            'span_of_control': {
                'total_managers': total_managers,
                'avg_span': avg_span,
                'max_span': max_span,
                'overloaded_count': len(overloaded_managers),
                'overloaded_managers': overloaded_managers,
                'optimal_count': len(optimal_managers),
                'manager_metrics': manager_metrics_list,
            },
            'delegations': {
                'active_count': len(active_delegations),
                'active_delegations': active_delegations,
            },
            'financial_radar': {
                'budget_amount': total_budget_amount,
                'spent_this_month': total_spent_month,
                'utilization_pct': utilization_pct,
                'status': budget_health,
                'currency': 'USD',
            },
            'hiring_pipeline': {
                'open_requisitions_count': len(open_jobs),
                'open_roles': open_roles,
            },
            'department_cards': dept_cards,
        }


class EmployeeService:

    def list_employees(self, org_id, requesting_user, filters=None):
        # Managers see only their direct reports
        if requesting_user.role == 'manager':
            my_profile = employee_repo.get_by_user_id(requesting_user.id, org_id)
            if not my_profile:
                return Employee.objects.none() if False else []
            return employee_repo.list_by_manager(my_profile.id, org_id, filters)
        # HR and Admin see everyone
        return employee_repo.list_by_org(org_id, filters)

    def get_employee(self, employee_id, org_id, requesting_user):
        emp = employee_repo.get_by_id(employee_id, org_id)
        if not emp:
            raise ServiceError('Employee not found.', 404)

        # Managers can only view their own direct reports
        if requesting_user.role == 'manager':
            my_profile = employee_repo.get_by_user_id(requesting_user.id, org_id)
            if my_profile and emp.manager_id != my_profile.id:
                # Allow viewing own profile
                if emp.user_id != requesting_user.id:
                    raise ServiceError(
                        'You can only view your direct reports.', 403
                    )

        return emp

    def create_employee(self, org_id, requesting_user, email, password,
                        first_name, last_name, role,
                        department_id=None, manager_id=None, hire_date=None):
        if requesting_user.role not in ['admin', 'hr']:
            raise ServiceError(
                'Only HR and Admin can create employees.', 403
            )

        from accounts.models import User
        from accounts.repositories import UserRepository
        user_repo = UserRepository()

        # Check email not already in use in this org
        existing = user_repo.get_by_email(email, org_id)
        if existing:
            raise ServiceError(
                'A user with this email already exists in this organisation.'
            )

        # Resolve department
        department = None
        if department_id:
            department = dept_repo.get_by_id(department_id, org_id)
            if not department:
                raise ServiceError('Department not found.', 404)

        # Resolve manager
        manager = None
        if manager_id:
            manager = employee_repo.get_by_id(manager_id, org_id)
            if not manager:
                raise ServiceError('Manager not found.', 404)

        from core.validators import validate_and_clean_name, sanitize_string
        try:
            first_name = validate_and_clean_name(first_name, 'First name')
            last_name = validate_and_clean_name(last_name, 'Last name')
            email = sanitize_string(email).lower()
        except Exception as e:
            raise ServiceError(str(e), 400)

        # Atomic: create User + Employee together
        with transaction.atomic():
            from tenants.models import Organization
            org = Organization.objects.get(id=org_id)
            user = user_repo.create(
                email=email,
                password=password,
                org=org,
                role=role,
                first_name=first_name,
                last_name=last_name,
            )
            employee = employee_repo.create(
                org_id=org_id,
                user=user,
                department=department,
                manager=manager,
                hire_date=hire_date,
                employment_status='active',
            )

        return employee

    def update_employee(self, employee_id, org_id, requesting_user,
                        department_id=None, department_ids=None,
                        manager_id=None, employment_status=None,
                        hire_date=None, leave_balance=None,
                        status_message=None, status_emoji=None,
                        skills=None):
        emp = employee_repo.get_by_id(employee_id, org_id)
        if not emp:
            raise ServiceError('Employee not found.', 404)

        is_self = str(emp.user_id) == str(requesting_user.id)
        
        if is_self:
            if (department_id is not None or department_ids is not None or manager_id is not None or 
                    employment_status or hire_date or leave_balance is not None):
                raise ServiceError(
                    'You cannot edit your own core administrative details in the teams panel.', 403
                )
        else:
            if requesting_user.role != 'admin':
                raise ServiceError(
                    'Only admins can update employee records.', 403
                )

        updates = {}

        if skills is not None:
            if isinstance(skills, list):
                updates['skills'] = [str(s).strip() for s in skills if str(s).strip()]


        if department_id is not None:
            if department_id:
                dept = dept_repo.get_by_id(department_id, org_id)
                if not dept:
                    raise ServiceError('Department not found.', 404)
                updates['department'] = dept
            else:
                updates['department'] = None

        if department_ids is not None:
            from teams.models import Department
            valid_depts = list(Department.objects.filter(id__in=department_ids, org_id=org_id, is_deleted=False))
            emp.departments.set(valid_depts)
            if 'department' not in updates:
                if valid_depts:
                    updates['department'] = valid_depts[0]
                else:
                    updates['department'] = None

        if manager_id is not None:
            if manager_id:
                mgr = employee_repo.get_by_id(manager_id, org_id)
                if not mgr:
                    raise ServiceError('Manager not found.', 404)
                updates['manager'] = mgr
            else:
                updates['manager'] = None

        if employment_status:
            updates['employment_status'] = employment_status
            # Also deactivate user account if setting to inactive
            if employment_status == 'inactive':
                emp.user.is_active = False
                emp.user.save(update_fields=['is_active'])

        if hire_date:
            updates['hire_date'] = hire_date

        if leave_balance is not None:
            updates['leave_balance'] = leave_balance

        if status_message is not None:
            updates['status_message'] = status_message
            from django.utils import timezone
            updates['status_updated_at'] = timezone.now()

        if status_emoji is not None:
            updates['status_emoji'] = status_emoji
            from django.utils import timezone
            updates['status_updated_at'] = timezone.now()

        if updates:
            updated_emp = employee_repo.update(employee_id, org_id, **updates)
            if status_message is not None or status_emoji is not None:
                final_msg = updated_emp.status_message
                final_emoji = updated_emp.status_emoji
                if final_msg:
                    from teams.models import DailyStatus
                    DailyStatus.objects.create(
                        org_id=org_id,
                        employee=updated_emp,
                        status_message=final_msg,
                        status_emoji=final_emoji
                    )
            return updated_emp

        return emp

    def deactivate_employee(self, employee_id, org_id, requesting_user):
        if requesting_user.role not in ['admin', 'hr']:
            raise ServiceError(
                'Only HR and Admin can deactivate employees.', 403
            )
        emp = employee_repo.get_by_id(employee_id, org_id)
        if not emp:
            raise ServiceError('Employee not found.', 404)

        with transaction.atomic():
            emp.user.is_active = False
            emp.user.save(update_fields=['is_active'])
            employee_repo.update(employee_id, org_id, employment_status='inactive')

        return employee_repo.get_by_id(employee_id, org_id)

    def get_employee_with_tasks(self, employee_id, org_id, requesting_user):
        emp = self.get_employee(employee_id, org_id, requesting_user)
        try:
            from projects.services import ProjectService
            project_service = ProjectService()
            tasks = list(project_service.get_tasks_for_user(
                user_id=str(emp.user_id),
                org_id=org_id
            ))
        except Exception:
            tasks = []
        return emp, tasks


class LeaveService:

    def get_my_leave_summary(self, org_id, requesting_user):
        emp = employee_repo.get_by_user_id(requesting_user.id, org_id)
        if not emp:
            raise ServiceError('Employee profile not found.', 404)

        # Balances
        balances = emp.leave_balance or {'annual': 20, 'sick': 10, 'casual': 5, 'wfh': 12, 'unpaid': 0}
        for k in ['annual', 'sick', 'casual', 'wfh', 'unpaid']:
            if k not in balances:
                balances[k] = 20 if k == 'annual' else (10 if k == 'sick' else (5 if k == 'casual' else (12 if k == 'wfh' else 0)))

        today = timezone.now().date()
        current_year = today.year

        # Compute approved days used in current year per leave type
        approved_leaves = LeaveRequest.objects.filter(
            org_id=org_id,
            employee=emp,
            status='approved',
            start_date__year=current_year,
            is_deleted=False
        )
        used_by_type = {'annual': 0.0, 'sick': 0.0, 'casual': 0.0, 'wfh': 0.0, 'unpaid': 0.0, 'maternity_paternity': 0.0, 'bereavement': 0.0}
        for l in approved_leaves:
            ltype = l.leave_type
            dur = l.duration_days()
            used_by_type[ltype] = used_by_type.get(ltype, 0.0) + dur

        pending_count = LeaveRequest.objects.filter(
            org_id=org_id,
            employee=emp,
            status='pending',
            is_deleted=False
        ).count()

        upcoming_leaves = LeaveRequest.objects.filter(
            org_id=org_id,
            employee=emp,
            status='approved',
            end_date__gte=today,
            is_deleted=False
        ).order_by('start_date')[:5]

        from .serializers import LeaveRequestSerializer
        return {
            'employee_id': str(emp.id),
            'balances': balances,
            'used_this_year': used_by_type,
            'pending_count': pending_count,
            'upcoming_leaves': LeaveRequestSerializer(upcoming_leaves, many=True).data,
        }

    def list_leave_requests(self, org_id, requesting_user, filters=None):
        my_profile = employee_repo.get_by_user_id(requesting_user.id, org_id)
        if requesting_user.role == 'employee':
            if not my_profile:
                return []
            if not filters:
                filters = {}
            filters['employee'] = str(my_profile.id)
            return leave_repo.list_by_org(org_id, filters)
        elif requesting_user.role == 'manager':
            if not my_profile:
                return []
            return leave_repo.list_by_manager_team(my_profile.id, org_id, filters)
        return leave_repo.list_by_org(org_id, filters)

    def create_leave_request(self, org_id, requesting_user,
                             leave_type, start_date, end_date, notes,
                             is_half_day=False, half_day_period=None):
        emp = employee_repo.get_by_user_id(requesting_user.id, org_id)
        if not emp:
            raise ServiceError(
                'Employee profile not found for this user.', 404
            )
        leave = leave_repo.create(
            org_id=org_id,
            employee=emp,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date,
            notes=notes,
            is_half_day=is_half_day,
            half_day_period=half_day_period,
        )

        dept = emp.department
        if dept and dept.head and dept.head.user_id != requesting_user.id:
            from core.notifications import send_notification
            send_notification(
                recipient=dept.head.user,
                org=org_id,
                actor=requesting_user,
                type='LEAVE_REQUESTED',
                title="New Leave Request",
                message=f"{emp.get_full_name()} submitted a {leave_type.replace('_', ' ')} leave request ({start_date} to {end_date}).",
                target_url='/departments?tab=leaves',
                send_email=True,
                email_subject=f"New Leave Request from {emp.get_full_name()}",
                email_cta_text="Review Leave Request"
            )
        return leave

    def cancel_leave_request(self, leave_id, org_id, requesting_user):
        leave = leave_repo.get_by_id(leave_id, org_id)
        if not leave:
            raise ServiceError('Leave request not found.', 404)

        emp = leave.employee
        is_owner = str(emp.user_id) == str(requesting_user.id)
        is_admin = requesting_user.role in ['admin', 'hr', 'manager']

        if not is_owner and not is_admin:
            raise ServiceError('Permission denied to cancel this leave request.', 403)

        if leave.status in ['cancelled', 'rejected']:
            raise ServiceError(f'Leave request is already {leave.status}.', 400)

        # If it was approved and not unpaid, refund days back to balance
        if leave.status == 'approved' and leave.leave_type not in ['unpaid', 'maternity_paternity', 'bereavement']:
            balance = emp.leave_balance.copy() if emp.leave_balance else {}
            leave_key = leave.leave_type
            duration = leave.duration_days()
            balance[leave_key] = balance.get(leave_key, 0) + duration
            employee_repo.update(emp.id, org_id, leave_balance=balance)

        leave.status = 'cancelled'
        leave.updated_at = timezone.now()
        leave.save(update_fields=['status', 'updated_at'])
        return leave

    def update_leave_status(self, leave_id, org_id,
                             requesting_user, new_status, rejection_reason=''):
        leave = leave_repo.get_by_id(leave_id, org_id)
        if not leave:
            raise ServiceError('Leave request not found.', 404)

        if leave.status != 'pending':
            raise ServiceError(
                'This leave request has already been processed.'
            )

        emp = leave.employee
        mgr_user = emp.manager.user if emp.manager else None
        dept_head_user = emp.department.head if emp.department else None

        # Check for active delegation proxy for leaves
        from teams.models import ApprovalDelegation
        today = timezone.now().date()
        delegation = ApprovalDelegation.objects.filter(
            org_id=org_id,
            delegatee=requesting_user,
            is_active=True,
            is_deleted=False,
            start_date__lte=today,
            end_date__gte=today,
            delegation_type__in=['all', 'leaves']
        ).filter(
            Q(delegator=mgr_user) | Q(delegator=dept_head_user)
        ).first()

        is_admin_or_hr = requesting_user.role in ['admin', 'hr']
        is_direct_mgr = mgr_user and mgr_user.id == requesting_user.id
        is_dept_head = dept_head_user and dept_head_user.id == requesting_user.id
        is_manager = requesting_user.role == 'manager'

        if not (is_admin_or_hr or is_direct_mgr or is_dept_head or is_manager or delegation):
            raise ServiceError(
                'You do not have permission to approve or reject leave.', 403
            )

        # Deduct from balance if approving
        if new_status == 'approved':
            balance = emp.leave_balance.copy() if emp.leave_balance else {}
            leave_key = leave.leave_type
            available = balance.get(leave_key, 0)
            duration = leave.duration_days()

            if leave_key in ['annual', 'sick', 'casual', 'wfh'] and available < duration:
                raise ServiceError(
                    f'Insufficient {leave_key} leave balance. '
                    f'Available: {available} days, Requested: {duration} days.'
                )

            if leave_key in ['annual', 'sick', 'casual', 'wfh']:
                balance[leave_key] = max(0, available - duration)
                employee_repo.update(emp.id, org_id, leave_balance=balance)

        updated_leave = leave_repo.update_status(
            leave_id, org_id,
            status=new_status,
            approved_by=requesting_user if new_status == 'approved' else None,
            rejection_reason=rejection_reason if new_status == 'rejected' else ''
        )

        from core.notifications import send_notification
        notif_type = 'LEAVE_APPROVED' if new_status == 'approved' else 'LEAVE_REJECTED'
        reason_text = f" Reason: {rejection_reason}" if (new_status == 'rejected' and rejection_reason) else ""
        actor_name = f"{requesting_user.first_name} {requesting_user.last_name}".strip() or requesting_user.email
        if delegation:
            actor_name += f" (Proxy for {delegation.delegator.first_name} {delegation.delegator.last_name})"

        send_notification(
            recipient=updated_leave.employee.user,
            org=org_id,
            actor=requesting_user,
            type=notif_type,
            title=f"Leave Request {new_status.capitalize()}",
            message=f"Your request for {updated_leave.leave_type.replace('_', ' ')} leave from {updated_leave.start_date} to {updated_leave.end_date} has been {new_status} by {actor_name}.{reason_text}",
            target_url='/departments?tab=leaves',
            send_email=True,
            email_subject=f"Leave Request {new_status.capitalize()}",
            email_cta_text="View Leave Status"
        )
        return updated_leave

    def get_team_calendar(self, org_id, requesting_user, year=None, month=None, department_id=None):
        today = timezone.now().date()
        target_year = int(year) if year else today.year
        target_month = int(month) if month else today.month

        # Calculate start and end of the requested month
        start_date = datetime.date(target_year, target_month, 1)
        if target_month == 12:
            end_date = datetime.date(target_year, 12, 31)
        else:
            # First day of next month minus 1 day
            next_month = datetime.date(target_year, target_month + 1, 1)
            end_date = next_month - datetime.timedelta(days=1)

        # Query leaves overlapping with [start_date, end_date]
        leaves_qs = leave_repo.list_calendar_events(
            org_id=org_id,
            start_date=start_date,
            end_date=end_date,
            department_id=department_id
        )

        # Query public holidays in that year
        holidays_qs = holiday_repo.list_by_org(org_id, year=target_year)

        from .serializers import LeaveRequestSerializer, PublicHolidaySerializer
        return {
            'year': target_year,
            'month': target_month,
            'leaves': LeaveRequestSerializer(leaves_qs, many=True).data,
            'holidays': PublicHolidaySerializer(holidays_qs, many=True).data
        }

    def generate_ai_leave_draft(self, prompt, requesting_user, org_id):
        today = timezone.now().date()
        today_str = today.strftime('%Y-%m-%d')
        weekday_name = today.strftime('%A')

        gemini_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
        groq_key = getattr(settings, 'GROQ_API_KEY', '') or os.getenv('GROQ_API_KEY', '')

        system_instruction = f"""
You are an intelligent HR Leave Assistant for the CORE Enterprise Workspace.
Today's Date: {today_str} ({weekday_name}).

The employee wants to request time off or work remotely.
Analyze their natural language request and output a structured JSON object with the following fields:
- "leave_type": One of ["annual", "sick", "casual", "wfh", "maternity_paternity", "bereavement", "unpaid"]. Defaults to "annual" or "casual" if unspecified.
- "start_date": "YYYY-MM-DD" formatted date. Calculate accurately relative to today ({today_str}, {weekday_name}).
- "end_date": "YYYY-MM-DD" formatted date. Same as start_date if single day.
- "is_half_day": boolean (true if mentions half day, morning, afternoon).
- "half_day_period": "morning" or "afternoon" or null.
- "notes": Professional reason/handover note extracted from the prompt.
- "summary_explanation": A warm, 1-sentence summary of the booked leave (e.g. "Requesting 2 days of annual leave for family travel from Oct 12 to Oct 13.").

Return ONLY raw valid JSON.
"""
        draft_data = None

        if gemini_key:
            for model in ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest']:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
                    payload = {
                        "contents": [
                            {"parts": [{"text": f"{system_instruction}\n\nUser Request: \"{prompt}\""}]}
                        ],
                        "generationConfig": {
                            "temperature": 0.1,
                            "response_mime_type": "application/json"
                        }
                    }
                    with httpx.Client(timeout=15.0) as client:
                        resp = client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            raw_text = data['candidates'][0]['content']['parts'][0]['text']
                            draft_data = json.loads(raw_text)
                            break
                except Exception as e:
                    logger.warning(f"Gemini leave draft failed with {model}: {e}")
                    continue

        if not draft_data and groq_key:
            try:
                with httpx.Client(timeout=15.0) as client:
                    resp = client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {groq_key}"},
                        json={
                            "model": getattr(settings, 'GROQ_MODEL', 'openai/gpt-oss-120b'),
                            "messages": [
                                {"role": "system", "content": system_instruction},
                                {"role": "user", "content": prompt}
                            ],
                            "response_format": {"type": "json_object"},
                            "temperature": 0.1
                        }
                    )
                    if resp.status_code == 200:
                        raw_text = resp.json()['choices'][0]['message']['content']
                        draft_data = json.loads(raw_text)
            except Exception as e:
                logger.warning(f"Groq leave draft failed: {e}")

        if not draft_data:
            # Rule-based fallback
            ltype = 'annual'
            prompt_lower = prompt.lower()
            if 'sick' in prompt_lower or 'doctor' in prompt_lower or 'fever' in prompt_lower:
                ltype = 'sick'
            elif 'wfh' in prompt_lower or 'remote' in prompt_lower or 'home' in prompt_lower:
                ltype = 'wfh'
            elif 'personal' in prompt_lower or 'urgent' in prompt_lower:
                ltype = 'casual'

            draft_data = {
                "leave_type": ltype,
                "start_date": today_str,
                "end_date": today_str,
                "is_half_day": "half" in prompt_lower,
                "half_day_period": "morning" if "morning" in prompt_lower else ("afternoon" if "afternoon" in prompt_lower else None),
                "notes": prompt,
                "summary_explanation": f"Requesting {ltype} leave starting {today_str}."
            }

        return draft_data

    def adjust_employee_balance(self, employee_id, org_id, requesting_user, balances):
        if requesting_user.role not in ['admin', 'hr']:
            raise ServiceError('Only Admins and HR can adjust employee leave balances.', 403)

        emp = employee_repo.get_by_id(employee_id, org_id)
        if not emp:
            raise ServiceError('Employee not found.', 404)

        current_balance = emp.leave_balance.copy() if emp.leave_balance else {}
        for k, v in balances.items():
            if v is not None:
                current_balance[k] = float(v)

        updated_emp = employee_repo.update(employee_id, org_id, leave_balance=current_balance)
        return updated_emp


class PublicHolidayService:

    def list_holidays(self, org_id, year=None):
        return holiday_repo.list_by_org(org_id, year)

    def create_holiday(self, org_id, user, name, date, description=''):
        if user.role not in ['admin', 'hr']:
            raise ServiceError('Only Admins and HR can create public holidays.', 403)
        return holiday_repo.create(org_id=org_id, name=name, date=date, description=description)

    def delete_holiday(self, holiday_id, org_id, user):
        if user.role not in ['admin', 'hr']:
            raise ServiceError('Only Admins and HR can delete public holidays.', 403)
        return holiday_repo.soft_delete(holiday_id, org_id)


class ReviewService:

    def list_reviews_for_employee(self, employee_id, org_id):
        return review_repo.list_by_employee(employee_id, org_id)

    def create_review(self, org_id, requesting_user,
                      employee_id, period_start, period_end, score, notes):
        if requesting_user.role not in ['admin', 'hr', 'manager']:
            raise ServiceError(
                'Only managers and above can create performance reviews.', 403
            )

        emp = employee_repo.get_by_id(employee_id, org_id)
        if not emp:
            raise ServiceError('Employee not found.', 404)

        return review_repo.create(
            org_id=org_id,
            employee=emp,
            reviewer=requesting_user,
            period_start=period_start,
            period_end=period_end,
            score=score,
            notes=notes,
        )


class DelegationService:

    def list_delegations(self, org_id, requesting_user, active_only=False):
        from teams.models import ApprovalDelegation
        qs = ApprovalDelegation.objects.filter(org_id=org_id, is_deleted=False)
        if requesting_user.role not in ['admin', 'hr']:
            qs = qs.filter(Q(delegator=requesting_user) | Q(delegatee=requesting_user))
        if active_only:
            today = timezone.now().date()
            qs = qs.filter(is_active=True, start_date__lte=today, end_date__gte=today)
        return qs.select_related('delegator', 'delegatee').order_by('-created_at')

    def create_delegation(self, org_id, requesting_user, delegatee_id, delegation_type, start_date, end_date, notes=''):
        from accounts.models import User
        from teams.models import ApprovalDelegation

        delegatee = User.objects.filter(id=delegatee_id, org_id=org_id, is_active=True, is_deleted=False).first()
        if not delegatee:
            raise ServiceError('Delegatee user not found in this organization.', 404)

        if str(delegatee.id) == str(requesting_user.id):
            raise ServiceError('You cannot delegate approval authority to yourself.', 400)

        if start_date > end_date:
            raise ServiceError('End date cannot be earlier than start date.', 400)

        delegation = ApprovalDelegation.objects.create(
            org_id=org_id,
            delegator=requesting_user,
            delegatee=delegatee,
            delegation_type=delegation_type,
            start_date=start_date,
            end_date=end_date,
            is_active=True,
            notes=notes or ''
        )

        from core.notifications import send_notification
        del_label = "All Approvals (Expenses & Leaves)" if delegation_type == 'all' else ("Expense Claims" if delegation_type == 'expenses' else "Leave Requests")
        send_notification(
            recipient=delegatee,
            org=org_id,
            actor=requesting_user,
            type='APPROVAL_DELEGATED',
            title="Out-of-Office Proxy Authority Granted",
            message=f"{requesting_user.first_name} {requesting_user.last_name} has designated you as their approval proxy for {del_label} from {start_date} to {end_date}.",
            target_url='/departments?tab=members',
            send_email=True,
            email_subject="Approval Delegation Authority Granted",
            email_cta_text="View Departments & Approvals"
        )
        return delegation

    def revoke_delegation(self, delegation_id, org_id, requesting_user):
        from teams.models import ApprovalDelegation
        delegation = ApprovalDelegation.objects.filter(id=delegation_id, org_id=org_id, is_deleted=False).first()
        if not delegation:
            raise ServiceError('Delegation record not found.', 404)

        can_revoke = (
            requesting_user.role in ['admin', 'hr'] or
            delegation.delegator_id == requesting_user.id
        )
        if not can_revoke:
            raise ServiceError('Only the delegator or an administrator can revoke this delegation.', 403)

        delegation.is_active = False
        delegation.updated_at = timezone.now()
        delegation.save(update_fields=['is_active', 'updated_at'])
        return delegation


class StandupService:
    """
    Pillar 3: 3-Question Rapid Async Check-in & Gemini Standup Rollup Engine.
    Handles task linking, blocker alerting, AI executive digests, and Brevo dispatch.
    """

    def get_user_recent_tasks(self, org_id, user):
        from projects.models import Task
        from django.utils import timezone
        import datetime

        today = timezone.now().date()
        # Monday looks back 3 days to Friday, otherwise yesterday
        lookback_days = 3 if today.weekday() == 0 else 1
        since_date = today - datetime.timedelta(days=lookback_days)

        completed_tasks = list(Task.objects.filter(
            org_id=org_id,
            assignee=user,
            status='done',
            is_deleted=False,
            updated_at__date__gte=since_date
        ).select_related('project').order_by('-updated_at')[:10])

        active_tasks = list(Task.objects.filter(
            org_id=org_id,
            assignee=user,
            is_deleted=False
        ).exclude(status='done').select_related('project').order_by('-priority', 'due_date')[:15])

        return {
            'completed_yesterday': [
                {
                    'id': str(t.id),
                    'title': t.title,
                    'project_name': t.project.name if t.project else 'General',
                    'priority': t.priority,
                    'completed_at': t.updated_at.isoformat()
                }
                for t in completed_tasks
            ],
            'assigned_today': [
                {
                    'id': str(t.id),
                    'title': t.title,
                    'project_name': t.project.name if t.project else 'General',
                    'priority': t.priority,
                    'status': t.status,
                    'due_date': t.due_date.isoformat() if t.due_date else None
                }
                for t in active_tasks
            ]
        }

    def submit_checkin(self, org_id, user, data):
        from teams.models import DailyStatus, Employee
        from django.utils import timezone

        employee = getattr(user, 'employee_profile', None)
        if not employee:
            raise ServiceError("Employee profile not found for this account.", 400)

        yesterday_accomplished = data.get('yesterday_accomplished', '').strip()
        yesterday_task_ids = data.get('yesterday_task_ids', [])
        today_focus = data.get('today_focus', '').strip()
        today_task_ids = data.get('today_task_ids', [])
        has_blockers = bool(data.get('has_blockers', False))
        blockers_description = data.get('blockers_description', '').strip()
        blocker_severity = data.get('blocker_severity', 'none')
        status_emoji = data.get('status_emoji') or ('🚨' if has_blockers else '🚀')

        # Compute summary status message
        if blockers_description and has_blockers:
            status_message = f"🚨 Blocked: {blockers_description[:100]}"
        elif today_focus:
            status_message = today_focus[:200]
        elif yesterday_accomplished:
            status_message = f"Done: {yesterday_accomplished[:200]}"
        else:
            status_message = data.get('status_message', 'Active in workspace').strip()

        status_entry = DailyStatus.objects.create(
            org_id=org_id,
            employee=employee,
            status_message=status_message,
            status_emoji=status_emoji,
            yesterday_accomplished=yesterday_accomplished,
            yesterday_task_ids=yesterday_task_ids,
            today_focus=today_focus,
            today_task_ids=today_task_ids,
            has_blockers=has_blockers,
            blockers_description=blockers_description,
            blocker_severity=blocker_severity
        )

        # Sync with Employee profile
        employee.status_message = status_message
        employee.status_emoji = status_emoji
        employee.status_updated_at = timezone.now()
        employee.save(update_fields=['status_message', 'status_emoji', 'status_updated_at'])

        # 🚨 Urgent Blocker Alert Relay
        if has_blockers and blocker_severity in ['medium', 'high', 'critical']:
            from core.notifications import send_notification
            approvers = []
            if employee.department and employee.department.head:
                if employee.department.head_id != user.id:
                    approvers.append(employee.department.head)
            if employee.manager and employee.manager.user and employee.manager.user_id != user.id:
                if employee.manager.user not in approvers:
                    approvers.append(employee.manager.user)

            dept_name = employee.department.name if employee.department else 'General'
            for approver in approvers:
                send_notification(
                    recipient=approver,
                    org=org_id,
                    type='SYSTEM',
                    title=f"🚨 Standup Blocker Alert: {employee.get_full_name()}",
                    message=f"{employee.get_full_name()} ({dept_name}) flagged a {blocker_severity.upper()} blocker: \"{blockers_description}\"",
                    target_url='/departments?tab=standup',
                    send_email=True,
                    email_subject=f"🚨 Blocker Alert ({blocker_severity.upper()}): {employee.get_full_name()}",
                    email_cta_text="Review Standup in CORE"
                )

        return status_entry

    def generate_standup_rollup(self, org_id, dept_id=None, requesting_user=None, dispatch_email=False):
        import os
        import json
        import httpx
        from teams.models import DailyStatus, Department, DepartmentStandupDigest
        from django.conf import settings
        from django.utils import timezone
        import datetime

        today = timezone.now().date()
        since = timezone.now() - datetime.timedelta(hours=28)

        qs = DailyStatus.objects.filter(
            org_id=org_id,
            created_at__gte=since
        ).select_related('employee__user', 'employee__department')

        department = None
        if dept_id and dept_id != 'all':
            department = Department.objects.filter(id=dept_id, org_id=org_id, is_deleted=False).select_related('head').first()
            if department:
                qs = qs.filter(employee__department_id=dept_id)

        statuses = list(qs.order_by('-created_at')[:40])
        total_checkins = len(statuses)
        active_blockers_count = sum(1 for s in statuses if s.has_blockers)

        if not statuses:
            dept_name = department.name if department else "All Departments"
            empty_markdown = f"### Daily Standup Digest: {dept_name} ({today})\n\nNo member check-ins have been recorded yet today. Encourage team members to submit their 3-question async updates!"
            return {
                'digest_date': today.isoformat(),
                'department_name': dept_name,
                'total_checkins': 0,
                'active_blockers_count': 0,
                'shipped_summary': [],
                'in_flight_summary': [],
                'blockers_summary': [],
                'team_mood': 'Steady',
                'full_markdown': empty_markdown,
                'email_dispatched': False
            }

        # Format prompt inputs
        member_lines = []
        for s in statuses:
            name = s.employee.get_full_name()
            dname = s.employee.department.name if s.employee.department else 'General'
            accomplished = s.yesterday_accomplished or s.status_message or 'None specified'
            focus = s.today_focus or s.status_message or 'Ongoing sprint tasks'
            blocker = f"YES ({s.blocker_severity}): {s.blockers_description}" if s.has_blockers else "None"
            member_lines.append(f"- Member: {name} ({dname})\n  Accomplished: {accomplished}\n  Focus Today: {focus}\n  Blocker: {blocker}")

        standups_corpus = "\n".join(member_lines)

        system_prompt = (
            "You are a Chief of Staff and Agile Engineering Director. "
            "Synthesize team daily standups into an executive 3-bullet rollup: "
            "1) Shipped: Merged code, finished releases, and resolved items. "
            "2) In Flight: Sprint priorities and critical tasks underway today. "
            "3) Active Blockers: Urgent impediments requiring leadership intervention. "
            "Respond strictly in JSON matching the specified schema."
        )

        prompt = f"""Synthesize these team standup updates into an executive daily digest:

{standups_corpus}

Output strictly valid JSON with this schema:
{{
  "shipped_summary": ["Crisp bullet 1", "Crisp bullet 2"],
  "in_flight_summary": ["Priority 1", "Priority 2"],
  "blockers_summary": ["Impediment 1", "Impediment 2"],
  "team_mood": "High Velocity" | "Steady" | "Blocked / At Risk",
  "executive_takeaway": "One-line executive takeaway for the department head"
}}
"""

        gemini_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
        groq_key = getattr(settings, 'GROQ_API_KEY', '') or os.getenv('GROQ_API_KEY', '')
        ai_data = None

        if groq_key:
            try:
                with httpx.Client(timeout=4.0) as client:
                    resp = client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {groq_key}"},
                        json={
                            "model": "openai/gpt-oss-120b",
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": prompt}
                            ],
                            "response_format": {"type": "json_object"},
                            "temperature": 0.2
                        }
                    )
                    if resp.status_code == 200:
                        from projects.services import _extract_json_payload
                        ai_data = _extract_json_payload(resp.json()['choices'][0]['message']['content'])
            except Exception:
                pass

        if not ai_data and gemini_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={gemini_key}"
                with httpx.Client(timeout=4.0) as client:
                    resp = client.post(
                        url,
                        json={
                            "contents": [{"parts": [{"text": f"{system_prompt}\n\n{prompt}"}]}],
                            "generationConfig": {"temperature": 0.2, "response_mime_type": "application/json"}
                        }
                    )
                    if resp.status_code == 200:
                        from projects.services import _extract_json_payload
                        ai_data = _extract_json_payload(resp.json()['candidates'][0]['content']['parts'][0]['text'])
            except Exception:
                pass

        # Fallback heuristic if external AI APIs are blocked
        if not ai_data or not isinstance(ai_data, dict):
            shipped = [s.yesterday_accomplished or s.status_message for s in statuses if s.yesterday_accomplished or s.status_message][:4]
            in_flight = [s.today_focus or s.status_message for s in statuses if s.today_focus][:4]
            blockers = [f"{s.employee.get_full_name()}: {s.blockers_description}" for s in statuses if s.has_blockers]
            mood = 'Blocked / At Risk' if blockers else ('High Velocity' if len(statuses) >= 3 else 'Steady')
            ai_data = {
                'shipped_summary': shipped or ['Team maintained active sprint velocity.'],
                'in_flight_summary': in_flight or ['Ongoing assigned sprint backlog tasks.'],
                'blockers_summary': blockers,
                'team_mood': mood,
                'executive_takeaway': f"{len(statuses)} team members active. {len(blockers)} blocker(s) requiring attention."
            }

        shipped = ai_data.get('shipped_summary', [])
        in_flight = ai_data.get('in_flight_summary', [])
        blockers = ai_data.get('blockers_summary', [])
        team_mood = ai_data.get('team_mood', 'Steady')
        takeaway = ai_data.get('executive_takeaway', '')

        dept_title = department.name if department else "All Departments"

        # Generate markdown format
        md_lines = [
            f"### 🎯 Department Standup Rollup: {dept_title}",
            f"**Date:** {today.strftime('%A, %B %d, %Y')} • **Check-ins:** {total_checkins} • **Team Mood:** {team_mood}",
            "",
            "#### 🎯 Shipped (Accomplishments & Merged Work)",
        ]
        for s in (shipped or ['No items reported as shipped yesterday.']):
            md_lines.append(f"- {s}")

        md_lines.extend(["", "#### 🚀 In Flight (Sprint Priorities Today)"])
        for f in (in_flight or ['Ongoing sprint backlog execution.']):
            md_lines.append(f"- {f}")

        md_lines.extend(["", "#### 🚨 Active Blockers (Immediate Intervention Required)"])
        if blockers:
            for b in blockers:
                md_lines.append(f"- **[BLOCKER]** {b}")
        else:
            md_lines.append("- *No critical impediments reported today.* 👍")

        if takeaway:
            md_lines.extend(["", f"> 💡 **Executive Takeaway:** {takeaway}"])

        full_markdown = "\n".join(md_lines)

        # Save to DepartmentStandupDigest
        digest = DepartmentStandupDigest.objects.create(
            org_id=org_id,
            department=department,
            digest_date=today,
            shipped_summary=shipped,
            in_flight_summary=in_flight,
            blockers_summary=blockers,
            full_markdown=full_markdown,
            team_mood=team_mood,
            active_blockers_count=active_blockers_count,
            total_checkins_count=total_checkins
        )

        email_dispatched = False
        target_head = None
        if department and department.head:
            target_head = department.head
        elif requesting_user and requesting_user.role in ['admin', 'manager', 'hr']:
            target_head = requesting_user

        # 📨 Brevo Notification Relay
        if dispatch_email and target_head:
            from core.email_dispatcher import send_robust_email

            shipped_html = "".join([f"<li style='margin-bottom:6px;'>{item}</li>" for item in (shipped or ['Steady execution'])])
            inflight_html = "".join([f"<li style='margin-bottom:6px;'>{item}</li>" for item in (in_flight or ['Ongoing sprint backlog'])])
            if blockers:
                blockers_html = "".join([f"<div style='background:#fef2f2;border-left:4px solid #ef4444;color:#991b1b;padding:8px 12px;border-radius:6px;margin-bottom:6px;font-size:12px;font-weight:700;'>🚨 {item}</div>" for item in blockers])
            else:
                blockers_html = "<div style='color:#10b981;font-size:12px;font-weight:600;'>No critical blockers reported today. 👍</div>"

            html_email = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
    .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
    .header {{ background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; color: #ffffff; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
    .header p {{ margin: 4px 0 0; font-size: 13px; color: #e0e7ff; }}
    .content {{ padding: 24px; }}
    .badge-bar {{ display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }}
    .section-title {{ font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin: 18px 0 8px 0; color: #0f172a; }}
    .btn-container {{ text-align: center; margin: 28px 0 16px 0; }}
    .btn {{ display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 13px; }}
    .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CORE Morning Standup Rollup</h1>
      <p>{dept_title} • {today.strftime('%B %d, %Y')}</p>
    </div>
    <div class="content">
      <div style="background:#f1f5f9;border-radius:10px;padding:12px;margin-bottom:18px;font-size:12px;">
        <strong>Check-ins:</strong> {total_checkins} members &bull; 
        <strong>Mood:</strong> {team_mood} &bull; 
        <strong>Active Blockers:</strong> {active_blockers_count}
      </div>

      <div class="section-title" style="color:#059669;">🎯 Shipped & Completed</div>
      <ul style="padding-left:18px;margin:0;font-size:13px;color:#334155;line-height:1.5;">
        {shipped_html}
      </ul>

      <div class="section-title" style="color:#0284c7;">🚀 In Flight Today</div>
      <ul style="padding-left:18px;margin:0;font-size:13px;color:#334155;line-height:1.5;">
        {inflight_html}
      </ul>

      <div class="section-title" style="color:#dc2626;">🚨 Active Blockers & Risks</div>
      <div>
        {blockers_html}
      </div>

      <div class="btn-container">
        <a href="https://core-workspace-xi.vercel.app/departments?tab=standup" class="btn">
          Open Standup Feed in CORE &rarr;
        </a>
      </div>
    </div>
    <div class="footer">
      Dispatched via Brevo Notification Relay &bull; CORE Workspace
    </div>
  </div>
</body>
</html>
"""
            success, msg = send_robust_email(
                to_email=target_head.email,
                subject=f"🎯 Morning Standup Rollup: {dept_title} ({today.strftime('%b %d')})",
                html_content=html_email
            )
            if success:
                email_dispatched = True
                digest.email_sent_to = target_head
                digest.email_sent_at = timezone.now()
                digest.save(update_fields=['email_sent_to', 'email_sent_at'])

        return {
            'id': str(digest.id),
            'digest_date': today.isoformat(),
            'department_name': dept_title,
            'total_checkins': total_checkins,
            'active_blockers_count': active_blockers_count,
            'shipped_summary': shipped,
            'in_flight_summary': in_flight,
            'blockers_summary': blockers,
            'team_mood': team_mood,
            'executive_takeaway': takeaway,
            'full_markdown': full_markdown,
            'email_dispatched': email_dispatched,
            'email_recipient': target_head.email if email_dispatched else None
        }

    def get_active_blockers(self, org_id, user, dept_id=None):
        from teams.models import DailyStatus
        from django.utils import timezone

        today = timezone.now().date()
        qs = DailyStatus.objects.filter(
            org_id=org_id,
            has_blockers=True,
            created_at__date=today
        ).select_related('employee__user', 'employee__department')

        if dept_id and dept_id != 'all':
            qs = qs.filter(employee__department_id=dept_id)
        elif user.role in ['employee', 'manager']:
            user_depts = []
            if hasattr(user, 'employee_profile') and user.employee_profile.department:
                user_depts.append(user.employee_profile.department_id)
            for d in user.headed_departments.filter(is_deleted=False):
                if d.id not in user_depts:
                    user_depts.append(d.id)
            if user_depts:
                qs = qs.filter(employee__department_id__in=user_depts)

        blockers = list(qs.order_by('-created_at')[:15])

        return {
            'has_active_blockers': len(blockers) > 0,
            'blocker_count': len(blockers),
            'blockers': [
                {
                    'id': str(b.id),
                    'employee_id': str(b.employee_id),
                    'employee_name': b.employee.get_full_name(),
                    'role': b.employee.user.role,
                    'department_id': str(b.employee.department_id) if b.employee.department_id else None,
                    'department_name': b.employee.department.name if b.employee.department else 'General',
                    'severity': b.blocker_severity,
                    'description': b.blockers_description or b.status_message,
                    'created_at': b.created_at.isoformat(),
                }
                for b in blockers
            ]
        }


class OneOnOneService:
    """
    Pillar 4: Recurring 1-on-1 Meeting Workspaces between Managers and Direct Reports.
    Shared agenda, discussion topics, and action items directly convertible into CORE Tasks.
    """

    def get_or_create_workspace(self, org_id, manager_id, employee_id, requesting_user=None):
        import uuid
        from teams.models import OneOnOneWorkspace, Employee
        from accounts.models import User
        from django.utils import timezone

        manager = User.objects.filter(id=manager_id, org_id=org_id).first()
        employee = User.objects.filter(id=employee_id, org_id=org_id).first()
        if not manager or not employee:
            raise ServiceError("Manager or Employee account not found in this organization.", 404)

        emp_profile = Employee.objects.filter(user=employee, org_id=org_id).select_related('department').first()
        dept = emp_profile.department if emp_profile else None

        workspace, created = OneOnOneWorkspace.objects.get_or_create(
            org_id=org_id,
            manager=manager,
            employee=employee,
            defaults={
                'department': dept,
                'cadence': 'biweekly',
                'day_of_week': 'Thursday',
                'time_of_day': '14:00',
                'shared_agenda': [
                    {'id': str(uuid.uuid4()), 'topic': 'Sprint highlights & bandwidth review', 'notes': '', 'is_completed': False},
                    {'id': str(uuid.uuid4()), 'topic': 'Active blockers, impediments & cross-team dependencies', 'notes': '', 'is_completed': False},
                    {'id': str(uuid.uuid4()), 'topic': 'Career trajectory, skills mastery & quarterly goals', 'notes': '', 'is_completed': False},
                ],
                'discussion_topics': [
                    {'id': str(uuid.uuid4()), 'title': 'Long-term product architecture alignment', 'talking_points': 'Discuss migration to asynchronous event-driven workers.', 'status': 'open'},
                ],
                'action_items': [],
                'room_code': f"1on1-{str(uuid.uuid4())[:8]}"
            }
        )
        return workspace

    def list_workspaces(self, org_id, user):
        from teams.models import OneOnOneWorkspace
        from django.db.models import Q

        qs = OneOnOneWorkspace.objects.filter(org_id=org_id, is_deleted=False)
        if user.role not in ['admin', 'hr']:
            qs = qs.filter(Q(manager=user) | Q(employee=user))

        return qs.select_related('manager', 'employee', 'department').order_by('-updated_at')

    def get_workspace(self, org_id, workspace_id, user):
        from teams.models import OneOnOneWorkspace
        ws = OneOnOneWorkspace.objects.filter(id=workspace_id, org_id=org_id, is_deleted=False).select_related('manager', 'employee', 'department').first()
        if not ws:
            raise ServiceError("1-on-1 Workspace not found.", 404)
        if user.role not in ['admin', 'hr'] and user.id not in [ws.manager_id, ws.employee_id]:
            raise ServiceError("You do not have permission to access this private 1-on-1 workspace.", 403)
        return ws

    def update_workspace(self, org_id, workspace_id, user, data):
        ws = self.get_workspace(org_id, workspace_id, user)
        from django.utils import timezone

        if 'cadence' in data:
            ws.cadence = data['cadence']
        if 'day_of_week' in data:
            ws.day_of_week = data['day_of_week']
        if 'time_of_day' in data:
            ws.time_of_day = data['time_of_day']
        if 'next_meeting_date' in data:
            ws.next_meeting_date = data['next_meeting_date'] or None
        if 'notes' in data:
            ws.notes = data['notes']
        if 'shared_agenda' in data:
            ws.shared_agenda = data['shared_agenda']
        if 'discussion_topics' in data:
            ws.discussion_topics = data['discussion_topics']
        if 'action_items' in data:
            ws.action_items = data['action_items']

        ws.last_synced_at = timezone.now()
        ws.save()
        return ws

    def convert_action_item_to_task(self, org_id, workspace_id, user, item_id, project_id=None):
        ws = self.get_workspace(org_id, workspace_id, user)
        from projects.models import Task, Project
        from core.notifications import send_notification
        from django.utils import timezone
        import datetime

        target_item = None
        for item in ws.action_items:
            if str(item.get('id')) == str(item_id):
                target_item = item
                break

        if not target_item:
            raise ServiceError("Action item not found in this workspace.", 404)

        if target_item.get('converted_to_task_id'):
            raise ServiceError("This action item has already been converted into a CORE task.", 400)

        # Resolve Project
        project = None
        if project_id:
            project = Project.objects.filter(id=project_id, org_id=org_id, is_deleted=False).first()
        if not project:
            project = Project.objects.filter(org_id=org_id, is_deleted=False).first()
        if not project:
            project = Project.objects.create(org_id=org_id, name="General Operations", key="OPS")

        assignee_id = target_item.get('assignee_id') or ws.employee_id
        from accounts.models import User
        assignee = User.objects.filter(id=assignee_id, org_id=org_id).first() or ws.employee

        due_date = None
        if target_item.get('due_date'):
            try:
                due_date = datetime.date.fromisoformat(str(target_item['due_date']))
            except Exception:
                due_date = timezone.now().date() + datetime.timedelta(days=7)
        else:
            due_date = timezone.now().date() + datetime.timedelta(days=7)

        task = Task.objects.create(
            org_id=org_id,
            project=project,
            title=target_item.get('title', '1-on-1 Action Item'),
            description=f"Action item established during 1-on-1 sync between {ws.manager.get_full_name()} and {ws.employee.get_full_name()}.\n\nContext: {target_item.get('notes', 'Direct 1-on-1 deliverable.')}",
            assignee=assignee,
            status='todo',
            priority='high',
            due_date=due_date
        )

        target_item['converted_to_task_id'] = str(task.id)
        target_item['converted_task_title'] = task.title
        ws.save(update_fields=['action_items', 'updated_at'])

        # Notify assignee
        send_notification(
            recipient=assignee,
            org=org_id,
            actor=user,
            type='SYSTEM',
            title="1-on-1 Action Item Assigned",
            message=f"'{task.title}' was converted from your 1-on-1 workspace into a CORE Task in '{project.name}'.",
            target_url='/projects',
            send_email=True,
            email_subject=f"1-on-1 Task Assigned: {task.title}",
            email_cta_text="View in CORE Projects"
        )

        return {
            'task_id': str(task.id),
            'title': task.title,
            'project_name': project.name,
            'assignee_name': assignee.get_full_name(),
            'due_date': task.due_date.isoformat() if task.due_date else None,
            'item_id': str(item_id)
        }

    def launch_meeting_room(self, org_id, workspace_id, user):
        ws = self.get_workspace(org_id, workspace_id, user)
        from meetings.models import Meeting
        import uuid

        room_code = ws.room_code or f"1on1-{str(uuid.uuid4())[:8]}"
        meeting, created = Meeting.objects.get_or_create(
            org_id=org_id,
            room_code=room_code,
            defaults={
                'title': f"1-on-1: {ws.manager.get_full_name()} & {ws.employee.get_full_name()}",
                'description': f"Recurring 1-on-1 private sync between {ws.manager.get_full_name()} and {ws.employee.get_full_name()}.",
                'host': user,
                'template_type': 'one_on_one',
                'status': 'scheduled',
                'is_instant': True,
                'allowed_roles': 'admin,hr,manager,employee',
                'agenda_items': [item.get('topic') for item in ws.shared_agenda if isinstance(item, dict) and item.get('topic')]
            }
        )

        if not ws.room_code:
            ws.room_code = room_code
            ws.save(update_fields=['room_code'])

        return {
            'room_code': meeting.room_code,
            'meeting_id': str(meeting.id),
            'title': meeting.title,
            'url': f"/meeting-room?room={meeting.room_code}"
        }


class SkillMatrixService:
    """
    Pillar 4: Department Skill Matrix & Talent Directory.
    Instant natural queries & tag searching ("Marketing SQL", "Engineering Kubernetes").
    """

    POPULAR_SKILLS = [
        'React', 'Django', 'Python', 'AWS', 'PostgreSQL', 'Figma',
        'Cold Outreach', 'Kubernetes', 'Docker', 'TypeScript', 'SQL',
        'Product Design', 'Go', 'GraphQL', 'Next.js', 'Salesforce'
    ]

    def get_skill_matrix(self, org_id, query='', department_id=None, skills=None):
        from teams.models import Employee, Department
        from django.db.models import Q
        import re

        query = (query or '').strip().lower()
        requested_skills = [s.strip().lower() for s in (skills.split(',') if skills else []) if s.strip()]

        all_depts = list(Department.objects.filter(org_id=org_id, is_deleted=False).order_by('name'))
        dept_map = {str(d.id): d for d in all_depts}

        emp_qs = Employee.objects.filter(
            org_id=org_id,
            is_deleted=False,
            user__is_deleted=False,
            user__is_active=True
        ).select_related('user', 'department', 'manager__user').prefetch_related('departments')

        if department_id and department_id != 'all':
            emp_qs = emp_qs.filter(Q(department_id=department_id) | Q(departments__id=department_id)).distinct()

        employees = list(emp_qs)

        # 1. Aggregate all skills across organization with counts
        skill_counts = {}
        for emp in employees:
            e_skills = emp.skills if isinstance(emp.skills, list) else []
            for s in e_skills:
                cleaned = str(s).strip()
                if cleaned:
                    norm = cleaned.title()
                    skill_counts[norm] = skill_counts.get(norm, 0) + 1

        all_skills_list = sorted([
            {'name': name, 'count': count} for name, count in skill_counts.items()
        ], key=lambda x: (-x['count'], x['name']))

        # 2. Match natural query: check if query specifies a department name (e.g. "Marketing SQL")
        detected_dept_id = None
        cleaned_query = query
        for d in all_depts:
            if d.name.lower() in query:
                detected_dept_id = str(d.id)
                # Remove department name from query string to isolate skill keywords
                cleaned_query = re.sub(re.escape(d.name.lower()), '', cleaned_query).strip()
                break

        # Extract words from query
        query_tokens = [w for w in re.split(r'[\s,]+', cleaned_query) if w]

        matched_members = []
        for emp in employees:
            e_skills = [str(s).strip() for s in (emp.skills if isinstance(emp.skills, list) else [])]
            e_skills_lower = [s.lower() for s in e_skills]
            dept_name = emp.department.name if emp.department else 'General'

            # Department filter match
            if detected_dept_id:
                if str(emp.department_id) != detected_dept_id and not any(str(d.id) == detected_dept_id for d in emp.departments.all()):
                    continue

            # Skill matching score
            matching_skills = []
            score = 0

            # Direct skills filter match
            if requested_skills:
                for req in requested_skills:
                    for idx, s_low in enumerate(e_skills_lower):
                        if req in s_low or s_low in req:
                            matching_skills.append(e_skills[idx])
                            score += 10

            # Natural query token match
            if query_tokens:
                name_lower = emp.get_full_name().lower()
                role_lower = emp.user.role.lower()
                dept_lower = dept_name.lower()

                for token in query_tokens:
                    token_matched = False
                    for idx, s_low in enumerate(e_skills_lower):
                        if token in s_low or s_low in token:
                            matching_skills.append(e_skills[idx])
                            score += 15
                            token_matched = True

                    if token in name_lower:
                        score += 5
                        token_matched = True
                    if token in role_lower:
                        score += 5
                        token_matched = True
                    if token in dept_lower:
                        score += 5
                        token_matched = True

            # If no filter or query provided, score based on total skills
            if not requested_skills and not query_tokens:
                score = len(e_skills)

            # Only include if score > 0 when filters/queries exist, or all when browsing
            if (not requested_skills and not query_tokens) or score > 0:
                matched_members.append({
                    'id': str(emp.id),
                    'user_id': str(emp.user_id),
                    'email': emp.user.email,
                    'full_name': emp.get_full_name(),
                    'role': emp.user.role,
                    'department_id': str(emp.department_id) if emp.department_id else None,
                    'department_name': dept_name,
                    'manager_name': emp.manager.get_full_name() if emp.manager else None,
                    'skills': e_skills,
                    'matching_skills': list(dict.fromkeys(matching_skills)),
                    'match_score': score,
                    'is_online': emp.user.is_online,
                    'last_seen_display': 'Online now' if emp.user.is_online else 'Recently active'
                })

        # Sort matched members by match score descending
        matched_members.sort(key=lambda m: (-m['match_score'], m['full_name']))

        return {
            'query': query,
            'all_skills': all_skills_list,
            'popular_skills': self.POPULAR_SKILLS,
            'total_matches': len(matched_members),
            'matched_members': matched_members,
            'detected_department': dept_map[detected_dept_id].name if detected_dept_id and detected_dept_id in dept_map else None
        }

    def update_employee_skills(self, org_id, employee_id, skills_list):
        from teams.models import Employee
        emp = Employee.objects.filter(id=employee_id, org_id=org_id, is_deleted=False).first()
        if not emp:
            raise ServiceError("Employee not found.", 404)

        clean_skills = []
        for s in skills_list:
            cleaned = str(s).strip()
            if cleaned and cleaned not in clean_skills:
                clean_skills.append(cleaned)

        emp.skills = clean_skills
        emp.save(update_fields=['skills', 'updated_at'])
        return emp


class DepartmentRunbookService:
    """
    Pillar 4: Automated Departmental Onboarding / Offboarding Runbook.
    Checklist template for new hires & departures with 1-click trigger.
    """

    DEFAULT_ONBOARDING_CHECKLIST = [
        {
            'id': 1,
            'phase': 'Day 1',
            'title': 'Assign equipment, laptop provisioning, and departmental documentation overview',
            'assignee_role': 'manager',
            'required': True
        },
        {
            'id': 2,
            'phase': 'Day 3',
            'title': 'Schedule 1-on-1 intro meeting with Department Head & Team Lead',
            'assignee_role': 'employee',
            'required': True
        },
        {
            'id': 3,
            'phase': 'Week 1',
            'title': 'First beginner sprint task assignment & local development pairing session',
            'assignee_role': 'manager',
            'required': True
        },
        {
            'id': 4,
            'phase': 'Day 30',
            'title': '30-Day Alignment & Initial Performance Expectations Check-in',
            'assignee_role': 'manager',
            'required': False
        }
    ]

    DEFAULT_OFFBOARDING_CHECKLIST = [
        {
            'id': 1,
            'phase': 'Day 1',
            'title': 'Handover active deliverables, reassign open CORE tasks, and transfer repository write access',
            'assignee_role': 'manager',
            'required': True
        },
        {
            'id': 2,
            'phase': 'Day 2',
            'title': 'Revoke system credentials, Google Workspace, GitHub organization, and AWS console keys',
            'assignee_role': 'admin',
            'required': True
        },
        {
            'id': 3,
            'phase': 'Exit Day',
            'title': 'Exit 1-on-1 interview with HR & Department Head and equipment surrender receipt',
            'assignee_role': 'hr',
            'required': True
        }
    ]

    def get_or_create_default_runbook(self, org_id, department_id, runbook_type='onboarding'):
        from teams.models import DepartmentRunbook, Department
        dept = Department.objects.filter(id=department_id, org_id=org_id, is_deleted=False).first()
        if not dept:
            raise ServiceError("Department not found.", 404)

        rb = DepartmentRunbook.objects.filter(org_id=org_id, department=dept, type=runbook_type, is_deleted=False).first()
        if not rb:
            steps = self.DEFAULT_ONBOARDING_CHECKLIST if runbook_type == 'onboarding' else self.DEFAULT_OFFBOARDING_CHECKLIST
            title = f"Standard {dept.name} {runbook_type.capitalize()} Runbook"
            rb = DepartmentRunbook.objects.create(
                org_id=org_id,
                department=dept,
                type=runbook_type,
                title=title,
                is_default=True,
                checklist_steps=steps,
                description=f"Automated departmental {runbook_type} roadmap for {dept.name}."
            )
        return rb

    def trigger_runbook(self, org_id, employee_id, runbook_type='onboarding', actor_user=None):
        from teams.models import Employee, EmployeeRunbookExecution, DepartmentRunbook
        from core.notifications import send_notification
        from django.utils import timezone

        employee = Employee.objects.filter(id=employee_id, org_id=org_id, is_deleted=False).select_related('user', 'department', 'manager__user').first()
        if not employee:
            raise ServiceError("Employee not found.", 404)

        dept = employee.department
        if not dept:
            raise ServiceError("Employee must belong to a department to trigger a runbook.", 400)

        template = self.get_or_create_default_runbook(org_id, dept.id, runbook_type=runbook_type)

        # Initialize execution steps with completion flags
        execution_steps = []
        for step in template.checklist_steps:
            execution_steps.append({
                'id': step.get('id'),
                'phase': step.get('phase', 'Phase 1'),
                'title': step.get('title'),
                'is_completed': False,
                'completed_at': None,
                'completed_by': None,
                'converted_task_id': None,
                'assignee_role': step.get('assignee_role', 'manager')
            })

        execution = EmployeeRunbookExecution.objects.create(
            org_id=org_id,
            employee=employee,
            department=dept,
            runbook_template=template,
            type=runbook_type,
            status='active',
            steps=execution_steps
        )

        # 📨 Notification Relay
        recipients = [employee.user]
        if employee.manager and employee.manager.user and employee.manager.user_id != actor_user.id:
            recipients.append(employee.manager.user)
        if dept.head and dept.head_id not in [employee.user_id, getattr(actor_user, 'id', None)]:
            recipients.append(dept.head)

        for rec in set(recipients):
            send_notification(
                recipient=rec,
                org=org_id,
                actor=actor_user,
                type='SYSTEM',
                title=f"{runbook_type.capitalize()} Runbook Activated",
                message=f"{template.title} has been initialized for {employee.get_full_name()} in {dept.name}.",
                target_url='/departments?tab=runbooks',
                send_email=True,
                email_subject=f"{dept.name}: {runbook_type.capitalize()} Runbook Initiated for {employee.get_full_name()}",
                email_cta_text="Review Runbook in CORE"
            )

        return execution

    def list_executions(self, org_id, employee_id=None, department_id=None, runbook_type=None):
        from teams.models import EmployeeRunbookExecution
        qs = EmployeeRunbookExecution.objects.filter(org_id=org_id, is_deleted=False)
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if department_id and department_id != 'all':
            qs = qs.filter(department_id=department_id)
        if runbook_type:
            qs = qs.filter(type=runbook_type)
        return qs.select_related('employee__user', 'department', 'runbook_template').order_by('-started_at')

    def toggle_step(self, org_id, execution_id, step_id, is_completed, actor_user):
        from teams.models import EmployeeRunbookExecution
        from django.utils import timezone

        execution = EmployeeRunbookExecution.objects.filter(id=execution_id, org_id=org_id, is_deleted=False).select_related('employee__user', 'department').first()
        if not execution:
            raise ServiceError("Runbook execution not found.", 404)

        steps = list(execution.steps)
        found = False
        all_done = True

        for s in steps:
            if str(s.get('id')) == str(step_id):
                s['is_completed'] = is_completed
                s['completed_at'] = timezone.now().isoformat() if is_completed else None
                s['completed_by'] = actor_user.get_full_name() if is_completed else None
                found = True
            if not s.get('is_completed'):
                all_done = False

        if not found:
            raise ServiceError("Step ID not found in this runbook.", 404)

        execution.steps = steps
        if all_done:
            execution.status = 'completed'
            execution.completed_at = timezone.now()
        else:
            execution.status = 'active'
            execution.completed_at = None

        execution.save(update_fields=['steps', 'status', 'completed_at', 'updated_at'])
        return execution


