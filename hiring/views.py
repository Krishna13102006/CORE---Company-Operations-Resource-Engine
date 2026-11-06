import os
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from core.permissions import IsHR
from core.exceptions import ServiceError
from core.pagination import StandardPagination
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.utils.decorators import method_decorator
from core.audit import log_action
from .services import JobPostingService, CandidateService, ApplicationService, ResumeMatchService
from .serializers import (
    JobPostingSerializer, JobPostingCreateSerializer, JobPostingUpdateSerializer,
    ApplicationSerializer, ApplicationSummarySerializer,
    StageUpdateSerializer, InterviewNoteCreateSerializer,
    InterviewScheduleSerializer, InterviewScheduleCreateSerializer, InterviewScheduleStatusSerializer,
    ScorecardSerializer, ScorecardCreateSerializer,
)
from .models import Application, InterviewSchedule, Scorecard

job_service       = JobPostingService()
candidate_service = CandidateService()
app_service       = ApplicationService()
match_service     = ResumeMatchService()


class HiringStatsView(APIView):
    permission_classes = [IsHR]

    def get(self, request):
        stats = job_service.get_hiring_stats(request.org_id)
        return Response(stats)


class JobPostingListView(APIView):
    permission_classes = [IsHR]

    def get(self, request):
        filters = {
            'status':     request.query_params.get('status'),
            'department': request.query_params.get('department'),
            'search':     request.query_params.get('search'),
        }
        filters  = {k: v for k, v in filters.items() if v}
        jobs     = job_service.list_jobs(request.org_id, filters)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(jobs, request)
        return paginator.get_paginated_response(
            JobPostingSerializer(page, many=True).data
        )

    def post(self, request):
        serializer = JobPostingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            job = job_service.create_job(
                org_id=request.org_id,
                user=request.user,
                title=d['title'],
                department=d.get('department', ''),
                description=d.get('description', ''),
                requirements=d.get('requirements', ''),
                experience_requirements=d.get('experience_requirements', ''),
                status=d.get('status', 'draft'),
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='create_job_posting',
                target_type='job_posting',
                target_id=job.id,
                detail=f'Created job posting: {job.title}'
            )
            return Response(
                JobPostingSerializer(job).data,
                status=status.HTTP_201_CREATED
            )
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class JobPostingDetailView(APIView):
    permission_classes = [IsHR]

    def get(self, request, job_id):
        try:
            job = job_service.get_job(str(job_id), request.org_id)
            return Response(JobPostingSerializer(job).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def patch(self, request, job_id):
        serializer = JobPostingUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            job = job_service.update_job(
                job_id=str(job_id),
                org_id=request.org_id,
                **serializer.validated_data
            )
            # Clear cached match scores — requirements changed, so old scores are stale
            from hiring.models import Application
            Application.objects.filter(
                job_posting_id=job_id,
                is_deleted=False,
            ).update(
                match_computed_at=None,
                score_skills=None,
                score_experience=None,
                score_projects=None,
                score_education=None,
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='update_job_posting',
                target_type='job_posting',
                target_id=job_id,
                detail=f'Updated job posting: {job.title}'
            )
            return Response(JobPostingSerializer(job).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def delete(self, request, job_id):
        try:
            job_service.delete_job(str(job_id), request.org_id)
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='delete_job_posting',
                target_type='job_posting',
                target_id=job_id,
                detail=f'Deleted job posting ID: {job_id}'
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ApplicationListView(APIView):
    permission_classes = [IsHR]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, job_id):
        try:
            applications = app_service.list_applications_for_job(
                str(job_id), request.org_id
            )
            # Dispatch async background calculation for any applications that still need match scores
            for app in applications:
                if app.match_score is None and getattr(app.candidate, 'resume_path', ''):
                    if not getattr(app.candidate, 'resume_processed', False):
                        from hiring.tasks import dispatch_resume_processing
                        try:
                            dispatch_resume_processing(str(app.candidate.id))
                        except Exception:
                            pass
                    else:
                        from hiring.tasks import dispatch_application_match
                        try:
                            dispatch_application_match(str(app.id), str(request.org_id))
                        except Exception:
                            pass

            return Response(
                ApplicationSummarySerializer(applications, many=True).data
            )
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to fetch applications for job {job_id}: {e}", exc_info=True)
            return Response({'error': 'Failed to fetch applications.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, job_id):
        # Add a candidate to this job (multipart - may include resume file)
        try:
            resume_file = request.FILES.get('resume')
            if resume_file:
                from core.validators import validate_uploaded_file
                safe_name = validate_uploaded_file(resume_file, allowed_types=('pdf', 'docx'), max_size_mb=15)
                resume_file.name = safe_name

            application = candidate_service.create_candidate_with_application(
                org_id=request.org_id,
                job_id=str(job_id),
                user=request.user,
                first_name=request.data.get('first_name', '').strip(),
                last_name=request.data.get('last_name', '').strip(),
                email=request.data.get('email', '').strip(),
                phone=request.data.get('phone', '').strip(),
                resume_file=resume_file,
                source=request.data.get('source', 'other').strip(),
                source_details=request.data.get('source_details', '').strip(),
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='add_candidate',
                target_type='application',
                target_id=application.id,
                detail=f'Added {application.candidate.get_full_name()} to {application.job_posting.title}'
            )
            return Response(
                ApplicationSerializer(application).data,
                status=status.HTTP_201_CREATED
            )
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class ApplicationDetailView(APIView):
    permission_classes = [IsHR]

    def get(self, request, application_id):
        try:
            app = app_service.get_application(
                str(application_id), request.org_id
            )
            # Auto-compute match score on-the-fly if not yet computed
            if app.match_score is None and getattr(app.candidate, 'resume_path', ''):
                try:
                    match_service.get_match(str(application_id), request.org_id)
                    app.refresh_from_db()
                except Exception as match_err:
                    import logging
                    logging.getLogger(__name__).warning(f"On-demand match calculation in detail view failed: {match_err}")

            return Response(ApplicationSerializer(app).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def delete(self, request, application_id):
        try:
            app = app_service.get_application(str(application_id), request.org_id)
            cand_name = app.candidate.get_full_name() if app.candidate else 'Candidate'
            job_title = app.job_posting.title if app.job_posting else 'Job'

            app_service.delete_application(str(application_id), request.org_id)

            log_action(
                org_id=request.org_id,
                user=request.user,
                action='delete_application',
                target_type='application',
                target_id=application_id,
                detail=f'Permanently deleted application, resume file, and vector embeddings for {cand_name} from {job_title}'
            )

            return Response({
                'success': True,
                'message': f'Application and resume data for {cand_name} deleted successfully.'
            }, status=status.HTTP_200_OK)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error deleting application {application_id}: {e}", exc_info=True)
            return Response({'error': str(e) or 'Internal server error deleting application.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CandidateDetailView(APIView):
    permission_classes = [IsHR]

    def delete(self, request, candidate_id):
        try:
            cand = candidate_service.get_candidate(str(candidate_id), request.org_id)
            cand_name = cand.get_full_name() if cand else 'Candidate'

            candidate_service.delete_candidate(str(candidate_id), request.org_id)

            log_action(
                org_id=request.org_id,
                user=request.user,
                action='delete_candidate',
                target_type='candidate',
                target_id=candidate_id,
                detail=f'Permanently deleted candidate {cand_name}, resume file, and vector embeddings'
            )

            return Response({
                'success': True,
                'message': f'Candidate {cand_name} and associated resume files/vectors deleted successfully.'
            }, status=status.HTTP_200_OK)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error deleting candidate {candidate_id}: {e}", exc_info=True)
            return Response({'error': str(e) or 'Internal server error deleting candidate.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ApplicationStageView(APIView):
    permission_classes = [IsHR]

    def patch(self, request, application_id):
        serializer = StageUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            app = app_service.move_stage(
                application_id=str(application_id),
                org_id=request.org_id,
                user=request.user,
                new_stage=d['stage'],
                rejection_reason=d.get('rejection_reason', ''),
                notes=d.get('notes', ''),
            )
            # Trigger automatic emails based on stage changes
            from hiring.services import send_automatic_email
            if d['stage'] == 'rejected':
                if d.get('send_email', True):
                    send_automatic_email(
                        app,
                        'rejected',
                        custom_body=d.get('custom_message') or None,
                        context={'rejection_reason': d.get('rejection_reason', '')}
                    )
            elif d['stage'] == 'interview':
                send_automatic_email(app, 'interview')
            elif d['stage'] == 'hired':
                try:
                    from automations.services import AutomationService
                    AutomationService.execute_zero_touch_onboarding(
                        org_id=request.org_id,
                        candidate=app.candidate,
                        application=app,
                        actor_user=request.user
                    )
                except Exception as auto_err:
                    import logging
                    logging.getLogger(__name__).warning(f"Automation trigger error: {auto_err}")

            log_action(
                org_id=request.org_id,
                user=request.user,
                action='move_stage',
                target_type='application',
                target_id=application_id,
                detail=f'Moved {app.candidate.get_full_name()} to {d["stage"]}'
            )
            return Response(ApplicationSerializer(app).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class InterviewNoteView(APIView):
    permission_classes = [IsHR]

    def post(self, request, application_id):
        serializer = InterviewNoteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            note = app_service.add_interview_note(
                application_id=str(application_id),
                org_id=request.org_id,
                user=request.user,
                score=d.get('score'),
                notes=d['notes'],
            )
            return Response({
                'id':               str(note.id),
                'interviewer_name': f'{note.interviewer.first_name} {note.interviewer.last_name}' if note.interviewer else 'Unknown',
                'score':            note.score,
                'notes':            note.notes,
                'created_at':       note.created_at.isoformat(),
            }, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


from django.views.decorators.clickjacking import xframe_options_exempt


def _generate_fallback_resume_pdf(candidate) -> bytes:
    """Generate a clean, professional PDF document containing candidate profile information."""
    try:
        import io
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        import xml.sax.saxutils as saxutils

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40
        )
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'CandidateTitle',
            parent=styles['Heading1'],
            fontSize=22,
            leading=26,
            textColor=colors.HexColor('#0F172A'),
            fontName='Helvetica-Bold',
            spaceAfter=4,
        )
        subtitle_style = ParagraphStyle(
            'CandidateSub',
            parent=styles['Normal'],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#475569'),
            fontName='Helvetica',
            spaceAfter=12,
        )
        section_style = ParagraphStyle(
            'CandidateSection',
            parent=styles['Heading2'],
            fontSize=12,
            leading=16,
            textColor=colors.HexColor('#1E293B'),
            fontName='Helvetica-Bold',
            spaceBefore=14,
            spaceAfter=6,
        )
        body_style = ParagraphStyle(
            'CandidateBody',
            parent=styles['Normal'],
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor('#334155'),
            fontName='Helvetica',
            spaceAfter=4,
        )

        elements = []
        name = candidate.get_full_name() if hasattr(candidate, 'get_full_name') else f"{candidate.first_name} {candidate.last_name}"
        elements.append(Paragraph(saxutils.escape(name or "Candidate Profile"), title_style))

        contact_parts = []
        if candidate.email:
            contact_parts.append(f"Email: {saxutils.escape(candidate.email)}")
        if candidate.phone:
            contact_parts.append(f"Phone: {saxutils.escape(candidate.phone)}")
        contact_line = " &nbsp;|&nbsp; ".join(contact_parts) if contact_parts else "Contact information not provided"
        elements.append(Paragraph(contact_line, subtitle_style))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceAfter=12))

        skills = getattr(candidate, 'parsed_skills', []) or []
        if skills:
            elements.append(Paragraph("KEY SKILLS &amp; TECHNOLOGIES", section_style))
            skills_str = ", ".join(saxutils.escape(str(s)) for s in skills[:20])
            elements.append(Paragraph(skills_str, body_style))
            elements.append(Spacer(1, 6))

        experience = getattr(candidate, 'parsed_experience', []) or []
        if experience:
            elements.append(Paragraph("EXPERIENCE HIGHLIGHTS", section_style))
            for exp in experience[:6]:
                elements.append(Paragraph(f"• {saxutils.escape(str(exp))}", body_style))
            elements.append(Spacer(1, 6))

        education = getattr(candidate, 'parsed_education', []) or []
        if education:
            elements.append(Paragraph("EDUCATION &amp; QUALIFICATIONS", section_style))
            for edu in education[:4]:
                elements.append(Paragraph(f"• {saxutils.escape(str(edu))}", body_style))

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
    except Exception:
        # Ultimate minimal PDF 1.4 fallback if ReportLab encounters any error
        buf = bytearray()
        offsets = []

        def write_obj(obj_num, data):
            offsets.append(len(buf))
            buf.extend(f"{obj_num} 0 obj\n".encode("ascii"))
            buf.extend(data)
            buf.extend(b"\nendobj\n")

        buf.extend(b"%PDF-1.4\n")
        write_obj(1, b"<< /Type /Catalog /Pages 2 0 R >>")
        write_obj(2, b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
        write_obj(3, b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>")

        name = candidate.get_full_name() if hasattr(candidate, 'get_full_name') else f"{candidate.first_name} {candidate.last_name}"
        stream_lines = [
            "BT",
            "/F1 16 Tf",
            f"50 780 Td ({name}) Tj",
            "/F1 10 Tf",
            f"0 -22 Td (Email: {candidate.email}   |   Phone: {candidate.phone or 'Not provided'}) Tj",
            "0 -15 Td (----------------------------------------------------------------------------------------------------) Tj",
            "ET"
        ]
        content = "\n".join(stream_lines).encode("latin-1", "replace")
        write_obj(4, b"<< /Length " + str(len(content)).encode("ascii") + b" >>\nstream\n" + content + b"\nendstream")
        write_obj(5, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

        xref_pos = len(buf)
        buf.extend(f"xref\n0 {len(offsets) + 1}\n0000000000 65535 f \n".encode("ascii"))
        for off in offsets:
            buf.extend(f"{off:010d} 00000 n \n".encode("ascii"))
        buf.extend(f"trailer\n<< /Size {len(offsets) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode("ascii"))
        return bytes(buf)


@method_decorator(xframe_options_exempt, name='dispatch')
class ResumeDownloadView(APIView):
    permission_classes = [IsHR]

    def initial(self, request, *args, **kwargs):
        # Support authentication via query param for direct browser previews / iframes / new tabs
        token_str = request.query_params.get('token')
        if token_str and (not getattr(request, 'user', None) or not request.user.is_authenticated):
            from rest_framework_simplejwt.tokens import AccessToken
            try:
                validated = AccessToken(token_str)
                from accounts.models import User
                user = User.objects.get(id=validated['user_id'])
                if user.role in ('admin', 'hr') or user.is_superuser:
                    request.user = user
                    request.org_id = user.org_id
            except Exception:
                pass

        super().initial(request, *args, **kwargs)

        if not getattr(request, 'org_id', None) and getattr(request, 'user', None) and getattr(request.user, 'org_id', None):
            request.org_id = request.user.org_id

    def get(self, request, candidate_id):
        from hiring.models import Candidate
        from django.http import HttpResponse

        if not getattr(request, 'user', None) or not request.user.is_authenticated:
            return Response({'error': 'Authentication required to preview resume.'}, status=status.HTTP_401_UNAUTHORIZED)

        candidate = Candidate.objects.filter(id=candidate_id, org_id=request.org_id, is_deleted=False).first()
        if not candidate:
            return Response({'error': 'Candidate not found.'}, status=status.HTTP_404_NOT_FOUND)

        # 1. Primary durable source: BinaryField stored directly in PostgreSQL (Neon DB)
        if candidate.resume_data:
            pdf_bytes = bytes(candidate.resume_data)
            # Rehydrate disk cache if candidate has a resume_path so any local file operations succeed
            if candidate.resume_path:
                norm_p = candidate.resume_path.replace('\\', os.sep).replace('/', os.sep)
                disk_cache_path = os.path.join(settings.MEDIA_ROOT, norm_p)
                try:
                    os.makedirs(os.path.dirname(disk_cache_path), exist_ok=True)
                    if not os.path.exists(disk_cache_path):
                        with open(disk_cache_path, 'wb') as f:
                            f.write(pdf_bytes)
                except Exception:
                    pass

            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="resume_{candidate_id}.pdf"'
            return response

        # 2. Check filesystem for existing file (e.g. uploaded before migration)
        resume_path = candidate.resume_path or ''
        found_path = None
        if resume_path:
            normalized_path = resume_path.replace('\\', os.sep).replace('/', os.sep)
            candidate_file_path = os.path.join(settings.MEDIA_ROOT, normalized_path)

            if os.path.exists(candidate_file_path):
                found_path = candidate_file_path
            elif os.path.isabs(resume_path) and os.path.exists(resume_path):
                found_path = resume_path
            else:
                # Search media/hiring for matches by basename or candidate_id
                hiring_root = os.path.join(settings.MEDIA_ROOT, 'hiring')
                target_name = os.path.basename(normalized_path)
                if os.path.exists(hiring_root):
                    for root, _, files in os.walk(hiring_root):
                        if target_name and target_name in files:
                            found_path = os.path.join(root, target_name)
                            break
                        for f in files:
                            if str(candidate_id) in f:
                                found_path = os.path.join(root, f)
                                break
                        if found_path:
                            break

        if found_path and os.path.exists(found_path):
            try:
                with open(found_path, 'rb') as f:
                    pdf_bytes = f.read()
                # Persist to DB so Render restarts will never lose this resume again
                if not candidate.resume_data and pdf_bytes:
                    candidate.resume_data = pdf_bytes
                    candidate.save(update_fields=['resume_data'])

                response = HttpResponse(pdf_bytes, content_type='application/pdf')
                response['Content-Disposition'] = f'inline; filename="resume_{candidate_id}.pdf"'
                return response
            except Exception:
                pass

        # 3. Fallback: synthesize clean, styled resume summary PDF so preview never breaks
        pdf_bytes = _generate_fallback_resume_pdf(candidate)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="resume_{candidate_id}.pdf"'
        return response


class ResumeMatchView(APIView):
    """
    Returns match analysis between a candidate's resume and the job posting
    they applied for. Called when HR opens the candidate drawer.

    Returns immediately with cached data if available (< 24 hours old).
    Computes fresh if not cached or cache is stale.
    """
    permission_classes = [IsHR]

    def get(self, request, application_id):
        try:
            result = match_service.get_match(
                application_id=str(application_id),
                org_id=request.org_id,
            )
            return Response(result)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class JobChatView(APIView):
    """
    RAG Chatbot view scoped specifically to a particular job posting
    and all candidates applied to it.
    """
    permission_classes = [IsHR]

    def post(self, request, job_id):
        question = request.data.get('question', '').strip()
        if not question:
            return Response({'error': 'Question is required.'}, status=status.HTTP_400_BAD_REQUEST)

        history = request.data.get('history') or request.data.get('messages') or []

        from hiring.models import Candidate, JobPosting
        from django.conf import settings
        import httpx
        import logging

        logger = logging.getLogger(__name__)

        try:
            # 1. Fetch Job
            try:
                job = JobPosting.objects.get(id=job_id, org_id=request.org_id, is_deleted=False)
            except JobPosting.DoesNotExist:
                return Response({'error': 'Job posting not found.'}, status=status.HTTP_404_NOT_FOUND)

            # 2. Fetch Candidates applied to this job
            candidates = Candidate.objects.filter(
                applications__job_posting_id=job_id,
                org_id=request.org_id,
                is_deleted=False
            ).distinct()

            # 3. Build candidate context (always include all applicants and full details)
            candidate_list = []
            for c in candidates:
                app = c.applications.filter(job_posting_id=job_id, is_deleted=False).first()
                score = int(app.match_score * 100) if (app and app.match_score is not None) else 0
                candidate_list.append({
                    'name': c.get_full_name(),
                    'email': c.email or 'Not provided',
                    'phone': c.phone or 'Not provided',
                    'stage': app.stage if app else 'applied',
                    'score': score,
                    'matched_skills': app.matched_skills if app else [],
                    'missing_skills': app.missing_skills if app else [],
                    'extracted_skills': c.parsed_skills or [],
                    'experience': c.parsed_experience or [],
                    'education': c.parsed_education or [],
                })

            # Sort by score descending so the best candidate is always first
            candidate_list.sort(key=lambda x: x['score'], reverse=True)

            context_parts = []
            if candidate_list:
                best_cand = candidate_list[0]
                worst_cand = candidate_list[-1]
                summary = (
                    "RANKINGS SUMMARY:\n"
                    f"- Best Candidate: {best_cand['name']} (Match Score: {best_cand['score']}%)\n"
                    f"- Lowest Match Candidate: {worst_cand['name']} (Match Score: {worst_cand['score']}%)\n\n"
                    "CANDIDATES DETAILED LIST:\n"
                )
                context_parts.append(summary)

                for idx, item in enumerate(candidate_list, 1):
                    c_text = f"Rank {idx}: {item['name']}\n"
                    c_text += f"   Email: {item['email']}\n"
                    if item.get('phone') and item['phone'] != 'Not provided':
                        c_text += f"   Phone: {item['phone']}\n"
                    c_text += f"   Application Stage: {item['stage'].title()}\n"
                    c_text += f"   Match Score: {item['score']}%\n"
                    c_text += f"   Matched Job Skills: {', '.join(item['matched_skills']) if item['matched_skills'] else 'None'}\n"
                    c_text += f"   Missing Job Skills: {', '.join(item['missing_skills']) if item['missing_skills'] else 'None'}\n"
                    c_text += f"   Extracted Skills: {', '.join(item['extracted_skills'][:10]) if item['extracted_skills'] else 'None'}\n"
                    # Deep experience & education for top candidates to keep token usage within limits
                    if idx <= 3:
                        if item['experience']:
                            c_text += "   Experience Details:\n" + "\n".join([f"     - {exp}" for exp in item['experience'][:4]]) + "\n"
                        if item['education']:
                            c_text += "   Education Details:\n" + "\n".join([f"     - {edu}" for edu in item['education'][:2]]) + "\n"
                    context_parts.append(c_text)

            candidates_context = "\n---\n".join(context_parts) if context_parts else "No candidate resumes processed yet for this job."

            job_text = (
                f"Job Title: {job.title}\n"
                f"Department: {job.department}\n"
                f"Status: {job.status.title()}\n"
                f"Requirements: {job.requirements or 'None listed'}\n"
                f"Description: {job.description or 'None listed'}"
            )

            # 4. Build Recent Conversation History (compacted to prevent token bloat on follow-up questions)
            history_str = ""
            if isinstance(history, list) and history:
                turns = []
                for h in history[-4:]:
                    if not isinstance(h, dict):
                        continue
                    role = "User" if h.get('role') == 'user' else "Assistant"
                    content = (h.get('content') or '').strip()
                    if not content or "I am your Talent Assistant" in content:
                        continue
                    # Truncate assistant turns so giant previous tables don't flood prompt tokens
                    if role == "Assistant" and len(content) > 350:
                        content = content[:350] + "..."
                    turns.append(f"{role}: {content}")
                if turns:
                    history_str = "Recent Conversation History:\n" + "\n".join(turns) + "\n\n"

            # 5. Always provide complete context (both Job and Candidates)
            system_prompt = (
                "You are CORE AI Talent & Recruiting Assistant for a hiring manager.\n"
                "Your role is to answer questions about the job opening AND the candidates/applicants who applied for it.\n"
                "You have full, direct access to both the Job Information and the Candidates Resume Details provided in the context.\n\n"
                "Strict Operational Instructions:\n"
                "1. When asked about ANY candidate (by name, email, skills, experience, score, or contact info), look them up in the Candidates Resume Details and answer directly, accurately, and factually.\n"
                "2. NEVER claim that a candidate's email, phone, or info is missing or not in the job information when it is listed in the Candidates Resume Details. Candidate emails are explicitly provided in each candidate's profile.\n"
                "3. Use the Recent Conversation History to maintain conversational continuity for follow-up questions, pronouns, and previous replies.\n"
                "4. When asked for recommendations or best candidates, refer to the RANKINGS SUMMARY and match scores.\n"
                "5. Present responses with clean markdown formatting. Be concise, direct, and factual."
            )

            user_prompt = (
                f"{history_str}"
                f"Job Information:\n"
                f"===\n"
                f"{job_text}\n"
                f"===\n\n"
                f"Candidates Resume Details:\n"
                f"===\n"
                f"{candidates_context}\n"
                f"===\n\n"
                f"User Question: {question}"
            )

            # 6. Execute AI Generation with Cloud LLMs
            # Google Gemini is prioritized first because it has a 1,000,000 TPM limit (vs Groq's 8,000 TPM),
            # preventing token rate-limit starvation on consecutive multi-turn queries.
            import time
            start_gen_time = time.time()
            answer = ""

            # 1. Try Google Gemini API (ultra-fast gemini-3.5-flash-lite, 1M TPM)
            gemini_key = getattr(settings, 'GEMINI_API_KEY', '').strip()
            if gemini_key:
                try:
                    from ml.rag_generator import _call_gemini
                    answer = _call_gemini(user_prompt, system_prompt, max_tokens=1200)
                except Exception as e:
                    logger.warning(f"Gemini generation failed in JobChatView: {e}")

            # 2. Try Groq Cloud fallback if Gemini was unavailable and we have time budget (< 8s elapsed)
            groq_key = getattr(settings, 'GROQ_API_KEY', '').strip()
            if not answer and groq_key and (time.time() - start_gen_time < 8.0):
                try:
                    from ml.rag_generator import _call_groq
                    answer = _call_groq(user_prompt, system_prompt, max_tokens=1024)
                except Exception as e:
                    logger.warning(f"Groq generation failed in JobChatView: {e}")

            # 3. Try OpenAI / custom LLM if configured (< 10s elapsed)
            openai_key = getattr(settings, 'OPENAI_API_KEY', '').strip()
            if not answer and openai_key and (time.time() - start_gen_time < 10.0):
                try:
                    from ml.rag_generator import _call_openai
                    answer = _call_openai(user_prompt, system_prompt)
                except Exception as e:
                    logger.warning(f"OpenAI generation failed in JobChatView: {e}")

            # 7. Fallback: Deterministic Candidate Intelligence from live pipeline data
            if not answer:
                q_lower = question.lower()
                if not candidate_list:
                    answer = f"No processed candidate resumes are currently available for **{job.title}**."
                else:
                    # Check if user is asking about a specific candidate by name or email
                    matched_cand = None
                    for c in candidate_list:
                        c_name_lower = c['name'].lower()
                        if c_name_lower in q_lower or (c['email'] and c['email'].lower() in q_lower):
                            matched_cand = c
                            break
                        parts = [p.lower() for p in c['name'].split() if len(p) >= 3]
                        if any(p in q_lower for p in parts):
                            matched_cand = c
                            break

                    # If not matched directly in current question, inspect recent conversation history for context (e.g. "what is her email?")
                    if not matched_cand and isinstance(history, list) and history:
                        hist_text = " ".join([h.get('content', '') for h in history[-3:] if isinstance(h, dict)]).lower()
                        for c in candidate_list:
                            c_name_lower = c['name'].lower()
                            if c_name_lower in hist_text:
                                matched_cand = c
                                break
                            parts = [p.lower() for p in c['name'].split() if len(p) >= 3]
                            if any(p in hist_text for p in parts):
                                matched_cand = c
                                break

                    if matched_cand:
                        if any(w in q_lower for w in ['email', 'mail', 'contact', 'reach', 'address']):
                            answer = f"**{matched_cand['name']}**'s email address is `{matched_cand['email']}`."
                        elif any(w in q_lower for w in ['skill', 'stack', 'tech', 'matched', 'missing']):
                            matched_skills = ', '.join(matched_cand['matched_skills']) if matched_cand['matched_skills'] else 'None'
                            missing_skills = ', '.join(matched_cand['missing_skills']) if matched_cand['missing_skills'] else 'None'
                            answer = (
                                f"### Skills Breakdown for {matched_cand['name']}\n\n"
                                f"- **Match Score**: {matched_cand['score']}%\n"
                                f"- **Matched Job Skills**: {matched_skills}\n"
                                f"- **Skill Gaps / Missing**: {missing_skills}\n"
                                f"- **Extracted Core Skills**: {', '.join(matched_cand['extracted_skills'][:10]) if matched_cand['extracted_skills'] else 'None'}"
                            )
                        elif any(w in q_lower for w in ['experience', 'work', 'history', 'job', 'company']):
                            exp_list = '\n'.join([f"- {e}" for e in matched_cand['experience']]) if matched_cand['experience'] else 'No detailed experience records parsed.'
                            answer = f"### Work Experience for {matched_cand['name']}\n\n{exp_list}"
                        elif any(w in q_lower for w in ['education', 'degree', 'college', 'university']):
                            edu_list = '\n'.join([f"- {e}" for e in matched_cand['education']]) if matched_cand['education'] else 'No detailed education records parsed.'
                            answer = f"### Education for {matched_cand['name']}\n\n{edu_list}"
                        else:
                            matched_skills = ', '.join(matched_cand['matched_skills']) if matched_cand['matched_skills'] else 'None'
                            missing_skills = ', '.join(matched_cand['missing_skills']) if matched_cand['missing_skills'] else 'None'
                            answer = (
                                f"### Candidate Details: {matched_cand['name']}\n\n"
                                f"- **Email**: `{matched_cand['email']}`\n"
                                f"- **Match Score**: {matched_cand['score']}%\n"
                                f"- **Application Stage**: {matched_cand['stage'].title()}\n"
                                f"- **Matched Skills**: {matched_skills}\n"
                                f"- **Skill Gaps**: {missing_skills}\n"
                            )
                    elif any(w in q_lower for w in ['best', 'top', 'recommend', 'who should', 'highest', 'leader', 'first choice']):
                        top = candidate_list[0]
                        answer = (
                            f"### Top Recommended Candidate for {job.title}\n\n"
                            f"**{top['name']}** has the highest qualification match score at **{top['score']}%**.\n\n"
                            f"- **Email**: `{top['email']}`\n"
                            f"- **Matched Job Skills**: {', '.join(top['matched_skills']) if top['matched_skills'] else 'None'}\n"
                            f"- **Missing Skills / Gaps**: {', '.join(top['missing_skills']) if top['missing_skills'] else 'None'}\n"
                        )
                        if top.get('extracted_skills'):
                            answer += f"- **Extracted Core Skills**: {', '.join(top['extracted_skills'][:10])}\n"
                    elif any(w in q_lower for w in ['compare', 'rank', 'list', 'all candidates', 'score', 'overview']):
                        answer = f"### Candidate Rankings for {job.title}\n\n"
                        for idx, c in enumerate(candidate_list, 1):
                            matched_str = ', '.join(c['matched_skills'][:4]) if c['matched_skills'] else 'None'
                            missing_str = ', '.join(c['missing_skills'][:3]) if c['missing_skills'] else 'None'
                            answer += (
                                f"{idx}. **{c['name']}** — **{c['score']}% Match**\n"
                                f"   - **Email**: `{c['email']}`\n"
                                f"   - **Matched Skills**: {matched_str}\n"
                                f"   - **Skill Gaps**: {missing_str}\n\n"
                            )
                    elif any(w in q_lower for w in ['job', 'requirement', 'role', 'desc', 'position', 'criteria']):
                        answer = (
                            f"### Job Opening: {job.title}\n\n"
                            f"- **Department**: {job.department}\n"
                            f"- **Status**: {job.status.title()}\n"
                            f"- **Key Requirements**: {job.requirements or 'None listed'}\n\n"
                            f"**Description**:\n{job.description or 'No detailed description provided.'}"
                        )
                    else:
                        top = candidate_list[0]
                        candidates_brief = ', '.join([f"{c['name']} ({c['score']}%)" for c in candidate_list[:3]])
                        answer = (
                            f"### {job.title} Pipeline Overview\n\n"
                            f"- **Total Candidates Processed**: {len(candidate_list)}\n"
                            f"- **Top Match**: **{top['name']}** ({top['score']}% match)\n"
                            f"- **Leading Candidates**: {candidates_brief}\n"
                            f"- **Job Requirements**: {job.requirements or 'None listed'}\n\n"
                            f"You can ask me to evaluate a specific applicant or compare candidates side-by-side."
                        )

            return Response({
                'answer': answer
            })

        except Exception as e:
            logger.error(f'Hiring RAG Error: {e}')
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BulkUploadView(APIView):
    """
    Accepts multiple PDF resume files for a job, extracts names, emails, and phone numbers
    synchronously to create Candidates and Applications, then kicks off background processing
    to parse skills/experience and compute vector embeddings.
    """
    permission_classes = [IsHR]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, job_id):
        resumes = request.FILES.getlist('resumes')
        if not resumes:
            resumes = request.FILES.getlist('resumes[]') or request.FILES.getlist('file')
            if not resumes and request.FILES.get('resume'):
                resumes = [request.FILES.get('resume')]

        if not resumes:
            return Response({'error': 'No resumes uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        from hiring.models import JobPosting, Candidate, Application
        from django.conf import settings
        from django.db import transaction
        import uuid
        import os
        from hiring.repositories import CandidateRepository, ApplicationRepository

        candidate_repo = CandidateRepository()
        app_repo = ApplicationRepository()

        try:
            job = JobPosting.objects.get(id=job_id, org_id=request.org_id, is_deleted=False)
        except JobPosting.DoesNotExist:
            return Response({'error': 'Job posting not found.'}, status=status.HTTP_404_NOT_FOUND)

        uploaded_count = 0
        errors = []

        from core.validators import validate_uploaded_file
        from rest_framework.exceptions import ValidationError

        for resume_file in resumes:
            try:
                safe_name = validate_uploaded_file(resume_file, allowed_types=('pdf', 'docx'), max_size_mb=15)
                resume_file.name = safe_name
            except ValidationError as ve:
                err_msg = ve.detail[0] if hasattr(ve, 'detail') and isinstance(ve.detail, list) else str(ve)
                errors.append(f"{resume_file.name}: {err_msg}")
                continue

            try:
                # 1. Save resume file to disk
                unique_name = f"{uuid.uuid4()}_{resume_file.name.replace(' ', '_')}"
                file_path = os.path.join(settings.MEDIA_ROOT, 'hiring', str(request.org_id), unique_name)
                os.makedirs(os.path.dirname(file_path), exist_ok=True)

                resume_bytes = None
                with open(file_path, 'wb+') as dest:
                    for chunk in resume_file.chunks():
                        dest.write(chunk)
                try:
                    with open(file_path, 'rb') as f:
                        resume_bytes = f.read()
                except Exception:
                    pass

                resume_path = os.path.join('hiring', str(request.org_id), unique_name)

                # 2. Asynchronous details placeholders: parse name from filename
                base_name = os.path.splitext(resume_file.name)[0]
                name = base_name.replace('_', ' ').replace('-', ' ').title()
                
                parts = name.split()
                if len(parts) >= 2:
                    first_name = parts[0]
                    last_name = " ".join(parts[1:])
                elif len(parts) == 1:
                    first_name = parts[0]
                    last_name = "Candidate"
                else:
                    first_name = "Unknown"
                    last_name = "Candidate"

                email = f"processing_{uuid.uuid4().hex[:8]}@example.com"
                phone = ''

                # 3. Save Candidate and Application placeholder records
                with transaction.atomic():
                    candidate = candidate_repo.create(
                        org_id=request.org_id,
                        first_name=first_name,
                        last_name=last_name,
                        email=email,
                        phone=phone,
                        resume_path=resume_path,
                        resume_data=resume_bytes,
                    )
                    application = app_repo.create(
                        org_id=request.org_id,
                        candidate=candidate,
                        job_posting=job,
                        stage='applied',
                        source=request.data.get('source', 'direct').strip(),
                    )
                    app_repo.create_stage_history(
                        org_id=request.org_id,
                        application=application,
                        from_stage='',
                        to_stage='applied',
                        moved_by=request.user,
                        notes='Application created via Bulk Upload',
                    )

                uploaded_count += 1

                # 4. Trigger async processing pipeline (Qdrant & full parsing)
                try:
                    from hiring.tasks import dispatch_resume_processing
                    dispatch_resume_processing(str(candidate.id))
                except Exception as queue_err:
                    logger.warning(f"Failed to dispatch processing for candidate {candidate.id}: {queue_err}")

            except Exception as e:
                errors.append(f"Failed to process {resume_file.name}: {str(e)}")

        return Response({
            'uploaded_count': uploaded_count,
            'errors': errors
        }, status=status.HTTP_201_CREATED if uploaded_count > 0 else status.HTTP_400_BAD_REQUEST)


class InterviewScheduleView(APIView):
    """
    GET  /applications/<id>/interviews/  → list all scheduled interviews for an application
    POST /applications/<id>/interviews/  → schedule a new interview
    """
    permission_classes = [IsHR]

    def get(self, request, application_id):
        schedules = InterviewSchedule.objects.filter(
            application_id=application_id,
            org_id=request.org_id,
        ).order_by('scheduled_at')
        return Response(InterviewScheduleSerializer(schedules, many=True).data)

    def post(self, request, application_id):
        # Verify application belongs to this org
        try:
            app = Application.objects.select_related('candidate', 'job_posting', 'org').get(
                id=application_id, org_id=request.org_id, is_deleted=False
            )
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = InterviewScheduleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            # Check overlapping interviewer schedules (Calendar Sync check)
            import datetime
            start_time = d['scheduled_at']
            end_time = start_time + datetime.timedelta(minutes=d.get('duration_min', 60))
            
            for existing in InterviewSchedule.objects.filter(org_id=request.org_id, status='scheduled'):
                existing_start = existing.scheduled_at
                existing_end = existing_start + datetime.timedelta(minutes=existing.duration_min)
                
                if start_time < existing_end and end_time > existing_start:
                    shared_interviewers = set(d.get('interviewers', [])).intersection(set(existing.interviewers))
                    if shared_interviewers:
                        return Response({
                            'error': f"Interviewer conflict: {', '.join(shared_interviewers)} is/are already booked for an interview from {existing_start.strftime('%Y-%m-%d %H:%M')} to {existing_end.strftime('%H:%M')}."
                        }, status=status.HTTP_400_BAD_REQUEST)

            # Auto-generation of video call meeting link (CORE Meeting Room integration)
            use_core_meeting = request.data.get('use_core_meeting', True)
            meeting_link = d.get('meeting_link', '')
            if d.get('interview_type') == 'video' and (not meeting_link or use_core_meeting):
                import uuid
                from meetings.models import Meeting, MeetingParticipant

                room_code = f"meet-{uuid.uuid4().hex[:6]}"
                meeting_title = f"Interview: {app.candidate.get_full_name()} — {app.job_posting.title}"
                core_meeting = Meeting.objects.create(
                    org=app.org,
                    title=meeting_title,
                    description=f"Interview round for {app.job_posting.title}. Candidate: {app.candidate.get_full_name()} ({app.candidate.email})",
                    host=request.user,
                    status='scheduled',
                    scheduled_start=start_time,
                    scheduled_end=end_time,
                    room_code=room_code,
                    passcode="interview",
                    agenda_items=[
                        {"id": "ag-1", "text": "Introductions & Role Overview", "is_completed": False},
                        {"id": "ag-2", "text": "Technical & Experience Deep-Dive", "is_completed": False},
                        {"id": "ag-3", "text": "Problem Solving & Architecture", "is_completed": False},
                        {"id": "ag-4", "text": "Candidate Q&A and Next Steps", "is_completed": False},
                    ]
                )

                created_emails = set()

                # 1. Add Host as participant
                host_email = request.user.email.strip().lower()
                MeetingParticipant.objects.get_or_create(
                    meeting=core_meeting,
                    email=host_email,
                    defaults={
                        'org': app.org,
                        'name': request.user.get_full_name() or host_email,
                        'user': request.user,
                        'role': 'host',
                        'is_admitted': True,
                        'invite_status': 'accepted'
                    }
                )
                created_emails.add(host_email)

                # 2. Add Candidate as attendee if email differs from host
                cand_email = app.candidate.email.strip().lower()
                if cand_email not in created_emails:
                    MeetingParticipant.objects.get_or_create(
                        meeting=core_meeting,
                        email=cand_email,
                        defaults={
                            'org': app.org,
                            'name': app.candidate.get_full_name(),
                            'role': 'attendee',
                            'is_admitted': True,
                            'invite_status': 'pending'
                        }
                    )
                    created_emails.add(cand_email)

                # 3. Add other interviewers
                for interviewer_name in d.get('interviewers', []):
                    clean_name = interviewer_name.strip()
                    if not clean_name:
                        continue
                    first_token = clean_name.split()[0]
                    from accounts.models import User
                    int_user = User.objects.filter(org=app.org, email__iexact=clean_name).first()
                    if not int_user:
                        int_user = User.objects.filter(org=app.org, email__icontains=first_token).first()
                    if not int_user:
                        int_user = User.objects.filter(org=app.org, first_name__icontains=first_token).first()

                    int_email = int_user.email.strip().lower() if int_user else f"{first_token.lower()}@workspace.local"
                    if int_email not in created_emails:
                        MeetingParticipant.objects.get_or_create(
                            meeting=core_meeting,
                            email=int_email,
                            defaults={
                                'org': app.org,
                                'name': int_user.get_full_name() if int_user else clean_name,
                                'user': int_user,
                                'role': 'co-host' if int_user else 'attendee',
                                'is_admitted': True,
                                'invite_status': 'pending'
                            }
                        )
                        created_emails.add(int_email)

                base_origin = request.headers.get('Origin') or request.headers.get('Referer') or ''
                if base_origin:
                    meeting_link = f"{base_origin.rstrip('/')}/meetings/room/{room_code}"
                else:
                    meeting_link = f"/meetings/room/{room_code}"
            elif d.get('interview_type') == 'video' and not meeting_link:
                import uuid
                meeting_link = f"https://meet.google.com/{uuid.uuid4().hex[:3]}-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:3]}"

            schedule = InterviewSchedule.objects.create(
                org=app.org,
                application=app,
                scheduled_at=d['scheduled_at'],
                duration_min=d.get('duration_min', 60),
                interview_type=d.get('interview_type', 'video'),
                meeting_link=meeting_link,
                interviewers=d.get('interviewers', []),
                agenda=d.get('agenda', ''),
                status='scheduled',
                created_by=request.user,
            )

            # Send interview invite email with attached .ics and calendar links
            try:
                from hiring.services import generate_interview_ics, get_google_calendar_url, send_automatic_email
                ics_content = generate_interview_ics(schedule)
                gcal_link = get_google_calendar_url(schedule)
                attachments = [{
                    'filename': 'interview_invite.ics',
                    'content': ics_content.encode('utf-8'),
                    'content_type': 'text/calendar; charset=utf-8'
                }]
                cand_context = {
                    'scheduled_time': schedule.scheduled_at.strftime('%B %d, %Y at %I:%M %p UTC'),
                    'duration': f"{schedule.duration_min} minutes",
                    'meeting_link': schedule.meeting_link or 'Video Conference Room',
                    'google_calendar_link': gcal_link,
                }
                send_automatic_email(app, 'interview', context=cand_context, attachments=attachments)
            except Exception as email_err:
                import logging
                logging.getLogger(__name__).warning(f"Failed to dispatch interview email invite with .ics: {email_err}")

            log_action(
                org_id=app.org.id, user=request.user,
                action='schedule_interview', target_type='application',
                target_id=application_id,
                detail=f'Scheduled {schedule.interview_type} interview for {app.candidate.get_full_name()}',
                request=request
            )
            return Response(InterviewScheduleSerializer(schedule).data, status=status.HTTP_201_CREATED)

        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("Error scheduling interview")
            return Response({'error': f"Failed to schedule interview: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class InterviewScheduleDetailView(APIView):
    """
    PATCH  /applications/<id>/interviews/<sid>/  → update status (complete/cancel/reschedule)
    DELETE /applications/<id>/interviews/<sid>/  → remove a scheduled interview
    """
    permission_classes = [IsHR]

    def _get_schedule(self, application_id, schedule_id, org_id):
        try:
            return InterviewSchedule.objects.get(
                id=schedule_id,
                application_id=application_id,
                org_id=org_id,
            )
        except InterviewSchedule.DoesNotExist:
            return None

    def patch(self, request, application_id, schedule_id):
        schedule = self._get_schedule(application_id, schedule_id, request.org_id)
        if not schedule:
            return Response({'error': 'Interview not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = InterviewScheduleStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        schedule.status = serializer.validated_data['status']
        schedule.save(update_fields=['status'])
        return Response(InterviewScheduleSerializer(schedule).data)

    def delete(self, request, application_id, schedule_id):
        schedule = self._get_schedule(application_id, schedule_id, request.org_id)
        if not schedule:
            return Response({'error': 'Interview not found.'}, status=status.HTTP_404_NOT_FOUND)
        schedule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InterviewScheduleICSView(APIView):
    """
    GET /applications/<id>/interviews/<sid>/ics/
    Downloads the standard RFC 5545 .ics calendar invitation file for an interview.
    """
    permission_classes = [IsHR]

    def get(self, request, application_id, schedule_id):
        from django.http import HttpResponse
        from hiring.models import InterviewSchedule
        from hiring.services import generate_interview_ics

        try:
            schedule = InterviewSchedule.objects.select_related('application__candidate', 'application__job_posting', 'org').get(
                id=schedule_id,
                application_id=application_id,
                org_id=request.org_id,
            )
        except InterviewSchedule.DoesNotExist:
            return Response({'error': 'Interview schedule not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            ics_content = generate_interview_ics(schedule)
            response = HttpResponse(ics_content, content_type='text/calendar; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="interview-{schedule.id}.ics"'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response
        except Exception as e:
            return Response({'error': f"Failed to generate calendar invite: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ScorecardView(APIView):
    """
    GET  /applications/<id>/scorecards/  → list all scorecards for an application
    POST /applications/<id>/scorecards/  → submit a new scorecard (one per reviewer per stage)
    """
    permission_classes = [IsHR]

    def get(self, request, application_id):
        scorecards = Scorecard.objects.filter(
            application_id=application_id,
            org_id=request.org_id,
        ).select_related('reviewer').order_by('submitted_at')
        return Response(ScorecardSerializer(scorecards, many=True).data)

    def post(self, request, application_id):
        try:
            app = Application.objects.get(id=application_id, org_id=request.org_id, is_deleted=False)
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ScorecardCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        scorecard = Scorecard.objects.create(
            org_id=request.org_id,
            application=app,
            stage=d['stage'],
            reviewer=request.user,
            scores=d['scores'],
            recommendation=d['recommendation'],
            strengths=d.get('strengths', ''),
            concerns=d.get('concerns', ''),
        )
        log_action(
            org_id=request.org_id, user=request.user,
            action='submit_scorecard', target_type='application',
            target_id=application_id,
            detail=f'Submitted {d["stage"]} scorecard for {app.candidate.get_full_name()} — {d["recommendation"]}'
        )
        return Response(ScorecardSerializer(scorecard).data, status=status.HTTP_201_CREATED)


class EmailTemplateListView(APIView):
    permission_classes = [IsHR]

    def get(self, request):
        from hiring.models import EmailTemplate
        from hiring.services import send_automatic_email
        from hiring.serializers import EmailTemplateSerializer

        # Use our send_automatic_email seeding logic by checking if we have any template.
        # If none, we trigger a dummy welcome template retrieval which forces template seeding.
        if not EmailTemplate.objects.filter(org_id=request.org_id).exists():
            class DummyApp:
                org = request.user.org
                class candidate:
                    email = 'dummy@example.com'
                    @staticmethod
                    def get_full_name():
                        return 'Dummy'
                class job_posting:
                    title = 'Dummy'
            send_automatic_email(DummyApp, 'applied')

        templates = EmailTemplate.objects.filter(org_id=request.org_id, is_deleted=False)
        return Response(EmailTemplateSerializer(templates, many=True).data)


class EmailLogView(APIView):
    permission_classes = [IsHR]

    def get(self, request, application_id):
        from hiring.models import EmailLog
        from hiring.serializers import EmailLogSerializer

        logs = EmailLog.objects.filter(application_id=application_id, org_id=request.org_id).order_by('sent_at')
        return Response(EmailLogSerializer(logs, many=True).data)


class EmailComposeView(APIView):
    permission_classes = [IsHR]

    def post(self, request, application_id):
        from hiring.models import Application, EmailLog
        from hiring.serializers import EmailComposeSerializer, EmailLogSerializer
        from core.email_dispatcher import send_robust_email

        try:
            app = Application.objects.get(id=application_id, org_id=request.org_id, is_deleted=False)
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = EmailComposeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        html_content = f"<div style='font-family: sans-serif; line-height: 1.6; color: #1e293b;'>{d['body'].replace(chr(10), '<br>')}</div>"
        status_str = 'sent'
        try:
            success, detail = send_robust_email(
                to_email=app.candidate.email,
                subject=d['subject'],
                html_content=html_content,
                text_content=d['body']
            )
            if not success:
                status_str = 'failed'
        except Exception:
            status_str = 'failed'

        log = EmailLog.objects.create(
            org_id=request.org_id,
            application=app,
            direction='outbound',
            from_email=request.user.email,
            to_email=app.candidate.email,
            subject=d['subject'],
            body=d['body'],
            status=status_str
        )
        log_action(
            org_id=request.org_id, user=request.user,
            action='send_email', target_type='application',
            target_id=application_id,
            detail=f'Manually sent email to {app.candidate.get_full_name()} — Status: {status_str}'
        )
        return Response(EmailLogSerializer(log).data, status=status.HTTP_201_CREATED)


class SimulateInboundReplyView(APIView):
    """
    POST /api/hiring/applications/<id>/emails/simulate-reply/
    Allows HR recruiters to simulate candidate replying to their emails directly
    to test two-way threaded messaging in CORE.
    """
    permission_classes = [IsHR]

    def post(self, request, application_id):
        from hiring.models import Application, EmailLog
        from hiring.serializers import EmailLogSerializer

        try:
            app = Application.objects.select_related('candidate', 'org', 'job_posting').get(
                id=application_id, org_id=request.org_id, is_deleted=False
            )
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        body = (request.data.get('body') or '').strip()
        if not body:
            return Response({'error': 'Reply body cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        subject = (request.data.get('subject') or f"Re: {app.job_posting.title} Application").strip()

        log = EmailLog.objects.create(
            org_id=request.org_id,
            application=app,
            direction='inbound',
            from_email=app.candidate.email,
            to_email=request.user.email,
            subject=subject,
            body=body,
            status='received'
        )

        return Response(EmailLogSerializer(log).data, status=status.HTTP_201_CREATED)


class OfferDetailView(APIView):
    permission_classes = [IsHR]

    def get(self, request, application_id):
        from hiring.models import Offer
        from hiring.serializers import OfferSerializer

        offer = Offer.objects.filter(application_id=application_id, org_id=request.org_id, is_deleted=False).first()
        if not offer:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OfferSerializer(offer).data)

    def post(self, request, application_id):
        from hiring.models import Application, Offer
        from hiring.serializers import OfferCreateSerializer, OfferSerializer

        try:
            app = Application.objects.get(id=application_id, org_id=request.org_id, is_deleted=False)
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = OfferCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        offer, created = Offer.objects.update_or_create(
            application=app,
            org_id=request.org_id,
            defaults={
                'salary': d['salary'],
                'start_date': d['start_date'],
                'expiration_date': d.get('expiration_date'),
                'notes': d.get('notes', ''),
                'offer_letter_text': d.get('offer_letter_text', ''),
                'benefits_summary': d.get('benefits_summary', ''),
                'work_location': d.get('work_location', 'Remote'),
            }
        )
        log_action(
            org_id=request.org_id, user=request.user,
            action='save_offer', target_type='application',
            target_id=application_id,
            detail=f'Saved draft offer for {app.candidate.get_full_name()} (Salary: ${d["salary"]})'
        )
        return Response(OfferSerializer(offer).data)


class OfferExtendView(APIView):
    permission_classes = [IsHR]

    def post(self, request, application_id):
        from hiring.models import Application, Offer
        from hiring.serializers import OfferSerializer
        from hiring.services import send_automatic_email
        from django.utils import timezone

        try:
            app = Application.objects.get(id=application_id, org_id=request.org_id, is_deleted=False)
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        offer = Offer.objects.filter(application_id=application_id, org_id=request.org_id, is_deleted=False).first()
        if not offer:
            return Response({'error': 'Create a draft offer first.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Update offer status to extended
        offer.status = 'extended'
        offer.extended_at = timezone.now()
        offer.save()

        # 2. Shift application stage to offer
        old_stage = app.stage
        if old_stage != 'offer':
            app_service.move_stage(
                application_id=str(application_id),
                org_id=request.org_id,
                user=request.user,
                new_stage='offer',
                notes='Offer extended to candidate.'
            )

        # 3. Generate official offer letter PDF attachment
        from hiring.services import generate_offer_letter_pdf
        attachments = None
        try:
            pdf_bytes = generate_offer_letter_pdf(offer)
            cand_name = app.candidate.get_full_name().strip().replace(' ', '_') or 'Candidate'
            attachments = [{
                'filename': f'Offer_Letter_{cand_name}.pdf',
                'content': pdf_bytes,
                'content_type': 'application/pdf'
            }]
        except Exception as pdf_err:
            import logging
            logging.getLogger(__name__).warning(f"Failed to generate offer letter PDF attachment: {pdf_err}")

        # 4. Send email to candidate with the offer details and PDF attachment
        send_automatic_email(
            app,
            'offer',
            context={
                'salary': f"${float(offer.salary):,.2f}",
                'start_date': offer.start_date.strftime('%B %d, %Y') if offer.start_date else 'TBD'
            },
            attachments=attachments
        )

        log_action(
            org_id=request.org_id, user=request.user,
            action='extend_offer', target_type='application',
            target_id=application_id,
            detail=f'Extended offer to {app.candidate.get_full_name()} with PDF attachment'
        )
        return Response(OfferSerializer(offer).data)


@method_decorator(xframe_options_exempt, name='dispatch')
class OfferPDFDownloadView(APIView):
    """
    GET /applications/<id>/offer/pdf/
    Generates and downloads the official branded Offer Letter PDF.
    Supports query parameter authentication for iframes and new tabs.
    """
    permission_classes = [IsHR]

    def initial(self, request, *args, **kwargs):
        token_str = request.query_params.get('token')
        if token_str and (not getattr(request, 'user', None) or not request.user.is_authenticated):
            from rest_framework_simplejwt.tokens import AccessToken
            try:
                validated = AccessToken(token_str)
                from accounts.models import User
                user = User.objects.get(id=validated['user_id'])
                if user.role in ('admin', 'hr') or user.is_superuser:
                    request.user = user
                    request.org_id = user.org_id
            except Exception:
                pass

        super().initial(request, *args, **kwargs)

        if not getattr(request, 'org_id', None) and getattr(request, 'user', None) and getattr(request.user, 'org_id', None):
            request.org_id = request.user.org_id

    def get(self, request, application_id):
        from django.http import HttpResponse
        from hiring.models import Application, Offer
        from hiring.services import generate_offer_letter_pdf

        try:
            app = Application.objects.select_related('candidate', 'job_posting', 'org').get(
                id=application_id, org_id=request.org_id, is_deleted=False
            )
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        offer = Offer.objects.filter(application=app, org_id=request.org_id, is_deleted=False).first()
        if not offer:
            return Response({'error': 'No offer found for this candidate. Please save a draft offer first.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            pdf_bytes = generate_offer_letter_pdf(offer)
            cand_name = app.candidate.get_full_name().strip().replace(' ', '_') or 'Candidate'
            filename = f"Offer_Letter_{cand_name}.pdf"

            is_inline = request.query_params.get('inline') == 'true' or request.headers.get('Sec-Fetch-Dest') == 'iframe'
            disp = 'inline' if is_inline else 'attachment'

            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'{disp}; filename="{filename}"'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("Failed to build offer letter PDF")
            return Response({'error': f"Failed to generate offer letter PDF: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OfferEmailSendView(APIView):
    """
    POST /applications/<id>/offer/send-email/
    Sends or resends the official offer letter with branded PDF attachment to the candidate.
    """
    permission_classes = [IsHR]

    def post(self, request, application_id):
        from hiring.models import Application, Offer
        from hiring.services import generate_offer_letter_pdf, send_automatic_email

        try:
            app = Application.objects.select_related('candidate', 'job_posting', 'org').get(
                id=application_id, org_id=request.org_id, is_deleted=False
            )
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        offer = Offer.objects.filter(application=app, org_id=request.org_id, is_deleted=False).first()
        if not offer:
            return Response({'error': 'No offer details found. Please save a draft offer first.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pdf_bytes = generate_offer_letter_pdf(offer)
            cand_name = app.candidate.get_full_name().strip().replace(' ', '_') or 'Candidate'
            attachments = [{
                'filename': f'Offer_Letter_{cand_name}.pdf',
                'content': pdf_bytes,
                'content_type': 'application/pdf'
            }]

            custom_subject = request.data.get('subject') or None
            custom_body = request.data.get('body') or None

            email_log = send_automatic_email(
                app,
                'offer',
                context={
                    'salary': f"${float(offer.salary):,.2f}",
                    'start_date': offer.start_date.strftime('%B %d, %Y') if offer.start_date else 'TBD'
                },
                custom_subject=custom_subject,
                custom_body=custom_body,
                attachments=attachments
            )

            log_action(
                org_id=request.org_id, user=request.user,
                action='email_offer_pdf', target_type='application',
                target_id=application_id,
                detail=f'Emailed offer letter with PDF attachment to {app.candidate.email}'
            )

            return Response({
                'success': True,
                'message': f'Offer letter PDF successfully sent to {app.candidate.email}.',
                'email_id': str(email_log.id) if email_log else None
            }, status=status.HTTP_200_OK)
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("Failed to email offer letter")
            return Response({'error': f"Failed to send offer letter: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OfferRespondView(APIView):
    permission_classes = [IsHR]

    def post(self, request, application_id):
        from hiring.models import Application, Offer
        from hiring.serializers import OfferResponseSerializer, OfferSerializer
        from django.utils import timezone

        try:
            app = Application.objects.get(id=application_id, org_id=request.org_id, is_deleted=False)
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        offer = Offer.objects.filter(application_id=application_id, org_id=request.org_id, is_deleted=False).first()
        if not offer or offer.status != 'extended':
            return Response({'error': 'Offer is not in extended state.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = OfferResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resp = serializer.validated_data['response']

        # 1. Update status
        offer.status = resp
        offer.signed_at = timezone.now()
        offer.save()

        # 2. Transition stage
        new_stage = 'hired' if resp == 'accepted' else 'rejected'
        app_service.move_stage(
            application_id=str(application_id),
            org_id=request.org_id,
            user=request.user,
            new_stage=new_stage,
            notes=f'Offer was {resp} by candidate.'
        )

        log_action(
            org_id=request.org_id, user=request.user,
            action='offer_respond', target_type='application',
            target_id=application_id,
            detail=f'Candidate {resp} the offer.'
        )
        return Response(OfferSerializer(offer).data)


class AnalyticsView(APIView):
    permission_classes = [IsHR]

    def get(self, request, job_id=None):
        from hiring.models import Application, StageHistory, Offer, Scorecard
        from django.db.models import Count, Q

        # Filter by organization and job_id (if provided)
        q = {'org_id': request.org_id, 'is_deleted': False}
        if job_id:
            q['job_posting_id'] = job_id

        apps = Application.objects.filter(**q)

        # 1. Funnel counts in a single group-by query
        counts_dict = {
            'applied': 0, 'screening': 0, 'interview': 0,
            'offer': 0, 'hired': 0, 'rejected': 0
        }
        raw_counts = apps.values('stage').annotate(cnt=Count('id'))
        total_apps = 0
        for rc in raw_counts:
            stg = (rc['stage'] or '').lower()
            cnt = rc['cnt']
            total_apps += cnt
            if stg in counts_dict:
                counts_dict[stg] = cnt

        # Cumulative funnel metrics
        hired_cnt = counts_dict['hired']
        offer_cnt = counts_dict['offer'] + hired_cnt
        interview_cnt = counts_dict['interview'] + offer_cnt
        screening_cnt = counts_dict['screening'] + interview_cnt
        applied_cnt = total_apps

        stage_funnel = []
        for stg, cnt in [
            ('applied', applied_cnt),
            ('screening', screening_cnt),
            ('interview', interview_cnt),
            ('offer', offer_cnt),
            ('hired', hired_cnt),
            ('rejected', counts_dict['rejected']),
        ]:
            pct = (cnt / applied_cnt) if applied_cnt > 0 else 0.0
            stage_funnel.append({
                'stage': stg.title(),
                'count': cnt,
                'conversion_rate': round(pct, 3)
            })

        # 2. Average Time-in-Stage (lightweight tuple streaming)
        histories = StageHistory.objects.filter(
            application__org_id=request.org_id,
            application__is_deleted=False
        )
        if job_id:
            histories = histories.filter(application__job_posting_id=job_id)

        # Select only necessary columns directly without loading full model instances
        hist_records = histories.order_by('application_id', 'moved_at').values_list(
            'application_id', 'to_stage', 'moved_at'
        )

        stage_times = {}
        app_stage_start = {}

        for app_id, to_stage, moved_at in hist_records:
            app_key = str(app_id)
            if app_key in app_stage_start:
                prev_stage, start_time = app_stage_start[app_key]
                if prev_stage and moved_at and start_time:
                    duration = (moved_at - start_time).total_seconds()
                    stage_times.setdefault(prev_stage.lower(), []).append(duration)
            app_stage_start[app_key] = (to_stage, moved_at)

        avg_stage_days = {}
        for stg, durations in stage_times.items():
            if durations:
                avg_seconds = sum(durations) / len(durations)
                avg_stage_days[stg] = round(avg_seconds / 86400.0, 1)

        for stg in ['applied', 'screening', 'interview', 'offer']:
            avg_stage_days.setdefault(stg, 0.0)

        avg_stage_time = []
        for stg in ['applied', 'screening', 'interview', 'offer']:
            avg_stage_time.append({
                'stage': stg.title(),
                'avg_days': avg_stage_days.get(stg, 0.0)
            })

        # 3. Offer Acceptance Rate in a single query
        offer_q = {'org_id': request.org_id, 'is_deleted': False}
        if job_id:
            offer_q['application__job_posting_id'] = job_id
        offer_stats = Offer.objects.filter(**offer_q).aggregate(
            total=Count('id'),
            accepted=Count('id', filter=Q(status='accepted'))
        )
        total_offers = offer_stats['total'] or 0
        accepted_offers = offer_stats['accepted'] or 0
        offer_acceptance_rate = (accepted_offers / total_offers) if total_offers > 0 else 0.0

        # 4. Average Time to Hire (Batch SQL query for all hired apps)
        hired_apps_data = list(apps.filter(stage='hired').values_list('id', 'created_at', 'updated_at'))
        time_to_hire_list = []
        if hired_apps_data:
            hired_ids = [ha[0] for ha in hired_apps_data]
            # Batch query the earliest moved_at for all hired applications
            hired_transitions = (
                StageHistory.objects.filter(application_id__in=hired_ids, to_stage='hired')
                .order_by('moved_at')
                .values_list('application_id', 'moved_at')
            )
            hired_trans_map = {}
            for aid, moved_at in hired_transitions:
                if aid not in hired_trans_map:
                    hired_trans_map[aid] = moved_at

            for aid, created_at, updated_at in hired_apps_data:
                moved_at = hired_trans_map.get(aid)
                end_time = moved_at or updated_at
                if end_time and created_at:
                    delta = (end_time - created_at).total_seconds() / 86400.0
                    time_to_hire_list.append(max(0.5, round(delta, 1)))

        avg_time_to_hire = round(sum(time_to_hire_list) / len(time_to_hire_list), 1) if time_to_hire_list else None

        # 5. Scorecard Reviewer Insights
        scorecards = Scorecard.objects.filter(application__in=apps).values_list('scores', 'recommendation')
        sc_ratings = []
        rec_distribution = {'strong_yes': 0, 'yes': 0, 'maybe': 0, 'no': 0, 'strong_no': 0}
        for scores, rec in scorecards:
            rec_distribution[rec] = rec_distribution.get(rec, 0) + 1
            if scores and isinstance(scores, dict):
                for v in scores.values():
                    try:
                        sc_ratings.append(float(v))
                    except (ValueError, TypeError):
                        pass

        avg_scorecard_rating = round(sum(sc_ratings) / len(sc_ratings), 1) if sc_ratings else None

        # 6. Add drop_off_pct to stage_funnel
        enriched_funnel = []
        prev_funnel_cnt = applied_cnt
        for idx, item in enumerate(stage_funnel):
            curr_cnt = item['count']
            drop_off_pct = round(((prev_funnel_cnt - curr_cnt) / prev_funnel_cnt) * 100, 1) if prev_funnel_cnt > 0 and idx > 0 else 0.0
            enriched_funnel.append({
                **item,
                'drop_off_pct': max(0.0, drop_off_pct)
            })

        # 7. Sourcing Channel Metrics in 1 single grouped query
        source_counts = (
            apps.values('source')
            .annotate(
                total_cnt=Count('id'),
                hired_cnt=Count('id', filter=Q(stage='hired'))
            )
            .order_by('-total_cnt')
        )
        source_metrics = []
        for sc in source_counts:
            src = sc['source'] or 'other'
            stotal = sc['total_cnt']
            shired = sc['hired_cnt']
            sconv = (shired / stotal) if stotal > 0 else 0.0
            source_metrics.append({
                'source': src.title(),
                'count': stotal,
                'hired_count': shired,
                'conversion_rate': round(sconv, 3)
            })

        return Response({
            'total_applications': total_apps,
            'active_applications': max(0, total_apps - (hired_cnt + counts_dict['rejected'])),
            'hired_count': hired_cnt,
            'rejected_count': counts_dict['rejected'],
            'avg_time_to_hire_days': avg_time_to_hire,
            'offer_acceptance_rate': round(offer_acceptance_rate * 100, 1),
            'avg_scorecard_rating': avg_scorecard_rating,
            'scorecard_recommendations': rec_distribution,
            'stage_funnel': enriched_funnel,
            'avg_stage_time': avg_stage_time,
            'source_metrics': source_metrics
        })


from hiring.models import Candidate, Application, EmailLog

class InboundEmailWebhookView(APIView):
    """
    POST /api/hiring/inbound/
    Public webhook endpoint that receives email replies from candidates.
    Matches the candidate by email, finds their latest active application,
    and logs the reply with status='received'.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        sender = (request.data.get('sender') or request.data.get('from_email') or request.data.get('from') or '').strip()
        recipient = (request.data.get('recipient') or request.data.get('to_email') or request.data.get('to') or '').strip()
        subject = (request.data.get('subject') or 'Candidate Inbound Reply').strip()
        body = (request.data.get('body') or request.data.get('text') or request.data.get('message') or '').strip()

        if not sender or not body:
            return Response({'error': 'sender and body are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Match candidate by sender email address
        candidate = Candidate.objects.filter(email__iexact=sender, is_deleted=False).first()
        if not candidate:
            return Response({'error': f"Candidate with email '{sender}' not found."}, status=status.HTTP_404_NOT_FOUND)

        # Retrieve their latest active job application
        application = Application.objects.filter(candidate=candidate, is_deleted=False).order_by('-created_at').first()
        if not application:
            return Response({'error': f"No active application found for candidate {candidate.get_full_name()}."}, status=status.HTTP_404_NOT_FOUND)

        # Create inbound email log record
        log = EmailLog.objects.create(
            org_id=application.org_id,
            application=application,
            direction='inbound',
            from_email=sender,
            to_email=recipient or 'hr@core.internal',
            subject=subject,
            body=body,
            status='received'
        )

        from hiring.serializers import EmailLogSerializer
        return Response({
            'message': 'Inbound email synced successfully.',
            'log': EmailLogSerializer(log).data
        }, status=status.HTTP_201_CREATED)


class ApplicationOnboardView(APIView):
    """
    POST /api/hiring/applications/<uuid:application_id>/onboard/
    1-Click converts a hired candidate into a full CORE employee:
    - Creates/Activates User account in accounts.User
    - Creates Employee record in teams.Employee with department and parsed skills
    - Creates Onboarding Project in projects with 5 standard milestone tasks
    - Schedules Day 1 Orientation Meeting in meetings.Meeting
    - Moves application to 'hired' stage
    """
    permission_classes = [IsHR]

    def post(self, request, application_id):
        import logging
        logger = logging.getLogger(__name__)

        try:
            from accounts.models import User
            from teams.models import Department, Employee
            from tenants.services import InvitationService, ServiceError
            from django.core.exceptions import ValidationError
            invitation_service = InvitationService()

            app = Application.objects.select_related('candidate', 'job_posting', 'org').get(
                id=application_id,
                org_id=request.org_id,
                is_deleted=False
            )
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as init_err:
            logger.exception("Error initializing ApplicationOnboardView")
            return Response({'error': f"Failed to initialize onboarding: {str(init_err)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            role = request.data.get('role', 'employee')
            dept_id = request.data.get('department_id')
            department = None

            # 1. Resolve Department
            if dept_id and str(dept_id).strip():
                try:
                    import uuid
                    dept_uuid = uuid.UUID(str(dept_id).strip())
                    department = Department.objects.filter(id=dept_uuid, org=app.org, is_deleted=False).first()
                except (ValueError, TypeError):
                    pass

            if not department:
                dept_name = request.data.get('department') or (app.job_posting.department if app.job_posting else 'General') or 'General'
                dept_name = str(dept_name).strip() or 'General'
                department = Department.objects.filter(org=app.org, name__iexact=dept_name, is_deleted=False).first()
                if not department:
                    department = Department.objects.create(org=app.org, name=dept_name)

            department_name = department.name
            job_title = request.data.get('job_title') or (app.job_posting.title if app.job_posting else 'Employee')
            manager_id = request.data.get('manager_id')
            start_date_str = request.data.get('start_date')
            create_tasks = request.data.get('create_tasks', True)
            if 'create_onboarding_tasks' in request.data:
                create_tasks = request.data.get('create_onboarding_tasks')
            schedule_orientation = request.data.get('schedule_orientation', True)
            if 'schedule_orientation_meeting' in request.data:
                schedule_orientation = request.data.get('schedule_orientation_meeting')

            # 2. Resolve Reporting Manager
            manager_obj = None
            manager_email = ''
            if manager_id and str(manager_id).strip():
                try:
                    import uuid
                    mgr_uuid = uuid.UUID(str(manager_id).strip())
                    manager_obj = Employee.objects.filter(id=mgr_uuid, org=app.org).select_related('user').first()
                    if manager_obj and manager_obj.user:
                        manager_email = manager_obj.user.email
                except (ValueError, TypeError):
                    manager_id = None
            else:
                manager_id = None

            onboarding_data = {
                'job_title': job_title,
                'start_date': start_date_str,
                'create_tasks': bool(create_tasks),
                'schedule_orientation': bool(schedule_orientation),
                'manager_id': str(manager_id) if manager_id else None,
                'department_id': str(department.id),
                'application_id': str(app.id),
                'candidate_name': app.candidate.get_full_name(),
            }

            from django.conf import settings
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
            if request:
                origin = request.headers.get('Origin') or request.META.get('HTTP_ORIGIN')
                if origin:
                    frontend_url = origin.rstrip('/')

            # 3. Always dispatch Magic Link invitation to candidate email
            invite = invitation_service.create_invitation(
                org_id=app.org.id,
                inviter_user=request.user,
                email=app.candidate.email,
                role=role,
                department_id=department.id,
                first_name=app.candidate.first_name,
                last_name=app.candidate.last_name,
                manager_email=manager_email,
                skills=app.candidate.parsed_skills or [],
                onboarding_data=onboarding_data,
                request=request
            )

            invite_url = f"{frontend_url}/accept-invite?token={invite.token}"

            old_stage = app.stage
            if old_stage != 'hired':
                app.stage = 'hired'
                app.save(update_fields=['stage'])

                from hiring.models import StageHistory
                StageHistory.objects.create(
                    org=app.org,
                    application=app,
                    from_stage=old_stage,
                    to_stage='hired',
                    moved_by=request.user,
                    notes=f"Hired — Sent onboarding invitation magic link to {app.candidate.email} ({job_title} in {department_name})"
                )

            log_action(
                org_id=app.org.id,
                user=request.user,
                action='onboard_invitation_sent',
                target_type='application',
                target_id=application_id,
                detail=f"Sent onboarding invitation to {app.candidate.get_full_name()} ({app.candidate.email}) as {job_title} in {department_name}",
                request=request
            )

            return Response({
                'success': True,
                'invitation_sent': True,
                'message': f"Magic link invitation dispatched to {app.candidate.email}! When {app.candidate.get_full_name()} clicks the link and signs up, their account will be created, and their onboarding roadmap and orientation meeting will be set up automatically.",
                'email': app.candidate.email,
                'candidate_name': app.candidate.get_full_name(),
                'job_title': job_title,
                'department': department_name,
                'invite_url': invite_url,
                'invitation_id': str(invite.id),
                'is_new_user': True
            }, status=status.HTTP_200_OK)

        except ServiceError as se:
            logger.warning(f"ServiceError during candidate onboarding: {se.message}")
            return Response({'error': se.message}, status=se.status_code)
        except ValidationError as ve:
            logger.warning(f"ValidationError during candidate onboarding: {ve}")
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("Unexpected error in ApplicationOnboardView")
            return Response({'error': f"Failed to onboard candidate: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ApplicationGenerateQuestionsView(APIView):
    """
    POST /api/hiring/applications/<uuid:application_id>/generate-questions/
    Uses Gemini AI to analyze candidate resume vs job requirements and outputs
    5 tailored interview questions.
    """
    permission_classes = [IsHR]

    def post(self, request, application_id):
        from hiring.services import generate_interview_questions_for_candidate

        try:
            app = Application.objects.select_related('candidate', 'job_posting').get(
                id=application_id,
                org_id=request.org_id,
                is_deleted=False
            )
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        questions = generate_interview_questions_for_candidate(app)
        return Response({
            'candidate_name': app.candidate.get_full_name(),
            'job_title': app.job_posting.title,
            'questions': questions
        })


class PublicCareersPortalView(APIView):
    """
    GET /api/hiring/public/careers/<str:slug>/
    Public endpoint showing open jobs for a company careers portal.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request, slug):
        from tenants.models import Organization
        from hiring.models import JobPosting

        org = Organization.objects.filter(slug__iexact=slug, is_active=True).first()
        if not org:
            return Response({'error': 'Company careers page not found.'}, status=status.HTTP_404_NOT_FOUND)

        open_jobs = JobPosting.objects.filter(org=org, status='open', is_deleted=False).order_by('-created_at')

        jobs_data = []
        for j in open_jobs:
            jobs_data.append({
                'id': str(j.id),
                'title': j.title,
                'department': j.department or 'General',
                'description': j.description,
                'requirements': j.requirements,
                'experience_requirements': j.experience_requirements,
                'created_at': j.created_at.isoformat(),
            })

        return Response({
            'org_name': org.name,
            'slug': org.slug,
            'total_open_jobs': len(jobs_data),
            'jobs': jobs_data
        })


class PublicJobDetailView(APIView):
    """
    GET /api/hiring/public/careers/<str:slug>/jobs/<uuid:job_id>/
    Public endpoint viewing a single open job posting.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request, slug, job_id):
        from tenants.models import Organization
        from hiring.models import JobPosting

        org = Organization.objects.filter(slug__iexact=slug, is_active=True).first()
        if not org:
            return Response({'error': 'Company not found.'}, status=status.HTTP_404_NOT_FOUND)

        job = JobPosting.objects.filter(id=job_id, org=org, status='open', is_deleted=False).first()
        if not job:
            return Response({'error': 'Job opening not found or closed.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'org_name': org.name,
            'slug': org.slug,
            'job': {
                'id': str(job.id),
                'title': job.title,
                'department': job.department or 'General',
                'description': job.description,
                'requirements': job.requirements,
                'experience_requirements': job.experience_requirements,
                'created_at': job.created_at.isoformat(),
            }
        })


class PublicJobApplyView(APIView):
    """
    POST /api/hiring/public/careers/<str:slug>/jobs/<uuid:job_id>/apply/
    Public multipart application submission with PDF resume upload.
    """
    authentication_classes = []
    permission_classes = []
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, slug, job_id):
        from tenants.models import Organization
        from hiring.models import JobPosting, Candidate, Application, StageHistory
        from hiring.services import send_automatic_email
        import os

        org = Organization.objects.filter(slug__iexact=slug, is_active=True).first()
        if not org:
            return Response({'error': 'Company not found.'}, status=status.HTTP_404_NOT_FOUND)

        job = JobPosting.objects.filter(id=job_id, org=org, status='open', is_deleted=False).first()
        if not job:
            return Response({'error': 'Job opening not found or closed.'}, status=status.HTTP_404_NOT_FOUND)

        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()
        email = request.data.get('email', '').strip().lower()
        phone = request.data.get('phone', '').strip()
        resume_file = request.FILES.get('resume') or request.FILES.get('file')

        if not first_name or not last_name or not email:
            return Response({'error': 'First name, last name, and email are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Resume file handling
        resume_path = ''
        resume_bytes = None
        if resume_file:
            import uuid
            ext = os.path.splitext(resume_file.name)[1].lower()
            if ext != '.pdf':
                return Response({'error': 'Only PDF resumes are supported.'}, status=status.HTTP_400_BAD_REQUEST)

            org_dir = os.path.join(settings.MEDIA_ROOT, 'hiring', str(org.id))
            os.makedirs(org_dir, exist_ok=True)
            filename = f"{uuid.uuid4()}{ext}"
            full_path = os.path.join(org_dir, filename)
            resume_bytes = resume_file.read()
            with open(full_path, 'wb+') as dest:
                dest.write(resume_bytes)
            resume_path = f"hiring/{org.id}/{filename}"

        # Candidate lookup / creation
        candidate = Candidate.objects.filter(org=org, email=email, is_deleted=False).first()
        if not candidate:
            candidate = Candidate.objects.create(
                org=org,
                first_name=first_name,
                last_name=last_name,
                email=email,
                phone=phone,
                resume_path=resume_path,
                resume_data=resume_bytes,
            )
        else:
            if resume_path:
                candidate.resume_path = resume_path
                candidate.resume_processed = False
                if resume_bytes:
                    candidate.resume_data = resume_bytes
            candidate.first_name = first_name or candidate.first_name
            candidate.last_name = last_name or candidate.last_name
            candidate.phone = phone or candidate.phone
            candidate.save()

        # Check existing application for this job
        application = Application.objects.filter(candidate=candidate, job_posting=job, is_deleted=False).first()
        if application:
            return Response({
                'success': True,
                'message': 'You have already applied for this role. Your profile has been updated.',
                'application_id': str(application.id)
            }, status=status.HTTP_200_OK)

        application = Application.objects.create(
            org=org,
            candidate=candidate,
            job_posting=job,
            stage='applied',
            source='careers_page',
            source_details=f'Applied via Public Careers Portal: {slug}'
        )

        StageHistory.objects.create(
            org=org,
            application=application,
            from_stage='',
            to_stage='applied',
            notes='Submitted application through public careers portal'
        )

        # Trigger async resume parsing
        if resume_path:
            try:
                from hiring.tasks import dispatch_resume_processing
                dispatch_resume_processing(str(candidate.id))
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to queue resume processing: {e}")

        # Send confirmation email
        try:
            send_automatic_email(application, 'applied')
        except Exception:
            pass

        return Response({
            'success': True,
            'message': 'Application submitted successfully! Our hiring team will review your profile.',
            'application_id': str(application.id)
        }, status=status.HTTP_201_CREATED)


class JobPostingStagesView(APIView):
    """
    GET   /api/hiring/jobs/<job_id>/stages/ → Returns stages for this job
    PATCH /api/hiring/jobs/<job_id>/stages/ → Updates custom stages for this job
    """
    permission_classes = [IsHR]

    DEFAULT_STAGES = [
        {'id': 'applied',   'label': 'Applied',   'color': 'slate'},
        {'id': 'screening', 'label': 'Screening', 'color': 'blue'},
        {'id': 'interview', 'label': 'Interview', 'color': 'purple'},
        {'id': 'offer',     'label': 'Offer',     'color': 'emerald'},
        {'id': 'hired',     'label': 'Hired',     'color': 'green'},
    ]

    def get(self, request, job_id):
        from hiring.models import JobPosting
        try:
            job = JobPosting.objects.get(id=job_id, org_id=request.org_id, is_deleted=False)
        except JobPosting.DoesNotExist:
            return Response({'error': 'Job posting not found.'}, status=status.HTTP_404_NOT_FOUND)

        stages = job.pipeline_stages if (job.pipeline_stages and len(job.pipeline_stages) > 0) else self.DEFAULT_STAGES
        return Response({'stages': stages, 'is_custom': bool(job.pipeline_stages)})

    def patch(self, request, job_id):
        from hiring.models import JobPosting
        try:
            job = JobPosting.objects.get(id=job_id, org_id=request.org_id, is_deleted=False)
        except JobPosting.DoesNotExist:
            return Response({'error': 'Job posting not found.'}, status=status.HTTP_404_NOT_FOUND)

        raw_stages = request.data.get('stages') or request.data.get('pipeline_stages')
        if not isinstance(raw_stages, list) or len(raw_stages) < 2:
            return Response({'error': 'A pipeline must have at least 2 stages.'}, status=status.HTTP_400_BAD_REQUEST)

        sanitized_stages = []
        seen_ids = set()
        for idx, s in enumerate(raw_stages):
            if isinstance(s, str):
                s_id = s.lower().replace(' ', '_')
                s_label = s
                color = 'slate'
            elif isinstance(s, dict):
                s_id = str(s.get('id', '')).strip().lower().replace(' ', '_') or f"stage_{idx+1}"
                s_label = str(s.get('label', '') or s.get('name', '')).strip() or s_id.title()
                color = s.get('color', 'slate')
            else:
                continue

            if s_id in seen_ids:
                s_id = f"{s_id}_{idx+1}"
            seen_ids.add(s_id)

            sanitized_stages.append({
                'id': s_id,
                'label': s_label,
                'color': color
            })

        job.pipeline_stages = sanitized_stages
        job.save(update_fields=['pipeline_stages'])
        return Response({'stages': sanitized_stages, 'is_custom': True})


class InterviewInvitationListCreateView(APIView):
    """
    GET  /api/hiring/applications/<id>/invitations/  → list invitations
    POST /api/hiring/applications/<id>/invitations/  → generate self-service scheduling invitation
    """
    permission_classes = [IsHR]

    def get(self, request, application_id):
        from hiring.models import InterviewInvitation
        from hiring.serializers import InterviewInvitationSerializer
        invitations = InterviewInvitation.objects.filter(
            application_id=application_id,
            org_id=request.org_id
        ).select_related('interviewer', 'application__candidate', 'application__job_posting').order_by('-created_at')
        return Response(InterviewInvitationSerializer(invitations, many=True).data)

    def post(self, request, application_id):
        from hiring.models import Application, InterviewInvitation
        from hiring.serializers import InterviewInvitationCreateSerializer, InterviewInvitationSerializer
        from accounts.models import User
        from django.utils import timezone
        import datetime

        try:
            app = Application.objects.select_related('candidate', 'job_posting', 'org').get(
                id=application_id, org_id=request.org_id, is_deleted=False
            )
        except Application.DoesNotExist:
            return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = InterviewInvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        interviewer = None
        if d.get('interviewer_id'):
            interviewer = User.objects.filter(id=d['interviewer_id'], org_id=request.org_id).first()
        if not interviewer:
            interviewer = request.user

        expires_at = timezone.now() + datetime.timedelta(days=d.get('expires_in_days', 7))

        invitation = InterviewInvitation.objects.create(
            org_id=request.org_id,
            application=app,
            interviewer=interviewer,
            title=d.get('title') or f"Interview with {interviewer.get_full_name()}",
            interview_type=d.get('interview_type', 'video'),
            duration_min=d.get('duration_min', 45),
            notes=d.get('notes', ''),
            expires_at=expires_at,
            status='pending'
        )

        # Send invitation email if requested
        if d.get('send_email', True):
            try:
                from core.email_dispatcher import send_robust_email
                portal_url = f"https://core-workspace-xi.vercel.app/careers/schedule/{invitation.token}"
                email_body = (
                    f"Dear {app.candidate.get_full_name()},\n\n"
                    f"We are excited to invite you to schedule your {invitation.duration_min}-minute {invitation.title} for the {app.job_posting.title} role.\n\n"
                    f"Please choose an available date and time slot that works best for you:\n"
                    f"{portal_url}\n\n"
                    f"This scheduling link is valid until {expires_at.strftime('%B %d, %Y')}.\n\n"
                    f"Best regards,\n"
                    f"The {app.org.name} Team"
                )
                html_body = f"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; line-height: 1.6; color: #1e293b; padding: 20px;">
                    <h2 style="color: #0f172a; margin-bottom: 8px;">Schedule Your Interview</h2>
                    <p>Dear <strong>{app.candidate.get_full_name()}</strong>,</p>
                    <p>We are excited to invite you to pick your preferred interview slot for <strong>{app.job_posting.title}</strong> with <strong>{interviewer.get_full_name()}</strong>.</p>
                    <div style="margin: 28px 0;">
                        <a href="{portal_url}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                            Select Your Interview Slot &rarr;
                        </a>
                    </div>
                    <p style="font-size: 12px; color: #64748b;">Duration: {invitation.duration_min} minutes &bull; Mode: {invitation.get_interview_type_display() if hasattr(invitation, 'get_interview_type_display') else invitation.interview_type.title()}</p>
                    <p style="font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 24px;">Link valid until {expires_at.strftime('%B %d, %Y')}. If you have any questions, reply to this email.</p>
                </div>
                """
                send_robust_email(
                    to_email=app.candidate.email,
                    subject=f"Action Required: Select your interview slot for {app.job_posting.title}",
                    html_content=html_body,
                    text_content=email_body
                )
            except Exception as mail_err:
                import logging
                logging.getLogger(__name__).warning(f"Could not send self-scheduling invitation email: {mail_err}")

        return Response(InterviewInvitationSerializer(invitation).data, status=status.HTTP_201_CREATED)


class PublicInterviewInvitationDetailView(APIView):
    """
    GET /api/hiring/invitations/<token>/ (Public / Unauthenticated)
    Retrieves public invitation details and computes real-time available time slots
    across the next 7 business days, excluding existing interviewer bookings.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request, token):
        from hiring.models import InterviewInvitation, InterviewSchedule
        from django.utils import timezone
        import datetime

        try:
            inv = InterviewInvitation.objects.select_related(
                'application__candidate', 'application__job_posting', 'interviewer', 'org'
            ).get(token=token)
        except (InterviewInvitation.DoesNotExist, ValueError):
            return Response({'error': 'Invitation link is invalid or expired.'}, status=status.HTTP_404_NOT_FOUND)

        if inv.status == 'booked':
            return Response({
                'status': 'booked',
                'title': inv.title,
                'company_name': inv.org.name,
                'candidate_name': inv.application.candidate.get_full_name(),
                'job_title': inv.application.job_posting.title,
                'booked_at': inv.booked_schedule.scheduled_at.isoformat() if inv.booked_schedule else None,
                'meeting_link': inv.booked_schedule.meeting_link if inv.booked_schedule else '',
            })

        if inv.expires_at and inv.expires_at < timezone.now():
            return Response({'error': 'This interview invitation has expired.'}, status=status.HTTP_410_GONE)

        # Generate available business hour slots for next 7 business days
        # Times: 9:30 AM, 11:00 AM, 1:30 PM, 3:00 PM, 4:30 PM UTC
        now = timezone.now()
        existing_schedules = InterviewSchedule.objects.filter(
            scheduled_at__gte=now,
            status='scheduled'
        )
        if inv.interviewer:
            existing_schedules = existing_schedules.filter(interviewers__icontains=inv.interviewer.get_full_name())
        booked_datetimes = set(existing_schedules.values_list('scheduled_at', flat=True))

        available_days = []
        slot_hours = [(9, 30), (11, 0), (13, 30), (15, 0), (16, 30)]

        current_date = now.date() + datetime.timedelta(days=1)
        days_collected = 0
        while days_collected < 7:
            # Skip weekends (Saturday=5, Sunday=6)
            if current_date.weekday() < 5:
                day_slots = []
                for hour, minute in slot_hours:
                    slot_dt = timezone.make_aware(datetime.datetime.combine(current_date, datetime.time(hour, minute)))
                    # Check if slot is in future and not booked
                    is_conflict = any(abs((slot_dt - b).total_seconds()) < (inv.duration_min * 60) for b in booked_datetimes)
                    if not is_conflict:
                        day_slots.append({
                            'iso': slot_dt.isoformat(),
                            'time_iso': slot_dt.isoformat(),
                            'time': slot_dt.strftime('%I:%M %p'),
                            'time_label': slot_dt.strftime('%I:%M %p')
                        })
                if day_slots:
                    available_days.append({
                        'date': current_date.isoformat(),
                        'date_iso': current_date.isoformat(),
                        'day_name': current_date.strftime('%A'),
                        'display_date': current_date.strftime('%A, %B %d'),
                        'date_label': current_date.strftime('%A, %B %d'),
                        'slots': day_slots
                    })
                days_collected += 1
            current_date += datetime.timedelta(days=1)

        return Response({
            'status': inv.status,
            'title': inv.title,
            'company_name': inv.org.name,
            'job_title': inv.application.job_posting.title,
            'candidate_name': inv.application.candidate.get_full_name(),
            'candidate_email': inv.application.candidate.email,
            'interviewer_name': inv.interviewer.get_full_name() if inv.interviewer else 'Hiring Manager',
            'duration_min': inv.duration_min,
            'interview_type': inv.interview_type,
            'available_days': available_days,
            'available_slots': available_days,
        })


class PublicInterviewBookingView(APIView):
    """
    POST /api/hiring/invitations/<token>/book/ (Public / Unauthenticated)
    Candidate confirms their chosen interview slot. Creates InterviewSchedule,
    generates CORE virtual meeting room & .ics calendar invite, and confirms via email.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request, token):
        from hiring.models import InterviewInvitation, InterviewSchedule, Application, StageHistory
        from hiring.services import generate_interview_ics, send_automatic_email
        from hiring.serializers import InterviewBookingConfirmSerializer
        from django.utils import timezone
        import datetime

        try:
            inv = InterviewInvitation.objects.select_related(
                'application__candidate', 'application__job_posting', 'interviewer', 'org'
            ).get(token=token)
        except (InterviewInvitation.DoesNotExist, ValueError):
            return Response({'error': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if inv.status == 'booked':
            return Response({'error': 'This interview has already been booked.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = InterviewBookingConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        scheduled_at = d['scheduled_at']
        candidate_notes = d.get('candidate_notes', '').strip()
        phone = d.get('phone', '').strip()

        # Update candidate phone if provided
        if phone and not inv.application.candidate.phone:
            inv.application.candidate.phone = phone
            inv.application.candidate.save(update_fields=['phone'])

        # Generate virtual meeting room
        room_code = f"sched-{str(inv.token)[:8]}"
        meeting_link = f"https://core-workspace-xi.vercel.app/meetings/room/{room_code}"

        interviewer_names = [inv.interviewer.get_full_name()] if inv.interviewer else ['Hiring Team']

        # Create InterviewSchedule
        schedule = InterviewSchedule.objects.create(
            org=inv.org,
            application=inv.application,
            scheduled_at=scheduled_at,
            duration_min=inv.duration_min,
            interview_type=inv.interview_type,
            meeting_link=meeting_link,
            interviewers=interviewer_names,
            agenda=f"{inv.title}. Notes from candidate: {candidate_notes}" if candidate_notes else inv.title,
            status='scheduled',
            created_by=inv.interviewer
        )

        inv.booked_schedule = schedule
        inv.status = 'booked'
        inv.save(update_fields=['booked_schedule', 'status'])

        # Advance application to interview stage if in applied/screening
        app = inv.application
        if app.stage in ('applied', 'screening'):
            prev_stage = app.stage
            app.stage = 'interview'
            app.save(update_fields=['stage'])
            StageHistory.objects.create(
                org=inv.org,
                application=app,
                from_stage=prev_stage,
                to_stage='interview',
                moved_by=inv.interviewer,
                notes=f'Candidate self-scheduled interview for {scheduled_at.strftime("%B %d, %Y %I:%M %p UTC")}'
            )

        # Dispatch calendar invite emails
        try:
            ics_bytes = generate_interview_ics(schedule)
            attachments = [
                {
                    'name': 'interview_invitation.ics',
                    'content': ics_bytes,
                    'mime_type': 'text/calendar; charset=utf-8'
                }
            ]
            gcal_link = f"https://calendar.google.com/calendar/render?action=TEMPLATE&text={inv.title}&dates={schedule.scheduled_at.strftime('%Y%m%dT%H%M%SZ')}/{(schedule.scheduled_at + datetime.timedelta(minutes=schedule.duration_min)).strftime('%Y%m%dT%H%M%SZ')}&location={meeting_link}"
            cand_context = {
                'candidate_name': app.candidate.get_full_name(),
                'job_title': app.job_posting.title,
                'company_name': inv.org.name,
                'scheduled_time': schedule.scheduled_at.strftime('%B %d, %Y at %I:%M %p UTC'),
                'duration': f"{schedule.duration_min} minutes",
                'meeting_link': meeting_link,
                'google_calendar_link': gcal_link,
            }
            send_automatic_email(app, 'interview', context=cand_context, attachments=attachments)
        except Exception as mail_err:
            import logging
            logging.getLogger(__name__).warning(f"Failed to send confirmation email on self-booking: {mail_err}")

        return Response({
            'success': True,
            'message': 'Interview successfully booked!',
            'schedule_id': str(schedule.id),
            'scheduled_at': schedule.scheduled_at.isoformat(),
            'meeting_link': meeting_link,
            'ics_url': f"/api/hiring/applications/{app.id}/interviews/{schedule.id}/ics/"
        }, status=status.HTTP_201_CREATED)



