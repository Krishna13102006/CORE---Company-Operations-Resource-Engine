import uuid
import datetime
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from tenants.models import Organization
from communications.models import MailMessage, MailRecipientStatus, MailAttachment
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status
from communications.views import InboxListView, SentListView, MailComposeView, MailActionView, MailAttachmentDownloadView

User = get_user_model()

class CommunicationsMailPanelTestCase(TestCase):
    def setUp(self):
        # 1. Create Organization
        self.org = Organization.objects.create(
            name="Mail Corp",
            slug="mail-corp",
            passkey_hash="dummy"
        )
        self.org_id = self.org.id

        # 2. Create Users
        self.user1 = User.objects.create_user(
            email="sender@mail.com",
            password="password",
            first_name="Alice",
            last_name="Sender",
            role="employee",
            org=self.org
        )
        self.user2 = User.objects.create_user(
            email="recipient1@mail.com",
            password="password",
            first_name="Bob",
            last_name="Recipient",
            role="employee",
            org=self.org
        )
        self.user3 = User.objects.create_user(
            email="recipient2@mail.com",
            password="password",
            first_name="Charlie",
            last_name="Recipient",
            role="employee",
            org=self.org
        )

        self.factory = APIRequestFactory()

    def _setup_request(self, request, user):
        request.org_id = self.org_id
        force_authenticate(request, user=user)
        return request

    def test_mail_flow_compose_and_inbox(self):
        # 1. Compose mail to Bob and Charlie
        view = MailComposeView.as_view()
        request = self.factory.post(
            '/api/communications/compose/',
            {
                'recipient_ids': [str(self.user2.id), str(self.user3.id)],
                'subject': 'Project Standup',
                'body': 'Please send your reports by EOD today.'
            },
            format='json'
        )
        self._setup_request(request, self.user1)
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message_id = response.data['id']
        self.assertEqual(response.data['subject'], 'Project Standup')

        # Check database records directly
        message = MailMessage.objects.get(id=message_id)
        self.assertEqual(message.org_id, self.org_id)
        self.assertEqual(message.sender, self.user1)
        self.assertEqual(message.recipient_statuses.count(), 2)

        # 2. Query Alice's Outbox
        sent_view = SentListView.as_view()
        request_sent = self.factory.get('/api/communications/sent/')
        self._setup_request(request_sent, self.user1)
        response_sent = sent_view(request_sent)

        self.assertEqual(response_sent.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_sent.data), 1)
        self.assertEqual(response_sent.data[0]['subject'], 'Project Standup')

        # 3. Query Bob's Inbox
        inbox_view = InboxListView.as_view()
        request_inbox = self.factory.get('/api/communications/inbox/')
        self._setup_request(request_inbox, self.user2)
        response_inbox = inbox_view(request_inbox)

        self.assertEqual(response_inbox.status_code, status.HTTP_200_OK)
        inbox_msgs = response_inbox.data.get('messages', response_inbox.data) if isinstance(response_inbox.data, dict) else response_inbox.data
        self.assertEqual(len(inbox_msgs), 1)
        self.assertEqual(inbox_msgs[0]['subject'], 'Project Standup')
        self.assertEqual(inbox_msgs[0]['is_read'], False)

    def test_mail_detail_read_and_soft_delete(self):
        # Setup a message sent by user1 to user2
        message = MailMessage.objects.create(
            org_id=self.org_id,
            sender=self.user1,
            subject='Confidential Info',
            body='Do not share this message.'
        )
        recipient_status = MailRecipientStatus.objects.create(
            message=message,
            recipient=self.user2
        )

        action_view = MailActionView.as_view()

        # 1. Fetch detail as Bob (recipient) - should mark as Read
        request_detail = self.factory.get(f'/api/communications/messages/{message.id}/')
        self._setup_request(request_detail, self.user2)
        response_detail = action_view(request_detail, pk=message.id)

        self.assertEqual(response_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(response_detail.data['is_read'], True)
        
        # Verify db status is_read updated
        recipient_status.refresh_from_db()
        self.assertEqual(recipient_status.is_read, True)
        self.assertIsNotNone(recipient_status.read_at)

        # 2. Soft-delete as Bob (recipient)
        request_delete = self.factory.delete(f'/api/communications/messages/{message.id}/')
        self._setup_request(request_delete, self.user2)
        response_delete = action_view(request_delete, pk=message.id)

        self.assertEqual(response_delete.status_code, status.HTTP_204_NO_CONTENT)

        # Verify Bob's status is deleted, but MailMessage remains in database
        recipient_status.refresh_from_db()
        self.assertEqual(recipient_status.is_deleted, True)
        self.assertTrue(MailMessage.objects.filter(id=message.id).exists())

        # 3. Soft-delete as Alice (sender)
        request_delete_sender = self.factory.delete(f'/api/communications/messages/{message.id}/')
        self._setup_request(request_delete_sender, self.user1)
        response_delete_sender = action_view(request_delete_sender, pk=message.id)

        self.assertEqual(response_delete_sender.status_code, status.HTTP_204_NO_CONTENT)

        # Verify message is completely cleaned from database
        self.assertFalse(MailMessage.objects.filter(id=message.id).exists())

    def test_mail_send_to_all(self):
        # Compose mail with send_to_all=True
        view = MailComposeView.as_view()
        request = self.factory.post(
            '/api/communications/compose/',
            {
                'send_to_all': True,
                'subject': 'Global Announcement',
                'body': 'Holiday tomorrow!'
            },
            format='json'
        )
        self._setup_request(request, self.user1)
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message_id = response.data['id']

        # Verify both Bob and Charlie received it
        message = MailMessage.objects.get(id=message_id)
        self.assertEqual(message.recipient_statuses.count(), 2)
        recipients = [status.recipient for status in message.recipient_statuses.all()]
        self.assertIn(self.user2, recipients)
        self.assertIn(self.user3, recipients)

    def test_mail_conversation_threading(self):
        """Test that replying to a message groups them into a clean thread root."""
        # 1. Send root message
        root = MailMessage.objects.create(
            org_id=self.org_id,
            sender=self.user1,
            subject="Project Plan",
            body="Here is the roadmap."
        )
        MailRecipientStatus.objects.create(message=root, recipient=self.user2)

        # 2. Reply to root message
        reply = MailMessage.objects.create(
            org_id=self.org_id,
            sender=self.user2,
            subject="Re: Project Plan",
            body="Looks good, approved.",
            parent_message=root
        )
        MailRecipientStatus.objects.create(message=reply, recipient=self.user1)

        # 3. Query the reply message detail
        action_view = MailActionView.as_view()
        request = self.factory.get(f'/api/communications/messages/{reply.id}/')
        self._setup_request(request, self.user1)
        response = action_view(request, pk=reply.id)

        # Assert details resolves to the thread root (root message)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], str(root.id))
        self.assertEqual(response.data['subject'], "Project Plan")
        
        # Assert replies contains the reply message details
        self.assertEqual(len(response.data['replies']), 1)
        self.assertEqual(response.data['replies'][0]['id'], str(reply.id))
        self.assertEqual(response.data['replies'][0]['body'], "Looks good, approved.")

    def test_mail_attachments_upload_and_download(self):
        """Test uploading files as attachments and downloading them securely."""
        # 1. Compose message with file uploads
        compose_view = MailComposeView.as_view()
        
        # Build multipart file payload with valid PDF header
        test_file = SimpleUploadedFile("design_specs.pdf", b"%PDF-1.4 design specs content", content_type="application/pdf")
        
        request = self.factory.post(
            '/api/communications/compose/',
            {
                'recipient_ids': str(self.user2.id),
                'subject': 'Draft Design',
                'body': '<p>Attached is the layout document.</p>',
                'attachments': [test_file]
            },
            format='multipart'
        )
        self._setup_request(request, self.user1)
        response = compose_view(request)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message_id = response.data['id']
        
        # Verify attachment object is logged
        attachments = MailAttachment.objects.filter(message_id=message_id)
        self.assertEqual(attachments.count(), 1)
        attach = attachments.first()
        self.assertEqual(attach.file_name, "design_specs.pdf")
        self.assertEqual(attach.file_size, len(b"%PDF-1.4 design specs content"))

        # 2. Test downloading the attachment securely
        download_view = MailAttachmentDownloadView.as_view()
        request_download = self.factory.get(f'/api/communications/attachment/{attach.id}/')
        self._setup_request(request_download, self.user2)
        response_download = download_view(request_download, pk=attach.id)

        self.assertEqual(response_download.status_code, status.HTTP_200_OK)
        # Read file response stream
        content = b"".join(response_download.streaming_content)
        self.assertEqual(content, b"%PDF-1.4 design specs content")

    def test_ai_smart_compose_view_and_service(self):
        """Test AI Composer endpoint and resilient generation."""
        from communications.views import AISmartComposeView
        from communications.services import communication_service

        view = AISmartComposeView.as_view()
        request = self.factory.post(
            '/api/communications/ai-compose/',
            {
                'prompt': 'Ask the DevOps team for database access before 3 PM',
                'tone': 'executive',
                'action': 'draft',
                'length_level': 3
            },
            format='json'
        )
        self._setup_request(request, self.user1)
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('subject', response.data)
        self.assertIn('body_html', response.data)
        self.assertTrue(len(response.data['subject']) > 0)
        self.assertTrue(len(response.data['body_html']) > 0)

        # Direct test of smart replies fallback / generation
        replies = communication_service.ai_generate_smart_replies([
            {'sender_name': 'DevOps Lead', 'body_text': 'Here are the credentials for the database.'}
        ])
        self.assertIn('smart_replies', replies)
        self.assertEqual(len(replies['smart_replies']), 3)

        # Direct test of intent triage
        intent = communication_service.ai_analyze_intent('URGENT: Server outage in production', 'Please resolve immediately.')
        self.assertIn('intent', intent)
        self.assertIn('urgency', intent)



