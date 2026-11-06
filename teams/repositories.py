from .models import Department, Employee, LeaveRequest, PerformanceReview, PublicHoliday
from django.utils import timezone


class DepartmentRepository:

    def list_by_org(self, org_id):
        return Department.objects.filter(
            org_id=org_id,
            is_deleted=False
        ).select_related('head', 'parent_department').order_by('name')

    def get_by_id(self, dept_id, org_id):
        return Department.objects.filter(
            id=dept_id,
            org_id=org_id,
            is_deleted=False
        ).select_related('head', 'parent_department').first()

    def create(self, org_id, name, parent_department_id=None, head_id=None):
        return Department.objects.create(
            org_id=org_id,
            name=name,
            parent_department_id=parent_department_id,
            head_id=head_id,
        )

    def update(self, dept_id, org_id, **fields):
        Department.objects.filter(id=dept_id, org_id=org_id).update(
            updated_at=timezone.now(), **fields
        )
        return self.get_by_id(dept_id, org_id)

    def soft_delete(self, dept_id, org_id):
        dept = self.get_by_id(dept_id, org_id)
        if dept:
            dept.soft_delete()
        return dept

    def count_by_org(self, org_id):
        return Department.objects.filter(org_id=org_id, is_deleted=False).count()


class EmployeeRepository:

    def list_by_org(self, org_id, filters=None):
        qs = Employee.objects.filter(
            org_id=org_id,
            is_deleted=False
        ).select_related(
            'user', 'department', 'manager__user'
        ).order_by('user__first_name', 'user__last_name')

        if filters:
            if filters.get('department'):
                qs = qs.filter(department_id=filters['department'])
            if filters.get('status'):
                qs = qs.filter(employment_status=filters['status'])
            if filters.get('search'):
                q = filters['search']
                from django.db.models import Q
                qs = qs.filter(
                    Q(user__first_name__icontains=q) |
                    Q(user__last_name__icontains=q) |
                    Q(user__email__icontains=q)
                )

        return qs

    def list_by_manager(self, manager_employee_id, org_id, filters=None):
        # Returns direct reports only
        qs = Employee.objects.filter(
            manager_id=manager_employee_id,
            org_id=org_id,
            is_deleted=False
        ).select_related('user', 'department', 'manager__user')

        if filters:
            if filters.get('search'):
                q = filters['search']
                from django.db.models import Q
                qs = qs.filter(
                    Q(user__first_name__icontains=q) |
                    Q(user__last_name__icontains=q)
                )

        return qs

    def get_by_id(self, employee_id, org_id):
        return Employee.objects.filter(
            id=employee_id,
            org_id=org_id,
            is_deleted=False
        ).select_related(
            'user', 'department', 'manager__user'
        ).prefetch_related(
            'performance_reviews__reviewer',
            'leave_requests'
        ).first()

    def get_by_user_id(self, user_id, org_id):
        return Employee.objects.filter(
            user_id=user_id,
            org_id=org_id,
            is_deleted=False
        ).select_related('user', 'department', 'manager__user').first()

    def create(self, org_id, user, department, manager, hire_date, employment_status):
        emp, created = Employee.objects.get_or_create(
            user=user,
            defaults={
                'org_id': org_id,
                'department': department,
                'manager': manager,
                'hire_date': hire_date,
                'employment_status': employment_status,
                'leave_balance': {'annual': 20, 'sick': 10, 'unpaid': 0},
            }
        )
        if not created:
            emp.department = department
            emp.manager = manager
            emp.hire_date = hire_date
            emp.employment_status = employment_status
            emp.save(update_fields=['department', 'manager', 'hire_date', 'employment_status'])
        return emp

    def update(self, employee_id, org_id, **fields):
        Employee.objects.filter(id=employee_id, org_id=org_id).update(
            updated_at=timezone.now(), **fields
        )
        return self.get_by_id(employee_id, org_id)

    def soft_delete(self, employee_id, org_id):
        emp = self.get_by_id(employee_id, org_id)
        if emp:
            emp.soft_delete()
        return emp

    def count_by_org(self, org_id):
        return Employee.objects.filter(
            org_id=org_id,
            is_deleted=False,
            employment_status='active'
        ).count()


class LeaveRepository:

    def list_by_org(self, org_id, filters=None):
        qs = LeaveRequest.objects.filter(
            org_id=org_id,
            is_deleted=False
        ).select_related(
            'employee__user', 'approved_by'
        ).order_by('-created_at')

        if filters:
            if filters.get('status'):
                qs = qs.filter(status=filters['status'])
            if filters.get('employee'):
                qs = qs.filter(employee_id=filters['employee'])

        return qs

    def list_by_manager_team(self, manager_employee_id, org_id, filters=None):
        # Returns leave requests from direct reports only
        qs = LeaveRequest.objects.filter(
            org_id=org_id,
            is_deleted=False,
            employee__manager_id=manager_employee_id,
            employee__is_deleted=False,
        ).select_related('employee__user', 'approved_by')

        if filters and filters.get('status'):
            qs = qs.filter(status=filters['status'])

        return qs.order_by('-created_at')

    def list_calendar_events(self, org_id, start_date, end_date, department_id=None):
        qs = LeaveRequest.objects.filter(
            org_id=org_id,
            is_deleted=False,
            status='approved',
            start_date__lte=end_date,
            end_date__gte=start_date,
        ).select_related('employee__user', 'employee__department')

        if department_id:
            qs = qs.filter(employee__department_id=department_id)

        return qs.order_by('start_date')

    def get_by_id(self, leave_id, org_id):
        return LeaveRequest.objects.filter(
            id=leave_id,
            org_id=org_id,
            is_deleted=False
        ).select_related('employee__user', 'employee__department', 'approved_by').first()

    def create(self, org_id, employee, leave_type, start_date, end_date, notes,
               is_half_day=False, half_day_period=None):
        return LeaveRequest.objects.create(
            org_id=org_id,
            employee=employee,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date,
            notes=notes,
            is_half_day=is_half_day,
            half_day_period=half_day_period,
        )

    def update_status(self, leave_id, org_id, status, approved_by=None, rejection_reason=''):
        updates = {
            'status': status,
            'updated_at': timezone.now(),
            'rejection_reason': rejection_reason
        }
        if approved_by:
            updates['approved_by'] = approved_by
            updates['approved_at'] = timezone.now()
        LeaveRequest.objects.filter(id=leave_id, org_id=org_id).update(**updates)
        return self.get_by_id(leave_id, org_id)


class PublicHolidayRepository:

    def list_by_org(self, org_id, year=None):
        qs = PublicHoliday.objects.filter(org_id=org_id, is_deleted=False)
        if year:
            qs = qs.filter(date__year=year)
        return qs.order_by('date')

    def get_by_id(self, holiday_id, org_id):
        return PublicHoliday.objects.filter(id=holiday_id, org_id=org_id, is_deleted=False).first()

    def create(self, org_id, name, date, description=''):
        return PublicHoliday.objects.create(
            org_id=org_id,
            name=name,
            date=date,
            description=description,
        )

    def soft_delete(self, holiday_id, org_id):
        holiday = self.get_by_id(holiday_id, org_id)
        if holiday:
            holiday.soft_delete()
        return holiday


class ReviewRepository:

    def list_by_employee(self, employee_id, org_id):
        return PerformanceReview.objects.filter(
            employee_id=employee_id,
            org_id=org_id,
            is_deleted=False
        ).select_related('reviewer').order_by('-period_end')

    def create(self, org_id, employee, reviewer, period_start, period_end, score, notes):
        return PerformanceReview.objects.create(
            org_id=org_id,
            employee=employee,
            reviewer=reviewer,
            period_start=period_start,
            period_end=period_end,
            score=score,
            notes=notes,
        )
