import logging
from django.conf import settings
from django.utils import timezone
from core.models import Notification
from core.email_dispatcher import send_robust_email

logger = logging.getLogger(__name__)


def send_notification(
    recipient,
    org,
    title,
    message,
    type='SYSTEM',
    actor=None,
    target_url='',
    data=None,
    send_email=False,
    email_subject=None,
    email_cta_text='Open Workspace'
):
    """
    Central dispatcher to create in-app notifications and optionally dispatch
    branded transactional email alerts via Brevo.
    """
    try:
        from accounts.models import User
        from tenants.models import Organization

        # Resolve recipient
        if not isinstance(recipient, User):
            recipient = User.objects.filter(id=recipient).first()
            if not recipient:
                logger.warning(f"Notification aborted: recipient {recipient} not found.")
                return None

        # Resolve org
        if not isinstance(org, Organization):
            org = Organization.objects.filter(id=org).first()
            if not org and recipient.org:
                org = recipient.org

        if not org:
            logger.warning(f"Notification aborted: org not found for user {recipient.id}.")
            return None

        # Resolve actor if provided
        if actor and not isinstance(actor, User):
            actor = User.objects.filter(id=actor).first()

        # Create in-app notification row
        notification = Notification.objects.create(
            org=org,
            recipient=recipient,
            actor=actor,
            type=type,
            title=title,
            message=message,
            target_url=target_url or '',
            data=data or {},
            is_read=False
        )

        # Dispatch transactional email alert if requested
        if send_email and recipient.email:
            _dispatch_notification_email(
                recipient=recipient,
                org=org,
                title=title,
                message=message,
                type=type,
                actor=actor,
                target_url=target_url,
                email_subject=email_subject,
                email_cta_text=email_cta_text
            )

        return notification

    except Exception as e:
        logger.exception(f"Failed to dispatch notification: {e}")
        return None


def _dispatch_notification_email(
    recipient,
    org,
    title,
    message,
    type,
    actor,
    target_url,
    email_subject,
    email_cta_text
):
    try:
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
        full_target_url = f"{frontend_url}{target_url}" if target_url.startswith('/') else (target_url or frontend_url)

        actor_name = f"{actor.first_name} {actor.last_name}".strip() if actor else None
        subject = email_subject or f"[{org.name}] {title}"

        # Category theme colors / badges
        badge_colors = {
            'TASK_ASSIGNED': ('#4f46e5', '#e0e7ff', 'Task Assignment'),
            'TASK_COMPLETED': ('#059669', '#d1fae5', 'Task Completed'),
            'TASK_OVERDUE': ('#dc2626', '#fee2e2', 'Task Overdue'),
            'LEAVE_REQUESTED': ('#d97706', '#fef3c7', 'Leave Request'),
            'LEAVE_APPROVED': ('#059669', '#d1fae5', 'Leave Approved'),
            'LEAVE_REJECTED': ('#dc2626', '#fee2e2', 'Leave Rejected'),
            'INVITATION_ACCEPTED': ('#7c3aed', '#ede9fe', 'Team Update'),
            'MENTION': ('#2563eb', '#dbeafe', 'Mention'),
            'SYSTEM': ('#475569', '#f1f5f9', 'System Alert'),
        }
        color, bg_color, badge_label = badge_colors.get(type, ('#4f46e5', '#e0e7ff', 'Notification'))

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
    .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
    .header {{ background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; color: #ffffff; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }}
    .header p {{ margin: 4px 0 0; font-size: 13px; color: #e0e7ff; }}
    .content {{ padding: 28px 24px; }}
    .badge {{ display: inline-block; background: {bg_color}; color: {color}; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; margin-bottom: 12px; }}
    .title {{ font-size: 17px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px; }}
    .message-box {{ background: #f8fafc; border-left: 4px solid {color}; border-radius: 6px; padding: 14px 16px; margin: 16px 0 24px 0; color: #334155; font-size: 14px; line-height: 1.6; }}
    .btn-container {{ text-align: center; margin: 24px 0 16px 0; }}
    .btn {{ display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25); }}
    .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center; font-size: 11px; color: #94a3b8; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CORE Workspace</h1>
      <p>{org.name}</p>
    </div>
    <div class="content">
      <span class="badge">{badge_label}</span>
      <h2 class="title">{title}</h2>
      <p style="font-size: 14px; color: #475569; margin: 0 0 12px 0;">
        Hello <strong>{recipient.first_name or recipient.email}</strong>,
      </p>
      <div class="message-box">
        {message}
      </div>
      <div class="btn-container">
        <a href="{full_target_url}" class="btn">{email_cta_text} &rarr;</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; 2026 CORE Workspace &bull; {org.name}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
"""
        text_content = f"""
[{org.name}] {title}

Hello {recipient.first_name or recipient.email},

{message}

View details in your workspace:
{full_target_url}

--
CORE Workspace - {org.name}
""".strip()

        send_robust_email(
            to_email=recipient.email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )
    except Exception as e:
        logger.warning(f"Failed to dispatch notification email to {recipient.email}: {e}")
