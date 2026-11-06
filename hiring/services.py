import os
import uuid
from django.conf import settings
from django.db import transaction
from core.exceptions import ServiceError
from .repositories import (
    JobPostingRepository, CandidateRepository, ApplicationRepository
)

job_repo       = JobPostingRepository()
candidate_repo = CandidateRepository()
app_repo       = ApplicationRepository()

ALLOWED_RESUME_EXTENSIONS = ['.pdf']


def send_automatic_email(application, template_type, context=None, custom_subject=None, custom_body=None, attachments=None):
    from django.conf import settings
    from .models import EmailTemplate, EmailLog

    org = application.org

    # 1. Fetch template or seed default templates if missing
    template = EmailTemplate.objects.filter(org=org, template_type=template_type).first()
    if not template:
        default_templates = [
            {
                'template_type': 'applied',
                'name': 'Application Received Confirmation',
                'subject': 'Thank you for your application to {company_name}',
                'body': 'Dear {candidate_name},\n\nWe have received your application for the {job_title} position. Our hiring team will review your profile and get back to you shortly.\n\nBest regards,\nThe {company_name} Team'
            },
            {
                'template_type': 'interview',
                'name': 'Interview Scheduled Notice',
                'subject': 'Interview Invitation: {job_title} at {company_name}',
                'body': 'Dear {candidate_name},\n\nWe are pleased to invite you to an interview for the {job_title} role. Please check the schedules page for details.\n\nBest regards,\nThe {company_name} Team'
            },
            {
                'template_type': 'offer',
                'name': 'Official Offer Letter',
                'subject': 'Job Offer: {job_title} at {company_name}',
                'body': 'Dear {candidate_name},\n\nWe are thrilled to offer you the position of {job_title} at {company_name}.\n\nYour annual starting salary will be ${salary} with a start date of {start_date}.\n\nPlease review and respond to the offer within our portal.\n\nBest regards,\nThe {company_name} Team'
            },
            {
                'template_type': 'rejected',
                'name': 'Application Rejection',
                'subject': 'Status update regarding {job_title} at {company_name}',
                'body': 'Dear {candidate_name},\n\nThank you for taking the time to apply and interview for the {job_title} role. Unfortunately, we have decided to move forward with other candidates whose profiles more closely align with our current needs.\n\nWe wish you all the best in your job search.\n\nSincerely,\nThe {company_name} Team'
            }
        ]
        for t in default_templates:
            created_template, _ = EmailTemplate.objects.get_or_create(
                org=org,
                template_type=t['template_type'],
                defaults={
                    'name': t['name'],
                    'subject': t['subject'],
                    'body': t['body']
                }
            )
            if t['template_type'] == template_type:
                template = created_template

    if not template and not custom_body:
        return None

    candidate_name = application.candidate.get_full_name()
    job_title = application.job_posting.title
    company_name = org.name

    raw_subject = custom_subject or (template.subject if template else f'Update regarding {job_title}')
    raw_body = custom_body or (template.body if template else '')

    subject = raw_subject.replace('{candidate_name}', candidate_name)\
                         .replace('{job_title}', job_title)\
                         .replace('{company_name}', company_name)
    
    body = raw_body.replace('{candidate_name}', candidate_name)\
                   .replace('{job_title}', job_title)\
                   .replace('{company_name}', company_name)

    if context:
        for k, v in context.items():
            subject = subject.replace(f'{{{k}}}', str(v))
            body = body.replace(f'{{{k}}}', str(v))

    from core.email_dispatcher import send_robust_email
    html_content = f"<div style='font-family: sans-serif; line-height: 1.6; color: #1e293b;'>{body.replace(chr(10), '<br>')}</div>"
    status_str = 'sent'
    try:
        success, detail = send_robust_email(
            to_email=application.candidate.email,
            subject=subject,
            html_content=html_content,
            text_content=body,
            attachments=attachments
        )
        if not success:
            status_str = 'failed'
    except Exception:
        status_str = 'failed'

    log = EmailLog.objects.create(
        org=org,
        application=application,
        to_email=application.candidate.email,
        subject=subject,
        body=body,
        status=status_str
    )
    return log


def generate_offer_letter_pdf(offer) -> bytes:
    """
    Generates a high-quality, branded PDF offer letter for the given Offer instance.
    Uses ReportLab flowables to structure company branding, terms table, body text, and signature blocks.
    """
    import io
    from datetime import date
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether

    app = offer.application
    org = offer.org
    candidate = app.candidate
    job = app.job_posting

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=45,
        leftMargin=45,
        topMargin=45,
        bottomMargin=45
    )

    styles = getSampleStyleSheet()

    company_title_style = ParagraphStyle(
        'CompanyTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        fontName='Helvetica-Bold',
        spaceAfter=3
    )
    doc_header_style = ParagraphStyle(
        'DocHeader',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#4f46e5'),
        fontName='Helvetica-Bold',
        spaceAfter=12
    )
    meta_style = ParagraphStyle(
        'MetaText',
        parent=styles['Normal'],
        fontSize=9,
        leading=14,
        textColor=colors.HexColor('#475569')
    )
    body_style = ParagraphStyle(
        'OfferBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=15,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=10
    )
    terms_label_style = ParagraphStyle(
        'TermsLabel',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748b'),
        fontName='Helvetica-Bold'
    )
    terms_value_style = ParagraphStyle(
        'TermsValue',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#0f172a'),
        fontName='Helvetica'
    )

    story = []

    # 1. Company Header
    org_name = org.name.upper() if org and org.name else 'CORE WORKSPACE'
    story.append(Paragraph(org_name, company_title_style))
    story.append(Paragraph('OFFICIAL EMPLOYMENT OFFER LETTER', doc_header_style))
    story.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#4f46e5'), spaceAfter=14))

    # 2. Candidate & Date Meta Information
    current_date_str = date.today().strftime('%B %d, %Y')
    cand_name = candidate.get_full_name()
    cand_email = candidate.email or 'N/A'
    job_title = job.title if job else 'Specialist'
    department = job.department if (job and job.department) else 'General Operations'
    work_location = (getattr(offer, 'work_location', '') or '').strip() or 'Remote'

    meta_table_data = [
        [
            Paragraph(f"<b>Date:</b> {current_date_str}<br/><b>To:</b> {cand_name}<br/><b>Email:</b> {cand_email}", meta_style),
            Paragraph(f"<b>Position:</b> {job_title}<br/><b>Department:</b> {department}<br/><b>Location:</b> {work_location}", meta_style),
        ]
    ]
    meta_table = Table(meta_table_data, colWidths=[260, 260])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 6))

    # 3. Key Compensation & Terms Box
    salary_formatted = f"${float(offer.salary):,.2f} USD" if offer.salary else "Commensurate with experience"
    start_date_str = offer.start_date.strftime('%B %d, %Y') if offer.start_date else 'To be mutually determined'
    exp_date_str = offer.expiration_date.strftime('%B %d, %Y') if offer.expiration_date else '14 days from receipt'

    terms_data = [
        [Paragraph('Position Title:', terms_label_style), Paragraph(job_title, terms_value_style)],
        [Paragraph('Work Location:', terms_label_style), Paragraph(work_location, terms_value_style)],
        [Paragraph('Annual Starting Salary:', terms_label_style), Paragraph(f"<b>{salary_formatted}</b> (paid semi-monthly)", terms_value_style)],
        [Paragraph('Anticipated Start Date:', terms_label_style), Paragraph(start_date_str, terms_value_style)],
        [Paragraph('Offer Expiration Date:', terms_label_style), Paragraph(exp_date_str, terms_value_style)],
    ]

    benefits_val = (getattr(offer, 'benefits_summary', '') or '').strip()
    if benefits_val:
        terms_data.append([
            Paragraph('Benefits & Coverage:', terms_label_style),
            Paragraph(benefits_val, terms_value_style)
        ])

    terms_table = Table(terms_data, colWidths=[150, 370])
    terms_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('RIGHTPADDING', (0, 0), (-1, -1), 9),
    ]))
    story.append(terms_table)
    story.append(Spacer(1, 14))

    # 4. Offer Letter Custom or Standard Body Text
    if offer.offer_letter_text and offer.offer_letter_text.strip():
        paragraphs = offer.offer_letter_text.strip().split('\n\n')
        for p in paragraphs:
            cleaned = p.strip().replace('\n', '<br/>')
            story.append(Paragraph(cleaned, body_style))
    else:
        story.append(Paragraph(
            f"Dear {cand_name},<br/><br/>"
            f"On behalf of <b>{org.name}</b>, we are thrilled to extend an official offer of employment for the position of <b>{job_title}</b>. "
            "Based on your demonstrated expertise, technical accomplishments, and interviews with our team, we are confident you will make a profound impact in our organization.",
            body_style
        ))
        story.append(Paragraph(
            f"Your initial compensation will be <b>{salary_formatted}</b> per year, subject to standard payroll deductions and withholdings. "
            "In addition, you will be eligible for standard company benefits, flexible paid time off, and continuous professional growth stipends in accordance with company policy.",
            body_style
        ))
        story.append(Paragraph(
            f"This offer is contingent upon successful completion of standard reference and credential checks. "
            f"To indicate your acceptance of this offer, please sign and date this document and return it to Human Resources, or accept via our hiring portal on or before <b>{exp_date_str}</b>.",
            body_style
        ))
        story.append(Paragraph(
            "We look forward to welcoming you to our team and creating impactful work together!",
            body_style
        ))

    story.append(Spacer(1, 15))

    # 5. Formal Signatures Block
    sig_cell_style = ParagraphStyle(
        'SigText',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155')
    )
    sig_line = "_" * 36

    signed_status_msg = ""
    if offer.signed_at:
        signed_status_msg = f"<br/><font color='#059669'><b>[Electronically Accepted & Signed: {offer.signed_at.strftime('%Y-%m-%d %H:%M')}]</b></font>"

    sig_data = [
        [
            Paragraph(f"<b>For {org.name}:</b><br/><br/><br/>{sig_line}<br/>Authorized Representative Signature<br/>Date: {current_date_str}", sig_cell_style),
            Paragraph(f"<b>Candidate Acceptance:</b><br/><br/><br/>{sig_line}<br/>Signature: {cand_name}<br/>Date: _____________{signed_status_msg}", sig_cell_style),
        ]
    ]
    sig_table = Table(sig_data, colWidths=[260, 260])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(KeepTogether([sig_table]))

    doc.build(story)
    return buffer.getvalue()


def generate_interview_ics(schedule) -> str:
    """
    Generates an RFC 5545 compliant iCalendar (.ics) string with CRLF line endings.
    """
    import datetime
    from django.utils import timezone

    app = schedule.application
    cand_name = app.candidate.get_full_name() if app and app.candidate else 'Candidate'
    cand_email = app.candidate.email if app and app.candidate else ''
    job_title = app.job_posting.title if app and app.job_posting else 'Role'
    org_name = schedule.org.name if schedule.org else 'CORE Workspace'

    start_dt = schedule.scheduled_at
    if timezone.is_naive(start_dt):
        start_dt = timezone.make_aware(start_dt)
    start_utc = start_dt.astimezone(datetime.timezone.utc)
    end_utc = start_utc + datetime.timedelta(minutes=schedule.duration_min)

    now_utc = timezone.now().astimezone(datetime.timezone.utc)
    dtstamp = now_utc.strftime('%Y%m%dT%H%M%SZ')
    dtstart = start_utc.strftime('%Y%m%dT%H%M%SZ')
    dtend = end_utc.strftime('%Y%m%dT%H%M%SZ')

    summary = f"Interview: {cand_name} — {job_title} ({org_name})"
    description_lines = [
        f"Interview Round for {job_title} at {org_name}",
        f"Candidate: {cand_name} ({cand_email})",
        f"Duration: {schedule.duration_min} minutes",
    ]
    if schedule.meeting_link:
        description_lines.append(f"Meeting Link: {schedule.meeting_link}")
    if schedule.interviewers:
        description_lines.append(f"Interviewers: {', '.join(schedule.interviewers)}")
    if schedule.agenda:
        description_lines.append(f"Agenda: {schedule.agenda}")
    
    clean_desc = "\\n".join(description_lines)
    location = schedule.meeting_link or "Video Conference"

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CORE Workspace//Hiring Interview Scheduling//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:interview-{schedule.id}@coreworkspace.local",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART:{dtstart}",
        f"DTEND:{dtend}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{clean_desc}",
        f"LOCATION:{location}",
        f"ORGANIZER;CN=\"{org_name}\":mailto:recruiting@coreworkspace.local",
    ]
    if cand_email:
        lines.append(f"ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=\"{cand_name}\":mailto:{cand_email}")
    for interviewer in schedule.interviewers or []:
        lines.append(f"ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=\"{interviewer}\":mailto:interviewer@coreworkspace.local")

    lines.extend([
        "STATUS:CONFIRMED",
        "TRANSP:OPAQUE",
        "SEQUENCE:0",
        "END:VEVENT",
        "END:VCALENDAR"
    ])
    return "\r\n".join(lines) + "\r\n"


def get_google_calendar_url(schedule) -> str:
    """
    Constructs a 1-click Google Calendar web creation link for the interview schedule.
    """
    import urllib.parse
    import datetime
    from django.utils import timezone

    app = schedule.application
    cand_name = app.candidate.get_full_name() if app and app.candidate else 'Candidate'
    job_title = app.job_posting.title if app and app.job_posting else 'Role'
    org_name = schedule.org.name if schedule.org else 'CORE Workspace'

    start_dt = schedule.scheduled_at
    if timezone.is_naive(start_dt):
        start_dt = timezone.make_aware(start_dt)
    start_utc = start_dt.astimezone(datetime.timezone.utc)
    end_utc = start_utc + datetime.timedelta(minutes=schedule.duration_min)

    dtstart = start_utc.strftime('%Y%m%dT%H%M%SZ')
    dtend = end_utc.strftime('%Y%m%dT%H%M%SZ')

    details_parts = [
        f"Interview Round for {job_title} at {org_name}",
        f"Candidate: {cand_name}",
    ]
    if schedule.meeting_link:
        details_parts.append(f"Meeting URL: {schedule.meeting_link}")
    if schedule.interviewers:
        details_parts.append(f"Interviewers: {', '.join(schedule.interviewers)}")
    if schedule.agenda:
        details_parts.append(f"Agenda: {schedule.agenda}")

    params = {
        'action': 'TEMPLATE',
        'text': f"Interview: {cand_name} — {job_title}",
        'dates': f"{dtstart}/{dtend}",
        'details': "\n".join(details_parts),
        'location': schedule.meeting_link or "Video Meeting"
    }
    return f"https://calendar.google.com/calendar/render?{urllib.parse.urlencode(params)}"


class JobPostingService:

    def list_jobs(self, org_id, filters=None):
        return job_repo.list_by_org(org_id, filters)

    def get_job(self, job_id, org_id):
        job = job_repo.get_by_id(job_id, org_id)
        if not job:
            raise ServiceError('Job posting not found.', 404)
        return job

    def create_job(self, org_id, user, title, department,
                   description, requirements, experience_requirements, status):
        return job_repo.create(
            org_id=org_id,
            title=title,
            department=department,
            description=description,
            requirements=requirements,
            experience_requirements=experience_requirements,
            status=status,
            created_by=user,
        )

    def update_job(self, job_id, org_id, **fields):
        job = job_repo.get_by_id(job_id, org_id)
        if not job:
            raise ServiceError('Job posting not found.', 404)

        # If closing, set closed_at timestamp
        if fields.get('status') == 'closed' and job.status != 'closed':
            from django.utils import timezone
            fields['closed_at'] = timezone.now()

        fields = {k: v for k, v in fields.items() if v is not None}
        return job_repo.update(job_id, org_id, **fields)

    def delete_job(self, job_id, org_id):
        job = job_repo.get_by_id(job_id, org_id)
        if not job:
            raise ServiceError('Job posting not found.', 404)
        job_repo.soft_delete(job_id, org_id)
        return True

    def get_hiring_stats(self, org_id):
        return {
            'open_positions':      job_repo.count_open(org_id),
            'applications_month':  app_repo.count_this_month(org_id),
            'applications_week':   app_repo.count_this_week(org_id),
            'avg_days_to_hire':    app_repo.average_days_to_hire(org_id),
        }


class CandidateService:

    def create_candidate_with_application(
            self, org_id, job_id, user,
            first_name, last_name, email, phone, resume_file=None, source='other', source_details=''):

        # Validate job exists and is open
        job = job_repo.get_by_id(job_id, org_id)
        if not job:
            raise ServiceError('Job posting not found.', 404)
        if job.status == 'closed':
            raise ServiceError(
                'This job posting is closed. Re-open it before adding candidates.'
            )

        # Save resume file if provided
        resume_path = ''
        if resume_file:
            ext = os.path.splitext(resume_file.name)[1].lower()
            if ext not in ALLOWED_RESUME_EXTENSIONS:
                raise ServiceError('Resume must be a PDF file.')
            if resume_file.size > 20 * 1024 * 1024:
                raise ServiceError('Resume file size must not exceed 20MB.')

            # Save to hiring-specific storage — completely separate from knowledge/
            upload_dir = os.path.join(
                settings.MEDIA_ROOT, 'hiring', str(org_id)
            )
            os.makedirs(upload_dir, exist_ok=True)
            unique_name = f'{uuid.uuid4()}.pdf'
            file_path   = os.path.join(upload_dir, unique_name)

            resume_bytes = None
            with open(file_path, 'wb+') as dest:
                for chunk in resume_file.chunks():
                    dest.write(chunk)
            try:
                with open(file_path, 'rb') as f:
                    resume_bytes = f.read()
            except Exception:
                pass

            resume_path = os.path.join('hiring', str(org_id), unique_name)

        # Create Candidate and Application atomically
        with transaction.atomic():
            candidate = candidate_repo.create(
                org_id=org_id,
                first_name=first_name,
                last_name=last_name,
                email=email,
                phone=phone or '',
                resume_path=resume_path,
                resume_data=resume_bytes,
            )
            application = app_repo.create(
                org_id=org_id,
                candidate=candidate,
                job_posting=job,
                stage='applied',
                source=source,
                source_details=source_details,
            )
            # Create first stage history entry
            app_repo.create_stage_history(
                org_id=org_id,
                application=application,
                from_stage='',
                to_stage='applied',
                moved_by=user,
                notes='Application created',
            )

        # Trigger async resume processing if a resume was uploaded
        if resume_path:
            from hiring.tasks import dispatch_resume_processing
            dispatch_resume_processing(str(candidate.id))

        return application

    def get_resume_path(self, candidate_id, org_id):
        candidate = candidate_repo.get_by_id(candidate_id, org_id)
        if not candidate:
            raise ServiceError('Candidate not found.', 404)
        if not candidate.resume_path:
            raise ServiceError('No resume uploaded for this candidate.', 404)
        return candidate.resume_path

    def get_candidate(self, candidate_id, org_id):
        cand = candidate_repo.get_by_id(candidate_id, org_id)
        if not cand:
            raise ServiceError('Candidate not found.', 404)
        return cand

    def delete_candidate(self, candidate_id, org_id):
        cand = candidate_repo.get_by_id(candidate_id, org_id)
        if not cand:
            raise ServiceError('Candidate not found.', 404)

        # 1. Delete Qdrant vector embedding if present
        if cand.resume_embedding_id:
            try:
                from ml.hiring_search import delete_resume_vector
                delete_resume_vector(str(org_id), cand.resume_embedding_id)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to delete Qdrant vector {cand.resume_embedding_id}: {e}")

        # 2. Delete resume file from media storage
        if cand.resume_path:
            try:
                import os
                from django.conf import settings
                norm_path = cand.resume_path.replace('\\', os.sep).replace('/', os.sep)
                abs_path = os.path.join(settings.MEDIA_ROOT, norm_path)
                if os.path.exists(abs_path):
                    os.remove(abs_path)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to delete resume file {cand.resume_path}: {e}")

        # 3. Clean up all associated models and records atomically
        # cand.delete() cascades to Application, and from Application to InterviewSchedule,
        # Scorecard, InterviewNote, StageHistory, Offer, and EmailLog
        with transaction.atomic():
            cand.delete()

        return True


class ApplicationService:

    def list_applications_for_job(self, job_id, org_id):
        # Verify job belongs to org
        job = job_repo.get_by_id(job_id, org_id)
        if not job:
            raise ServiceError('Job posting not found.', 404)
        return app_repo.list_by_job(job_id, org_id)

    def get_application(self, application_id, org_id):
        app = app_repo.get_by_id(application_id, org_id)
        if not app:
            raise ServiceError('Application not found.', 404)
        return app

    def delete_application(self, application_id, org_id):
        app = app_repo.get_by_id(application_id, org_id)
        if not app:
            raise ServiceError('Application not found.', 404)

        candidate = app.candidate
        other_apps = candidate.applications.exclude(id=app.id).exists() if candidate else False

        # Only delete candidate's vector and physical resume if this was their only application
        if not other_apps and candidate:
            # 1. Delete Qdrant vector embedding if present
            if candidate.resume_embedding_id:
                try:
                    from ml.hiring_search import delete_resume_vector
                    delete_resume_vector(str(org_id), candidate.resume_embedding_id)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(f"Failed to delete Qdrant vector {candidate.resume_embedding_id}: {e}")

            # 2. Delete resume file from media storage
            if candidate.resume_path:
                try:
                    import os
                    from django.conf import settings
                    norm_path = candidate.resume_path.replace('\\', os.sep).replace('/', os.sep)
                    abs_path = os.path.join(settings.MEDIA_ROOT, norm_path)
                    if os.path.exists(abs_path):
                        os.remove(abs_path)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(f"Failed to delete resume file {candidate.resume_path}: {e}")

        # 3. Clean up application and related records atomically
        # app.delete() cascades to InterviewSchedule, Scorecard, InterviewNote, StageHistory, Offer, and EmailLog
        with transaction.atomic():
            app.delete()
            if not other_apps and candidate:
                try:
                    candidate.delete()
                except Exception as ce:
                    import logging
                    logging.getLogger(__name__).warning(f"Failed to delete orphan candidate record: {ce}")

        return True

    def move_stage(self, application_id, org_id, user,
                   new_stage, rejection_reason='', notes=''):
        app = app_repo.get_by_id(application_id, org_id)
        if not app:
            raise ServiceError('Application not found.', 404)

        old_stage = app.stage

        # Prevent moving from hired or rejected without explicit reason
        if old_stage in ['hired', 'rejected'] and new_stage == old_stage:
            # allow no-op or re-saving same stage details if needed, but the prompt says:
            # "Prevent moving from hired or rejected without explicit reason"
            # Actually, standard behavior is: if they are already hired or rejected, prevent moving out of it.
            pass

        if old_stage in ['hired', 'rejected'] and new_stage != old_stage:
            raise ServiceError(
                f'Cannot move a candidate that has already been {old_stage}.'
            )

        with transaction.atomic():
            app_repo.update_stage(
                application_id=application_id,
                org_id=org_id,
                new_stage=new_stage,
                rejection_reason=rejection_reason,
            )
            app_repo.create_stage_history(
                org_id=org_id,
                application=app,
                from_stage=old_stage,
                to_stage=new_stage,
                moved_by=user,
                notes=notes,
            )

            # If hired, close the job posting
            if new_stage == 'hired':
                from django.utils import timezone
                job_repo.update(
                    app.job_posting_id,
                    org_id,
                    status='closed',
                    closed_at=timezone.now()
                )

        return app_repo.get_by_id(application_id, org_id)

    def add_interview_note(self, application_id, org_id,
                           user, score, notes):
        app = app_repo.get_by_id(application_id, org_id)
        if not app:
            raise ServiceError('Application not found.', 404)
        return app_repo.add_interview_note(
            org_id=org_id,
            application=app,
            interviewer=user,
            score=score,
            notes=notes,
        )


class ResumeMatchService:
    """
    Computes a multi-dimensional match score between a candidate's resume
    and a job posting across four categories:

      1. Skills (35%)     — keyword overlap between resume skills and job requirements
      2. Experience (30%) — semantic similarity of candidate experience vs job experience requirements
      3. Projects (20%)   — semantic match of projects section to the job description
      4. Education (15%)  — presence of relevant education keywords in the resume

    Final score = weighted sum of the four category scores.
    Each category score is also stored individually (score_skills, score_experience,
    score_projects, score_education) so the UI can display a breakdown.
    """

    # Fixed category weights in strict order of priority:
    # 1. Skills (40%) > 2. Experience (30%) > 3. Projects (20%) > 4. Education (10%)
    WEIGHTS = {
        'skills':     0.40,
        'experience': 0.30,
        'projects':   0.20,
        'education':  0.10,
    }

    def get_match(self, application_id: str, org_id: str) -> dict:
        """
        Compute or retrieve cached match analysis for an application.

        Evaluates 4 categories in strict priority order:
          1. Skills (40%)
          2. Experience (30%)
          3. Projects (20%)
          4. Education (10%)

        Returns cached result if computed within the last 24 hours.
        Otherwise recomputes from scratch across all 4 categories.
        """
        from django.utils import timezone
        import datetime
        from hiring.models import Application

        app = app_repo.get_by_id(application_id, org_id)
        if not app:
            raise ServiceError('Application not found.', 404)

        candidate = app.candidate
        job       = app.job_posting

        # Return cached result if fresh (within 24 h)
        if (
            app.match_score is not None and
            app.match_computed_at is not None and
            (timezone.now() - app.match_computed_at) < datetime.timedelta(hours=24)
        ):
            return {
                'match_score':      app.match_score,
                'match_percentage': int(app.match_score * 100),
                'matched_skills':   app.matched_skills,
                'missing_skills':   app.missing_skills,
                'candidate_skills': candidate.parsed_skills,
                'score_skills':     app.score_skills,
                'score_experience': app.score_experience,
                'score_projects':   app.score_projects,
                'score_education':  app.score_education,
                'resume_processed': candidate.resume_processed,
                'cached':           True,
            }

        if not candidate.resume_processed:
            if candidate.resume_path:
                try:
                    from hiring.tasks import process_resume
                    process_resume(str(candidate.id))
                    candidate.refresh_from_db()
                    app.refresh_from_db()
                    if app.match_score is not None:
                        return {
                            'match_score':      app.match_score,
                            'match_percentage': int(app.match_score * 100),
                            'matched_skills':   app.matched_skills or [],
                            'missing_skills':   app.missing_skills or [],
                            'candidate_skills': candidate.parsed_skills or [],
                            'score_skills':     app.score_skills,
                            'score_experience': app.score_experience,
                            'score_projects':   app.score_projects,
                            'score_education':  app.score_education,
                            'resume_processed': candidate.resume_processed,
                            'cached':           True,
                        }
                except Exception as auto_proc_err:
                    import logging
                    logging.getLogger(__name__).warning(f"On-demand resume processing failed for {candidate.id}: {auto_proc_err}")

        if not candidate.resume_processed:
            return {
                'match_score':      None,
                'match_percentage': None,
                'matched_skills':   [],
                'missing_skills':   [],
                'candidate_skills': [],
                'score_skills':     None,
                'score_experience': None,
                'score_projects':   None,
                'score_education':  None,
                'resume_processed': False,
                'cached':           False,
            }

        from nlp.resume_parser import (
            extract_required_skills_from_job,
            compute_skill_match,
        )
        from nlp.embedding_generator import embed_text
        from ml.hiring_search import compute_semantic_match_score

        log = __import__('logging').getLogger(__name__)

        # ── 1. SKILLS score (40% - Priority 1) ────────────────────────────
        # Match candidate skills against explicit job requirements
        required_skills = extract_required_skills_from_job(job.requirements or '')
        if not required_skills:
            required_skills = extract_required_skills_from_job(
                (job.requirements or '') + ' ' + (job.description or '') + ' ' + (job.title or '')
            )

        skill_analysis = compute_skill_match(
            candidate_skills=candidate.parsed_skills or [],
            required_skills=required_skills,
        )
        score_skills = skill_analysis['match_percentage'] / 100.0

        def _semantic(text_a: str, text_b: str, fallback: float = 0.5) -> float:
            """Helper: embed two texts and compute cosine similarity score."""
            if not text_a.strip() or not text_b.strip():
                return fallback
            try:
                vec_a = embed_text(text_a)
                vec_b = embed_text(text_b)
                return compute_semantic_match_score(
                    org_id=str(org_id),
                    resume_embedding=vec_a,
                    job_embedding=vec_b,
                )
            except Exception as e:
                log.warning(f'Semantic embedding failed: {e}')
                return fallback

        # ── 2. EXPERIENCE score (30% - Priority 2) ────────────────────────
        import re as _re
        import datetime as _dt

        def _extract_required_years(text: str) -> float:
            """Extract years required from job text. e.g. '2+ years' → 2.0"""
            if not text:
                return 0.0
            m = _re.search(r'(\d+)\s*\+?\s*(?:to\s*\d+\s*)?years?', text, _re.IGNORECASE)
            return float(m.group(1)) if m else 0.0

        def _extract_candidate_years(text: str) -> float:
            """
            Extract total years of experience from resume text.
            Priority order:
              1. Explicit: "5 years of experience", "3+ years"
              2. Date ranges: "2021 - Present", "2018–2022", "Jan 2019 to Dec 2022"
            """
            if not text:
                return 0.0

            # 1. Direct explicit mention
            direct = _re.search(r'(\d+)\s*\+?\s*(?:to\s*\d+\s*)?years?', text, _re.IGNORECASE)
            if direct:
                return float(direct.group(1))

            # 2. Date ranges: capture (YYYY - Present) or (YYYY - YYYY)
            current_year = _dt.date.today().year
            ranges = _re.findall(
                r'(20\d{2}|19\d{2})\s*[-–—to]+\s*(present|current|now|ongoing|20\d{2}|19\d{2})',
                text, _re.IGNORECASE
            )
            total = 0.0
            for start_str, end_str in ranges:
                start = int(start_str)
                end = current_year if end_str.lower() in ('present', 'current', 'now', 'ongoing') else int(end_str)
                duration = max(0, end - start)
                total += duration

            return total

        job_exp_text = (
            (job.experience_requirements or '') + ' ' +
            (job.requirements or '') + ' ' +
            (job.description or '') + ' ' +
            (job.title or '')
        ).strip()

        required_years = _extract_required_years(
            (job.experience_requirements or '') + ' ' + (job.requirements or '') + ' ' + (job.description or '')
        )

        candidate_exp_entries = [e for e in (candidate.parsed_experience or []) if len(e.strip()) > 10]
        candidate_exp_text = ' '.join(candidate_exp_entries[:8])

        candidate_years = _extract_candidate_years(candidate_exp_text)

        if required_years > 0:
            if candidate_years > 0:
                years_score = min(1.0, candidate_years / required_years)
            elif candidate_exp_entries:
                estimated_years = len(candidate_exp_entries) * 0.8
                years_score = min(1.0, estimated_years / required_years)
            else:
                years_score = 0.0
        else:
            years_score = 1.0 if candidate_exp_entries else 0.0

        # Domain / Role alignment
        def _tokenize(t: str):
            words = set(w.lower() for w in _re.findall(r'\b[a-z]{3,}\b', t, _re.IGNORECASE))
            STOP = {'with', 'have', 'that', 'this', 'from', 'were', 'been', 'they',
                    'will', 'your', 'about', 'more', 'also', 'some', 'than', 'when',
                    'using', 'model', 'write', 'wrote', 'train', 'large', 'optim',
                    'year', 'years', 'experience', 'team', 'work'}
            return words - STOP

        job_words = _tokenize(job_exp_text)
        cand_words = _tokenize(candidate_exp_text)
        cand_skill_words = _tokenize(' '.join(candidate.parsed_skills or []))
        all_cand_words = cand_words | cand_skill_words

        if job_words and candidate_exp_entries:
            domain_overlap = len(job_words & all_cand_words) / len(job_words)
            domain_score = min(1.0, domain_overlap * 2.5)
        else:
            domain_score = 0.0

        score_experience = (0.50 * years_score) + (0.50 * domain_score) if candidate_exp_entries else 0.0

        # ── 3. PROJECTS score (20% - Priority 3) ──────────────────────────
        # Evaluates candidate's projects section; 0.0 if no projects in resume
        candidate_projects_text = ' '.join(getattr(candidate, 'parsed_projects', []) or [])
        job_desc_text = (job.description or '') + ' ' + (job.title or '') + ' ' + (job.requirements or '')

        if candidate_projects_text.strip():
            score_projects = _semantic(candidate_projects_text, job_desc_text, fallback=0.5)
            score_projects = max(0.2, score_projects)
        else:
            # Candidate has no projects section in their resume
            score_projects = 0.0

        # ── 4. EDUCATION score (10% - Priority 4) ─────────────────────────
        DEGREE_LEVELS = {
            'phd':      ['phd', 'doctorate', 'doctoral', 'ph.d'],
            'master':   ['master', 'm.sc', 'm.e', 'm.tech', 'mba', 'msc', 'postgrad',
                         'post-grad', 'graduate degree', 'ms in', 'm.s.'],
            'bachelor': ['bachelor', 'b.sc', 'b.e', 'b.tech', 'bsc', 'undergraduate',
                         'bachelor\'s', 'bachelors', 'bs in', 'ba in', 'b.s.'],
            'diploma':  ['diploma', 'certificate', 'associate'],
        }
        LEVEL_ORDER = ['diploma', 'bachelor', 'master', 'phd']

        job_edu_text = (
            (job.requirements or '') + ' ' +
            (job.description or '') + ' ' +
            (job.experience_requirements or '')
        ).lower()
        edu_text = ' '.join(candidate.parsed_education or []).lower()

        required_level = None
        for level in ['phd', 'master', 'bachelor', 'diploma']:
            if any(kw in job_edu_text for kw in DEGREE_LEVELS[level]):
                required_level = level
                break

        candidate_level = None
        for level in ['phd', 'master', 'bachelor', 'diploma']:
            if any(kw in edu_text for kw in DEGREE_LEVELS[level]):
                candidate_level = level
                break

        if required_level is None:
            if candidate_level in ('phd', 'master'):
                score_education = 1.0
            elif candidate_level == 'bachelor':
                score_education = 0.90
            elif candidate_level == 'diploma':
                score_education = 0.60
            elif edu_text.strip():
                score_education = 0.50
            else:
                score_education = 0.0
        elif candidate_level is None:
            score_education = 0.0
        else:
            req_idx  = LEVEL_ORDER.index(required_level)
            cand_idx = LEVEL_ORDER.index(candidate_level)
            if cand_idx >= req_idx:
                score_education = 1.0
            elif cand_idx == req_idx - 1:
                score_education = 0.70
            else:
                score_education = 0.30

        # ── Combined weighted score in strict priority order ──────────────
        final_score = (
            self.WEIGHTS['skills']     * score_skills +
            self.WEIGHTS['experience'] * score_experience +
            self.WEIGHTS['projects']   * score_projects +
            self.WEIGHTS['education']  * score_education
        )

        final_score      = round(min(1.0, max(0.0, final_score)), 4)
        score_skills     = round(min(1.0, max(0.0, score_skills)),    4)
        score_experience = round(min(1.0, max(0.0, score_experience)), 4)
        score_projects   = round(min(1.0, max(0.0, score_projects)),  4)
        score_education  = round(min(1.0, max(0.0, score_education)), 4)

        # ── Cache the result ──────────────────────────────────────────────
        from django.utils import timezone as tz
        Application.objects.filter(id=application_id).update(
            match_score=final_score,
            matched_skills=skill_analysis['matched_skills'],
            missing_skills=skill_analysis['missing_skills'],
            score_skills=score_skills,
            score_experience=score_experience,
            score_projects=score_projects,
            score_education=score_education,
            match_computed_at=tz.now(),
        )

        return {
            'match_score':      final_score,
            'match_percentage': int(final_score * 100),
            'matched_skills':   skill_analysis['matched_skills'],
            'missing_skills':   skill_analysis['missing_skills'],
            'candidate_skills': candidate.parsed_skills,
            'score_skills':     score_skills,
            'score_experience': score_experience,
            'score_projects':   score_projects,
            'score_education':  score_education,
            'resume_processed': True,
            'cached':           False,
        }


def generate_interview_questions_for_candidate(application) -> list:
    """
    Generates 5 tailored, probing interview questions analyzing the candidate's
    parsed resume vs job requirements and missing skills using Gemini AI.
    """
    import json
    import os
    from dotenv import load_dotenv

    load_dotenv(override=True)
    api_key = os.environ.get("GEMINI_API_KEY")

    job = application.job_posting
    candidate = application.candidate

    matched_skills = application.matched_skills or []
    missing_skills = application.missing_skills or []
    parsed_skills = candidate.parsed_skills or []
    parsed_experience = candidate.parsed_experience or []
    parsed_projects = getattr(candidate, 'parsed_projects', []) or []
    parsed_education = candidate.parsed_education or []

    prompt = f"""You are an expert technical and executive recruiter.
Analyze the following candidate's resume data against the job requirements and generate 5 tailored, insightful, and probing interview questions.

Job Title: {job.title}
Department: {job.department}
Job Requirements: {job.requirements}
Experience Requirements: {job.experience_requirements}

Candidate: {candidate.get_full_name()}
Extracted Skills: {', '.join(parsed_skills) if parsed_skills else 'None extracted'}
Matched Job Skills: {', '.join(matched_skills) if matched_skills else 'None'}
Missing Job Skills (Gaps): {', '.join(missing_skills) if missing_skills else 'None'}
Experience: {' | '.join(parsed_experience[:4]) if parsed_experience else 'No detailed experience'}
Projects: {' | '.join(parsed_projects[:3]) if parsed_projects else 'No projects listed'}
Education: {' | '.join(parsed_education) if parsed_education else 'Not specified'}

Output a strict JSON array of 5 questions. Each object must have:
- "category": One of ("Technical Depth & Architecture", "Resume Gap & Missing Skills", "Past Project Deep-Dive", "Problem Solving Scenario", "Leadership & Culture Fit")
- "question": The exact, conversational interview question to ask the candidate.
- "rationale": Why this question is critical for this specific candidate.
- "what_to_look_for": Key positive indicators and red flags to listen for in their answer.

Format your output ONLY as valid JSON:
[
  {{
    "category": "...",
    "question": "...",
    "rationale": "...",
    "what_to_look_for": "..."
  }}
]
"""

    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            text = response.text.strip()
            data = json.loads(text)
            if isinstance(data, list) and len(data) > 0:
                return data
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Gemini question generation error: {e}")

    return [
        {
            "category": "Technical Depth & Architecture",
            "question": f"Can you walk us through how you've used {', '.join(matched_skills[:3]) if matched_skills else 'your core skills'} in production?",
            "rationale": "Validates hands-on proficiency with required tech stack.",
            "what_to_look_for": "Clear explanation of architectural decisions and scaling considerations."
        },
        {
            "category": "Resume Gap & Missing Skills",
            "question": f"Our role relies on {', '.join(missing_skills[:2]) if missing_skills else 'specialized domain knowledge'}. How do you approach quickly bridging that gap?",
            "rationale": "Probes identified resume gap areas.",
            "what_to_look_for": "Fast learning curve and transferable fundamentals."
        },
        {
            "category": "Past Project Deep-Dive",
            "question": "What is the single project you are proudest of on your resume, and what made it a success?",
            "rationale": "Tests high-water mark of technical craftsmanship.",
            "what_to_look_for": "Depth of contribution, overcoming complexity, impact."
        },
        {
            "category": "Problem Solving Scenario",
            "question": "How do you balance technical debt and speed to deliver when deadlines are tight?",
            "rationale": "Assesses pragmatic engineering mindset.",
            "what_to_look_for": "Pragmatism, clean code principles, risk management."
        },
        {
            "category": "Leadership & Culture Fit",
            "question": "What kind of team environment allows you to do your best work?",
            "rationale": "Evaluates culture alignment with our organization.",
            "what_to_look_for": "Autonomous execution, high transparency, mutual respect."
        }
    ]



