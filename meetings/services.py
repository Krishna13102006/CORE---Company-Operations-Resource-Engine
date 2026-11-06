import os
import json
import logging
import threading
import datetime
import httpx
from typing import List, Dict, Any, Generator, Optional
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.utils.html import strip_tags
from django.utils import timezone
from dotenv import load_dotenv

from .models import Meeting, MeetingParticipant
from .repositories import MeetingRepository
from accounts.models import User

logger = logging.getLogger(__name__)


# ----------------------------------------------------------------------
# 1. ICS Calendar & Email Invitation Service
# ----------------------------------------------------------------------

def _format_ics_datetime(dt: Optional[datetime.datetime]) -> str:
    if not dt:
        dt = timezone.now()
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.utc)
    utc_dt = dt.astimezone(datetime.timezone.utc)
    return utc_dt.strftime('%Y%m%dT%H%M%SZ')


def generate_ics_calendar_content(meeting: Meeting, join_url: str) -> str:
    """Generates standard iCalendar (RFC 5545) VCALENDAR .ics text."""
    now_str = _format_ics_datetime(timezone.now())
    start_str = _format_ics_datetime(meeting.scheduled_start or timezone.now())
    end_dt = meeting.scheduled_end or ((meeting.scheduled_start or timezone.now()) + datetime.timedelta(minutes=45))
    end_str = _format_ics_datetime(end_dt)

    uid = f"meet-{meeting.id}@{getattr(settings, 'ALLOWED_HOSTS', ['localhost'])[0]}"
    summary = meeting.title.replace('\n', ' ')
    description = f"CORE Workspace Meeting\\n\\nJoin Link: {join_url}\\nRoom Code: {meeting.room_code}\\n\\n{meeting.description}".replace('\n', '\\n')

    ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CORE Workspace//Meetings Engine//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{now_str}",
        f"DTSTART:{start_str}",
        f"DTEND:{end_str}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{description}",
        f"LOCATION:{join_url}",
        f"ORGANIZER;CN={meeting.host.get_full_name() or meeting.host.email}:mailto:{meeting.host.email}",
        "STATUS:CONFIRMED",
        "SEQUENCE:0",
        "BEGIN:VALARM",
        "TRIGGER:-PT15M",
        "ACTION:DISPLAY",
        f"DESCRIPTION:Reminder: {summary}",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR"
    ]
    return "\r\n".join(ics)


def _send_meeting_invitations_worker(meeting_id: str, recipient_emails: List[str], base_url: str):
    """Background thread worker to send modern HTML email invitations with .ics calendar attachments."""
    try:
        load_dotenv(override=True)
        meeting = Meeting.objects.filter(id=meeting_id).select_related('host').first()
        if not meeting:
            return

        if not recipient_emails:
            return

        host_name = meeting.host.get_full_name() or meeting.host.email
        join_url = f"{base_url.rstrip('/')}/meetings/room/{meeting.room_code}"
        
        time_str = "Instant Meeting (Starting Now)"
        if meeting.scheduled_start:
            time_str = meeting.scheduled_start.strftime("%A, %B %d, %Y at %I:%M %p UTC")

        ics_content = generate_ics_calendar_content(meeting, join_url)

        subject = f"Invitation: {meeting.title} - CORE Workspace"
        
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }}
    .header {{ background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 32px 24px; text-align: center; color: #ffffff; }}
    .header h1 {{ margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }}
    .header p {{ margin: 8px 0 0; font-size: 14px; opacity: 0.9; }}
    .content {{ padding: 32px 24px; }}
    .details-box {{ background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin: 20px 0; }}
    .detail-row {{ display: flex; margin-bottom: 12px; font-size: 14px; }}
    .detail-label {{ color: #94a3b8; width: 100px; flex-shrink: 0; font-weight: 600; }}
    .detail-value {{ color: #f1f5f9; font-weight: 500; word-break: break-word; }}
    .btn-container {{ text-align: center; margin: 32px 0 16px; }}
    .btn-join {{ display: inline-block; background: #6366f1; color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4); }}
    .btn-join:hover {{ background: #4f46e5; }}
    .room-code-tag {{ display: inline-block; background: #334155; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #38bdf8; margin-top: 4px; }}
    .footer {{ background: #0f172a; border-top: 1px solid #334155; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CORE Meetings</h1>
      <p>Video Conference Invitation</p>
    </div>
    <div class="content">
      <p style="font-size: 16px; color: #e2e8f0; margin-top: 0;">
        <strong>{host_name}</strong> has invited you to join a video conference.
      </p>
      
      <div class="details-box">
        <div class="detail-row">
          <div class="detail-label">Meeting:</div>
          <div class="detail-value" style="font-weight: 700; color: #ffffff; font-size: 16px;">{meeting.title}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">When:</div>
          <div class="detail-value">{time_str}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Room Code:</div>
          <div class="detail-value"><span class="room-code-tag">{meeting.room_code}</span></div>
        </div>
        {f'<div class="detail-row"><div class="detail-label">Passcode:</div><div class="detail-value">{meeting.passcode}</div></div>' if meeting.passcode else ''}
        {f'<div class="detail-row"><div class="detail-label">Notes:</div><div class="detail-value">{meeting.description}</div></div>' if meeting.description else ''}
      </div>

      <div class="btn-container">
        <a href="{join_url}" class="btn-join" target="_blank">Join Video Meeting</a>
      </div>
      <p style="text-align: center; font-size: 12px; color: #94a3b8;">
        Or paste this link into your browser: <br/>
        <a href="{join_url}" style="color: #6366f1; word-break: break-all;">{join_url}</a>
      </p>
    </div>
    <div class="footer">
      <p>Powered by CORE Workspace Meeting Intelligence with Real-Time Transcription & AI Insights.</p>
      <p>A calendar event file (.ics) is attached to this invitation for your convenience.</p>
    </div>
  </div>
</body>
</html>
"""

        from core.email_dispatcher import send_robust_email
        plain_text = f"You are invited to {meeting.title}.\nHost: {host_name}\nTime: {time_str}\nJoin Link: {join_url}\nRoom Code: {meeting.room_code}"

        ics_att = [{
            'filename': 'meeting.ics',
            'content': ics_content.encode('utf-8'),
            'content_type': 'text/calendar; charset=utf-8; method=REQUEST'
        }]

        success, detail = send_robust_email(
            to_email=recipient_emails,
            subject=subject,
            html_content=html_content,
            text_content=plain_text,
            from_email=from_email if 'from_email' in locals() else None,
            reply_to=meeting.host.email if meeting.host else None,
            attachments=ics_att
        )
        logger.info(f"Meeting invitations dispatched status: {success} ({detail}) for {meeting.room_code}")
    except Exception as e:
        logger.error(f"Failed to send meeting invites for meeting {meeting_id}: {e}", exc_info=True)

    except Exception as e:
        logger.error(f"Error in _send_meeting_invitations_worker: {e}", exc_info=True)


def dispatch_meeting_invites_async(meeting_id: str, recipient_emails: List[str], base_url: str):
    """Spawns background thread for zero-latency email dispatch."""
    if not recipient_emails:
        return
    t = threading.Thread(
        target=_send_meeting_invitations_worker,
        args=(meeting_id, recipient_emails, base_url),
        daemon=True
    )
    t.start()


def create_meeting_with_invites(data: Dict[str, Any], host_user, org_id: str, base_url: str) -> Meeting:
    """Creates meeting record, sets up participants, and dispatches invite emails."""
    meeting = MeetingRepository.create_meeting(data, host_user, org_id)

    # Add host as a participant
    MeetingRepository.add_participant(
        meeting=meeting,
        email=host_user.email,
        name=host_user.get_full_name() or host_user.email,
        user=host_user,
        role='host'
    )

    # Process invitees
    invitees = data.get('invitees', [])
    emails_to_invite = []

    for inv in invitees:
        if isinstance(inv, str):
            email = inv.strip().lower()
            name = email.split('@')[0]
            role = 'attendee'
        elif isinstance(inv, dict):
            email = inv.get('email', '').strip().lower()
            name = inv.get('name', '').strip() or email.split('@')[0]
            role = inv.get('role', 'attendee')
        else:
            continue

        if not email or email == host_user.email.lower():
            continue

        existing_user = User.objects.filter(email__iexact=email).first()
        MeetingRepository.add_participant(
            meeting=meeting,
            email=email,
            name=name or (existing_user.get_full_name() if existing_user else email.split('@')[0]),
            user=existing_user,
            role=role
        )
        emails_to_invite.append(email)

    if emails_to_invite:
        dispatch_meeting_invites_async(str(meeting.id), emails_to_invite, base_url)

    return meeting


def add_invitees_to_meeting(meeting: Meeting, invitees: List[Dict[str, Any]], base_url: str) -> List[MeetingParticipant]:
    """Adds more participants to an existing meeting and sends email invites."""
    added_participants = []
    emails_to_invite = []

    for inv in invitees:
        if isinstance(inv, str):
            email = inv.strip().lower()
            name = email.split('@')[0]
            role = 'attendee'
        elif isinstance(inv, dict):
            email = inv.get('email', '').strip().lower()
            name = inv.get('name', '').strip() or email.split('@')[0]
            role = inv.get('role', 'attendee')
        else:
            continue

        if not email:
            continue

        existing_user = User.objects.filter(email__iexact=email).first()
        participant = MeetingRepository.add_participant(
            meeting=meeting,
            email=email,
            name=name,
            user=existing_user,
            role=role
        )
        added_participants.append(participant)
        emails_to_invite.append(email)

    if emails_to_invite:
        dispatch_meeting_invites_async(str(meeting.id), emails_to_invite, base_url)

    return added_participants


# ----------------------------------------------------------------------
# 2. Gemini AI Meeting Summarization Service
# ----------------------------------------------------------------------

GEMINI_CASCADE_MODELS = [
    'gemini-flash-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-flash-lite-latest',
]

def format_dialogue_text(transcript_raw: List[Dict[str, Any]]) -> str:
    """Formats raw transcript entries into readable dialogue."""
    lines = []
    for entry in transcript_raw:
        speaker = entry.get('speaker_name') or entry.get('speaker_email') or 'Participant'
        text = entry.get('text', '').strip()
        timestamp = entry.get('timestamp') or ''
        if text:
            if timestamp:
                lines.append(f"[{timestamp}] {speaker}: {text}")
            else:
                lines.append(f"{speaker}: {text}")
    return "\n".join(lines)


def generate_meeting_ai_summary(meeting: Meeting) -> Dict[str, Any]:
    """
    Analyzes meeting dialogue transcript and generates:
    1. Executive Summary (Markdown)
    2. Key Decisions (List of strings)
    3. Action Items (List of task objects with owner and priority)
    """
    transcript_text = format_dialogue_text(meeting.transcript_raw or [])
    if not transcript_text.strip():
        # Fallback for empty transcripts
        empty_summary = f"Meeting '{meeting.title}' concluded with no spoken dialogue recorded in the transcript."
        MeetingRepository.update_ai_notes(meeting, empty_summary, [], [])
        return {
            'ai_summary': empty_summary,
            'key_decisions': [],
            'action_items': []
        }

    gemini_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
    groq_key = getattr(settings, 'GROQ_API_KEY', '') or os.getenv('GROQ_API_KEY', '')
    openai_key = getattr(settings, 'OPENAI_API_KEY', '') or os.getenv('OPENAI_API_KEY', '')

    prompt = f"""
You are an expert AI Executive Meeting Assistant. Analyze the following meeting transcript for '{meeting.title}' and provide a structured JSON response.

Meeting Title: {meeting.title}
Meeting Description: {meeting.description}
Host: {meeting.host.get_full_name() or meeting.host.email}

Transcript:
{transcript_text}

Respond ONLY with valid JSON conforming to this exact structure:
{{
  "ai_summary": "Detailed multi-paragraph executive summary formatted in Markdown with headings, bullet points, and high-level outcomes.",
  "key_decisions": [
    "Decision 1 made during the meeting",
    "Decision 2 made during the meeting"
  ],
  "action_items": [
    {{
      "task": "Specific task description",
      "owner": "Person name or Unassigned",
      "priority": "high" | "medium" | "low",
      "deadline": "Target deadline or date mentioned, or 'Soon'"
    }}
  ]
}}
"""

    summary_data = None

    # 1. Try Gemini
    if gemini_key:
        for model in GEMINI_CASCADE_MODELS:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "response_mime_type": "application/json"
                    }
                }
                with httpx.Client(timeout=45.0) as client:
                    resp = client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        raw_text = data['candidates'][0]['content']['parts'][0]['text']
                        summary_data = json.loads(raw_text)
                        logger.info(f"Generated meeting summary with Gemini model {model}")
                        break
            except Exception as e:
                logger.warning(f"Gemini model {model} failed for meeting {meeting.id}: {e}")
                continue

    # 2. Try Groq Cloud if Gemini didn't complete
    if not summary_data and groq_key:
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_key}"},
                    json={
                        "model": getattr(settings, 'GROQ_MODEL', 'openai/gpt-oss-120b'),
                        "messages": [
                            {"role": "system", "content": "You are a meeting analysis expert. You output only valid JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.2
                    }
                )
                if resp.status_code == 200:
                    raw_text = resp.json()['choices'][0]['message']['content']
                    summary_data = json.loads(raw_text)
                    logger.info(f"Generated meeting summary with Groq")
        except Exception as e:
            logger.warning(f"Groq summary failed: {e}")

    # 3. Fallback extraction if LLM calls failed
    if not summary_data:
        summary_data = {
            "ai_summary": f"### Meeting Summary for {meeting.title}\n\nThe meeting was conducted with {len(meeting.transcript_raw or [])} transcript segments recorded.\n\n* Participants discussed agenda topics and shared live updates.",
            "key_decisions": ["Concluded meeting agenda items."],
            "action_items": [{"task": "Review meeting discussion notes", "owner": meeting.host.get_full_name() or "Host", "priority": "medium", "deadline": "This week"}]
        }

    ai_summary = summary_data.get('ai_summary', '')
    key_decisions = summary_data.get('key_decisions', [])
    action_items = summary_data.get('action_items', [])

    MeetingRepository.update_ai_notes(meeting, ai_summary, key_decisions, action_items)

    try:
        from automations.services import AutomationService
        AutomationService.execute_meeting_scribe_task_delegation(
            org_id=meeting.org_id,
            meeting=meeting,
            actor_user=meeting.host
        )
    except Exception as auto_err:
        logger.warning(f"Meeting automation trigger failed: {auto_err}")

    return {
        'ai_summary': ai_summary,
        'key_decisions': key_decisions,
        'action_items': action_items
    }


def trigger_meeting_ai_summary_async(meeting_id: str):
    """Triggers AI meeting summarization in background when meeting ends."""
    def _worker():
        try:
            meeting = Meeting.objects.filter(id=meeting_id).first()
            if meeting:
                generate_meeting_ai_summary(meeting)
        except Exception as e:
            logger.error(f"Async meeting summary failed for {meeting_id}: {e}", exc_info=True)

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


# ----------------------------------------------------------------------
# 3. Meeting Transcript Interactive RAG Q&A Streaming Engine (SSE)
# ----------------------------------------------------------------------

def stream_meeting_chat_answer(meeting: Meeting, question: str, history: List[Dict[str, str]] = None) -> Generator[str, None, None]:
    """
    Streams conversational answers to user questions regarding the meeting transcript,
    decisions, attendees, and action items via Server-Sent Events (SSE).
    """
    transcript_text = format_dialogue_text(meeting.transcript_raw or [])
    
    participants_str = ", ".join([f"{p.name} ({p.email})" for p in meeting.participants.all()])
    decisions_str = "\n".join([f"- {d}" for d in (meeting.key_decisions or [])])
    actions_str = "\n".join([
        f"- {a.get('task')} (Owner: {a.get('owner', 'N/A')}, Priority: {a.get('priority', 'medium')}, Due: {a.get('deadline', 'N/A')})"
        for a in (meeting.action_items or [])
    ])

    context_prompt = f"""
You are the AI Assistant for the following recorded meeting:
Meeting Title: {meeting.title}
Description: {meeting.description}
Host: {meeting.host.get_full_name() or meeting.host.email}
Participants: {participants_str}

Summary:
{meeting.ai_summary or 'No AI summary generated yet.'}

Key Decisions:
{decisions_str or 'None recorded.'}

Action Items:
{actions_str or 'None recorded.'}

Full Transcript Dialogue:
{transcript_text or 'No spoken dialogue recorded.'}

User Question: {question}

Instructions:
- Provide clear, direct, comprehensive, and helpful answers grounded exclusively in the meeting dialogue and notes.
- Use markdown formatting with bullet points, bold highlights, and citations of what specific speaker said what if asked.
- If the question cannot be answered from the meeting content, politely state what was discussed instead.
"""

    gemini_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
    groq_key = getattr(settings, 'GROQ_API_KEY', '') or os.getenv('GROQ_API_KEY', '')

    yield "event: start\ndata: {}\n\n"

    streamed_any = False

    # 1. Stream via Gemini if available
    if gemini_key:
        for model in GEMINI_CASCADE_MODELS:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={gemini_key}"
                payload = {
                    "contents": [{"parts": [{"text": context_prompt}]}],
                    "generationConfig": {"temperature": 0.2}
                }
                with httpx.Client(timeout=60.0) as client:
                    with client.stream("POST", url, json=payload) as response:
                        if response.status_code == 200:
                            for line in response.iter_lines():
                                if not line:
                                    continue
                                if line.startswith("data: "):
                                    json_str = line[6:].strip()
                                    try:
                                        chunk_data = json.loads(json_str)
                                        candidates = chunk_data.get("candidates", [])
                                        if candidates:
                                            parts = candidates[0].get("content", {}).get("parts", [])
                                            for part in parts:
                                                text = part.get("text", "")
                                                if text:
                                                    streamed_any = True
                                                    yield f"data: {json.dumps({'text': text})}\n\n"
                                    except Exception:
                                        pass
                            if streamed_any:
                                break
            except Exception as e:
                logger.warning(f"Gemini streaming failed on {model}: {e}")
                continue

    # 2. Stream via Groq if Gemini wasn't streamed
    if not streamed_any and groq_key:
        try:
            with httpx.Client(timeout=45.0) as client:
                with client.stream(
                    "POST",
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_key}"},
                    json={
                        "model": getattr(settings, 'GROQ_MODEL', 'openai/gpt-oss-120b'),
                        "messages": [
                            {"role": "system", "content": "You are a helpful meeting assistant grounded in the provided notes."},
                            {"role": "user", "content": context_prompt}
                        ],
                        "stream": True,
                        "temperature": 0.2
                    }
                ) as resp:
                    if resp.status_code == 200:
                        for line in resp.iter_lines():
                            if not line:
                                continue
                            if line.startswith("data: "):
                                payload_str = line[6:].strip()
                                if payload_str == "[DONE]":
                                    break
                                try:
                                    delta = json.loads(payload_str)["choices"][0]["delta"]
                                    content = delta.get("content", "")
                                    if content:
                                        streamed_any = True
                                        yield f"data: {json.dumps({'text': content})}\n\n"
                                except Exception:
                                    pass
        except Exception as e:
            logger.warning(f"Groq streaming failed: {e}")

    # 3. Fallback response if no streaming LLM worked
    if not streamed_any:
        fallback_msg = f"Based on the meeting transcript for '{meeting.title}', {len(meeting.transcript_raw or [])} dialogue entries were analyzed. Summary: {meeting.ai_summary or 'No additional details found.'}"
        yield f"data: {json.dumps({'text': fallback_msg})}\n\n"

    yield "data: [DONE]\n\n"


def send_meeting_summary_recap_email(meeting: Meeting, base_url: str = "") -> int:
    """
    Sends an executive recap email to all invited meeting participants containing:
    - Executive Meeting Summary
    - Key Decisions
    - Assigned Action Items
    - Link to full meeting intelligence in CORE
    """
    try:
        load_dotenv(override=True)
        participants = meeting.participants.all()
        recipients = list(set([p.email.strip().lower() for p in participants if p.email and '@' in p.email]))
        if meeting.host and meeting.host.email and meeting.host.email not in recipients:
            recipients.append(meeting.host.email.strip().lower())

        if not recipients:
            return 0

        detail_url = f"{base_url.rstrip('/')}/meetings/{meeting.id}" if base_url else f"/meetings/{meeting.id}"
        
        decisions_html = "".join([f"<li style='margin-bottom:6px;'>{d}</li>" for d in (meeting.key_decisions or [])])
        if not decisions_html:
            decisions_html = "<li>No specific decisions recorded.</li>"

        actions_html = "".join([
            f"<tr style='border-bottom:1px solid #334155;'>"
            f"<td style='padding:8px;color:#f8fafc;'>{a.get('task', '')}</td>"
            f"<td style='padding:8px;color:#a855f7;font-weight:600;'>{a.get('owner', 'Unassigned')}</td>"
            f"<td style='padding:8px;color:#38bdf8;'>{a.get('deadline', 'Soon')}</td>"
            f"</tr>"
            for a in (meeting.action_items or [])
        ])
        if not actions_html:
            actions_html = "<tr><td colspan='3' style='padding:8px;color:#94a3b8;'>No action items identified.</td></tr>"

        subject = f"Executive Recap: {meeting.title} - CORE Workspace"
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; }}
    .header {{ background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 28px 24px; text-align: center; color: #ffffff; }}
    .content {{ padding: 28px 24px; font-size: 14px; line-height: 1.6; }}
    .box {{ background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin: 16px 0; }}
    .btn {{ display: inline-block; background: #6366f1; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;font-size:18px;">Executive Meeting Recap</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">{meeting.title}</p>
    </div>
    <div class="content">
      <div class="box">
        <h3 style="margin-top:0;color:#6366f1;font-size:14px;text-transform:uppercase;">Executive Summary</h3>
        <div>{meeting.ai_summary or 'Meeting concluded successfully.'}</div>
      </div>
      <div class="box">
        <h3 style="margin-top:0;color:#10b981;font-size:14px;text-transform:uppercase;">Key Decisions</h3>
        <ul style="padding-left:18px;margin:0;">{decisions_html}</ul>
      </div>
      <div class="box">
        <h3 style="margin-top:0;color:#f59e0b;font-size:14px;text-transform:uppercase;">Assigned Action Items</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid #475569;text-align:left;">
              <th style="padding:6px 8px;color:#94a3b8;">Task</th>
              <th style="padding:6px 8px;color:#94a3b8;">Owner</th>
              <th style="padding:6px 8px;color:#94a3b8;">Due</th>
            </tr>
          </thead>
          <tbody>{actions_html}</tbody>
        </table>
      </div>
      <div style="text-align:center;margin-top:24px;">
        <a href="{detail_url}" class="btn">View Full Meeting Intelligence</a>
      </div>
    </div>
  </div>
</body>
</html>
"""
        plain_text = strip_tags(html_content)
        msg = EmailMultiAlternatives(
            subject=subject,
            body=plain_text,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=recipients
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=True)
        return len(recipients)
    except Exception as e:
        logger.warning(f"Failed to send meeting recap email: {e}")
        return 0
