from rest_framework import serializers
from .models import (
    JobPosting, Candidate, Application, StageHistory, InterviewNote,
    InterviewSchedule, Scorecard, EmailTemplate, EmailLog, Offer,
    InterviewInvitation,
)


class StageHistorySerializer(serializers.ModelSerializer):
    moved_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = StageHistory
        fields = ['id', 'from_stage', 'to_stage', 'moved_by_name',
                  'moved_at', 'notes']

    def get_moved_by_name(self, obj):
        if obj.moved_by:
            return f'{obj.moved_by.first_name} {obj.moved_by.last_name}'
        return 'System'


class InterviewNoteSerializer(serializers.ModelSerializer):
    interviewer_name = serializers.SerializerMethodField()

    class Meta:
        model  = InterviewNote
        fields = ['id', 'interviewer_name', 'score', 'notes', 'created_at']

    def get_interviewer_name(self, obj):
        if obj.interviewer:
            return f'{obj.interviewer.first_name} {obj.interviewer.last_name}'
        return 'Unknown'


class CandidateSerializer(serializers.ModelSerializer):
    full_name   = serializers.SerializerMethodField()
    has_resume  = serializers.SerializerMethodField()

    class Meta:
        model  = Candidate
        fields = ['id', 'first_name', 'last_name', 'full_name',
                  'email', 'phone', 'has_resume', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_has_resume(self, obj):
        return bool(obj.resume_path)


class InterviewScheduleSerializer(serializers.ModelSerializer):
    created_by_name     = serializers.SerializerMethodField()
    google_calendar_url = serializers.SerializerMethodField()
    ics_url             = serializers.SerializerMethodField()

    class Meta:
        model  = InterviewSchedule
        fields = [
            'id', 'scheduled_at', 'duration_min', 'interview_type',
            'meeting_link', 'interviewers', 'agenda', 'status',
            'created_by_name', 'created_at', 'google_calendar_url', 'ics_url',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f'{obj.created_by.first_name} {obj.created_by.last_name}'.strip()
        return 'Unknown'

    def get_google_calendar_url(self, obj):
        from .services import get_google_calendar_url
        try:
            return get_google_calendar_url(obj)
        except Exception:
            return ''

    def get_ics_url(self, obj):
        return f'/api/hiring/applications/{obj.application_id}/interviews/{obj.id}/ics/'


class InterviewScheduleCreateSerializer(serializers.Serializer):
    scheduled_at   = serializers.DateTimeField()
    duration_min   = serializers.IntegerField(default=60, min_value=15, max_value=480)
    interview_type = serializers.ChoiceField(
                         choices=['video', 'phone', 'in_person', 'technical'],
                         default='video'
                     )
    meeting_link   = serializers.URLField(required=False, allow_blank=True, default='')
    interviewers   = serializers.ListField(
                         child=serializers.CharField(max_length=200),
                         default=list, required=False
                     )
    agenda         = serializers.CharField(required=False, allow_blank=True, default='')


class InterviewScheduleStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['scheduled', 'completed', 'cancelled', 'rescheduled'])


class ScorecardSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.SerializerMethodField()
    dimensions    = serializers.SerializerMethodField()

    class Meta:
        model  = Scorecard
        fields = [
            'id', 'stage', 'reviewer_name', 'scores', 'dimensions',
            'recommendation', 'strengths', 'concerns', 'submitted_at',
        ]

    def get_reviewer_name(self, obj):
        if obj.reviewer:
            return f'{obj.reviewer.first_name} {obj.reviewer.last_name}'.strip()
        return 'Unknown'

    def get_dimensions(self, obj):
        """Return the ordered dimension list for this scorecard's stage."""
        return Scorecard.STAGE_DIMENSIONS.get(obj.stage, Scorecard.STAGE_DIMENSIONS['default'])


class ScorecardCreateSerializer(serializers.Serializer):
    stage          = serializers.ChoiceField(
                         choices=['applied', 'screening', 'interview', 'technical', 'offer', 'hired']
                     )
    scores         = serializers.DictField(child=serializers.IntegerField(min_value=1, max_value=5))
    recommendation = serializers.ChoiceField(
                         choices=['strong_yes', 'yes', 'maybe', 'no', 'strong_no']
                     )
    strengths      = serializers.CharField(required=False, allow_blank=True, default='')
    concerns       = serializers.CharField(required=False, allow_blank=True, default='')


class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EmailTemplate
        fields = ['id', 'name', 'template_type', 'subject', 'body']


class EmailLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EmailLog
        fields = ['id', 'direction', 'from_email', 'to_email', 'subject', 'body', 'message_id', 'sent_at', 'status']


class OfferSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Offer
        fields = [
            'id', 'salary', 'start_date', 'expiration_date',
            'notes', 'status', 'extended_at', 'signed_at', 'offer_letter_text',
            'benefits_summary', 'work_location',
        ]


class ApplicationSerializer(serializers.ModelSerializer):
    candidate_name      = serializers.SerializerMethodField()
    candidate_email     = serializers.SerializerMethodField()
    candidate_phone     = serializers.SerializerMethodField()
    has_resume          = serializers.SerializerMethodField()
    candidate_id        = serializers.SerializerMethodField()
    stage_history       = StageHistorySerializer(many=True, read_only=True)
    interview_notes     = InterviewNoteSerializer(many=True, read_only=True)
    interview_schedules = InterviewScheduleSerializer(many=True, read_only=True)
    scorecards          = ScorecardSerializer(many=True, read_only=True)
    scorecard_summary   = serializers.SerializerMethodField()
    offer               = OfferSerializer(read_only=True)
    candidate_skills    = serializers.SerializerMethodField()
    candidate_education = serializers.SerializerMethodField()
    candidate_experience = serializers.SerializerMethodField()
    candidate_projects  = serializers.SerializerMethodField()
    resume_processed    = serializers.SerializerMethodField()

    class Meta:
        model  = Application
        fields = [
            'id', 'candidate_id', 'candidate_name', 'candidate_email',
            'candidate_phone', 'has_resume', 'stage', 'rejection_reason',
            'source', 'source_details',
            'stage_history', 'interview_notes', 'interview_schedules', 'scorecards',
            'scorecard_summary', 'offer',
            'created_at', 'updated_at',
            'match_score', 'matched_skills', 'missing_skills', 'match_computed_at',
            'candidate_skills', 'candidate_education', 'candidate_experience', 'candidate_projects',
            'resume_processed',
            'score_skills', 'score_experience', 'score_projects', 'score_education',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_candidate_name(self, obj):
        return obj.candidate.get_full_name()

    def get_candidate_email(self, obj):
        return obj.candidate.email

    def get_candidate_phone(self, obj):
        return obj.candidate.phone

    def get_has_resume(self, obj):
        return bool(obj.candidate.resume_path)

    def get_candidate_id(self, obj):
        return str(obj.candidate.id)

    def get_candidate_skills(self, obj):
        return obj.candidate.parsed_skills if obj.candidate else []

    def get_candidate_education(self, obj):
        return obj.candidate.parsed_education if obj.candidate else []

    def get_candidate_experience(self, obj):
        return obj.candidate.parsed_experience if obj.candidate else []

    def get_candidate_projects(self, obj):
        return obj.candidate.parsed_projects if obj.candidate else []

    def get_resume_processed(self, obj):
        return obj.candidate.resume_processed if obj.candidate else False

    def get_scorecard_summary(self, obj):
        scs = obj.scorecards.all()
        if not scs:
            return None

        total_reviews = len(scs)
        all_scores = []
        rec_counts = {
            'strong_yes': 0,
            'yes': 0,
            'maybe': 0,
            'no': 0,
            'strong_no': 0
        }
        dimension_sums = {}
        dimension_counts = {}

        for sc in scs:
            if sc.recommendation in rec_counts:
                rec_counts[sc.recommendation] += 1
            if isinstance(sc.scores, dict):
                for dim, score in sc.scores.items():
                    try:
                        num_score = float(score)
                        all_scores.append(num_score)
                        dimension_sums[dim] = dimension_sums.get(dim, 0.0) + num_score
                        dimension_counts[dim] = dimension_counts.get(dim, 0) + 1
                    except (ValueError, TypeError):
                        pass

        avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0.0
        dimension_averages = {
            dim: round(dimension_sums[dim] / dimension_counts[dim], 1)
            for dim in dimension_sums if dimension_counts[dim] > 0
        }

        # Consensus evaluation
        positives = rec_counts['strong_yes'] + rec_counts['yes']
        negatives = rec_counts['no'] + rec_counts['strong_no']

        if rec_counts['strong_yes'] >= 2 and negatives == 0 and avg_score >= 4.0:
            consensus = 'Strong Hire'
            consensus_variant = 'emerald'
        elif positives > negatives and avg_score >= 3.5:
            consensus = 'Hire'
            consensus_variant = 'blue'
        elif negatives > positives or (avg_score > 0 and avg_score < 2.8):
            consensus = 'No Hire'
            consensus_variant = 'rose'
        else:
            consensus = 'Mixed Feedback'
            consensus_variant = 'amber'

        return {
            'total_reviews': total_reviews,
            'average_score': avg_score,
            'dimension_averages': dimension_averages,
            'recommendations': rec_counts,
            'consensus': consensus,
            'consensus_variant': consensus_variant,
        }



class ApplicationSummarySerializer(serializers.ModelSerializer):
    candidate_name  = serializers.SerializerMethodField()
    candidate_email = serializers.SerializerMethodField()
    has_resume      = serializers.SerializerMethodField()

    class Meta:
        model  = Application
        fields = ['id', 'candidate_name', 'candidate_email', 'has_resume',
                  'stage', 'match_score', 'source', 'created_at']

    def get_candidate_name(self, obj):
        return obj.candidate.get_full_name()

    def get_candidate_email(self, obj):
        return obj.candidate.email if obj.candidate else ''

    def get_has_resume(self, obj):
        return bool(obj.candidate.resume_path) if obj.candidate else False


class JobPostingSerializer(serializers.ModelSerializer):
    created_by_name    = serializers.SerializerMethodField()
    application_count  = serializers.SerializerMethodField()

    class Meta:
        model  = JobPosting
        fields = [
            'id', 'title', 'department', 'description', 'requirements',
            'experience_requirements', 'pipeline_stages',
            'status', 'created_by_name', 'application_count',
            'created_at', 'updated_at', 'closed_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f'{obj.created_by.first_name} {obj.created_by.last_name}'
        return 'Unknown'

    def get_application_count(self, obj):
        return obj.applications.filter(is_deleted=False).count()


class JobPostingCreateSerializer(serializers.Serializer):
    title        = serializers.CharField(max_length=300)
    department   = serializers.CharField(
                       max_length=200, required=False,
                       allow_blank=True, default=''
                   )
    description  = serializers.CharField(
                       required=False, allow_blank=True, default=''
                   )
    requirements = serializers.CharField(
                       required=False, allow_blank=True, default=''
                   )
    experience_requirements = serializers.CharField(
                       required=False, allow_blank=True, default=''
                   )
    status       = serializers.ChoiceField(
                       choices=['draft', 'open', 'closed'],
                       default='draft'
                   )
    pipeline_stages = serializers.ListField(
                       required=False, default=list
                   )


class JobPostingUpdateSerializer(serializers.Serializer):
    title        = serializers.CharField(max_length=300, required=False)
    department   = serializers.CharField(
                       max_length=200, required=False, allow_blank=True
                   )
    description  = serializers.CharField(required=False, allow_blank=True)
    requirements = serializers.CharField(required=False, allow_blank=True)
    experience_requirements = serializers.CharField(required=False, allow_blank=True)
    status       = serializers.ChoiceField(
                       choices=['draft', 'open', 'closed'], required=False
                   )
    pipeline_stages = serializers.ListField(required=False)


class StageUpdateSerializer(serializers.Serializer):
    stage            = serializers.CharField(max_length=60)
    rejection_reason = serializers.CharField(
                           required=False, allow_blank=True, default=''
                       )
    notes            = serializers.CharField(
                           required=False, allow_blank=True, default=''
                       )
    send_email       = serializers.BooleanField(required=False, default=True)
    custom_message   = serializers.CharField(
                           required=False, allow_blank=True, default=''
                       )


class InterviewNoteCreateSerializer(serializers.Serializer):
    score = serializers.IntegerField(min_value=1, max_value=5, required=False,
                                     allow_null=True)
    notes = serializers.CharField(min_length=1)


class OfferCreateSerializer(serializers.Serializer):
    salary            = serializers.DecimalField(max_digits=12, decimal_places=2)
    start_date        = serializers.DateField()
    expiration_date   = serializers.DateField(required=False, allow_null=True)
    notes             = serializers.CharField(required=False, allow_blank=True, default='')
    offer_letter_text = serializers.CharField(required=False, allow_blank=True, default='')
    benefits_summary  = serializers.CharField(required=False, allow_blank=True, default='')
    work_location     = serializers.CharField(required=False, allow_blank=True, default='')


class OfferResponseSerializer(serializers.Serializer):
    response = serializers.ChoiceField(choices=['accepted', 'declined'])


class EmailComposeSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=300)
    body    = serializers.CharField()


class InterviewInvitationSerializer(serializers.ModelSerializer):
    interviewer_name = serializers.SerializerMethodField()
    candidate_name   = serializers.SerializerMethodField()
    candidate_email  = serializers.SerializerMethodField()
    job_title        = serializers.SerializerMethodField()
    booking_url      = serializers.SerializerMethodField()

    class Meta:
        model = InterviewInvitation
        fields = [
            'id', 'token', 'title', 'notes', 'status', 'interview_type',
            'duration_min', 'interviewer', 'interviewer_name', 'candidate_name',
            'candidate_email', 'job_title', 'booking_url', 'expires_at', 'created_at',
            'booked_schedule'
        ]

    def get_interviewer_name(self, obj):
        return obj.interviewer.get_full_name() if obj.interviewer else 'Hiring Team'

    def get_candidate_name(self, obj):
        return obj.application.candidate.get_full_name() if obj.application and obj.application.candidate else 'Candidate'

    def get_candidate_email(self, obj):
        return obj.application.candidate.email if obj.application and obj.application.candidate else ''

    def get_job_title(self, obj):
        return obj.application.job_posting.title if obj.application and obj.application.job_posting else 'Role'

    def get_booking_url(self, obj):
        return f"/careers/schedule/{obj.token}"


class InterviewInvitationCreateSerializer(serializers.Serializer):
    title           = serializers.CharField(max_length=255, required=False, default='Interview Session')
    interview_type  = serializers.CharField(max_length=20, required=False, default='video')
    duration_min    = serializers.IntegerField(required=False, default=45)
    interviewer_id  = serializers.UUIDField(required=False, allow_null=True)
    notes           = serializers.CharField(required=False, allow_blank=True, default='')
    expires_in_days = serializers.IntegerField(required=False, default=7)
    send_email      = serializers.BooleanField(required=False, default=True)


class InterviewBookingConfirmSerializer(serializers.Serializer):
    scheduled_at    = serializers.DateTimeField()
    candidate_notes = serializers.CharField(required=False, allow_blank=True, default='')
    phone           = serializers.CharField(required=False, allow_blank=True, default='')


