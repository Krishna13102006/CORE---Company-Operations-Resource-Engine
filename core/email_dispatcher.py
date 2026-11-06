import os
import json
import base64
import logging
import urllib.request
import urllib.error
from typing import Tuple, List, Union, Optional
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection

logger = logging.getLogger(__name__)

DEFAULT_BREVO_KEY = os.getenv('BREVO_API_KEY', '')
DEFAULT_RESEND_KEY = os.getenv('RESEND_API_KEY', '')

def send_robust_email(
    to_email: Union[str, List[str]],
    subject: str,
    html_content: str,
    text_content: str = "",
    from_email: str = None,
    reply_to: Optional[str] = None,
    attachments: Optional[List[dict]] = None
) -> Tuple[bool, str]:
    """
    Universal multi-strategy cloud email dispatcher for CORE Workspace.
    
    Strategies:
    1. Brevo HTTPS REST API (Port 443) - primary cloud delivery engine (delivers to all domains).
    2. Resend HTTPS REST API (Port 443) - secondary cloud fallback.
    3. SMTPS on Port 465 (Direct SSL).
    4. SMTP on Port 587 (STARTTLS).
    
    attachments format: [{'filename': 'invite.ics', 'content': b'...', 'content_type': 'text/calendar'}]
    """
    recipients = [to_email] if isinstance(to_email, str) else list(to_email)
    recipients = [r.strip() for r in recipients if r and r.strip()]
    if not recipients:
        return False, "No recipient email addresses provided."

    if not text_content and html_content:
        from django.utils.html import strip_tags
        text_content = strip_tags(html_content).strip()

    # Determine sender details
    host_user = getattr(settings, 'EMAIL_HOST_USER', '') or os.getenv('EMAIL_HOST_USER', '')
    brevo_sender_email = getattr(settings, 'BREVO_SENDER_EMAIL', '') or os.getenv('BREVO_SENDER_EMAIL', host_user or 'noreply@example.com')
    brevo_sender_name = getattr(settings, 'BREVO_SENDER_NAME', '') or os.getenv('BREVO_SENDER_NAME', 'CORE Workspace')
    
    resend_from = getattr(settings, 'RESEND_FROM_EMAIL', '') or os.getenv('RESEND_FROM_EMAIL', 'CORE Workspace <onboarding@resend.dev>')
    host_pass = getattr(settings, 'EMAIL_HOST_PASSWORD', '') or os.getenv('EMAIL_HOST_PASSWORD', '')
    sender = from_email or getattr(settings, 'DEFAULT_FROM_EMAIL', '') or os.getenv('DEFAULT_FROM_EMAIL', f'{brevo_sender_name} <{host_user}>' if host_user else f'{brevo_sender_name} <noreply@example.com>')
    smtp_host = getattr(settings, 'EMAIL_HOST', '') or os.getenv('EMAIL_HOST', 'smtp.gmail.com')

    errors = []

    # --- Strategy 1: Brevo Cloud HTTPS REST API (Port 443 - Cloud Native) ---
    brevo_api_key = (
        getattr(settings, 'BREVO_API_KEY', '') or
        os.getenv('BREVO_API_KEY', '') or
        DEFAULT_BREVO_KEY
    ).strip()

    if brevo_api_key:
        try:
            brevo_payload = {
                'sender': {
                    'name': brevo_sender_name,
                    'email': brevo_sender_email
                },
                'to': [{'email': r} for r in recipients],
                'subject': subject,
                'htmlContent': html_content,
                'textContent': text_content,
            }
            if reply_to:
                brevo_payload['replyTo'] = {'email': reply_to}

            # Format attachments for Brevo API if present
            if attachments:
                brevo_att_list = []
                for att in attachments:
                    fname = att.get('filename', 'attachment')
                    raw_content = att.get('content', b'')
                    if isinstance(raw_content, str):
                        raw_content = raw_content.encode('utf-8')
                    b64_content = base64.b64encode(raw_content).decode('ascii')
                    brevo_att_list.append({
                        'name': fname,
                        'content': b64_content,
                    })
                if brevo_att_list:
                    brevo_payload['attachment'] = brevo_att_list

            req = urllib.request.Request(
                'https://api.brevo.com/v3/smtp/email',
                data=json.dumps(brevo_payload).encode('utf-8'),
                headers={
                    'api-key': brevo_api_key,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'CORE-Workspace/1.0',
                },
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status in (200, 201):
                    logger.info(f"[EmailDispatcher] Successfully sent email to {recipients} via Brevo HTTPS API")
                    print(f"[EmailDispatcher] Successfully sent email to {recipients} via Brevo HTTPS API", flush=True)
                    return True, "Email dispatched successfully via Brevo HTTPS API."
        except urllib.error.HTTPError as h_err:
            err_body = h_err.read().decode('utf-8', errors='replace')
            errors.append(f"Brevo HTTP {h_err.code}: {err_body}")
            logger.warning(f"[EmailDispatcher] Brevo HTTP Error {h_err.code}: {err_body}")
            print(f"[EmailDispatcher] Brevo HTTP Error {h_err.code}: {err_body}", flush=True)
        except Exception as brevo_err:
            errors.append(f"Brevo error: {brevo_err}")
            logger.warning(f"[EmailDispatcher] Brevo API failed: {brevo_err}")
            print(f"[EmailDispatcher] Brevo API failed: {brevo_err}", flush=True)
    else:
        errors.append("Brevo API key not configured")

    # --- Strategy 2: Resend HTTPS REST API (Port 443 Fallback) ---
    resend_api_key = (
        getattr(settings, 'RESEND_API_KEY', '') or
        os.getenv('RESEND_API_KEY', '') or
        DEFAULT_RESEND_KEY
    ).strip()

    if resend_api_key:
        try:
            payload = {
                'from': resend_from,
                'to': recipients,
                'subject': subject,
                'html': html_content,
                'text': text_content,
            }
            if reply_to:
                payload['reply_to'] = reply_to

            # Format attachments for Resend API if present
            if attachments:
                resend_att_list = []
                for att in attachments:
                    fname = att.get('filename', 'attachment')
                    raw_content = att.get('content', b'')
                    if isinstance(raw_content, str):
                        raw_content = raw_content.encode('utf-8')
                    b64_content = base64.b64encode(raw_content).decode('ascii')
                    resend_att_list.append({
                        'filename': fname,
                        'content': b64_content,
                    })
                if resend_att_list:
                    payload['attachments'] = resend_att_list

            req = urllib.request.Request(
                'https://api.resend.com/emails',
                data=json.dumps(payload).encode('utf-8'),
                headers={
                    'Authorization': f'Bearer {resend_api_key}',
                    'Content-Type': 'application/json',
                    'User-Agent': 'CORE-Workspace/1.0',
                },
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status in (200, 201):
                    logger.info(f"[EmailDispatcher] Successfully sent email to {recipients} via Resend HTTPS API")
                    print(f"[EmailDispatcher] Successfully sent email to {recipients} via Resend HTTPS API", flush=True)
                    return True, "Email dispatched successfully via Resend HTTPS API."
        except urllib.error.HTTPError as h_err:
            err_body = h_err.read().decode('utf-8', errors='replace')
            errors.append(f"Resend HTTP {h_err.code}: {err_body}")
            logger.warning(f"[EmailDispatcher] Resend HTTP Error {h_err.code}: {err_body}")
            print(f"[EmailDispatcher] Resend HTTP Error {h_err.code}: {err_body}", flush=True)
        except Exception as resend_err:
            errors.append(f"Resend error: {resend_err}")
            logger.warning(f"[EmailDispatcher] Resend API failed: {resend_err}")
            print(f"[EmailDispatcher] Resend API failed: {resend_err}", flush=True)
    else:
        errors.append("Resend API key not configured")

    # --- Strategy 3: SMTPS on Port 465 (Direct SSL) ---
    if host_user and host_pass:
        try:
            connection_ssl = get_connection(
                backend='django.core.mail.backends.smtp.EmailBackend',
                host=smtp_host,
                port=465,
                username=host_user,
                password=host_pass,
                use_ssl=True,
                use_tls=False,
                timeout=8
            )
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=sender,
                to=recipients,
                reply_to=[reply_to] if reply_to else None,
                connection=connection_ssl
            )
            msg.attach_alternative(html_content, "text/html")
            if attachments:
                for att in attachments:
                    fname = att.get('filename', 'attachment')
                    content = att.get('content', b'')
                    mimetype = att.get('content_type', 'application/octet-stream')
                    msg.attach(fname, content, mimetype)

            sent = msg.send(fail_silently=False)
            if sent:
                logger.info(f"[EmailDispatcher] Successfully sent email to {recipients} via Port 465 (SSL)")
                print(f"[EmailDispatcher] Successfully sent email to {recipients} via Port 465 (SSL)", flush=True)
                return True, "Email dispatched successfully via Port 465 SSL."
        except Exception as ssl_err:
            errors.append(f"Port 465 SSL: {ssl_err}")
            logger.warning(f"[EmailDispatcher] Port 465 SSL failed: {ssl_err}")

        # --- Strategy 4: SMTP on Port 587 (STARTTLS fallback) ---
        try:
            connection_tls = get_connection(
                backend='django.core.mail.backends.smtp.EmailBackend',
                host=smtp_host,
                port=587,
                username=host_user,
                password=host_pass,
                use_ssl=False,
                use_tls=True,
                timeout=8
            )
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=sender,
                to=recipients,
                reply_to=[reply_to] if reply_to else None,
                connection=connection_tls
            )
            msg.attach_alternative(html_content, "text/html")
            if attachments:
                for att in attachments:
                    fname = att.get('filename', 'attachment')
                    content = att.get('content', b'')
                    mimetype = att.get('content_type', 'application/octet-stream')
                    msg.attach(fname, content, mimetype)

            sent = msg.send(fail_silently=False)
            if sent:
                logger.info(f"[EmailDispatcher] Successfully sent email to {recipients} via Port 587 (TLS)")
                print(f"[EmailDispatcher] Successfully sent email to {recipients} via Port 587 (TLS)", flush=True)
                return True, "Email dispatched successfully via Port 587 TLS."
        except Exception as tls_err:
            errors.append(f"Port 587 TLS: {tls_err}")
            logger.error(f"[EmailDispatcher] Port 587 TLS failed: {tls_err}")
    else:
        errors.append("SMTP credentials not configured (EMAIL_HOST_USER and EMAIL_HOST_PASSWORD required)")

    err_summary = " | ".join(errors)
    return False, f"All email dispatch methods failed ({err_summary})"
