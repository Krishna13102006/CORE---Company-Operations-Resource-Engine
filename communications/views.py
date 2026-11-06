import os
import logging
import threading
import mimetypes
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.conf import settings
from django.utils import timezone
from django.utils.html import strip_tags
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import FileResponse, Http404
from dotenv import load_dotenv

from core.permissions import IsEmployee
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from tenants.models import Organization
from teams.models import Department, Employee
from projects.models import Project
from .models import MailMessage, MailRecipientStatus, MailAttachment, UserMailPreference, EmailTemplate
from .serializers import (
    MailMessageListSerializer,
    MailMessageDetailSerializer,
    MailComposeSerializer
)
from .services import communication_service

logger = logging.getLogger(__name__)
User = get_user_model()


def get_request_org_id(request):
    org_id = getattr(request, 'org_id', None)
    if not org_id and hasattr(request, 'user') and getattr(request.user, 'is_authenticated', False):
        org_id = getattr(request.user, 'org_id', None)
    return org_id


def _send_real_email_worker(message_id, sender_name, sender_email, recipient_emails, subject, body_html, org_name, app_url=None):
    try:
        load_dotenv(override=True)

        msg = MailMessage.objects.filter(id=message_id).first()
        if not msg:
            return

        plain_text = strip_tags(body_html).strip()
        text_content = f"From: {sender_name} <{sender_email}>\nOrganization: {org_name}\n\n{plain_text}\n\n---\nView and reply to this thread in your CORE Workspace account."

        # Compute public app url that works on phones, laptops, and external networks
        if not app_url:
            configured = getattr(settings, 'FRONTEND_URL', '') or os.getenv('FRONTEND_URL', '')
            if configured and 'localhost' not in configured and '127.0.0.1' not in configured:
                app_url = configured.rstrip('/')
            else:
                app_url = 'https://core-workspace-xi.vercel.app'
        app_url = app_url.rstrip('/')

        # Generate status badges without hijacking the header color
        badges = []
        if msg.priority == 'urgent':
            badges.append('<span style="display:inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; margin-right: 6px; margin-bottom: 12px;">⚠️ URGENT</span>')
        elif msg.priority == 'high':
            badges.append('<span style="display:inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; margin-right: 6px; margin-bottom: 12px;">⚡ HIGH PRIORITY</span>')

        if msg.requires_acknowledgment or msg.category_tag == 'compliance':
            badges.append('<span style="display:inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; margin-right: 6px; margin-bottom: 12px;">🛡️ FORMAL ACKNOWLEDGMENT</span>')
        elif msg.category_tag == 'action_required':
            badges.append('<span style="display:inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; margin-right: 6px; margin-bottom: 12px;">⚡ ACTION REQUIRED</span>')
        elif msg.category_tag == 'announcement':
            badges.append('<span style="display:inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; margin-right: 6px; margin-bottom: 12px;">📢 ANNOUNCEMENT</span>')
        badges_markup = "".join(badges)

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08); }}
    .header {{ background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%); padding: 24px 28px; color: #ffffff; }}
    .header-logo {{ font-size: 12px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #e0e7ff; margin-bottom: 4px; }}
    .header-title {{ margin: 0; font-size: 16px; font-weight: 700; color: #ffffff; }}
    .header-subtitle {{ margin: 4px 0 0; font-size: 12px; color: rgba(255, 255, 255, 0.88); }}
    .content {{ padding: 28px; }}
    .sender-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #475569; }}
    .sender-box strong {{ color: #0f172a; }}
    .subject-title {{ font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 16px; line-height: 1.4; }}
    .body-box {{ font-size: 14px; line-height: 1.65; color: #334155; margin-bottom: 28px; }}
    .body-box ul {{ padding-left: 20px; margin: 8px 0; }}
    .body-box ol {{ padding-left: 20px; margin: 8px 0; }}
    .body-box li {{ margin: 4px 0; }}
    .cta-btn {{ display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff !important; padding: 13px 30px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35); }}
    .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5; }}
    .footer a {{ color: #6366f1; text-decoration: underline; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-logo">CORE WORKSPACE</div>
      <h1 class="header-title">{org_name}</h1>
      <p class="header-subtitle">Internal Message Delivery</p>
    </div>
    <div class="content">
      <div class="sender-box">
        <div><strong>From:</strong> {sender_name} &lt;{sender_email}&gt;</div>
      </div>
      {badges_markup}
      <h2 class="subject-title">{subject}</h2>
      <div class="body-box">
        {body_html}
      </div>
      <div style="margin: 32px 0 16px 0; text-align: center;">
        <a href="{app_url}/mail" class="cta-btn" target="_blank" rel="noopener noreferrer">Open in CORE Workspace &rarr;</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;">This message was securely dispatched from your CORE Workspace account via Brevo.</p>
      <p style="margin: 0; font-size: 11px;">
        <a href="{app_url}/login">Sign In to CORE Workspace</a> &bull;
        <a href="{app_url}/mail">Direct Mailbox</a>
      </p>
    </div>
  </div>
</body>
</html>
"""
        from core.email_dispatcher import send_robust_email

        attachments_list = []
        for att in msg.attachments.all():
            try:
                if att.file and hasattr(att.file, 'path') and os.path.exists(att.file.path):
                    content_type, _ = mimetypes.guess_type(att.file_name)
                    with open(att.file.path, 'rb') as f:
                        attachments_list.append({
                            'filename': att.file_name,
                            'content': f.read(),
                            'content_type': content_type or 'application/octet-stream'
                        })
            except Exception as att_err:
                logger.warning(f"Failed to attach file {att.file_name}: {att_err}")

        success, detail = send_robust_email(
            to_email=recipient_emails,
            subject=f"[{org_name}] {subject}",
            html_content=html_content,
            text_content=text_content,
            from_email=None,
            reply_to=sender_email if sender_email else None,
            attachments=attachments_list if attachments_list else None
        )
        logger.info(f"Real email dispatched status: {success} ({detail}) to {recipient_emails}")
    except Exception as e:
        logger.error(f"Failed to dispatch real email: {e}", exc_info=True)


def send_real_email_async(message_id, sender_name, sender_email, recipient_emails, subject, body_html, org_name, app_url=None):
    t = threading.Thread(
        target=_send_real_email_worker,
        args=(message_id, sender_name, sender_email, recipient_emails, subject, body_html, org_name, app_url),
        daemon=True
    )
    t.start()


class InboxListView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        user = request.user
        org_id = request.org_id
        folder = request.query_params.get('folder', 'inbox').lower()
        search = request.query_params.get('search', '').strip()
        category = request.query_params.get('category', '').strip()
        priority = request.query_params.get('priority', '').strip()

        now = timezone.now()

        # Base user statuses (Received)
        rec_statuses = MailRecipientStatus.objects.filter(
            recipient=user,
            is_deleted=False
        ).select_related('message__sender')

        # Filter out snoozed messages unless viewed in archive/snooze or past due
        active_rec_statuses = rec_statuses.filter(
            Q(snoozed_until__isnull=True) | Q(snoozed_until__lte=now)
        )

        # Base user sent
        sent_qs = MailMessage.objects.filter(
            org_id=org_id,
            sender=user,
            is_deleted_by_sender=False,
            is_draft=False
        )

        messages = []

        if folder == 'inbox':
            statuses = active_rec_statuses.filter(is_archived=False)
            messages = [s.message for s in statuses if not s.message.is_deleted_by_sender and s.message.is_sent and not s.message.is_draft]
        elif folder == 'sent':
            messages = list(sent_qs.filter(is_archived_by_sender=False))
        elif folder == 'starred':
            starred_rec = active_rec_statuses.filter(is_starred=True, is_archived=False)
            rec_msgs = [s.message for s in starred_rec if not s.message.is_deleted_by_sender]
            sent_starred = list(sent_qs.filter(is_starred_by_sender=True, is_archived_by_sender=False))
            # Merge and deduplicate
            seen_ids = set()
            merged = []
            for m in rec_msgs + sent_starred:
                if m.id not in seen_ids:
                    seen_ids.add(m.id)
                    merged.append(m)
            messages = merged
        elif folder == 'announcements':
            # Company-wide / department announcements
            ann_statuses = active_rec_statuses.filter(
                Q(message__category_tag__in=['announcement', 'compliance']) | Q(message__broadcast_channel__gt='')
            )
            messages = [s.message for s in ann_statuses if not s.message.is_deleted_by_sender]
        elif folder == 'archived':
            arch_rec = rec_statuses.filter(is_archived=True)
            rec_msgs = [s.message for s in arch_rec if not s.message.is_deleted_by_sender]
            sent_arch = list(sent_qs.filter(is_archived_by_sender=True))
            seen_ids = set()
            merged = []
            for m in rec_msgs + sent_arch:
                if m.id not in seen_ids:
                    seen_ids.add(m.id)
                    merged.append(m)
            messages = merged
        elif folder == 'snoozed':
            snoozed_rec = rec_statuses.filter(snoozed_until__gt=now, is_archived=False)
            messages = [s.message for s in snoozed_rec if not s.message.is_deleted_by_sender]
        elif folder == 'drafts':
            messages = list(MailMessage.objects.filter(
                org_id=org_id,
                sender=user,
                is_draft=True,
                is_deleted_by_sender=False
            ))

        # Search filtering
        if search:
            q = search.lower()
            messages = [
                m for m in messages 
                if q in m.subject.lower() or q in m.body.lower() or q in (m.sender.email or '').lower() or q in f"{m.sender.first_name} {m.sender.last_name}".lower()
            ]

        # Category and priority filters
        if category and category != 'all':
            messages = [m for m in messages if m.category_tag == category]
        if priority and priority != 'all':
            messages = [m for m in messages if m.priority == priority]

        messages.sort(key=lambda x: x.created_at, reverse=True)

        # Folder counters for badges
        unread_inbox = active_rec_statuses.filter(is_read=False, is_archived=False).count()
        starred_count = active_rec_statuses.filter(is_starred=True, is_archived=False).count() + sent_qs.filter(is_starred_by_sender=True, is_archived_by_sender=False).count()
        snoozed_count = rec_statuses.filter(snoozed_until__gt=now, is_archived=False).count()
        announcements_count = active_rec_statuses.filter(
            Q(message__category_tag__in=['announcement', 'compliance']) | Q(message__broadcast_channel__gt=''),
            is_read=False
        ).count()
        drafts_count = MailMessage.objects.filter(org_id=org_id, sender=user, is_draft=True, is_deleted_by_sender=False).count()

        serializer = MailMessageListSerializer(messages, many=True, context={'request': request})
        return Response({
            'messages': serializer.data,
            'counts': {
                'inbox_unread': unread_inbox,
                'starred': starred_count,
                'snoozed': snoozed_count,
                'announcements_unread': announcements_count,
                'drafts': drafts_count,
            }
        })


class SentListView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        messages = MailMessage.objects.filter(
            sender=request.user,
            is_deleted_by_sender=False,
            is_draft=False
        ).order_by('-created_at')

        serializer = MailMessageListSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)


class MailComposeView(APIView):
    permission_classes = [IsEmployee]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = MailComposeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        org_id = getattr(request, 'org_id', None) or (getattr(request.user, 'org_id', None) if request.user else None)
        is_draft = d.get('is_draft', False)

        # Resolve recipients based on target_mode (all, department, role, project, individual)
        recipients = []
        broadcast_channel_name = ''

        target_mode = d.get('target_mode', 'individual')
        if d.get('send_to_all') or request.data.get('send_to_all'):
            target_mode = 'all'
        if target_mode == 'all':
            broadcast_channel_name = 'All Organization'
            recipients = communication_service.resolve_recipients(org_id, request.user, 'all')
        elif target_mode == 'department':
            dept_id = d.get('department_id')
            dept = Department.objects.filter(id=dept_id, org_id=org_id).first()
            broadcast_channel_name = f"Department: {dept.name}" if dept else "Department"
            recipients = communication_service.resolve_recipients(org_id, request.user, 'department', department_id=dept_id)
        elif target_mode == 'role':
            target_role = d.get('target_role')
            role_label = target_role.replace('_', ' ').title()
            broadcast_channel_name = f"Role: {role_label}"
            recipients = communication_service.resolve_recipients(org_id, request.user, 'role', target_role=target_role)
        elif target_mode == 'project':
            proj_id = d.get('project_id')
            proj = Project.objects.filter(id=proj_id, org_id=org_id).first()
            broadcast_channel_name = f"Project Team: {proj.name}" if proj else "Project Team"
            recipients = communication_service.resolve_recipients(org_id, request.user, 'project', project_id=proj_id)
        else:
            recipients = communication_service.resolve_recipients(
                org_id, request.user, 'individual', recipient_ids_list=d.get('recipient_ids_list', [])
            )

        raw_recipient_list = d.get('recipient_ids_list', [])
        external_emails = [
            str(x).strip() for x in raw_recipient_list
            if '@' in str(x) and not any(r.email.lower() == str(x).strip().lower() for r in recipients)
        ]

        if not is_draft and not recipients and not external_emails:
            return Response(
                {'error': 'No active recipients found for the selected broadcast channel or individuals.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from core.sanitizers import sanitize_html, sanitize_plain_text
        from core.validators import validate_uploaded_file

        clean_subject = sanitize_plain_text(d['subject'])
        clean_body = sanitize_html(d['body'])
        draft_id = d.get('draft_id')

        with transaction.atomic():
            message = None
            if draft_id:
                message = MailMessage.objects.filter(id=draft_id, org_id=org_id, sender=request.user).first()

            parent_msg = None
            parent_id = d.get('parent_message_id')
            if parent_id:
                parent_msg = MailMessage.objects.filter(id=parent_id, org_id=org_id).first()

            if message:
                message.subject = clean_subject
                message.body = clean_body
                message.parent_message = parent_msg
                message.priority = d.get('priority', 'normal')
                message.category_tag = d.get('category_tag', 'general')
                message.requires_acknowledgment = d.get('requires_acknowledgment', False)
                message.broadcast_channel = broadcast_channel_name
                message.linked_entity_type = d.get('linked_entity_type', '')
                message.linked_entity_id = d.get('linked_entity_id', '')
                message.linked_entity_title = d.get('linked_entity_title', '')
                message.is_draft = is_draft
                message.scheduled_for = d.get('scheduled_for')
                message.is_sent = not is_draft
                message.save()
            else:
                message = MailMessage.objects.create(
                    org_id=org_id,
                    sender=request.user,
                    subject=clean_subject,
                    body=clean_body,
                    parent_message=parent_msg,
                    priority=d.get('priority', 'normal'),
                    category_tag=d.get('category_tag', 'general'),
                    requires_acknowledgment=d.get('requires_acknowledgment', False),
                    broadcast_channel=broadcast_channel_name,
                    linked_entity_type=d.get('linked_entity_type', ''),
                    linked_entity_id=d.get('linked_entity_id', ''),
                    linked_entity_title=d.get('linked_entity_title', ''),
                    is_draft=is_draft,
                    scheduled_for=d.get('scheduled_for'),
                    is_sent=not is_draft
                )

            # Process file attachments
            uploaded_files = request.FILES.getlist('attachments')
            for f in uploaded_files:
                safe_name = validate_uploaded_file(
                    f,
                    allowed_types=('pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg', 'webp', 'xlsx', 'csv'),
                    max_size_mb=25
                )
                f.name = safe_name
                MailAttachment.objects.create(
                    message=message,
                    file=f,
                    file_name=safe_name,
                    file_size=f.size
                )

            # Create recipient status records if not a draft
            recipient_emails = []
            if not is_draft:
                if recipients:
                    status_objects = []
                    for r in recipients:
                        status_objects.append(
                            MailRecipientStatus(message=message, recipient=r)
                        )
                        if r.email:
                            recipient_emails.append(r.email)
                    MailRecipientStatus.objects.bulk_create(status_objects)

                for ext in external_emails:
                    if ext not in recipient_emails:
                        recipient_emails.append(ext)

        # Dispatch real email asynchronously
        if not is_draft and recipient_emails:
            sender_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.email
            org_obj = Organization.objects.filter(id=org_id).first()
            org_name = org_obj.name if org_obj else "Core Organization"

            # Resolve real frontend application URL for external email CTA links
            frontend_url = None
            origin = request.META.get('HTTP_ORIGIN') or request.headers.get('Origin')
            if not origin and request.headers.get('Referer'):
                from urllib.parse import urlparse
                parsed = urlparse(request.headers.get('Referer'))
                if parsed.scheme and parsed.netloc:
                    origin = f"{parsed.scheme}://{parsed.netloc}"

            if origin and 'localhost' not in origin and '127.0.0.1' not in origin:
                frontend_url = origin.rstrip('/')
            else:
                configured_url = getattr(settings, 'FRONTEND_URL', '').rstrip('/')
                if configured_url and 'localhost' not in configured_url and '127.0.0.1' not in configured_url:
                    frontend_url = configured_url
                else:
                    frontend_url = 'https://core-workspace-xi.vercel.app'

            send_real_email_async(
                message_id=message.id,
                sender_name=sender_name,
                sender_email=request.user.email,
                recipient_emails=recipient_emails,
                subject=d['subject'],
                body_html=d['body'],
                org_name=org_name,
                app_url=frontend_url
            )

        return Response(
            MailMessageDetailSerializer(message, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )


class MailActionView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, pk):
        org_id = get_request_org_id(request)
        message = MailMessage.objects.filter(org_id=org_id, id=pk).first()
        if not message:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        root = message
        while root.parent_message is not None:
            root = root.parent_message

        thread_messages = MailMessage.objects.filter(
            Q(id=root.id) | Q(parent_message=root)
        )

        has_access = False
        if getattr(request.user, 'role', '') in ['admin', 'hr']:
            has_access = True
        elif message.sender_id == request.user.id or message.recipient_statuses.filter(recipient_id=request.user.id).exists():
            has_access = True
        elif root.sender_id == request.user.id or root.recipient_statuses.filter(recipient_id=request.user.id).exists():
            has_access = True
        else:
            for m in thread_messages:
                if m.sender_id == request.user.id or m.recipient_statuses.filter(recipient_id=request.user.id).exists():
                    has_access = True
                    break

        if not has_access:
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        # Mark unread messages in thread as read
        unread_statuses = MailRecipientStatus.objects.filter(
            message__in=thread_messages,
            recipient=request.user,
            is_read=False
        )
        if unread_statuses.exists():
            unread_statuses.update(is_read=True, read_at=timezone.now())

        return Response(MailMessageDetailSerializer(root, context={'request': request}).data)

    def delete(self, request, pk):
        org_id = get_request_org_id(request)
        message = MailMessage.objects.filter(org_id=org_id, id=pk).first()
        if not message:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        is_sender = (message.sender == request.user)
        recipient_status = message.recipient_statuses.filter(recipient=request.user).first()

        if not is_sender and not recipient_status:
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            if is_sender:
                message.is_deleted_by_sender = True
                message.save()
            if recipient_status:
                recipient_status.is_deleted = True
                recipient_status.save()

            active_recipients = message.recipient_statuses.filter(is_deleted=False).count()
            if message.is_deleted_by_sender and active_recipients == 0:
                message.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class MailAcknowledgeView(APIView):
    """Recipients acknowledge compliance and policy memos."""
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        org_id = get_request_org_id(request)
        message = MailMessage.objects.filter(org_id=org_id, id=pk).first()
        if not message:
            return Response({'error': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)

        status_obj = MailRecipientStatus.objects.filter(
            message=message,
            recipient=request.user
        ).first()

        if not status_obj:
            return Response({'error': 'You are not a recipient of this message.'}, status=status.HTTP_403_FORBIDDEN)

        status_obj.is_acknowledged = True
        status_obj.acknowledged_at = timezone.now()
        status_obj.is_read = True
        if not status_obj.read_at:
            status_obj.read_at = timezone.now()
        status_obj.save()

        return Response({
            'success': True,
            'message': 'Acknowledged successfully.',
            'acknowledged_at': status_obj.acknowledged_at.strftime('%Y-%m-%d %H:%M')
        })


class MailStarToggleView(APIView):
    """Toggle star on a message for the user."""
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        org_id = get_request_org_id(request)
        message = MailMessage.objects.filter(org_id=org_id, id=pk).first()
        if not message:
            return Response({'error': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)

        is_sender = (message.sender == request.user)
        rec_status = message.recipient_statuses.filter(recipient=request.user).first()

        is_starred = False
        if is_sender:
            message.is_starred_by_sender = not message.is_starred_by_sender
            message.save()
            is_starred = message.is_starred_by_sender
        elif rec_status:
            rec_status.is_starred = not rec_status.is_starred
            rec_status.save()
            is_starred = rec_status.is_starred

        return Response({'success': True, 'is_starred': is_starred})


class MailArchiveToggleView(APIView):
    """Toggle archive state for the user."""
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        org_id = get_request_org_id(request)
        message = MailMessage.objects.filter(org_id=org_id, id=pk).first()
        if not message:
            return Response({'error': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)

        is_sender = (message.sender == request.user)
        rec_status = message.recipient_statuses.filter(recipient=request.user).first()

        is_archived = False
        if is_sender:
            message.is_archived_by_sender = not message.is_archived_by_sender
            message.save()
            is_archived = message.is_archived_by_sender
        elif rec_status:
            rec_status.is_archived = not rec_status.is_archived
            rec_status.save()
            is_archived = rec_status.is_archived

        return Response({'success': True, 'is_archived': is_archived})


class MailSnoozeView(APIView):
    """Snooze a message thread until a specific datetime or duration preset."""
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        org_id = get_request_org_id(request)
        message = MailMessage.objects.filter(org_id=org_id, id=pk).first()
        if not message:
            return Response({'error': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)

        rec_status = message.recipient_statuses.filter(recipient=request.user).first()
        if not rec_status:
            return Response({'error': 'You can only snooze messages you received.'}, status=status.HTTP_400_BAD_REQUEST)

        snooze_until_str = request.data.get('snooze_until')
        preset = request.data.get('preset')  # 'tomorrow_9am', 'this_weekend', 'next_monday', 'custom', 'clear'

        now = timezone.now()
        snooze_time = None

        if preset == 'clear':
            rec_status.snoozed_until = None
            rec_status.save()
            return Response({'success': True, 'snoozed_until': None, 'message': 'Snooze cleared.'})

        if preset == 'tomorrow_9am':
            tomorrow = now + timezone.timedelta(days=1)
            snooze_time = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
        elif preset == 'this_weekend':
            days_ahead = 5 - now.weekday()  # Saturday
            if days_ahead <= 0:
                days_ahead += 7
            sat = now + timezone.timedelta(days=days_ahead)
            snooze_time = sat.replace(hour=10, minute=0, second=0, microsecond=0)
        elif preset == 'next_monday':
            days_ahead = 7 - now.weekday()  # Next Monday
            if days_ahead <= 0:
                days_ahead += 7
            mon = now + timezone.timedelta(days=days_ahead)
            snooze_time = mon.replace(hour=9, minute=0, second=0, microsecond=0)
        elif snooze_until_str:
            from django.utils.dateparse import parse_datetime
            parsed = parse_datetime(snooze_until_str)
            if parsed:
                snooze_time = parsed if timezone.is_aware(parsed) else timezone.make_aware(parsed)

        if not snooze_time:
            return Response({'error': 'Valid snooze preset or timestamp required.'}, status=status.HTTP_400_BAD_REQUEST)

        rec_status.snoozed_until = snooze_time
        rec_status.save()

        return Response({
            'success': True,
            'snoozed_until': snooze_time.isoformat(),
            'message': f"Snoozed until {snooze_time.strftime('%b %d, %Y at %I:%M %p')}"
        })


class MailPreferencesView(APIView):
    """Get and update user's signature and Out of Office (OOO) configuration."""
    permission_classes = [IsEmployee]

    def get(self, request):
        org_id = get_request_org_id(request)
        pref, _ = UserMailPreference.objects.get_or_create(
            user=request.user,
            defaults={'org_id': org_id}
        )
        return Response({
            'signature_html': pref.signature_html,
            'include_signature_by_default': pref.include_signature_by_default,
            'is_ooo_enabled': pref.is_ooo_enabled,
            'ooo_start_date': pref.ooo_start_date.isoformat() if pref.ooo_start_date else None,
            'ooo_end_date': pref.ooo_end_date.isoformat() if pref.ooo_end_date else None,
            'ooo_message': pref.ooo_message,
        })

    def post(self, request):
        org_id = get_request_org_id(request)
        pref, _ = UserMailPreference.objects.get_or_create(
            user=request.user,
            defaults={'org_id': org_id}
        )
        d = request.data

        if 'signature_html' in d:
            pref.signature_html = d['signature_html']
        if 'include_signature_by_default' in d:
            pref.include_signature_by_default = bool(d['include_signature_by_default'])
        if 'is_ooo_enabled' in d:
            pref.is_ooo_enabled = bool(d['is_ooo_enabled'])
        if 'ooo_start_date' in d:
            pref.ooo_start_date = d['ooo_start_date'] or None
        if 'ooo_end_date' in d:
            pref.ooo_end_date = d['ooo_end_date'] or None
        if 'ooo_message' in d:
            pref.ooo_message = d['ooo_message']

        pref.save()

        return Response({
            'success': True,
            'signature_html': pref.signature_html,
            'include_signature_by_default': pref.include_signature_by_default,
            'is_ooo_enabled': pref.is_ooo_enabled,
            'ooo_start_date': pref.ooo_start_date.isoformat() if pref.ooo_start_date else None,
            'ooo_end_date': pref.ooo_end_date.isoformat() if pref.ooo_end_date else None,
            'ooo_message': pref.ooo_message,
        })


class EmailTemplatesView(APIView):
    """Corporate canned email templates library."""
    permission_classes = [IsEmployee]

    def get(self, request):
        org_id = get_request_org_id(request)
        templates = EmailTemplate.objects.filter(
            Q(org_id=org_id) & (Q(is_shared=True) | Q(created_by=request.user))
        ).order_by('category', 'title')

        # If empty for org, seed high-utility standard corporate templates
        if not templates.exists():
            default_templates = [
                {
                    'title': 'Weekly Sprint Status Update',
                    'category': 'Engineering & Product',
                    'subject': 'Weekly Status Update: [Project/Sprint Name] - [Date]',
                    'body_html': '<p>Hi Team,</p><p>Here is the status summary for this week\'s sprint:</p><ul><li><strong>Key Deliverables Completed:</strong> Feature A merged, PR #124 deployed.</li><li><strong>Work in Progress:</strong> Database optimization, API integration tests.</li><li><strong>Blockers / Risks:</strong> Waiting on third-party API webhook verification.</li><li><strong>Next Week Priorities:</strong> Staging load tests and documentation review.</li></ul><p>Please let me know if you have any questions or feedback.</p>',
                    'is_shared': True
                },
                {
                    'title': 'Candidate Interview Invitation',
                    'category': 'HR & Recruiting',
                    'subject': 'Interview Invitation: [Job Role] at Core Workspace',
                    'body_html': '<p>Hi [Candidate Name],</p><p>Thank you for your application for the <strong>[Job Role]</strong> position. We were impressed with your background and would like to invite you for a virtual interview.</p><p><strong>Format:</strong> 45-minute technical discussion & problem solving<br><strong>Location:</strong> Core Video Interview Room (direct link attached)</p><p>Please let us know your availability over the next few business days.</p><p>Best regards,<br>Hiring Team</p>',
                    'is_shared': True
                },
                {
                    'title': 'Meeting Follow-up & Action Items',
                    'category': 'General Management',
                    'subject': 'Recap & Action Items: [Meeting Title] - [Date]',
                    'body_html': '<p>Hi Everyone,</p><p>Thank you for attending today\'s sync. Below is a quick recap of what was agreed upon and the assigned action items:</p><h4>Decisions Finalized:</h4><ul><li>Approved architectural approach for Q4 milestone.</li></ul><h4>Action Items:</h4><ul><li><strong>@Member:</strong> Draft specification document by Friday.</li><li><strong>@Member:</strong> Follow up with security compliance team.</li></ul><p>Best regards,</p>',
                    'is_shared': True
                },
                {
                    'title': 'Formal Budget / Expense Approval Request',
                    'category': 'Finance & Operations',
                    'subject': 'Approval Request: [Expense Item / Equipment / Software License]',
                    'body_html': '<p>Hi [Manager Name],</p><p>I would like to request formal approval for the following business expenditure:</p><ul><li><strong>Item / Service:</strong> [Item Name]</li><li><strong>Estimated Cost:</strong> [$ Amount]</li><li><strong>Business Justification:</strong> [Why this is needed for the team/project]</li><li><strong>Timeline:</strong> Needed by [Date]</li></ul><p>Please review and let me know if approved to proceed.</p><p>Thanks,</p>',
                    'is_shared': True
                }
            ]
            created_objs = []
            for dt in default_templates:
                created_objs.append(EmailTemplate(
                    org_id=org_id,
                    created_by=request.user,
                    title=dt['title'],
                    category=dt['category'],
                    subject=dt['subject'],
                    body_html=dt['body_html'],
                    is_shared=dt['is_shared']
                ))
            EmailTemplate.objects.bulk_create(created_objs)
            templates = EmailTemplate.objects.filter(org_id=org_id).order_by('category', 'title')

        data = [{
            'id': str(t.id),
            'title': t.title,
            'category': t.category,
            'subject': t.subject,
            'body_html': t.body_html,
            'is_shared': t.is_shared,
            'is_owner': t.created_by_id == request.user.id
        } for t in templates]
        return Response(data)

    def post(self, request):
        title = request.data.get('title', '').strip()
        subject = request.data.get('subject', '').strip()
        body_html = request.data.get('body_html', '').strip()
        category = request.data.get('category', 'General').strip()
        is_shared = bool(request.data.get('is_shared', True))

        if not title or not subject:
            return Response({'error': 'Title and subject are required.'}, status=status.HTTP_400_BAD_REQUEST)

        org_id = get_request_org_id(request)
        template = EmailTemplate.objects.create(
            org_id=org_id,
            created_by=request.user,
            title=title,
            category=category,
            subject=subject,
            body_html=body_html,
            is_shared=is_shared
        )

        return Response({
            'id': str(template.id),
            'title': template.title,
            'category': template.category,
            'subject': template.subject,
            'body_html': template.body_html,
            'is_shared': template.is_shared,
            'is_owner': True
        }, status=status.HTTP_201_CREATED)


class RecipientOOOCheckView(APIView):
    """Check if any of the target recipient email addresses are currently Out of Office."""
    permission_classes = [IsEmployee]

    def post(self, request):
        emails = request.data.get('emails', [])
        if not emails or not isinstance(emails, list):
            return Response({'ooo_recipients': []})

        today = timezone.localdate()
        clean_emails = [e.strip().lower() for e in emails if isinstance(e, str) and e.strip()]

        # Query active OOO preferences
        ooo_prefs = UserMailPreference.objects.filter(
            user__email__in=clean_emails,
            is_ooo_enabled=True
        ).select_related('user')

        results = []
        for p in ooo_prefs:
            # Check date boundaries if set
            if p.ooo_start_date and p.ooo_start_date > today:
                continue
            if p.ooo_end_date and p.ooo_end_date < today:
                continue

            results.append({
                'email': p.user.email,
                'name': f"{p.user.first_name} {p.user.last_name}".strip() or p.user.email,
                'end_date': p.ooo_end_date.strftime('%b %d, %Y') if p.ooo_end_date else 'indefinitely',
                'message': p.ooo_message
            })

        return Response({'ooo_recipients': results})



class AISmartComposeView(APIView):
    """Gemini & Groq AI Composer & Tone Polisher."""
    permission_classes = [IsEmployee]

    def post(self, request):
        prompt = request.data.get('prompt', '').strip()
        if not prompt:
            return Response({'error': 'Prompt or instructions required.'}, status=status.HTTP_400_BAD_REQUEST)

        tone = request.data.get('tone', 'executive')
        action = request.data.get('action', 'draft')
        context_text = request.data.get('context', '')
        try:
            length_level = int(request.data.get('length_level', 3))
        except (ValueError, TypeError):
            length_level = 3

        org_id = get_request_org_id(request)
        org_obj = Organization.objects.filter(id=org_id).first() if org_id else None
        org_name = org_obj.name if org_obj else "Our Organization"

        try:
            result = communication_service.ai_smart_compose(
                prompt=prompt,
                tone=tone,
                action=action,
                context_text=context_text,
                org_name=org_name,
                length_level=length_level
            )
            return Response(result)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': f"AI Composer error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIThreadSummaryView(APIView):
    """Gemini 1-Click Thread TL;DR, key takeaways & action items."""
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        org_id = get_request_org_id(request)
        message = MailMessage.objects.filter(org_id=org_id, id=pk).first()
        if not message:
            return Response({'error': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)

        root = message
        while root.parent_message is not None:
            root = root.parent_message

        thread_messages = MailMessage.objects.filter(
            Q(id=root.id) | Q(parent_message=root)
        ).order_by('created_at')

        messages_data = []
        for m in thread_messages:
            messages_data.append({
                'sender_name': m.sender.get_full_name() if m.sender else m.sender.email,
                'sender_email': m.sender.email if m.sender else '',
                'subject': m.subject,
                'body_text': strip_tags(m.body),
                'created_at': m.created_at.strftime('%Y-%m-%d %H:%M')
            })

        org_obj = Organization.objects.filter(id=org_id).first() if org_id else None
        org_name = org_obj.name if org_obj else "Our Organization"

        try:
            summary_result = communication_service.ai_thread_summarize(messages_data, org_name)
            return Response(summary_result)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': f"AI Summarizer error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AISmartRepliesView(APIView):
    """Dynamic Smart Reply Chips: 3 contextual reply recommendations."""
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        org_id = get_request_org_id(request)
        message = MailMessage.objects.filter(org_id=org_id, id=pk).first()
        if not message:
            return Response({'error': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)

        root = message
        while root.parent_message is not None:
            root = root.parent_message

        thread_messages = MailMessage.objects.filter(
            Q(id=root.id) | Q(parent_message=root)
        ).order_by('created_at')

        messages_data = []
        for m in thread_messages:
            messages_data.append({
                'sender_name': m.sender.get_full_name() if m.sender else m.sender.email,
                'sender_email': m.sender.email if m.sender else '',
                'subject': m.subject,
                'body_text': strip_tags(m.body),
                'created_at': m.created_at.strftime('%Y-%m-%d %H:%M')
            })

        org_obj = Organization.objects.filter(id=org_id).first() if org_id else None
        org_name = org_obj.name if org_obj else "Our Organization"

        try:
            result = communication_service.ai_generate_smart_replies(messages_data, org_name)
            return Response(result)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': f"Smart Replies error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AITranslateView(APIView):
    """Instant Multi-Language Translation for email messages and drafts."""
    permission_classes = [IsEmployee]

    def post(self, request):
        text = request.data.get('text', '').strip()
        target_language = request.data.get('target_language', 'English').strip()

        if not text:
            return Response({'error': 'Text to translate is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = communication_service.ai_translate_text(text=text, target_language=target_language)
            return Response(result)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': f"Translation error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIEmailIntentView(APIView):
    """AI Sentiment & Intent Triage badge analysis."""
    permission_classes = [IsEmployee]

    def get(self, request, pk):
        org_id = get_request_org_id(request)
        message = MailMessage.objects.filter(org_id=org_id, id=pk).first()
        if not message:
            return Response({'error': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)

        body_clean = strip_tags(message.body)
        try:
            result = communication_service.ai_analyze_intent(subject=message.subject, body_text=body_clean)
            return Response(result)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': f"Intent analysis error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIConvertTaskView(APIView):
    """1-Click Action Item / Thread to Project Task Converter with Bidirectional Work-Graph Linking."""
    permission_classes = [IsEmployee]

    def post(self, request):
        project_id = request.data.get('project_id')
        title = request.data.get('title')
        if not project_id or not title:
            return Response({'error': 'Project and task title required.'}, status=status.HTTP_400_BAD_REQUEST)

        description = request.data.get('description', '')
        assignee_id = request.data.get('assignee_id')
        due_date = request.data.get('due_date')
        priority = request.data.get('priority', 'medium')
        message_id = request.data.get('message_id')

        task_data = communication_service.create_task_from_action_item(
            org_id=get_request_org_id(request),
            requesting_user=request.user,
            project_id=project_id,
            title=title,
            description=description,
            assignee_id=assignee_id,
            due_date=due_date,
            priority=priority,
            message_id=message_id
        )
        return Response(task_data, status=status.HTTP_201_CREATED)


class MailWorkGraphCardView(APIView):
    """Returns live interactive preview card details for any Work-Graph entity (Task/Project, Meeting, Expense, Doc)."""
    permission_classes = [IsEmployee]

    def get(self, request):
        entity_type = request.query_params.get('entity_type', '').strip()
        entity_id = request.query_params.get('entity_id', '').strip()

        if not entity_type or not entity_id:
            return Response({})

        card_data = communication_service.get_workgraph_entity_card(
            org_id=get_request_org_id(request),
            entity_type=entity_type,
            entity_id=entity_id
        )
        return Response(card_data)


class MailSpawnInstantMeetingView(APIView):
    """1-Click Meeting Escalation: Spawns live Meeting Room with all thread attendees."""
    permission_classes = [IsEmployee]

    def post(self, request, pk):
        org_id = get_request_org_id(request)
        message = MailMessage.objects.filter(org_id=org_id, id=pk).first()
        if not message:
            return Response({'error': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)

        meeting_data = communication_service.spawn_instant_meeting_from_thread(
            org_id=org_id,
            requesting_user=request.user,
            message=message
        )
        return Response(meeting_data, status=status.HTTP_201_CREATED)


class MailUserPresenceView(APIView):
    """Returns live presence indicators: 🟢 Online, 🟡 In Meeting, 🔴 Out of Office, ⚪ Offline."""
    permission_classes = [IsEmployee]

    def post(self, request):
        user_ids = request.data.get('user_ids', [])
        if not isinstance(user_ids, list):
            user_ids = []

        org_id = get_request_org_id(request)
        presence_data = communication_service.get_users_presence(
            org_id=org_id,
            user_ids=user_ids
        )
        return Response({'presence': presence_data, **presence_data})


class MailVerifyDocumentAccessView(APIView):
    """Verifies that all email recipients have permission to read a linked Document."""
    permission_classes = [IsEmployee]

    def post(self, request):
        document_id = request.data.get('document_id')
        recipient_ids = request.data.get('recipient_ids', [])

        if not document_id:
            return Response({'has_permission_issues': False})

        res = communication_service.verify_document_permissions(
            org_id=get_request_org_id(request),
            document_id=document_id,
            recipient_ids=recipient_ids
        )
        return Response(res)


class MailGrantDocumentRolesView(APIView):
    """1-Click Grant: expands document role permissions so email recipients can access it."""
    permission_classes = [IsEmployee]

    def post(self, request):
        document_id = request.data.get('document_id')
        roles = request.data.get('roles', [])

        if not document_id or not roles:
            return Response({'error': 'Document ID and roles required.'}, status=status.HTTP_400_BAD_REQUEST)

        res = communication_service.grant_document_roles(
            org_id=get_request_org_id(request),
            document_id=document_id,
            roles_to_add=roles
        )
        return Response(res)


class BroadcastChannelsMetaView(APIView):
    """Returns active departments, roles, and projects for broadcast targeting."""
    permission_classes = [IsEmployee]

    def get(self, request):
        org_id = get_request_org_id(request)

        departments = Department.objects.filter(org_id=org_id).values('id', 'name')
        projects = Project.objects.filter(org_id=org_id, is_deleted=False).values('id', 'name', 'status')

        # Role presets with member counts
        role_counts = {
            'all_managers': User.objects.filter(org_id=org_id, role__in=['admin', 'manager', 'hr'], is_active=True).count(),
            'admins_hr': User.objects.filter(org_id=org_id, role__in=['admin', 'hr'], is_active=True).count(),
            'employee': User.objects.filter(org_id=org_id, role='employee', is_active=True).count(),
            'all': User.objects.filter(org_id=org_id, is_active=True).exclude(id=request.user.id).count(),
        }

        return Response({
            'departments': list(departments),
            'projects': list(projects),
            'role_presets': [
                {'id': 'all_managers', 'label': 'All Managers & Leadership', 'count': role_counts['all_managers']},
                {'id': 'admins_hr', 'label': 'Admins & HR Only', 'count': role_counts['admins_hr']},
                {'id': 'employee', 'label': 'All Employees', 'count': role_counts['employee']},
            ],
            'total_org_members': role_counts['all']
        })


class MailAttachmentDownloadView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, pk):
        attachment = MailAttachment.objects.filter(
            message__org_id=get_request_org_id(request),
            id=pk
        ).first()
        
        if not attachment:
            raise Http404("Attachment not found.")

        message = attachment.message
        is_sender = (message.sender == request.user)
        recipient_status = message.recipient_statuses.filter(
            recipient=request.user, 
            is_deleted=False
        ).exists()

        if not is_sender and not recipient_status:
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        file_path = attachment.file.path
        if not os.path.exists(file_path):
            raise Http404("File not found on disk.")

        response = FileResponse(open(file_path, 'rb'))
        response['Content-Disposition'] = f'attachment; filename="{attachment.file_name}"'
        return response
