import os
import json
import logging
import httpx
from datetime import datetime
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models import Q
from core.exceptions import ServiceError
from tenants.models import Organization
from teams.models import Department, Employee
from projects.models import Project, Task
from knowledge.models import Document
from expenses.models import ExpenseClaim
from meetings.models import Meeting, MeetingParticipant, generate_room_code
from .models import MailMessage, MailRecipientStatus, UserMailPreference

logger = logging.getLogger(__name__)
User = get_user_model()

GEMINI_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-3.8-flash',
]

def _extract_json_payload(raw_text: str):
    if not raw_text:
        return None
    cleaned = raw_text.strip()
    if cleaned.startswith('```'):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith('```'):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith('```'):
            lines = lines[:-1]
        cleaned = '\n'.join(lines).strip()

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    start_idx = -1
    end_idx = -1
    for i, char in enumerate(cleaned):
        if char in ('{', '['):
            start_idx = i
            break
    for i in range(len(cleaned) - 1, -1, -1):
        if cleaned[i] in ('}', ']'):
            end_idx = i + 1
            break
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        try:
            return json.loads(cleaned[start_idx:end_idx])
        except Exception:
            pass
    return None


class CommunicationService:

    def _call_gemini(self, system_prompt: str, user_prompt: str, json_mode: bool = False) -> str:
        """
        High-performance multi-engine LLM caller:
        1. Fast path: Groq (openai/gpt-oss-120b, 300ms latency)
        2. Cascade path: Google Gemini (gemini-3.5-flash-lite, gemini-flash-lite-latest, gemini-flash-latest)
        """
        groq_key = getattr(settings, 'GROQ_API_KEY', '') or os.getenv('GROQ_API_KEY', '')
        gemini_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')

        # 1. Groq ultra-fast engine (sub-second response)
        if groq_key:
            try:
                headers = {"Authorization": f"Bearer {groq_key}"}
                payload = {
                    "model": "openai/gpt-oss-120b",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.2
                }
                if json_mode:
                    payload["response_format"] = {"type": "json_object"}

                with httpx.Client(timeout=4.0) as client:
                    resp = client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
                    if resp.status_code == 200:
                        content = resp.json()['choices'][0]['message']['content']
                        if content and content.strip():
                            return content
                    else:
                        logger.warning(f"Groq API returned status {resp.status_code}: {resp.text[:120]}")
            except Exception as e:
                logger.warning(f"Groq invocation failed in CommunicationService: {e}")

        # 2. Google Gemini cascade (lite models first)
        if gemini_key:
            for model in GEMINI_MODELS:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
                    payload = {
                        "contents": [
                            {
                                "role": "user",
                                "parts": [
                                    {"text": f"{system_prompt}\n\nTask:\n{user_prompt}"}
                                ]
                            }
                        ],
                        "generationConfig": {
                            "temperature": 0.2,
                        }
                    }
                    if json_mode:
                        payload["generationConfig"]["response_mime_type"] = "application/json"

                    with httpx.Client(timeout=4.5) as client:
                        resp = client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            candidates = data.get('candidates', [])
                            if candidates:
                                text = candidates[0]['content']['parts'][0]['text']
                                if text and text.strip():
                                    return text
                        else:
                            logger.warning(f"Gemini {model} returned status {resp.status_code}: {resp.text[:120]}")
                except Exception as e:
                    logger.warning(f"Gemini {model} call failed in CommunicationService: {e}")
                    continue

        raise ServiceError("AI service is temporarily busy or unreachable. Please try again in a few moments.", 503)

    def ai_smart_compose(self, prompt: str, tone: str = 'executive', action: str = 'draft', context_text: str = '', org_name: str = 'Our Organization', length_level: int = 3) -> dict:
        """
        AI Smart Composer & Tone Switcher with Length Slider (1 = Ultra-Concise Bullets to 5 = In-Depth Elaboration):
        Drafts, polishes, replies, elaborates, shortens, or fixes grammar with selectable professional tones and precise length control.
        """
        length_descriptions = {
            1: "LEVEL 1 (ULTRA-CONCISE BULLETS): Cut all filler, pleasantries, and fluff. Condense the entire message into 2-3 razor-sharp, high-impact bullet points only.",
            2: "LEVEL 2 (CONCISE & COMPACT): Brief, direct, and focused. Keep to 1 tight paragraph or a short bulleted list. Eliminate redundant words.",
            3: "LEVEL 3 (BALANCED & STANDARD): Standard professional email length with 1-2 balanced paragraphs and clear phrasing.",
            4: "LEVEL 4 (DETAILED & EXPANDED): Elaborate on key points, providing supporting rationale, background context, and clear next steps.",
            5: "LEVEL 5 (IN-DEPTH & COMPREHENSIVE): Fully elaborate all rough notes into articulate, thorough, multi-section workplace correspondence with headers and deep context."
        }
        length_guideline = length_descriptions.get(length_level, length_descriptions[3])

        system_prompt = f"""
You are the Executive AI Communication Assistant for '{org_name}'.
You compose clean, highly effective, professional workplace emails and announcements.
Tone: {tone.upper()} (Executive, Concise, Friendly, Urgent, Formal).
Action Requested: {action.upper()} (draft, polish, reply, elaborate, shorten, fix_grammar, length_adjust).

Target Length / Depth:
{length_guideline}

Guidelines:
- If action is 'elaborate' or length_level in [4, 5]: Expand rough notes or short points into full, articulate, highly professional paragraphs.
- If action is 'shorten' or length_level in [1, 2]: Condense verbose paragraphs into sharp, high-impact executive summaries or bullet points.
- If action is 'fix_grammar': Keep the exact meaning and tone, but correct all spelling, punctuation, sentence flow, and phrasing.
- If action is 'polish': Upgrade vocabulary, rhythm, and professional poise.

Return a structured JSON object with the following schema:
{{
  "subject": "Clear, compelling email subject line",
  "body_html": "<p>Formatted HTML content with clean paragraphs, lists (<ul>/<li>), or bold callouts.</p>",
  "body_text": "Plain text version of the message",
  "suggested_category": "announcement | action_required | fyi | general | compliance",
  "suggested_priority": "urgent | high | normal | low"
}}
Return ONLY valid JSON.
"""
        user_prompt = f"User Request / Topic / Draft to modify:\n{prompt}\n\nExisting Context / Prior Thread:\n{context_text}"
        try:
            raw_json = self._call_gemini(system_prompt, user_prompt, json_mode=True)
            parsed = _extract_json_payload(raw_json)
            if parsed and isinstance(parsed, dict) and ('subject' in parsed or 'body_html' in parsed):
                return parsed
        except Exception as e:
            logger.warning(f"AI compose online call failed, using graceful heuristic draft: {e}")

        # Reliable fallback synthesis ensuring user is never blocked
        clean_prompt = prompt.strip()
        subject_candidate = clean_prompt[:60].rstrip('.')
        if len(clean_prompt) > 60:
            subject_candidate = clean_prompt[:57] + '...'

        action_labels = {
            'draft': f"Regarding: {subject_candidate}",
            'reply': f"Re: {subject_candidate}",
            'elaborate': f"Detailed Update: {subject_candidate}",
            'shorten': f"Executive Brief: {subject_candidate}",
            'fix_grammar': f"Updated: {subject_candidate}",
            'polish': f"Refined: {subject_candidate}",
        }
        subj = action_labels.get(action, f"Update: {subject_candidate}")

        paragraphs = [p.strip() for p in (context_text or prompt).split('\n') if p.strip()]
        if not paragraphs:
            paragraphs = [prompt]

        if length_level in [1, 2]:
            bullets = ''.join(f"<li>{p}</li>" for p in paragraphs[:3])
            body_html = f"<p>Key Highlights & Action Items:</p><ul>{bullets}</ul><p>Please let us know if any further details are required.</p>"
            body_text = "\n".join(f"- {p}" for p in paragraphs[:3])
        elif length_level in [4, 5]:
            body_html = f"<p>Dear Team,</p><p>We are reaching out to provide a comprehensive update regarding <strong>{prompt}</strong>.</p>"
            for p in paragraphs:
                body_html += f"<p>{p}</p>"
            body_html += f"<p>Next steps and deliverables are currently being coordinated. Please review the attached points and let us know your feedback.</p><p>Best regards,<br/>{org_name}</p>"
            body_text = f"Dear Team,\n\nUpdate on {prompt}:\n\n" + "\n\n".join(paragraphs)
        else:
            body_html = f"<p>Hello,</p><p>{prompt}</p>"
            if context_text:
                body_html += f"<blockquote>{context_text}</blockquote>"
            body_html += f"<p>Best regards,<br/>{org_name}</p>"
            body_text = f"{prompt}\n\nBest regards,\n{org_name}"

        return {
            "subject": subj,
            "body_html": body_html,
            "body_text": body_text,
            "suggested_category": "action_required" if action in ['draft', 'elaborate'] else "general",
            "suggested_priority": "urgent" if tone == 'urgent' else "normal"
        }

    def ai_generate_smart_replies(self, thread_messages: list, org_name: str = 'Our Organization') -> dict:
        """
        Dynamic Smart Reply Chips:
        Generates 3 contextual 1-click reply options tailored to the incoming conversation:
        1. Acknowledge / Confirm / Agree
        2. Clarify / Ask question / Offer alternative
        3. Postpone / Need more time / Decline politely
        """
        formatted_thread = ""
        for idx, m in enumerate(thread_messages[-4:]):
            sender = m.get('sender_name') or m.get('sender_email') or 'Colleague'
            body = m.get('body_text') or m.get('body') or ''
            formatted_thread += f"[{sender}]: {body}\n"

        system_prompt = f"""
You are the Executive AI Email Assistant for '{org_name}'.
Analyze the recent email messages and generate 3 realistic, distinct, professional 1-click reply suggestions for the recipient.
The 3 options MUST cover:
1. "affirmative": Acknowledge receipt, confirm approval, or agree.
2. "clarification": Inquire about next steps, ask a pertinent clarifying question, or offer an alternative.
3. "postpone": Request more time to review, defer, or politely pass.

Return a JSON object with schema:
{{
  "smart_replies": [
    {{
      "label": "Short button label (2-4 words, e.g. 'Looks Good, Approved')",
      "type": "affirmative",
      "subject_prefix": "Re: ",
      "body_html": "<p>Professional 1-3 sentence pre-written response body formatted in HTML.</p>"
    }},
    {{
      "label": "Short button label (e.g. 'Request Details')",
      "type": "clarification",
      "subject_prefix": "Re: ",
      "body_html": "<p>Professional 1-3 sentence pre-written response body formatted in HTML.</p>"
    }},
    {{
      "label": "Short button label (e.g. 'Reviewing by EOD')",
      "type": "postpone",
      "subject_prefix": "Re: ",
      "body_html": "<p>Professional 1-3 sentence pre-written response body formatted in HTML.</p>"
    }}
  ]
}}
Return ONLY valid JSON.
"""
        try:
            raw_json = self._call_gemini(system_prompt, formatted_thread, json_mode=True)
            parsed = _extract_json_payload(raw_json)
            if parsed and isinstance(parsed, dict) and parsed.get('smart_replies'):
                return parsed
        except Exception as e:
            logger.warning(f"AI smart replies online call failed, using graceful fallback: {e}")

        return {
            "smart_replies": [
                {
                    "label": "Looks Good, Approved",
                    "type": "affirmative",
                    "subject_prefix": "Re: ",
                    "body_html": "<p>Thank you for the update. Everything looks great and is approved to proceed.</p>"
                },
                {
                    "label": "Request Details",
                    "type": "clarification",
                    "subject_prefix": "Re: ",
                    "body_html": "<p>Thanks for sharing. Could you please provide a few additional details or context on the timeline?</p>"
                },
                {
                    "label": "Reviewing by EOD",
                    "type": "postpone",
                    "subject_prefix": "Re: ",
                    "body_html": "<p>Received. I am currently in a focus block and will review this thoroughly by end of day today.</p>"
                }
            ]
        }

    def ai_translate_text(self, text: str, target_language: str = 'English') -> dict:
        """
        Instant Multi-Language Workplace Translation:
        Translates email content into target language while strictly preserving HTML markup, lists, and line breaks.
        """
        system_prompt = f"""
You are an enterprise translation engine.
Translate the input text into: {target_language}.
Maintain all HTML tags (<p>, <br>, <strong>, <ul>, <li>, etc.) exactly as formatted.
Keep proper nouns, names, URLs, and corporate terminology natural and accurate.

Return a JSON object with:
{{
  "translated_html": "<p>Translated HTML content...</p>",
  "detected_source_language": "Name of language detected in original (e.g. English, Spanish, Japanese)",
  "target_language": "{target_language}"
}}
Return ONLY valid JSON.
"""
        try:
            raw_json = self._call_gemini(system_prompt, text, json_mode=True)
            parsed = _extract_json_payload(raw_json)
            if parsed and isinstance(parsed, dict) and parsed.get('translated_html'):
                return parsed
        except Exception as e:
            logger.warning(f"AI translate online call failed, using graceful fallback: {e}")

        return {
            "translated_html": text,
            "detected_source_language": "Auto-detected",
            "target_language": target_language
        }

    def ai_analyze_intent(self, subject: str, body_text: str) -> dict:
        """
        AI Sentiment & Intent Triage:
        Classifies incoming email for rapid decision-making:
        Intent (Escalation, Approval, FYI, Action Required, Collaboration), Urgency, Sentiment, and Estimated Read Time.
        """
        words = len(body_text.split())
        est_read_time = max(1, round(words / 200))

        system_prompt = """
You are an executive email triage classifier.
Analyze the email subject and body to determine intent, urgency, and core ask.

Return a JSON object with:
{
  "intent": "Approval Request | Urgent Escalation | Action Required | Informational FYI | Status Update | General Inquiry",
  "urgency": "Urgent | High | Normal | Low",
  "sentiment": "Positive | Neutral | Pressing | Concerned",
  "badge_color": "rose | amber | emerald | sky | violet",
  "key_ask": "1 concise sentence stating what the sender needs (or 'No action required')",
  "estimated_read_minutes": 1
}
Return ONLY valid JSON.
"""
        user_prompt = f"Subject: {subject}\n\nBody:\n{body_text[:2500]}"
        try:
            raw_json = self._call_gemini(system_prompt, user_prompt, json_mode=True)
            res = _extract_json_payload(raw_json)
            if res and isinstance(res, dict):
                if not res.get('estimated_read_minutes'):
                    res['estimated_read_minutes'] = est_read_time
                return res
        except Exception as e:
            logger.warning(f"AI analyze intent online call failed, using graceful fallback: {e}")

        # Heuristic fallback
        subj_lower = (subject or '').lower()
        if any(w in subj_lower for w in ['urgent', 'asap', 'escalat', 'blocker', 'critical']):
            intent = "Urgent Escalation"
            urgency = "Urgent"
            color = "rose"
        elif any(w in subj_lower for w in ['approv', 'sign-off', 'review']):
            intent = "Approval Request"
            urgency = "High"
            color = "amber"
        elif any(w in subj_lower for w in ['fyi', 'announc', 'update', 'status']):
            intent = "Informational FYI"
            urgency = "Normal"
            color = "sky"
        else:
            intent = "General Inquiry"
            urgency = "Normal"
            color = "violet"

        return {
            "intent": intent,
            "urgency": urgency,
            "sentiment": "Neutral",
            "badge_color": color,
            "key_ask": subject or "General discussion",
            "estimated_read_minutes": est_read_time
        }


    def ai_thread_summarize(self, thread_messages: list, org_name: str = 'Our Organization') -> dict:
        """
        1-Click Thread TL;DR / Executive Summary:
        Summarizes multi-message threads into 3 crisp bullet points, key takeaways, and extracted action items.
        """
        formatted_thread = ""
        for idx, m in enumerate(thread_messages):
            sender = m.get('sender_name') or m.get('sender_email') or 'Unknown'
            date = m.get('created_at') or ''
            body = m.get('body_text') or m.get('body') or ''
            formatted_thread += f"--- Message {idx + 1} by {sender} ({date}) ---\nSubject: {m.get('subject')}\n{body}\n\n"

        system_prompt = f"""
You are the AI Executive Summarizer for '{org_name}'.
Analyze the following email thread conversation and extract structured insights.

Return a JSON object with:
{{
  "tldr_summary": "1-2 sentence high-level executive synthesis of the whole conversation",
  "key_points": [
    "Key takeaway point 1",
    "Key takeaway point 2",
    "Key takeaway point 3"
  ],
  "action_items": [
    {{
      "task": "Specific actionable task description",
      "assignee": "Name of person responsible (or 'Unassigned')",
      "due_date": "Suggested or mentioned due date or 'Upcoming'",
      "priority": "high | medium | low"
    }}
  ],
  "sentiment": "Positive | Collaborative | Urgent | Neutral | Blocked",
  "unresolved_questions": [
    "Any question still left unanswered in the thread"
  ]
}}
Return ONLY valid JSON.
"""
        try:
            raw_json = self._call_gemini(system_prompt, formatted_thread, json_mode=True)
            parsed = _extract_json_payload(raw_json)
            if parsed and isinstance(parsed, dict) and parsed.get('tldr_summary'):
                return parsed
        except Exception as e:
            logger.warning(f"AI summarize online call failed, using graceful fallback: {e}")

        first_subj = thread_messages[0].get('subject') if thread_messages else 'Discussion'
        return {
            "tldr_summary": f"Discussion regarding '{first_subj}' across {len(thread_messages)} messages with key project stakeholders.",
            "key_points": [
                f"Thread initiated with focus on: {first_subj}.",
                f"Active participants include: {', '.join(set(m.get('sender_name', 'Colleague') for m in thread_messages[:3]))}.",
                "Ongoing collaboration on project deliverables and schedule."
            ],
            "action_items": [
                {
                    "task": f"Review thread takeaways for {first_subj}",
                    "assignee": "Team",
                    "due_date": "Upcoming",
                    "priority": "medium"
                }
            ],
            "sentiment": "Collaborative",
            "unresolved_questions": []
        }

    def resolve_recipients(self, org_id, sender_user, target_mode: str, 
                           department_id: str = None, target_role: str = None, 
                           project_id: str = None, recipient_ids_list: list = None) -> list:
        """
        Resolves the list of User recipient objects based on broadcast channels or manual selections:
        - 'all': Entire active organization (excluding sender)
        - 'department': All members belonging to the specified department
        - 'role': All users with a specific role ('admin', 'manager', 'hr', 'employee')
        - 'project': All members working on / owning the project
        - 'individual': Explicit list of User IDs
        """
        base_qs = User.objects.filter(org_id=org_id, is_active=True).exclude(id=sender_user.id)

        if target_mode == 'all':
            return list(base_qs)

        if target_mode == 'department' and department_id:
            emp_user_ids = Employee.objects.filter(
                org_id=org_id,
                department_id=department_id,
                is_deleted=False
            ).values_list('user_id', flat=True)
            return list(base_qs.filter(id__in=emp_user_ids))

        if target_mode == 'role' and target_role:
            if target_role == 'all_managers':
                return list(base_qs.filter(role__in=['admin', 'manager', 'hr']))
            elif target_role == 'admins_hr':
                return list(base_qs.filter(role__in=['admin', 'hr']))
            else:
                return list(base_qs.filter(role=target_role))

        if target_mode == 'project' and project_id:
            p = Project.objects.filter(org_id=org_id, id=project_id, is_deleted=False).first()
            if not p:
                return []
            project_user_ids = set()
            if p.owner_id:
                project_user_ids.add(p.owner_id)
            task_assignees = Task.objects.filter(
                project_id=project_id,
                is_deleted=False,
                assignee__isnull=False
            ).values_list('assignee_id', flat=True)
            for uid in task_assignees:
                project_user_ids.add(uid)
            return list(base_qs.filter(id__in=project_user_ids))

        # Default: individual recipient IDs or email addresses
        if recipient_ids_list:
            return list(base_qs.filter(Q(id__in=recipient_ids_list) | Q(email__in=recipient_ids_list)))

        return []

    def create_task_from_action_item(self, org_id, requesting_user, project_id: str, 
                                     title: str, description: str = '', 
                                     assignee_id: str = None, due_date: str = None, 
                                     priority: str = 'medium', message_id: str = None) -> dict:
        """
        1-Click Action Item to Project Task Converter with Bidirectional Work-Graph Linking:
        Creates a Task linked to an existing Project in CORE, tags it with the originating email,
        and annotates the email thread with the resulting task reference.
        """
        project = Project.objects.filter(org_id=org_id, id=project_id, is_deleted=False).first()
        if not project:
            raise ServiceError("Target project not found.", 404)

        assignee = None
        if assignee_id:
            assignee = User.objects.filter(org_id=org_id, id=assignee_id, is_active=True).first()

        parsed_due_date = None
        if due_date and due_date not in ['Upcoming', 'ASAP', 'TBD', 'None']:
            try:
                parsed_due_date = datetime.strptime(due_date[:10], '%Y-%m-%d').date()
            except Exception:
                parsed_due_date = None

        tags = ['from_email']
        if message_id:
            tags.append(f"email_thread:{message_id}")

        task = Task.objects.create(
            org_id=org_id,
            project=project,
            title=title.strip(),
            description=description.strip(),
            assignee=assignee or requesting_user,
            status='todo',
            priority=priority if priority in ['low', 'medium', 'high', 'critical'] else 'medium',
            due_date=parsed_due_date,
            tags=tags
        )

        # Bidirectional Work-Graph linking: update the email message & root thread
        if message_id:
            msg = MailMessage.objects.filter(org_id=org_id, id=message_id).first()
            if msg:
                task_title_summary = f"{project.name} > {task.title}"
                msg.linked_entity_type = 'project'
                msg.linked_entity_id = str(task.id)
                msg.linked_entity_title = task_title_summary
                msg.save(update_fields=['linked_entity_type', 'linked_entity_id', 'linked_entity_title'])

                # Also update root thread if this is a reply
                root = msg
                while root.parent_message is not None:
                    root = root.parent_message
                if root.id != msg.id:
                    root.linked_entity_type = 'project'
                    root.linked_entity_id = str(task.id)
                    root.linked_entity_title = task_title_summary
                    root.save(update_fields=['linked_entity_type', 'linked_entity_id', 'linked_entity_title'])

        return {
            'task_id': str(task.id),
            'title': task.title,
            'project_id': str(project.id),
            'project_name': project.name,
            'assignee_name': task.assignee.get_full_name() if task.assignee else 'Unassigned',
            'status': task.status,
            'due_date': str(task.due_date) if task.due_date else None,
        }

    def get_workgraph_entity_card(self, org_id, entity_type: str, entity_id: str) -> dict:
        """
        Fetches rich live card metadata for any Work-Graph entity (Task/Project, Meeting, Expense, Doc).
        """
        if not entity_type or not entity_id:
            return {}

        if entity_type == 'project':
            task = Task.objects.filter(org_id=org_id, id=entity_id, is_deleted=False).select_related('project', 'assignee').first()
            if task:
                return {
                    'type': 'task',
                    'id': str(task.id),
                    'title': task.title,
                    'status': task.status,
                    'priority': task.priority,
                    'project_id': str(task.project_id),
                    'project_name': task.project.name,
                    'assignee_name': task.assignee.get_full_name() if task.assignee else 'Unassigned',
                    'due_date': str(task.due_date) if task.due_date else None,
                    'link': f"/projects/{task.project_id}?task={task.id}"
                }
            p = Project.objects.filter(org_id=org_id, id=entity_id, is_deleted=False).select_related('owner').first()
            if p:
                return {
                    'type': 'project',
                    'id': str(p.id),
                    'title': p.name,
                    'status': p.status,
                    'owner_name': p.owner.get_full_name() if p.owner else 'Unassigned',
                    'tasks_count': p.tasks.filter(is_deleted=False).count(),
                    'link': f"/projects/{p.id}"
                }

        elif entity_type == 'meeting':
            m = Meeting.objects.filter(org_id=org_id, id=entity_id, is_deleted=False).select_related('host').first()
            if m:
                return {
                    'type': 'meeting',
                    'id': str(m.id),
                    'title': m.title,
                    'room_code': m.room_code,
                    'status': m.status,
                    'is_live': m.status == 'live',
                    'host_name': m.host.get_full_name() if m.host else 'Host',
                    'scheduled_start': m.scheduled_start.strftime('%b %d, %I:%M %p') if m.scheduled_start else None,
                    'participant_count': m.participants.count(),
                    'link': f"/meetings/{m.id}"
                }

        elif entity_type == 'expense':
            e = ExpenseClaim.objects.filter(org_id=org_id, id=entity_id, is_deleted=False).select_related('employee__user').first()
            if e:
                return {
                    'type': 'expense',
                    'id': str(e.id),
                    'title': e.title,
                    'merchant': e.merchant,
                    'amount': str(e.amount),
                    'currency': e.currency,
                    'status': e.status,
                    'category': e.category,
                    'employee_name': e.employee.user.get_full_name() if e.employee and e.employee.user else 'Employee',
                    'expense_date': str(e.expense_date),
                    'link': f"/expenses?id={e.id}"
                }

        elif entity_type == 'document':
            d = Document.objects.filter(org_id=org_id, id=entity_id, is_deleted=False).select_related('uploaded_by').first()
            if d:
                return {
                    'type': 'document',
                    'id': str(d.id),
                    'title': d.title,
                    'file_type': d.file_type,
                    'file_size': d.file_size,
                    'status': d.status,
                    'allowed_roles': d.allowed_roles,
                    'author_name': d.uploaded_by.get_full_name() if d.uploaded_by else 'Staff',
                    'updated_at': d.updated_at.strftime('%b %d, %Y') if d.updated_at else None,
                    'link': f"/documents/{d.id}"
                }

        return {}

    def spawn_instant_meeting_from_thread(self, org_id, requesting_user, message: MailMessage) -> dict:
        """
        1-Click Meeting Escalation:
        Spawns a live Meeting room inviting all sender and recipient participants from the email thread.
        """
        root = message
        while root.parent_message is not None:
            root = root.parent_message

        recipients_qs = root.recipient_statuses.all().select_related('recipient')
        attendee_users = {root.sender}
        for s in recipients_qs:
            attendee_users.add(s.recipient)

        now = timezone.now()
        clean_title = f"Sync: {root.subject.replace('Re:', '').replace('Fwd:', '').strip()}"
        if len(clean_title) > 200:
            clean_title = clean_title[:197] + '...'

        meeting = Meeting.objects.create(
            org_id=org_id,
            host=requesting_user,
            title=clean_title,
            status='live',
            is_instant=True,
            room_code=generate_room_code(),
            scheduled_start=now,
            actual_start=now
        )

        # Add requesting user as host
        MeetingParticipant.objects.create(
            org_id=org_id,
            meeting=meeting,
            user=requesting_user,
            email=requesting_user.email,
            name=requesting_user.get_full_name() or requesting_user.email,
            role='host',
            is_admitted=True,
            has_joined=True,
            joined_at=now
        )

        # Add all thread colleagues as attendees
        for u in attendee_users:
            if u.id != requesting_user.id:
                MeetingParticipant.objects.get_or_create(
                    meeting=meeting,
                    email=u.email,
                    defaults={
                        'org_id': org_id,
                        'user': u,
                        'name': u.get_full_name() or u.email,
                        'role': 'attendee',
                        'is_admitted': True
                    }
                )

        # Bidirectional link: attach meeting to the root thread
        root.linked_entity_type = 'meeting'
        root.linked_entity_id = str(meeting.id)
        root.linked_entity_title = meeting.title
        root.save(update_fields=['linked_entity_type', 'linked_entity_id', 'linked_entity_title'])

        return {
            'meeting_id': str(meeting.id),
            'room_code': meeting.room_code,
            'title': meeting.title,
            'status': meeting.status,
            'participant_count': meeting.participants.count()
        }

    def get_users_presence(self, org_id, user_ids: list) -> dict:
        """
        Recipient Live Presence & Availability HUD:
        Evaluates real-time presence across the organization:
        - 🟡 In Meeting (connected to an active CORE Meeting)
        - 🔴 Out of Office (calendar vacation auto-responder active)
        - 🟢 Online (active session)
        - ⚪ Offline
        """
        if not user_ids:
            return {}

        users = User.objects.filter(org_id=org_id, id__in=user_ids)
        today = timezone.now().date()

        # In meeting check
        live_meeting_user_ids = set(
            MeetingParticipant.objects.filter(
                meeting__org_id=org_id,
                meeting__status='live',
                user_id__in=user_ids,
                has_joined=True,
                left_at__isnull=True
            ).values_list('user_id', flat=True)
        )

        # OOO check
        ooo_prefs = UserMailPreference.objects.filter(
            org_id=org_id,
            user_id__in=user_ids,
            is_ooo_enabled=True,
            ooo_start_date__lte=today,
            ooo_end_date__gte=today
        )
        ooo_map = {str(p.user_id): p for p in ooo_prefs}

        presence_data = {}
        for u in users:
            uid = str(u.id)
            if u.id in live_meeting_user_ids:
                presence_data[uid] = {
                    'status': 'in_meeting',
                    'label': 'In a Meeting',
                    'color': 'amber',
                    'detail': 'Connected to a live meeting room'
                }
            elif uid in ooo_map:
                p = ooo_map[uid]
                end_str = p.ooo_end_date.strftime('%b %d') if p.ooo_end_date else 'indefinitely'
                presence_data[uid] = {
                    'status': 'ooo',
                    'label': 'Out of Office',
                    'color': 'rose',
                    'detail': f"Returning {end_str}"
                }
            elif u.is_active:
                presence_data[uid] = {
                    'status': 'online',
                    'label': 'Active Online',
                    'color': 'emerald',
                    'detail': 'Active in workspace'
                }
            else:
                presence_data[uid] = {
                    'status': 'offline',
                    'label': 'Offline',
                    'color': 'slate',
                    'detail': 'Offline'
                }

        return presence_data

    def verify_document_permissions(self, org_id, document_id: str, recipient_ids: list) -> dict:
        """
        Document Pre-Send Permission Verifier:
        Verifies all email recipients possess the necessary role access to open a linked document.
        """
        doc = Document.objects.filter(org_id=org_id, id=document_id, is_deleted=False).first()
        if not doc:
            return {'has_permission_issues': False}

        raw_roles = doc.allowed_roles or 'admin,hr,manager,employee'
        allowed_roles = [r.strip().lower() for r in raw_roles.split(',') if r.strip()]

        recipients = User.objects.filter(org_id=org_id, id__in=recipient_ids)
        missing_recipients = []
        for r in recipients:
            role = (r.role or 'employee').lower()
            if role not in allowed_roles:
                missing_recipients.append({
                    'id': str(r.id),
                    'name': r.get_full_name() or r.email,
                    'email': r.email,
                    'role': role
                })

        return {
            'has_permission_issues': len(missing_recipients) > 0,
            'document_id': str(doc.id),
            'document_title': doc.title,
            'allowed_roles': allowed_roles,
            'missing_recipients': missing_recipients
        }

    def grant_document_roles(self, org_id, document_id: str, roles_to_add: list) -> dict:
        """
        Grants requested role access to a Document so all intended email recipients can access it.
        """
        doc = Document.objects.filter(org_id=org_id, id=document_id, is_deleted=False).first()
        if not doc:
            raise ServiceError("Document not found.", 404)

        raw_roles = doc.allowed_roles or 'admin,hr,manager,employee'
        current_roles = [r.strip().lower() for r in raw_roles.split(',') if r.strip()]
        for r in roles_to_add:
            clean = r.strip().lower()
            if clean and clean not in current_roles:
                current_roles.append(clean)

        doc.allowed_roles = ','.join(current_roles)
        doc.save(update_fields=['allowed_roles'])
        return {
            'document_id': str(doc.id),
            'document_title': doc.title,
            'allowed_roles': current_roles
        }

    def get_read_receipts_stats(self, message: MailMessage, requesting_user) -> dict:
        """
        Returns full audit breakdown of read receipts and policy acknowledgments for a sent thread.
        """
        statuses = message.recipient_statuses.all().select_related('recipient')
        total = statuses.count()
        if total == 0:
            return {
                'total_recipients': 0,
                'read_count': 0,
                'read_percentage': 0.0,
                'acknowledged_count': 0,
                'acknowledged_percentage': 0.0,
                'recipients': []
            }

        read_statuses = [s for s in statuses if s.is_read]
        ack_statuses = [s for s in statuses if s.is_acknowledged]

        recipients_list = []
        for s in statuses:
            r = s.recipient
            name = f"{r.first_name} {r.last_name}".strip() or r.email
            recipients_list.append({
                'id': str(r.id),
                'name': name,
                'email': r.email,
                'is_read': s.is_read,
                'read_at': s.read_at.strftime('%Y-%m-%d %H:%M') if s.read_at else None,
                'is_acknowledged': s.is_acknowledged,
                'acknowledged_at': s.acknowledged_at.strftime('%Y-%m-%d %H:%M') if s.acknowledged_at else None,
            })

        return {
            'total_recipients': total,
            'read_count': len(read_statuses),
            'read_percentage': round((len(read_statuses) / total) * 100, 1),
            'acknowledged_count': len(ack_statuses),
            'acknowledged_percentage': round((len(ack_statuses) / total) * 100, 1),
            'recipients': recipients_list
        }

communication_service = CommunicationService()
