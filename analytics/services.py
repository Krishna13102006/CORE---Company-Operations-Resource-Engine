"""
analytics/services.py

Analytics aggregation service for CORE.

All methods query live data from existing panel tables.
Every query is scoped by org_id — no cross-tenant data leakage is possible.

Method groups:
  - overview_stats()     — high-level org counts for all roles
  - knowledge_stats()    — document library metrics
  - projects_stats()     — project and task metrics
  - teams_stats()        — people and HR metrics
  - hiring_stats()       — recruitment funnel metrics
  - recent_activity()    — recent audit log entries

Role-based access is enforced in the view layer, not here.
These methods return data — the views decide who can see what.
"""

from django.db.models import Count, Avg, Q, F, Sum, ExpressionWrapper, DurationField
from django.utils import timezone
import datetime


class AnalyticsService:

    # ── Overview — shown to all roles ─────────────────────────────────────

    def overview_stats(self, org_id: str, user_id: str, role: str) -> dict:
        """
        High-level summary stats. Varies by role:
        - Employee/Manager: their own task counts + org knowledge count
        - HR: above + headcount + open positions
        - Admin: everything
        """
        from knowledge.models import Document
        from projects.models import Task, Project
        from accounts.models import User

        result = {}

        # Knowledge — all roles
        result['total_documents'] = Document.objects.filter(
            org_id=org_id, is_deleted=False
        ).count()
        result['searchable_documents'] = Document.objects.filter(
            org_id=org_id, is_deleted=False, status='searchable'
        ).count()

        # My tasks — all roles
        result['my_open_tasks'] = Task.objects.filter(
            org_id=org_id,
            is_deleted=False,
            project__is_deleted=False,
            assignee_id=user_id,
        ).exclude(status='done').count()

        result['my_overdue_tasks'] = Task.objects.filter(
            org_id=org_id,
            is_deleted=False,
            project__is_deleted=False,
            assignee_id=user_id,
            due_date__lt=timezone.now().date(),
        ).exclude(status='done').count()

        # Task completion counts (scoped by role)
        completed_qs = Task.objects.filter(org_id=org_id, is_deleted=False, project__is_deleted=False, status='done')
        if role == 'employee':
            completed_qs = completed_qs.filter(assignee_id=user_id)
        result['completed_tasks'] = completed_qs.count()

        # Overdue tasks counts (scoped by role)
        overdue_qs = Task.objects.filter(org_id=org_id, is_deleted=False, project__is_deleted=False, due_date__lt=timezone.now().date()).exclude(status='done')
        if role == 'employee':
            overdue_qs = overdue_qs.filter(assignee_id=user_id)
        result['overdue_tasks'] = overdue_qs.count()

        # Auto-detect overdue tasks for the current user and trigger notifications
        if user_id:
            overdue_to_notify = Task.objects.filter(
                org_id=org_id,
                is_deleted=False,
                project__is_deleted=False,
                assignee_id=user_id,
                due_date__lt=timezone.now().date(),
            ).exclude(status='done')

            from core.models import Notification
            for t in overdue_to_notify:
                notif_title = f"Task Overdue: {t.title}"
                if not Notification.objects.filter(recipient_id=user_id, title=notif_title).exists():
                    Notification.objects.create(
                        org_id=org_id,
                        recipient_id=user_id,
                        title=notif_title,
                        message=f"The deadline for task '{t.title}' has passed ({t.due_date}). Please update its status or request a schedule extension.",
                    )

        # Projects — all roles
        result['active_projects'] = Project.objects.filter(
            org_id=org_id,
            is_deleted=False,
            status='active'
        ).count()

        # Teams / HR / Admin
        if role in ['manager', 'hr', 'admin']:
            from teams.models import Employee
            result['active_employees'] = Employee.objects.filter(
                org_id=org_id,
                is_deleted=False,
                employment_status='active'
            ).count()

        # HR / Admin
        if role in ['hr', 'admin']:
            from hiring.models import JobPosting, Application
            result['open_positions'] = JobPosting.objects.filter(
                org_id=org_id,
                is_deleted=False,
                status='open'
            ).count()
            result['applications_this_month'] = Application.objects.filter(
                org_id=org_id,
                is_deleted=False,
                created_at__year=timezone.now().year,
                created_at__month=timezone.now().month,
            ).count()

        # Members count (all roles)
        result['total_users'] = User.objects.filter(
            org_id=org_id,
            is_deleted=False,
            is_active=True,
        ).count()

        # 1. Calendar Events (Task deadlines & Interview schedules)
        calendar_events = []
        my_tasks = Task.objects.filter(
            org_id=org_id,
            is_deleted=False,
            project__is_deleted=False,
            assignee_id=user_id,
            due_date__isnull=False,
        ).exclude(status='done')

        for task in my_tasks:
            calendar_events.append({
                'id': f"task-{task.id}",
                'type': 'task_deadline',
                'title': f"Task Due: {task.title}",
                'date': str(task.due_date),
                'detail': f"Project: {task.project.name} | Status: {task.status}",
                'link': '/projects',
            })

        user_obj = User.objects.filter(id=user_id).first()
        if user_obj:
            user_name = f"{user_obj.first_name} {user_obj.last_name}".strip()
            from hiring.models import InterviewSchedule
            my_interviews = InterviewSchedule.objects.filter(
                org_id=org_id,
                status='scheduled',
                interviewers__contains=user_name
            ).select_related('application__candidate')

            for iv in my_interviews:
                cand_name = f"{iv.application.candidate.first_name} {iv.application.candidate.last_name}".strip()
                calendar_events.append({
                    'id': f"interview-{iv.id}",
                    'type': 'interview',
                    'title': f"Interview: {cand_name}",
                    'date': iv.scheduled_at.isoformat(),
                    'detail': f"Type: {iv.get_interview_type_display()} | Duration: {iv.duration_min} min",
                    'link': '/hiring',
                })

        calendar_events.sort(key=lambda x: x['date'])
        result['calendar_events'] = calendar_events

        # 2. Pending Actions Alert (Leaves approvals & Overdue tasks warnings)
        pending_actions = []
        my_overdue_count = result.get('my_overdue_tasks', 0)
        if my_overdue_count > 0:
            pending_actions.append({
                'id': 'overdue-tasks',
                'type': 'warning',
                'title': f"You have {my_overdue_count} overdue task(s)",
                'detail': "Please update deadlines or complete them.",
                'link': '/projects',
            })

        if role in ['manager', 'hr', 'admin']:
            from teams.models import LeaveRequest
            pending_leaves = LeaveRequest.objects.filter(
                org_id=org_id,
                status='pending',
                is_deleted=False
            ).select_related('employee__user')

            for lr in pending_leaves:
                emp_name = f"{lr.employee.user.first_name} {lr.employee.user.last_name}".strip() or lr.employee.user.email
                pending_actions.append({
                    'id': f"leave-{lr.id}",
                    'type': 'approval',
                    'title': f"Leave Request from {emp_name}",
                    'detail': f"{lr.get_leave_type_display()} from {lr.start_date} to {lr.end_date}",
                    'link': '/departments',
                })

        result['pending_actions'] = pending_actions

        return result

    # ── Knowledge analytics ───────────────────────────────────────────────

    def knowledge_stats(self, org_id: str) -> dict:
        from knowledge.models import Document, DocumentMetadata

        # Documents by status
        by_status = list(
            Document.objects.filter(org_id=org_id, is_deleted=False)
            .values('status')
            .annotate(count=Count('id'))
            .order_by('status')
        )

        # Documents by category
        by_category = list(
            DocumentMetadata.objects.filter(
                document__org_id=org_id,
                document__is_deleted=False,
            )
            .exclude(category='')
            .values('category')
            .annotate(count=Count('id'))
            .order_by('-count')[:8]
        )

        # Documents by file type
        by_type = list(
            Document.objects.filter(org_id=org_id, is_deleted=False)
            .values('file_type')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # Uploads over the last 30 days (daily counts)
        thirty_days_ago = timezone.now() - datetime.timedelta(days=30)
        uploads_trend = list(
            Document.objects.filter(
                org_id=org_id,
                is_deleted=False,
                created_at__gte=thirty_days_ago,
            )
            .extra(select={'day': "DATE(knowledge_document.created_at)"})
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )

        # Total storage
        total_size = Document.objects.filter(
            org_id=org_id, is_deleted=False
        ).aggregate(total=Sum('file_size'))['total'] or 0

        return {
            'by_status':      by_status,
            'by_category':    by_category,
            'by_type':        by_type,
            'uploads_trend':  [
                {'day': str(r['day']), 'count': r['count']}
                for r in uploads_trend
            ],
            'total_size_bytes':   total_size,
            'total_size_display': _format_size(total_size),
        }

    # ── Projects analytics ────────────────────────────────────────────────

    def projects_stats(self, org_id: str, user_id: str, role: str) -> dict:
        from projects.models import Project, Task

        # Projects by status
        by_status = list(
            Project.objects.filter(org_id=org_id, is_deleted=False)
            .values('status')
            .annotate(count=Count('id'))
        )

        # Tasks by status across all active projects
        tasks_by_status = list(
            Task.objects.filter(org_id=org_id, is_deleted=False, project__is_deleted=False)
            .values('status')
            .annotate(count=Count('id'))
        )

        # Tasks by priority
        tasks_by_priority = list(
            Task.objects.filter(org_id=org_id, is_deleted=False, project__is_deleted=False)
            .exclude(status='done')
            .values('priority')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # Overdue tasks
        overdue_tasks = list(
            Task.objects.filter(
                org_id=org_id,
                is_deleted=False,
                project__is_deleted=False,
                due_date__lt=timezone.now().date(),
            )
            .exclude(status='done')
            .select_related('project', 'assignee')
            .values('id', 'title', 'project__name', 'assignee__first_name',
                    'assignee__last_name', 'due_date', 'priority')
            .order_by('due_date')[:10]
        )

        # My tasks breakdown (all roles)
        my_tasks_by_status = list(
            Task.objects.filter(
                org_id=org_id,
                is_deleted=False,
                project__is_deleted=False,
                assignee_id=user_id,
            )
            .values('status')
            .annotate(count=Count('id'))
        )

        # Task completion trend — last 30 days
        thirty_days_ago = timezone.now() - datetime.timedelta(days=30)
        completion_trend = list(
            Task.objects.filter(
                org_id=org_id,
                is_deleted=False,
                project__is_deleted=False,
                status='done',
                updated_at__gte=thirty_days_ago,
            )
            .extra(select={'day': "DATE(projects_task.updated_at)"})
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )

        # Calculate total, completed, and overdue task metrics (scoped by role)
        if role == 'employee':
            total_tasks_count = sum(item['count'] for item in my_tasks_by_status)
            completed_tasks_count = next((item['count'] for item in my_tasks_by_status if item['status'] == 'done'), 0)
            overdue_tasks_count = Task.objects.filter(
                org_id=org_id,
                is_deleted=False,
                project__is_deleted=False,
                assignee_id=user_id,
                due_date__lt=timezone.now().date()
            ).exclude(status='done').count()
        else:
            total_tasks_count = sum(item['count'] for item in tasks_by_status)
            completed_tasks_count = next((item['count'] for item in tasks_by_status if item['status'] == 'done'), 0)
            overdue_tasks_count = Task.objects.filter(
                org_id=org_id,
                is_deleted=False,
                project__is_deleted=False,
                due_date__lt=timezone.now().date()
            ).exclude(status='done').count()

        return {
            'projects_by_status':  by_status,
            'tasks_by_status':     tasks_by_status,
            'tasks_by_priority':   tasks_by_priority,
            'overdue_tasks_list': [
                {
                    'id':       str(t['id']),
                    'title':    t['title'],
                    'project':  t['project__name'],
                    'assignee': f"{t['assignee__first_name'] or ''} {t['assignee__last_name'] or ''}".strip(),
                    'due_date': str(t['due_date']),
                    'priority': t['priority'],
                }
                for t in overdue_tasks
            ],
            'my_tasks_by_status': my_tasks_by_status,
            'completion_trend': [
                {'day': str(r['day']), 'count': r['count']}
                for r in completion_trend
            ],
            'completed_tasks': completed_tasks_count,
            'total_tasks':     total_tasks_count,
            'overdue_tasks':   overdue_tasks_count,
        }

    # ── Teams analytics — manager/hr/admin ───────────────────────────────

    def teams_stats(self, org_id: str) -> dict:
        from teams.models import Employee, Department, LeaveRequest, PerformanceReview

        # Headcount by department
        by_dept = list(
            Employee.objects.filter(
                org_id=org_id, is_deleted=False, employment_status='active'
            )
            .values('department__name')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )

        # Employment status breakdown
        by_status = list(
            Employee.objects.filter(org_id=org_id, is_deleted=False)
            .values('employment_status')
            .annotate(count=Count('id'))
        )

        # Leave requests by status
        leave_by_status = list(
            LeaveRequest.objects.filter(org_id=org_id, is_deleted=False)
            .values('status')
            .annotate(count=Count('id'))
        )

        # Upcoming leave — approved leave starting in the next 30 days
        upcoming_leave = list(
            LeaveRequest.objects.filter(
                org_id=org_id,
                is_deleted=False,
                status='approved',
                start_date__gte=timezone.now().date(),
                start_date__lte=timezone.now().date() + datetime.timedelta(days=30),
            )
            .select_related('employee__user')
            .values(
                'employee__user__first_name', 'employee__user__last_name',
                'leave_type', 'start_date', 'end_date'
            )
            .order_by('start_date')[:10]
        )

        # Average performance score by department
        avg_score_by_dept = list(
            PerformanceReview.objects.filter(
                org_id=org_id, is_deleted=False
            )
            .values('employee__department__name')
            .annotate(avg_score=Avg('score'))
            .order_by('-avg_score')[:8]
        )

        # New hires in the last 90 days
        ninety_days_ago = timezone.now().date() - datetime.timedelta(days=90)
        new_hires = Employee.objects.filter(
            org_id=org_id,
            is_deleted=False,
            hire_date__gte=ninety_days_ago,
        ).count()

        return {
            'headcount_by_department': [
                {'department': r['department__name'] or 'Unassigned', 'count': r['count']}
                for r in by_dept
            ],
            'employment_status': by_status,
            'leave_by_status':   leave_by_status,
            'upcoming_leave': [
                {
                    'name':       f"{r['employee__user__first_name']} {r['employee__user__last_name']}",
                    'leave_type': r['leave_type'],
                    'start_date': str(r['start_date']),
                    'end_date':   str(r['end_date']),
                }
                for r in upcoming_leave
            ],
            'avg_score_by_dept': [
                {
                    'department': r['employee__department__name'] or 'Unassigned',
                    'avg_score':  round(float(r['avg_score']), 1),
                }
                for r in avg_score_by_dept
            ],
            'new_hires_90_days': new_hires,
        }

    # ── Hiring analytics — hr/admin ───────────────────────────────────────

    def hiring_stats(self, org_id: str) -> dict:
        from hiring.models import JobPosting, Application, Candidate

        # Job postings by status
        jobs_by_status = list(
            JobPosting.objects.filter(org_id=org_id, is_deleted=False)
            .values('status')
            .annotate(count=Count('id'))
        )

        # Applications by stage
        apps_by_stage = list(
            Application.objects.filter(org_id=org_id, is_deleted=False)
            .values('stage')
            .annotate(count=Count('id'))
            .order_by('stage')
        )

        # Applications per job (top 10 most applied)
        apps_per_job = list(
            Application.objects.filter(org_id=org_id, is_deleted=False)
            .values('job_posting__title')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )

        # Hiring funnel — ordered stage list with counts
        stage_order = ['applied', 'screening', 'interview', 'offer', 'hired']
        stage_counts = {item['stage']: item['count'] for item in apps_by_stage}
        funnel = [
            {'stage': s, 'count': stage_counts.get(s, 0)}
            for s in stage_order
        ]

        # Applications trend — last 60 days
        sixty_days_ago = timezone.now() - datetime.timedelta(days=60)
        apps_trend = list(
            Application.objects.filter(
                org_id=org_id,
                is_deleted=False,
                created_at__gte=sixty_days_ago,
            )
            .extra(select={'day': "DATE(hiring_application.created_at)"})
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )

        # Average match score across all scored applications
        avg_match = Application.objects.filter(
            org_id=org_id,
            is_deleted=False,
            match_score__isnull=False,
        ).aggregate(avg=Avg('match_score'))['avg']

        # Time to hire — average days from created to hired
        hired_apps = Application.objects.filter(
            org_id=org_id,
            is_deleted=False,
            stage='hired',
        ).annotate(
            duration=ExpressionWrapper(
                F('updated_at') - F('created_at'),
                output_field=DurationField()
            )
        ).aggregate(avg=Avg('duration'))

        avg_days_to_hire = 0
        if hired_apps['avg']:
            avg_days_to_hire = hired_apps['avg'].days

        # Active job openings
        active_jobs = JobPosting.objects.filter(org_id=org_id, status='open', is_deleted=False).count()

        # Pending applications (active stages: applied, screening, interview, offer)
        pending_applications = Application.objects.filter(
            org_id=org_id,
            is_deleted=False,
            stage__in=['applied', 'screening', 'interview', 'offer']
        ).count()

        return {
            'jobs_by_status': jobs_by_status,
            'apps_by_stage':  apps_by_stage,
            'funnel':         funnel,
            'apps_per_job': [
                {'job': r['job_posting__title'], 'count': r['count']}
                for r in apps_per_job
            ],
            'apps_trend': [
                {'day': str(r['day']), 'count': r['count']}
                for r in apps_trend
            ],
            'avg_match_score':  round(float(avg_match) * 100, 1) if avg_match else None,
            'avg_days_to_hire': avg_days_to_hire,
            'active_jobs': active_jobs,
            'pending_applications': pending_applications,
        }

    # ── Recent activity — all roles ───────────────────────────────────────

    def recent_activity(self, org_id: str, user_id: str, role: str, limit: int = 15) -> list:
        from core.models import AuditLog

        qs = AuditLog.objects.filter(org_id=org_id)

        # Employees see only their own activity
        if role == 'employee':
            qs = qs.filter(actor_id=user_id)

        qs = qs.select_related('actor').order_by('-created_at')[:limit]

        return [
            {
                'actor':       f'{log.actor.first_name} {log.actor.last_name}' if log.actor else 'System',
                'action':      log.action,
                'target_type': log.target_type,
                'detail':      getattr(log, 'detail', ''),
                'created_at':  log.created_at.isoformat(),
            }
            for log in qs
        ]

    # ── Predictive ML — Phase 6 ───────────────────────────────────────────

    def candidate_rankings(self, org_id: str, job_id: str) -> dict:
        """
        Rank candidates for a specific job posting using XGBoost.
        Returns ranked candidates with scores and feature breakdown.
        """
        from hiring.models import Application
        from ml.candidate_ranker import rank_candidates

        # Get active (non-resolved) applications for this job
        applications = list(
            Application.objects.filter(
                org_id=org_id,
                job_posting_id=job_id,
                is_deleted=False,
            )
            .exclude(stage__in=['hired', 'rejected'])
            .select_related('candidate')
            .prefetch_related('interview_notes')
        )

        if not applications:
            return {'rankings': [], 'job_id': job_id, 'total': 0}

        rankings = rank_candidates(
            org_id=str(org_id),
            job_id=str(job_id),
            candidate_applications=applications,
        )

        return {
            'rankings':          rankings,
            'job_id':            str(job_id),
            'total':             len(rankings),
            'model_used':        rankings[0]['model_used'] if rankings else 'none',
            'insufficient_data': rankings[0]['insufficient_data'] if rankings else True,
        }

    def attrition_risks(self, org_id: str) -> dict:
        """
        Predict attrition risk for all active employees.
        Returns top-risk employees with explanatory signals.
        """
        from ml.attrition_predictor import predict_attrition_risk

        risks = predict_attrition_risk(org_id=str(org_id))

        high   = [r for r in risks if r['risk_level'] == 'High']
        medium = [r for r in risks if r['risk_level'] == 'Medium']

        return {
            'risks':             risks,
            'total_assessed':    len(risks),
            'high_risk_count':   len(high),
            'medium_risk_count': len(medium),
            'model_used':        risks[0]['model_used'] if risks else 'none',
            'insufficient_data': risks[0]['insufficient_data'] if risks else True,
        }

    def project_risks(self, org_id: str) -> dict:
        """
        Score risk for all active projects.
        Returns projects sorted by risk score with signals.
        """
        from ml.project_risk_scorer import score_project_risks

        risks = score_project_risks(org_id=str(org_id))

        critical = [r for r in risks if r['risk_level'] == 'Critical']
        high     = [r for r in risks if r['risk_level'] == 'High']

        return {
            'risks':              risks,
            'total_assessed':     len(risks),
            'critical_count':     len(critical),
            'high_risk_count':    len(high),
            'model_used':         risks[0]['model_used'] if risks else 'none',
            'insufficient_data':  risks[0]['insufficient_data'] if risks else True,
        }


def _format_size(bytes_count: int) -> str:
    """Format a byte count into a human-readable storage string."""
    if bytes_count < 1024:
        return f'{bytes_count} B'
    elif bytes_count < 1024 * 1024:
        return f'{bytes_count / 1024:.1f} KB'
    elif bytes_count < 1024 * 1024 * 1024:
        return f'{bytes_count / (1024 * 1024):.1f} MB'
    else:
        return f'{bytes_count / (1024 * 1024 * 1024):.1f} GB'
