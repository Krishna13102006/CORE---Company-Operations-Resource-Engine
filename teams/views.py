from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from core.permissions import IsEmployee, IsManager, IsHR
from core.exceptions import ServiceError
from core.pagination import StandardPagination
from core.audit import log_action
from .models import Department, Employee
from .services import (
    DepartmentService, EmployeeService, LeaveService, ReviewService, PublicHolidayService, DelegationService, StandupService,
    OneOnOneService, SkillMatrixService, DepartmentRunbookService
)
from .serializers import (
    DepartmentSerializer, DepartmentCreateSerializer,
    EmployeeSerializer, EmployeeCreateSerializer, EmployeeUpdateSerializer,
    LeaveRequestSerializer, LeaveRequestCreateSerializer, LeaveStatusUpdateSerializer,
    LeaveRejectSerializer, PublicHolidaySerializer, PublicHolidayCreateSerializer,
    LeaveBalanceAdjustSerializer, LeaveAIDraftSerializer,
    PerformanceReviewSerializer, PerformanceReviewCreateSerializer,
    ApprovalDelegationSerializer, ApprovalDelegationCreateSerializer,
    OneOnOneWorkspaceSerializer, DepartmentRunbookSerializer, EmployeeRunbookExecutionSerializer,
)

dept_service       = DepartmentService()
employee_service   = EmployeeService()
leave_service      = LeaveService()
review_service     = ReviewService()
holiday_service    = PublicHolidayService()
delegation_service = DelegationService()
standup_service    = StandupService()
one_on_one_service = OneOnOneService()
skill_service      = SkillMatrixService()
runbook_service    = DepartmentRunbookService()


# ── Departments ───────────────────────────────────────────────

class DepartmentListView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        depts = dept_service.list_departments(request.org_id)
        return Response(DepartmentSerializer(depts, many=True).data)

    def post(self, request):
        if request.user.role not in ['admin', 'hr', 'manager']:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = DepartmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            with transaction.atomic():
                dept = dept_service.create_department(
                    org_id=request.org_id,
                    user=request.user,
                    name=d['name'],
                    parent_department_id=d.get('parent_department_id'),
                    head_id=d.get('head_id'),
                )

                member_ids = d.get('member_ids', [])
                if member_ids:
                    from django.db.models import Q
                    emps = Employee.objects.filter(
                        org_id=request.org_id
                    ).filter(
                        Q(user_id__in=member_ids) | Q(id__in=member_ids)
                    )
                    for emp in emps:
                        emp.departments.add(dept)
                        if not emp.department_id:
                            emp.department = dept
                            emp.save(update_fields=['department'])

                log_action(
                    org_id=request.org_id,
                    user=request.user,
                    action='create_department',
                    target_type='department',
                    target_id=dept.id,
                    detail=f'Created department: {dept.name} with {len(member_ids)} initial members'
                )

            return Response(
                DepartmentSerializer(dept).data,
                status=status.HTTP_201_CREATED
            )
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class DepartmentDetailView(APIView):
    permission_classes = [IsManager]

    def delete(self, request, dept_id):
        try:
            dept_service.delete_department(str(dept_id), request.org_id, request.user)
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='delete_department',
                target_type='department',
                target_id=dept_id,
                detail=f'Deleted department ID: {dept_id}'
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def patch(self, request, dept_id):
        from teams.serializers import DepartmentSerializer
        name = request.data.get('name')
        parent_department_id = request.data.get('parent_department_id')
        head_id = request.data.get('head_id')
        member_ids = request.data.get('member_ids')

        try:
            with transaction.atomic():
                dept = dept_service.update_department(
                    dept_id=str(dept_id),
                    org_id=request.org_id,
                    user=request.user,
                    name=name,
                    parent_department_id=parent_department_id,
                    head_id=head_id
                )

                if member_ids is not None:
                    from django.db.models import Q
                    # 1. Assign selected members to this department
                    target_emps = list(Employee.objects.filter(
                        org_id=request.org_id
                    ).filter(
                        Q(user_id__in=member_ids) | Q(id__in=member_ids)
                    ))
                    target_emp_ids = {e.id for e in target_emps}

                    for emp in target_emps:
                        emp.departments.add(dept)
                        if not emp.department_id:
                            emp.department = dept
                            emp.save(update_fields=['department'])

                    # 2. Unassign employees currently in this department who are excluded from member_ids
                    # (Preserve any memberships they have in other departments)
                    current_dept_emps = Employee.objects.filter(
                        org_id=request.org_id
                    ).filter(
                        Q(departments=dept) | Q(department=dept)
                    ).exclude(
                        id__in=target_emp_ids
                    ).distinct()

                    for emp in current_dept_emps:
                        emp.departments.remove(dept)
                        if emp.department_id == dept.id:
                            remaining = emp.departments.exclude(id=dept.id).first()
                            emp.department = remaining
                            emp.save(update_fields=['department'])

                log_action(
                    org_id=request.org_id,
                    user=request.user,
                    action='update_department',
                    target_type='department',
                    target_id=dept.id,
                    detail=f'Updated department: {dept.name}' + (f' with {len(member_ids)} assigned members' if member_ids is not None else '')
                )
            return Response(DepartmentSerializer(dept).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class DepartmentCommandCenterView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        dept_id = request.query_params.get('dept_id')
        try:
            # Instantly record requesting user presence
            if request.user and request.user.is_authenticated:
                from django.utils import timezone
                now = timezone.now()
                from accounts.models import User
                User.objects.filter(id=request.user.id).update(last_seen_at=now)
                request.user.last_seen_at = now

            data = dept_service.get_command_center_metrics(
                request.org_id,
                dept_id=dept_id,
                current_user_id=request.user.id if (request.user and request.user.is_authenticated) else None
            )
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Pillar 2: Approval Delegations (Out-of-Office Proxies) ────

class ApprovalDelegationListCreateView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        active_only = request.query_params.get('active_only', 'false').lower() == 'true'
        delegations = delegation_service.list_delegations(
            org_id=request.org_id,
            requesting_user=request.user,
            active_only=active_only
        )
        return Response(ApprovalDelegationSerializer(delegations, many=True).data)

    def post(self, request):
        serializer = ApprovalDelegationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            delegation = delegation_service.create_delegation(
                org_id=request.org_id,
                requesting_user=request.user,
                delegatee_id=d['delegatee_id'],
                delegation_type=d['delegation_type'],
                start_date=d['start_date'],
                end_date=d['end_date'],
                notes=d.get('notes', '')
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='create_approval_delegation',
                target_type='approval_delegation',
                target_id=delegation.id,
                detail=f'Delegated approval authority ({delegation.delegation_type}) to {delegation.delegatee.email}'
            )
            return Response(ApprovalDelegationSerializer(delegation).data, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ApprovalDelegationDetailView(APIView):
    permission_classes = [IsEmployee]

    def delete(self, request, delegation_id):
        try:
            delegation = delegation_service.revoke_delegation(
                delegation_id=delegation_id,
                org_id=request.org_id,
                requesting_user=request.user
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='revoke_approval_delegation',
                target_type='approval_delegation',
                target_id=delegation.id,
                detail=f'Revoked approval delegation to {delegation.delegatee.email}'
            )
            return Response(ApprovalDelegationSerializer(delegation).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ApprovalDelegationRevokeView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, delegation_id):
        try:
            delegation = delegation_service.revoke_delegation(
                delegation_id=delegation_id,
                org_id=request.org_id,
                requesting_user=request.user
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='revoke_approval_delegation',
                target_type='approval_delegation',
                target_id=delegation.id,
                detail=f'Revoked approval delegation to {delegation.delegatee.email}'
            )
            return Response(ApprovalDelegationSerializer(delegation).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


# ── Employees ─────────────────────────────────────────────────

class EmployeeListView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        filters = {
            'department': request.query_params.get('department'),
            'status':     request.query_params.get('status'),
            'search':     request.query_params.get('search'),
        }
        filters = {k: v for k, v in filters.items() if v}
        employees = employee_service.list_employees(
            request.org_id, request.user, filters
        )
        if request.query_params.get('all') == 'true':
            return Response(EmployeeSerializer(employees, many=True).data)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(employees, request)
        return paginator.get_paginated_response(
            EmployeeSerializer(page, many=True).data
        )

    def post(self, request):
        if request.user.role not in ['admin', 'hr', 'manager']:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = EmployeeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            emp = employee_service.create_employee(
                org_id=request.org_id,
                requesting_user=request.user,
                email=d['email'],
                password=d['password'],
                first_name=d['first_name'],
                last_name=d['last_name'],
                role=d['role'],
                department_id=d.get('department_id'),
                manager_id=d.get('manager_id'),
                hire_date=d.get('hire_date'),
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='create_employee',
                target_type='employee',
                target_id=emp.id,
                detail=f'Created employee: {emp.get_full_name()}'
            )
            return Response(
                EmployeeSerializer(emp).data,
                status=status.HTTP_201_CREATED
            )
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class EmployeeDetailView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, employee_id):
        try:
            emp, tasks = employee_service.get_employee_with_tasks(
                str(employee_id), request.org_id, request.user
            )
            data = EmployeeSerializer(emp).data
            # Add task summary inline
            data['active_tasks'] = [
                {
                    'id':           str(t.id),
                    'title':        t.title,
                    'status':       t.status,
                    'priority':     t.priority,
                    'project_name': t.project.name if t.project else '',
                    'due_date':     str(t.due_date) if t.due_date else None,
                }
                for t in tasks if t.status != 'done'
            ]
            if request.user.role in ['admin', 'hr', 'manager'] or emp.user_id == request.user.id:
                data['reviews'] = PerformanceReviewSerializer(
                    emp.performance_reviews.filter(is_deleted=False),
                    many=True
                ).data
            else:
                data['reviews'] = []
            return Response(data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def patch(self, request, employee_id):
        from teams.models import Employee
        try:
            emp_obj = Employee.objects.get(id=employee_id, org_id=request.org_id)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        is_self = str(emp_obj.user_id) == str(request.user.id)
        if not is_self and request.user.role != 'admin':
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = EmployeeUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            emp = employee_service.update_employee(
                employee_id=str(employee_id),
                org_id=request.org_id,
                requesting_user=request.user,
                department_id=d.get('department_id'),
                department_ids=d.get('department_ids'),
                manager_id=d.get('manager_id'),
                employment_status=d.get('employment_status'),
                hire_date=d.get('hire_date'),
                leave_balance=d.get('leave_balance'),
                status_message=d.get('status_message'),
                status_emoji=d.get('status_emoji'),
                skills=d.get('skills'),
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='update_employee',
                target_type='employee',
                target_id=employee_id,
                detail=f'Updated employee: {emp.get_full_name()}'
            )
            return Response(EmployeeSerializer(emp).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


# ── Leave ─────────────────────────────────────────────────────

class LeaveMySummaryView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        try:
            summary = leave_service.get_my_leave_summary(request.org_id, request.user)
            return Response(summary)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class LeaveListView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        filters = {
            'status':   request.query_params.get('status'),
            'employee': request.query_params.get('employee'),
        }
        filters  = {k: v for k, v in filters.items() if v}
        requests = leave_service.list_leave_requests(
            request.org_id, request.user, filters
        )
        if request.query_params.get('all') == 'true':
            return Response(LeaveRequestSerializer(requests, many=True).data)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(requests, request)
        return paginator.get_paginated_response(
            LeaveRequestSerializer(page, many=True).data
        )

    def post(self, request):
        serializer = LeaveRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            leave = leave_service.create_leave_request(
                org_id=request.org_id,
                requesting_user=request.user,
                leave_type=d['leave_type'],
                start_date=d['start_date'],
                end_date=d['end_date'],
                notes=d.get('notes', ''),
                is_half_day=d.get('is_half_day', False),
                half_day_period=d.get('half_day_period'),
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='create_leave_request',
                target_type='leave_request',
                target_id=leave.id,
                detail=f'{leave.employee.get_full_name()} requested {leave.leave_type} leave'
            )
            return Response(
                LeaveRequestSerializer(leave).data,
                status=status.HTTP_201_CREATED
            )
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class LeaveDetailView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, leave_id):
        from .models import LeaveRequest
        try:
            leave = LeaveRequest.objects.get(id=leave_id, org_id=request.org_id, is_deleted=False)
            return Response(LeaveRequestSerializer(leave).data)
        except LeaveRequest.DoesNotExist:
            return Response({'error': 'Leave request not found.'}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, leave_id):
        if request.user.role not in ['admin', 'hr', 'manager']:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = LeaveStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            leave = leave_service.update_leave_status(
                leave_id=str(leave_id),
                org_id=request.org_id,
                requesting_user=request.user,
                new_status=serializer.validated_data['status'],
                rejection_reason=serializer.validated_data.get('rejection_reason', '')
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='update_leave_status',
                target_type='leave_request',
                target_id=leave.id,
                detail=f'Updated leave request status to: {leave.status}'
            )
            return Response(LeaveRequestSerializer(leave).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class LeaveCancelView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, leave_id):
        try:
            leave = leave_service.cancel_leave_request(
                leave_id=str(leave_id),
                org_id=request.org_id,
                requesting_user=request.user
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='cancel_leave_request',
                target_type='leave_request',
                target_id=leave.id,
                detail=f'Cancelled leave request ID: {leave.id}'
            )
            return Response(LeaveRequestSerializer(leave).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class LeaveApproveView(APIView):
    permission_classes = [IsManager]

    def post(self, request, leave_id):
        try:
            leave = leave_service.update_leave_status(
                leave_id=str(leave_id),
                org_id=request.org_id,
                requesting_user=request.user,
                new_status='approved'
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='approve_leave_request',
                target_type='leave_request',
                target_id=leave.id,
                detail=f'Approved leave request ID: {leave.id}'
            )
            return Response(LeaveRequestSerializer(leave).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class LeaveRejectView(APIView):
    permission_classes = [IsManager]

    def post(self, request, leave_id):
        serializer = LeaveRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get('reason', '')
        try:
            leave = leave_service.update_leave_status(
                leave_id=str(leave_id),
                org_id=request.org_id,
                requesting_user=request.user,
                new_status='rejected',
                rejection_reason=reason
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='reject_leave_request',
                target_type='leave_request',
                target_id=leave.id,
                detail=f'Rejected leave request ID: {leave.id}. Reason: {reason}'
            )
            return Response(LeaveRequestSerializer(leave).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class LeaveTeamCalendarView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        dept_id = request.query_params.get('department_id')
        try:
            calendar_data = leave_service.get_team_calendar(
                org_id=request.org_id,
                requesting_user=request.user,
                year=year,
                month=month,
                department_id=dept_id
            )
            return Response(calendar_data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class LeaveAIDraftView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request):
        serializer = LeaveAIDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prompt = serializer.validated_data['prompt']
        try:
            draft = leave_service.generate_ai_leave_draft(
                prompt=prompt,
                requesting_user=request.user,
                org_id=request.org_id
            )
            return Response(draft)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class EmployeeLeaveBalanceUpdateView(APIView):
    permission_classes = [IsHR]

    def patch(self, request, employee_id):
        serializer = LeaveBalanceAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            emp = leave_service.adjust_employee_balance(
                employee_id=str(employee_id),
                org_id=request.org_id,
                requesting_user=request.user,
                balances=serializer.validated_data
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='update_employee_leave_balance',
                target_type='employee',
                target_id=employee_id,
                detail=f'Updated leave balances for employee {emp.get_full_name()}'
            )
            return Response(EmployeeSerializer(emp).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class PublicHolidayListView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        year = request.query_params.get('year')
        holidays = holiday_service.list_holidays(request.org_id, year)
        return Response(PublicHolidaySerializer(holidays, many=True).data)

    def post(self, request):
        if request.user.role not in ['admin', 'hr']:
            return Response({'error': 'Only Admins and HR can create public holidays.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = PublicHolidayCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            holiday = holiday_service.create_holiday(
                org_id=request.org_id,
                user=request.user,
                name=d['name'],
                date=d['date'],
                description=d.get('description', '')
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='create_public_holiday',
                target_type='public_holiday',
                target_id=holiday.id,
                detail=f'Created holiday: {holiday.name} on {holiday.date}'
            )
            return Response(PublicHolidaySerializer(holiday).data, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class PublicHolidayDetailView(APIView):
    permission_classes = [IsHR]

    def delete(self, request, holiday_id):
        try:
            holiday_service.delete_holiday(str(holiday_id), request.org_id, request.user)
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='delete_public_holiday',
                target_type='public_holiday',
                target_id=holiday_id,
                detail=f'Deleted public holiday ID: {holiday_id}'
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


# ── Performance Reviews ───────────────────────────────────────

class PerformanceReviewListView(APIView):
    permission_classes = [IsManager]

    def post(self, request):
        serializer = PerformanceReviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            review = review_service.create_review(
                org_id=request.org_id,
                requesting_user=request.user,
                employee_id=d['employee_id'],
                period_start=d['period_start'],
                period_end=d['period_end'],
                score=d['score'],
                notes=d.get('notes', ''),
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='create_performance_review',
                target_type='performance_review',
                target_id=review.id,
                detail=f'Created review for employee: {review.employee.get_full_name()}'
            )
            return Response(
                PerformanceReviewSerializer(review).data,
                status=status.HTTP_201_CREATED
            )
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class TeamStatsView(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        from .repositories import EmployeeRepository, DepartmentRepository, LeaveRepository
        from .models import Employee, Department, LeaveRequest
        active_employees  = Employee.objects.filter(org_id=request.org_id, is_deleted=False, employment_status='active').count()
        total_departments = Department.objects.filter(org_id=request.org_id, is_deleted=False).count()
        pending_leave     = LeaveRequest.objects.filter(org_id=request.org_id, is_deleted=False, status='pending').count()
        return Response({
            'total_employees':   active_employees,
            'total_departments': total_departments,
            'pending_leave':     pending_leave,
        })


class DailyStatusFeedView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        from teams.models import DailyStatus
        qs = DailyStatus.objects.filter(org_id=request.org_id)
        
        dept_id = request.query_params.get('department_id')
        if dept_id and dept_id != 'all':
            qs = qs.filter(employee__department_id=dept_id)
        elif request.user.role in ['employee', 'hr', 'manager']:
            user_depts = []
            if hasattr(request.user, 'employee_profile') and request.user.employee_profile.department:
                user_depts.append(request.user.employee_profile.department_id)
            headed_depts = request.user.headed_departments.filter(is_deleted=False)
            for d in headed_depts:
                if d.id not in user_depts:
                    user_depts.append(d.id)
            
            if user_depts:
                from django.db.models import Q
                qs = qs.filter(
                    Q(employee__department_id__in=user_depts) |
                    Q(employee__user__headed_departments__id__in=user_depts)
                ).distinct()
            else:
                qs = qs.filter(employee__user=request.user)

        qs = qs.select_related('employee__user', 'employee__department').order_by('-created_at')[:100]

        data = [
            {
                'id':                     str(status.id),
                'employee_id':            str(status.employee_id),
                'employee_name':          status.employee.get_full_name(),
                'role':                   status.employee.user.role,
                'department_id':          str(status.employee.department_id) if status.employee.department_id else None,
                'department_name':        status.employee.department.name if status.employee.department else 'General',
                'status_message':         status.status_message,
                'status_emoji':           status.status_emoji,
                'yesterday_accomplished': status.yesterday_accomplished,
                'yesterday_task_ids':     status.yesterday_task_ids,
                'today_focus':            status.today_focus,
                'today_task_ids':         status.today_task_ids,
                'has_blockers':           status.has_blockers,
                'blockers_description':   status.blockers_description,
                'blocker_severity':       status.blocker_severity,
                'created_at':             status.created_at.isoformat(),
            }
            for status in qs
        ]
        return Response(data)

    def post(self, request):
        try:
            status_entry = standup_service.submit_checkin(
                org_id=request.org_id,
                user=request.user,
                data=request.data
            )
            return Response({
                'id':                     str(status_entry.id),
                'status':                 'success',
                'message':                'Daily check-in posted successfully!',
                'status_message':         status_entry.status_message,
                'status_emoji':           status_entry.status_emoji,
                'yesterday_accomplished': status_entry.yesterday_accomplished,
                'today_focus':            status_entry.today_focus,
                'has_blockers':           status_entry.has_blockers,
                'blockers_description':   status_entry.blockers_description,
                'blocker_severity':       status_entry.blocker_severity,
            }, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UserStandupTasksView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        try:
            tasks_data = standup_service.get_user_recent_tasks(request.org_id, request.user)
            return Response(tasks_data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DepartmentStandupBannerView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        dept_id = request.query_params.get('department_id')
        try:
            banner_data = standup_service.get_active_blockers(request.org_id, request.user, dept_id)
            return Response(banner_data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DepartmentStandupDigestView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, dept_id=None):
        from teams.models import DepartmentStandupDigest
        from django.utils import timezone
        today = timezone.now().date()
        qs = DepartmentStandupDigest.objects.filter(org_id=request.org_id, digest_date=today)
        if dept_id and dept_id != 'all':
            qs = qs.filter(department_id=dept_id)
        latest = qs.order_by('-created_at').first()
        if not latest:
            return Response({'has_digest': False, 'message': 'No digest generated today.'})
        return Response({
            'has_digest': True,
            'id': str(latest.id),
            'digest_date': latest.digest_date.isoformat(),
            'department_name': latest.department.name if latest.department else 'All Departments',
            'shipped_summary': latest.shipped_summary,
            'in_flight_summary': latest.in_flight_summary,
            'blockers_summary': latest.blockers_summary,
            'team_mood': latest.team_mood,
            'full_markdown': latest.full_markdown,
            'active_blockers_count': latest.active_blockers_count,
            'total_checkins_count': latest.total_checkins_count,
            'email_sent_at': latest.email_sent_at.isoformat() if latest.email_sent_at else None,
        })

    def post(self, request, dept_id=None):
        target_dept = dept_id or request.data.get('department_id')
        dispatch_email = bool(request.data.get('dispatch_email', False) or request.data.get('send_brevo', False))
        try:
            digest_data = standup_service.generate_standup_rollup(
                org_id=request.org_id,
                dept_id=target_dept,
                requesting_user=request.user,
                dispatch_email=dispatch_email
            )
            return Response(digest_data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


from django.http import HttpResponse
import datetime
import hashlib
from django.conf import settings
from django.utils import timezone
from .models import Employee, LeaveRequest

class LeaveCalendarFeedView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, employee_id, token):
        # Verify token
        expected_token = hashlib.sha256(f"{employee_id}-{settings.SECRET_KEY}".encode()).hexdigest()[:16]
        if token != expected_token:
            return HttpResponse("Unauthorized", status=403)

        # Fetch Employee
        try:
            employee = Employee.objects.get(id=employee_id, is_deleted=False)
        except Employee.DoesNotExist:
            return HttpResponse("Not Found", status=404)

        # Fetch approved leaves for the employee's organization
        leaves = LeaveRequest.objects.filter(
            employee__org_id=employee.org_id,
            status='approved',
            is_deleted=False
        ).select_related('employee__user')

        # Generate iCal format
        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Core Workplace//Leave Calendar Feed//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
        ]
        for leave in leaves:
            start_str = leave.start_date.strftime("%Y%m%d")
            # All day exclusive end date in iCal
            end_exclusive = leave.end_date + datetime.timedelta(days=1)
            end_str = end_exclusive.strftime("%Y%m%d")
            
            summary = f"OOO: {leave.employee.get_full_name()} ({leave.leave_type.capitalize()})"
            notes = leave.notes.replace('\n', '\\n').replace('\r', '') if leave.notes else 'None'
            
            lines.extend([
                "BEGIN:VEVENT",
                f"UID:leave-{leave.id}@core.workplace",
                f"DTSTAMP:{timezone.now().strftime('%Y%m%dT%H%M%SZ')}",
                f"DTSTART;VALUE=DATE:{start_str}",
                f"DTEND;VALUE=DATE:{end_str}",
                f"SUMMARY:{summary}",
                f"DESCRIPTION:Status: {leave.status.capitalize()}\\nNotes: {notes}",
                "END:VEVENT"
            ])
        lines.append("END:VCALENDAR")
        
        ics_content = "\r\n".join(lines)
        response = HttpResponse(ics_content, content_type="text/calendar")
        response['Content-Disposition'] = 'attachment; filename="leaves_feed.ics"'
        return response


class DailyStatusSummaryView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request):
        dept_id = request.data.get('department_id')
        dispatch_email = bool(request.data.get('dispatch_email', False) or request.data.get('send_brevo', False))

        digest = standup_service.generate_standup_rollup(
            org_id=request.org_id,
            dept_id=dept_id,
            requesting_user=request.user,
            dispatch_email=dispatch_email
        )

        return Response({
            'summary_markdown':     digest.get('full_markdown'),
            'summary':              digest.get('full_markdown'),
            'shipped_summary':      digest.get('shipped_summary', []),
            'in_flight_summary':    digest.get('in_flight_summary', []),
            'blockers_summary':     digest.get('blockers_summary', []),
            'key_accomplishments':  digest.get('shipped_summary', []),
            'blockers':             digest.get('blockers_summary', []),
            'daily_priorities':     digest.get('in_flight_summary', []),
            'team_mood':            digest.get('team_mood', 'Steady'),
            'standup_count':        digest.get('total_checkins', 0),
            'update_count':         digest.get('total_checkins', 0),
            'active_blockers_count': digest.get('active_blockers_count', 0),
            'email_dispatched':     digest.get('email_dispatched', False),
            'email_recipient':      digest.get('email_recipient')
        })


class BulkTeamImportView(APIView):
    permission_classes = [IsManager]

    def post(self, request):
        import io
        import csv
        import json
        import secrets
        from datetime import timedelta
        from django.utils import timezone
        from django.db import transaction
        from accounts.models import User
        from teams.models import Department, Employee
        from tenants.models import Organization, OrganizationInvitation
        from tenants.services import InvitationService

        raw_data = (
            request.data.get('csv_data') or
            request.data.get('data') or
            request.data.get('csv') or
            request.data.get('payload') or
            request.data.get('file_content')
        )
        if not raw_data:
            return Response({'error': 'Data or CSV payload is required.'}, status=400)

        raw_rows = []
        if isinstance(raw_data, list):
            raw_rows = raw_data
        elif isinstance(raw_data, str):
            raw_str = raw_data.strip()
            if (raw_str.startswith('{') and raw_str.endswith('}')) or (raw_str.startswith('[') and raw_str.endswith(']')):
                try:
                    parsed = json.loads(raw_str)
                    raw_rows = parsed if isinstance(parsed, list) else parsed.get('employees', parsed.get('members', []))
                except Exception:
                    pass
            if not raw_rows:
                try:
                    reader = csv.DictReader(io.StringIO(raw_str))
                    raw_rows = [r for r in reader if any(r.values())]
                except Exception as e:
                    return Response({'error': f'Failed to parse CSV: {str(e)}'}, status=400)

        if not raw_rows:
            return Response({'error': 'Could not parse any employee records from the provided data.'}, status=400)

        # Normalize key dictionary for each row
        rows = []
        for raw_r in raw_rows:
            norm_r = {}
            for k, v in raw_r.items():
                if k:
                    norm_k = str(k).strip().lower().replace(' ', '_').replace('-', '_')
                    norm_r[norm_k] = v
            rows.append(norm_r)

        org = Organization.objects.get(id=request.org_id)
        invitations_sent = 0
        updated_active = 0
        skipped_count = 0
        errors = []

        existing_users = {u.email.lower(): u for u in User.objects.filter(org_id=request.org_id)}
        existing_depts = {d.name.lower(): d for d in Department.objects.filter(org_id=request.org_id, is_deleted=False)}
        existing_invites = {inv.email.lower(): inv for inv in OrganizationInvitation.objects.filter(org_id=request.org_id, status='pending')}

        inviter_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.email

        invites_to_email = []

        with transaction.atomic():
            for idx, r in enumerate(rows):
                first_name = (
                    r.get('first_name') or r.get('firstname') or r.get('name') or ''
                ).strip()
                last_name = (
                    r.get('last_name') or r.get('lastname') or ''
                ).strip()
                if not last_name and ' ' in first_name:
                    parts = first_name.split(' ', 1)
                    first_name, last_name = parts[0], parts[1]
                if not first_name:
                    first_name = f"Member {idx + 1}"

                email = (
                    r.get('email') or r.get('email_address') or ''
                ).strip().lower()
                if not email or '@' not in email:
                    skipped_count += 1
                    errors.append(f"Row {idx + 1}: Invalid or missing email.")
                    continue

                role = (r.get('role') or 'employee').strip().lower()
                if role not in ['admin', 'hr', 'manager', 'employee']:
                    role = 'employee'

                dept_name = (
                    r.get('department') or r.get('team') or r.get('dept') or ''
                ).strip()
                dept = None
                if dept_name:
                    dept_key = dept_name.lower()
                    if dept_key in existing_depts:
                        dept = existing_depts[dept_key]
                    else:
                        dept = Department.objects.create(
                            org_id=request.org_id,
                            name=dept_name
                        )
                        existing_depts[dept_key] = dept

                # Skills parsing
                skills_raw = r.get('skills') or r.get('competencies') or []
                skills_list = []
                if isinstance(skills_raw, list):
                    skills_list = [str(s).strip() for s in skills_raw if str(s).strip()]
                elif isinstance(skills_raw, str):
                    if ';' in skills_raw:
                        skills_list = [s.strip() for s in skills_raw.split(';') if s.strip()]
                    else:
                        skills_list = [s.strip() for s in skills_raw.split(',') if s.strip()]

                manager_email = (
                    r.get('manager_email') or r.get('manager') or ''
                ).strip().lower()

                # Always create/refresh pending invitation for every imported roster member
                token = secrets.token_urlsafe(32)
                expires_at = timezone.now() + timedelta(days=7)

                if email in existing_invites:
                    invite = existing_invites[email]
                    invite.first_name = first_name
                    invite.last_name = last_name
                    invite.role = role
                    invite.department = dept
                    invite.manager_email = manager_email
                    invite.skills = skills_list
                    invite.token = token
                    invite.expires_at = expires_at
                    invite.inviter = request.user
                    invite.status = 'pending'
                    invite.save()
                else:
                    invite = OrganizationInvitation.objects.create(
                        org=org,
                        inviter=request.user,
                        email=email,
                        first_name=first_name,
                        last_name=last_name,
                        role=role,
                        department=dept,
                        manager_email=manager_email,
                        skills=skills_list,
                        token=token,
                        expires_at=expires_at,
                        status='pending'
                    )
                    existing_invites[email] = invite

                invites_to_email.append((invite, inviter_name, org.name))
                invitations_sent += 1

            log_action(
                org_id=request.org_id,
                user=request.user,
                action='bulk_import_invitations',
                target_type='organization',
                target_id=request.org_id,
                detail=f'Bulk sent {invitations_sent} onboarding invitations from roster'
            )

        # Dispatch emails asynchronously in background thread so HTTP response is instant (< 30ms)
        if invites_to_email:
            import threading
            def _async_email_sender(email_tasks):
                for inv, in_name, o_name in email_tasks:
                    try:
                        InvitationService.send_invite_email(inv, in_name, o_name)
                    except Exception:
                        pass

            threading.Thread(target=_async_email_sender, args=(invites_to_email,), daemon=True).start()

        return Response({
            'success': True,
            'invitations_sent': invitations_sent,
            'imported_count': invitations_sent,
            'updated_active': updated_active,
            'skipped_count': skipped_count,
            'errors': errors
        })


# ── Pillar 4: Recurring 1-on-1 Meeting Workspaces ─────────────

class OneOnOneWorkspaceListCreateView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        workspaces = one_on_one_service.list_workspaces(request.org_id, request.user)
        return Response(OneOnOneWorkspaceSerializer(workspaces, many=True, context={'request': request}).data)

    def post(self, request):
        manager_id = request.data.get('manager_id')
        employee_id = request.data.get('employee_id')
        if not manager_id or not employee_id:
            return Response({'error': 'Both manager_id and employee_id are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ws = one_on_one_service.get_or_create_workspace(
                org_id=request.org_id,
                manager_id=manager_id,
                employee_id=employee_id,
                requesting_user=request.user
            )
            return Response(OneOnOneWorkspaceSerializer(ws, context={'request': request}).data, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OneOnOneWorkspaceDetailView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, pk):
        try:
            ws = one_on_one_service.get_workspace(request.org_id, pk, request.user)
            return Response(OneOnOneWorkspaceSerializer(ws, context={'request': request}).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def patch(self, request, pk):
        try:
            ws = one_on_one_service.update_workspace(request.org_id, pk, request.user, request.data)
            return Response(OneOnOneWorkspaceSerializer(ws, context={'request': request}).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OneOnOneConvertTaskView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        item_id = request.data.get('item_id')
        project_id = request.data.get('project_id')
        if not item_id:
            return Response({'error': 'item_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            res = one_on_one_service.convert_action_item_to_task(
                org_id=request.org_id,
                workspace_id=pk,
                user=request.user,
                item_id=item_id,
                project_id=project_id
            )
            return Response(res, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OneOnOneLaunchMeetingView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        try:
            res = one_on_one_service.launch_meeting_room(request.org_id, pk, request.user)
            return Response(res)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Pillar 4: Department Skill Matrix & Talent Directory ──────

class DepartmentSkillMatrixView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        query = request.query_params.get('query', '')
        department_id = request.query_params.get('department_id')
        skills = request.query_params.get('skills', '')

        try:
            data = skill_service.get_skill_matrix(
                org_id=request.org_id,
                query=query,
                department_id=department_id,
                skills=skills
            )
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class EmployeeSkillUpdateView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, employee_id):
        skills = request.data.get('skills', [])
        if not isinstance(skills, list):
            return Response({'error': 'skills must be a list of strings.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            emp = skill_service.update_employee_skills(request.org_id, employee_id, skills)
            return Response({
                'employee_id': str(emp.id),
                'skills': emp.skills,
                'message': 'Skills updated successfully.'
            })
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Pillar 4: Automated Onboarding / Offboarding Runbooks ─────

class DepartmentRunbookTemplateListCreateView(APIView):
    permission_classes = [IsManager]

    def get(self, request, dept_id):
        runbook_type = request.query_params.get('type', 'onboarding')
        try:
            rb = runbook_service.get_or_create_default_runbook(request.org_id, dept_id, runbook_type=runbook_type)
            return Response(DepartmentRunbookSerializer(rb).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def post(self, request, dept_id):
        from teams.models import DepartmentRunbook
        title = request.data.get('title')
        runbook_type = request.data.get('type', 'onboarding')
        steps = request.data.get('checklist_steps', [])
        description = request.data.get('description', '')

        if not title:
            return Response({'error': 'title is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rb = DepartmentRunbook.objects.create(
                org_id=request.org_id,
                department_id=dept_id,
                title=title,
                type=runbook_type,
                checklist_steps=steps,
                description=description
            )
            return Response(DepartmentRunbookSerializer(rb).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DepartmentRunbookExecutionListCreateView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        employee_id = request.query_params.get('employee_id')
        dept_id = request.query_params.get('department_id')
        runbook_type = request.query_params.get('type')

        executions = runbook_service.list_executions(
            org_id=request.org_id,
            employee_id=employee_id,
            department_id=dept_id,
            runbook_type=runbook_type
        )
        return Response(EmployeeRunbookExecutionSerializer(executions, many=True).data)

    def post(self, request):
        employee_id = request.data.get('employee_id')
        runbook_type = request.data.get('type', 'onboarding')

        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            execution = runbook_service.trigger_runbook(
                org_id=request.org_id,
                employee_id=employee_id,
                runbook_type=runbook_type,
                actor_user=request.user
            )
            return Response(EmployeeRunbookExecutionSerializer(execution).data, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DepartmentRunbookStepToggleView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, execution_id):
        step_id = request.data.get('step_id')
        is_completed = bool(request.data.get('is_completed', False))

        if step_id is None:
            return Response({'error': 'step_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            execution = runbook_service.toggle_step(
                org_id=request.org_id,
                execution_id=execution_id,
                step_id=step_id,
                is_completed=is_completed,
                actor_user=request.user
            )
            return Response(EmployeeRunbookExecutionSerializer(execution).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



