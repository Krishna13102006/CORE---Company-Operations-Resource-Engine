"""
hiring/tasks.py

Celery tasks for the Hiring AI pipeline.

RESUME PROCESSING PIPELINE:
  1. Load candidate and resolve resume file path
  2. Extract raw text from PDF resume (reuses nlp/text_extractor.py)
  3. Parse structured data: skills, experience, education, name
  4. Embed the resume text (reuses nlp/embedding_generator.py)
  5. Store embedding in Qdrant (hiring_<org_id> collection)
  6. Save parsed data + qdrant_id back to Candidate model
  7. Mark candidate as resume_processed = True

This pipeline is triggered automatically after a resume is uploaded
via CandidateService.create_candidate_with_application().

ISOLATION: This task only reads/writes to:
  - hiring/ models (Candidate)
  - media/hiring/ storage
  - Qdrant hiring_<org_id> collections
It never touches knowledge/, media/knowledge/, or knowledge_* Qdrant collections.
"""

import os
import re
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

try:
    from celery import shared_task
except (ImportError, ModuleNotFoundError):
    # Graceful fallback decorator when Celery is not installed or available
    def shared_task(*dargs, **dkwargs):
        def decorator(func):
            def delay(*call_args, **call_kwargs):
                import threading
                t = threading.Thread(target=func, args=call_args, kwargs=call_kwargs, daemon=True)
                t.start()
                return t
            func.delay = delay
            return func
        if dargs and callable(dargs[0]):
            return decorator(dargs[0])
        return decorator


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name='hiring.process_resume'
)
def process_resume(self_or_id, candidate_id: str = None):
    """
    Process a candidate's resume asynchronously.

    Args:
        candidate_id: String UUID of the Candidate to process.

    Triggered by CandidateService after a resume file is saved.
    Safe to re-run - idempotent.
    """
    if candidate_id is None and isinstance(self_or_id, str):
        candidate_id = self_or_id
        task_self = None
    else:
        task_self = self_or_id

    from hiring.models import Candidate
    from nlp.text_extractor import extract_text
    from nlp.resume_parser import parse_resume
    from nlp.embedding_generator import embed_text
    from ml.hiring_search import store_resume_vector, delete_resume_vector

    def _safe_retry(exc, countdown=2):
        if task_self and hasattr(task_self, 'request') and hasattr(task_self, 'retry'):
            retries = getattr(task_self.request, 'retries', 0)
            max_retries = getattr(task_self, 'max_retries', 3)
            if retries < max_retries:
                raise task_self.retry(exc=exc, countdown=countdown)

    # ── Step 1: Load candidate ────────────────────────────────────────────

    try:
        candidate = Candidate.objects.get(id=candidate_id, is_deleted=False)
    except Candidate.DoesNotExist:
        logger.warning(f'process_resume: Candidate {candidate_id} not found. Skipping.')
        return {'status': 'skipped', 'reason': 'candidate_not_found'}

    if not candidate.resume_path:
        logger.info(f'process_resume: Candidate {candidate_id} has no resume. Skipping.')
        return {'status': 'skipped', 'reason': 'no_resume'}

    org_id = candidate.org_id
    logger.info(f'process_resume: Starting pipeline for {candidate.get_full_name()} ({candidate_id})')

    # ── Step 2: Resolve file path ─────────────────────────────────────────

    normalized_path = candidate.resume_path.replace('\\', os.sep).replace('/', os.sep)
    absolute_path = os.path.join(settings.MEDIA_ROOT, normalized_path)
    if not os.path.exists(absolute_path):
        if os.path.isabs(candidate.resume_path) and os.path.exists(candidate.resume_path):
            absolute_path = candidate.resume_path
        elif candidate.resume_data:
            try:
                os.makedirs(os.path.dirname(absolute_path), exist_ok=True)
                with open(absolute_path, 'wb') as dest_f:
                    dest_f.write(bytes(candidate.resume_data))
                logger.info(f'process_resume: Restored resume file to disk from DB for candidate {candidate_id}')
            except Exception as restore_err:
                logger.warning(f'process_resume: Could not restore resume from DB for candidate {candidate_id}: {restore_err}')
        
        if not os.path.exists(absolute_path):
            logger.warning(f'process_resume: Resume file missing on disk: {absolute_path}. Marking candidate processed with fallback score.')
            from django.utils import timezone
            from hiring.models import Application
            Candidate.objects.filter(id=candidate_id).update(resume_processed=True)
            Application.objects.filter(candidate_id=candidate_id, match_score__isnull=True).update(
                match_score=0.0,
                score_skills=0.0,
                score_experience=0.0,
                score_projects=0.0,
                score_education=0.0,
                match_computed_at=timezone.now()
            )
            return {'status': 'failed', 'reason': 'file_not_found'}

    # ── Step 3: Extract text ──────────────────────────────────────────────

    try:
        raw_text = extract_text(absolute_path, 'pdf')
        logger.info(f'process_resume: Extracted {len(raw_text)} characters')
    except Exception as exc:
        logger.error(f'process_resume: Text extraction failed: {exc}')
        try:
            _safe_retry(exc, countdown=2)
        except Exception:
            raise
        # If retry was not raised or exhausted:
        from django.utils import timezone
        from hiring.models import Application
        Candidate.objects.filter(id=candidate_id).update(resume_processed=True)
        Application.objects.filter(candidate_id=candidate_id, match_score__isnull=True).update(
            match_score=0.0,
            score_skills=0.0,
            score_experience=0.0,
            score_projects=0.0,
            score_education=0.0,
            match_computed_at=timezone.now()
        )
        return {'status': 'failed', 'reason': f'extraction_failed: {exc}'}

    if not raw_text or not raw_text.strip():
        logger.warning(f'process_resume: Empty text extracted from resume for {candidate_id}')
        Candidate.objects.filter(id=candidate_id).update(resume_processed=True)
        return {'status': 'complete', 'reason': 'empty_resume'}

    # ── Step 4: Parse structured data ────────────────────────────────────

    try:
        parsed = parse_resume(raw_text)
        logger.info(
            f'process_resume: Parsed {len(parsed["skills"])} skills, '
            f'{len(parsed["experience"])} experience entries'
        )
    except Exception as exc:
        logger.warning(f'process_resume: Parsing failed (non-fatal): {exc}')
        parsed = {'skills': [], 'experience': [], 'education': [], 'name': ''}

    # ── Step 5: Embed resume text ─────────────────────────────────────────

    embedding = []
    try:
        # Embed a summary of the resume - skills + first 500 chars of text
        embed_input = ' '.join(parsed['skills']) + ' ' + raw_text[:500]
        embedding   = embed_text(embed_input.strip())
        logger.info(f'process_resume: Generated embedding (dim={len(embedding)})')
    except Exception as exc:
        logger.warning(f'process_resume: Embedding failed (non-fatal, proceeding): {exc}')
        embedding = []

    # ── Step 6: Store vector in Qdrant ────────────────────────────────────

    qdrant_id = ''
    if embedding:
        try:
            # Delete old vector if one exists (idempotency)
            if candidate.resume_embedding_id:
                delete_resume_vector(str(org_id), candidate.resume_embedding_id)

            qdrant_id = store_resume_vector(
                org_id=str(org_id),
                candidate_id=str(candidate_id),
                candidate_name=candidate.get_full_name(),
                embedding=embedding,
            )
            logger.info(f'process_resume: Stored vector in Qdrant ({qdrant_id})')
        except Exception as exc:
            logger.warning(f'process_resume: Qdrant storage failed (proceeding without vector): {exc}')
            qdrant_id = ''

    # ── Step 7: Save to database (asynchronously updating placeholders if needed) ──
    email_match = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', raw_text)
    phone_match = re.search(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', raw_text)

    update_fields = {
        'parsed_skills':       parsed['skills'],
        'parsed_experience':   parsed['experience'],
        'parsed_education':    parsed['education'],
        'parsed_projects':     parsed.get('projects', []),
        'parsed_name':          parsed['name'] or '',
        'resume_embedding_id': qdrant_id,
        'resume_processed':    True,
    }

    # Only update contacts if they are placeholders/empty
    if candidate.email.startswith('placeholder_') or candidate.email.startswith('processing_'):
        if email_match:
            update_fields['email'] = email_match.group(0)
            
    if not candidate.phone:
        if phone_match:
            update_fields['phone'] = phone_match.group(0)

    # If parsed name is found, sync it to first_name and last_name
    parsed_name = parsed.get('name', '').strip()
    if parsed_name:
        parts = parsed_name.split()
        if len(parts) >= 2:
            update_fields['first_name'] = parts[0]
            update_fields['last_name'] = " ".join(parts[1:])
        elif len(parts) == 1:
            update_fields['first_name'] = parts[0]
            update_fields['last_name'] = ""

    Candidate.objects.filter(id=candidate_id).update(**update_fields)


    # ── Step 8: Pre-compute Match Scores for Active Applications ──────────
    try:
        from hiring.services import ResumeMatchService
        from hiring.models import Application
        
        active_apps = Application.objects.filter(candidate_id=candidate_id, is_deleted=False)
        match_service = ResumeMatchService()
        for app in active_apps:
            try:
                match_service.get_match(str(app.id), str(org_id))
                logger.info(f'process_resume: Pre-computed match score for application {app.id}')
            except Exception as e:
                logger.warning(f'process_resume: Failed to pre-compute match score for app {app.id}: {e}')
    except Exception as exc:
        logger.warning(f'process_resume: Application match pre-computation setup failed: {exc}')

    logger.info(f'process_resume: Complete for {candidate.get_full_name()}')

    # Send Welcome/Applied email to the newly parsed candidate
    try:
        from hiring.services import send_automatic_email
        cand_email = getattr(candidate, 'email', '') or ''
        if cand_email and not cand_email.startswith('processing_') and not cand_email.startswith('placeholder_') and '@example.com' not in cand_email:
            for app in active_apps:
                send_automatic_email(app, 'applied')
                logger.info(f'process_resume: Sent applied email for application {app.id}')
    except Exception as e:
        logger.warning(f'process_resume: Failed to send automatic applied email: {e}')

    return {
        'status':     'complete',
        'skills':     len(parsed['skills']),
        'experience': len(parsed['experience']),
        'education':  len(parsed['education']),
        'embedded':   bool(qdrant_id),
    }


def _run_resume_processing_thread(candidate_id_str: str):
    from django.db import close_old_connections
    close_old_connections()
    try:
        process_resume(candidate_id_str)
    except Exception as e:
        logger.error(f"Background thread resume processing error for candidate {candidate_id_str}: {e}")
    finally:
        close_old_connections()


def dispatch_resume_processing(candidate_id: str):
    """
    Triggers resume parsing asynchronously.
    Dispatches to Celery only if USE_CELERY is explicitly enabled in environment.
    Otherwise (standard single-server / Render web dyno), executes safely
    in a daemon thread with clean DB connection lifecycle management.
    """
    import threading
    candidate_id_str = str(candidate_id)
    use_celery = os.getenv('USE_CELERY', '').lower() in ('true', '1')
    if use_celery and hasattr(process_resume, 'delay'):
        try:
            process_resume.delay(candidate_id_str)
            return
        except Exception as celery_err:
            logger.warning(
                f"Celery queue refused for candidate {candidate_id_str} ({celery_err}). "
                f"Falling back to background daemon thread."
            )

    t = threading.Thread(target=_run_resume_processing_thread, args=(candidate_id_str,), daemon=True)
    t.start()


def _run_app_match_thread(app_id_str: str, org_id_str: str):
    from django.db import close_old_connections
    close_old_connections()
    try:
        from hiring.services import ResumeMatchService
        ResumeMatchService().get_match(app_id_str, org_id_str)
    except Exception as e:
        logger.warning(f"Background match calculation failed for app {app_id_str}: {e}")
    finally:
        close_old_connections()


def dispatch_application_match(app_id: str, org_id: str):
    """
    Triggers match score computation asynchronously in a background daemon thread
    with DB connection recycling so HTTP request handlers never block.
    """
    import threading
    t = threading.Thread(
        target=_run_app_match_thread,
        args=(str(app_id), str(org_id)),
        daemon=True,
    )
    t.start()

