from .models import JobPosting, Candidate, Application, StageHistory, InterviewNote
from django.utils import timezone


class JobPostingRepository:

    def list_by_org(self, org_id, filters=None):
        qs = JobPosting.objects.filter(
            org_id=org_id,
            is_deleted=False
        ).select_related('created_by').order_by('-created_at')

        if filters:
            if filters.get('status'):
                qs = qs.filter(status=filters['status'])
            if filters.get('department'):
                qs = qs.filter(department__icontains=filters['department'])
            if filters.get('search'):
                qs = qs.filter(title__icontains=filters['search'])

        return qs

    def get_by_id(self, job_id, org_id):
        return JobPosting.objects.filter(
            id=job_id,
            org_id=org_id,
            is_deleted=False
        ).select_related('created_by').first()

    def create(self, org_id, title, department, description,
               requirements, experience_requirements, status, created_by):
        return JobPosting.objects.create(
            org_id=org_id,
            title=title,
            department=department,
            description=description,
            requirements=requirements,
            experience_requirements=experience_requirements,
            status=status,
            created_by=created_by,
        )

    def update(self, job_id, org_id, **fields):
        JobPosting.objects.filter(id=job_id, org_id=org_id).update(
            updated_at=timezone.now(), **fields
        )
        return self.get_by_id(job_id, org_id)

    def soft_delete(self, job_id, org_id):
        job = self.get_by_id(job_id, org_id)
        if job:
            job.soft_delete()
        return job

    def count_open(self, org_id):
        return JobPosting.objects.filter(
            org_id=org_id,
            is_deleted=False,
            status='open'
        ).count()


class CandidateRepository:

    def get_by_id(self, candidate_id, org_id):
        return Candidate.objects.filter(
            id=candidate_id,
            org_id=org_id,
            is_deleted=False
        ).first()

    def create(self, org_id, first_name, last_name, email, phone, resume_path, resume_data=None):
        return Candidate.objects.create(
            org_id=org_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            resume_path=resume_path,
            resume_data=resume_data,
        )

    def update(self, candidate_id, org_id, **fields):
        Candidate.objects.filter(id=candidate_id, org_id=org_id).update(
            updated_at=timezone.now(), **fields
        )
        return self.get_by_id(candidate_id, org_id)


class ApplicationRepository:

    def list_by_job(self, job_id, org_id):
        return Application.objects.filter(
            job_posting_id=job_id,
            org_id=org_id,
            is_deleted=False
        ).select_related(
            'candidate',
            'job_posting'
        ).prefetch_related(
            'stage_history__moved_by',
            'interview_notes__interviewer'
        ).order_by('-created_at')

    def get_by_id(self, application_id, org_id):
        return Application.objects.filter(
            id=application_id,
            org_id=org_id,
            is_deleted=False
        ).select_related(
            'candidate', 'job_posting'
        ).prefetch_related(
            'stage_history__moved_by',
            'interview_notes__interviewer'
        ).first()

    def create(self, org_id, candidate, job_posting, stage='applied', source='other', source_details=''):
        return Application.objects.create(
            org_id=org_id,
            candidate=candidate,
            job_posting=job_posting,
            stage=stage,
            source=source,
            source_details=source_details,
        )

    def update_stage(self, application_id, org_id, new_stage,
                     rejection_reason=''):
        updates = {
            'stage':      new_stage,
            'updated_at': timezone.now(),
        }
        if rejection_reason:
            updates['rejection_reason'] = rejection_reason
        else:
            # Clear rejection reason if moving to non-rejected stage
            updates['rejection_reason'] = ''
        Application.objects.filter(
            id=application_id, org_id=org_id
        ).update(**updates)
        return self.get_by_id(application_id, org_id)

    def create_stage_history(self, org_id, application,
                             from_stage, to_stage, moved_by, notes=''):
        return StageHistory.objects.create(
            org_id=org_id,
            application=application,
            from_stage=from_stage,
            to_stage=to_stage,
            moved_by=moved_by,
            notes=notes,
        )

    def add_interview_note(self, org_id, application,
                           interviewer, score, notes):
        return InterviewNote.objects.create(
            org_id=org_id,
            application=application,
            interviewer=interviewer,
            score=score,
            notes=notes,
        )

    def count_by_job(self, job_id, org_id):
        return Application.objects.filter(
            job_posting_id=job_id,
            org_id=org_id,
            is_deleted=False
        ).count()

    def count_this_month(self, org_id):
        from django.utils import timezone as tz
        now = tz.now()
        return Application.objects.filter(
            org_id=org_id,
            is_deleted=False,
            created_at__year=now.year,
            created_at__month=now.month,
        ).count()

    def count_this_week(self, org_id):
        from django.utils import timezone as tz
        import datetime
        today = tz.now().date()
        week_start = today - datetime.timedelta(days=today.weekday())
        return Application.objects.filter(
            org_id=org_id,
            is_deleted=False,
            created_at__date__gte=week_start,
        ).count()

    def average_days_to_hire(self, org_id):
        from django.db.models import Avg, F, ExpressionWrapper, DurationField
        result = Application.objects.filter(
            org_id=org_id,
            is_deleted=False,
            stage='hired'
        ).annotate(
            days=ExpressionWrapper(
                F('updated_at') - F('created_at'),
                output_field=DurationField()
            )
        ).aggregate(avg=Avg('days'))

        avg = result.get('avg')
        if avg:
            return avg.days
        return 0
