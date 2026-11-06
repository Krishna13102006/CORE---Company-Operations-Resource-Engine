import uuid
import os
import shutil
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status
from tenants.models import Organization
from knowledge.models import Document, DocumentMetadata
from knowledge.views import ArticleAPIView, RAGAskView, DocumentDetailView, DocumentPageView, invalidate_pdf_preview_cache
from unittest.mock import patch

User = get_user_model()

class KnowledgePermissionsAndWikiTestCase(TestCase):
    def setUp(self):
        # Create Org
        self.org = Organization.objects.create(
            name="Knowledge Corp",
            slug="knowledge-corp",
            passkey_hash="dummy"
        )
        
        # Create Users
        self.admin = User.objects.create_user(
            email="admin@kcorp.com",
            password="password",
            first_name="Admin",
            last_name="User",
            role="admin",
            org=self.org
        )
        self.employee1 = User.objects.create_user(
            email="emp1@kcorp.com",
            password="password",
            first_name="Alice",
            last_name="Employee",
            role="employee",
            org=self.org
        )
        self.employee2 = User.objects.create_user(
            email="emp2@kcorp.com",
            password="password",
            first_name="Bob",
            last_name="Employee",
            role="employee",
            org=self.org
        )
        
        self.factory = APIRequestFactory()
        
    def tearDown(self):
        # Cleanup created media files
        org_media_dir = os.path.join(settings.MEDIA_ROOT, 'knowledge', str(self.org.id))
        if os.path.exists(org_media_dir):
            shutil.rmtree(org_media_dir)

    @patch('knowledge.tasks.process_document.delay')
    def test_article_crud_flow(self, mock_celery):
        # 1. Create Article via POST
        view = ArticleAPIView.as_view()
        data = {
            "title": "Onboarding Policy",
            "body": "Welcome to Knowledge Corp. Here is our onboarding policy.",
            "category": "HR",
            "allowed_roles": "admin,hr,employee"
        }
        
        request = self.factory.post('/api/knowledge/articles/', data, format='json')
        request.org_id = self.org.id
        request.user = self.employee1
        force_authenticate(request, user=self.employee1)
        
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], "Onboarding Policy")
        
        doc_id = response.data['id']
        mock_celery.assert_called_once_with(str(doc_id))
        
        # Verify file is written
        doc = Document.objects.get(id=doc_id)
        abs_path = os.path.join(settings.MEDIA_ROOT, doc.file_path)
        self.assertTrue(os.path.exists(abs_path))
        
        # 2. Get Article details and body text via GET
        request = self.factory.get(f'/api/knowledge/articles/{doc_id}/')
        request.org_id = self.org.id
        request.user = self.employee1
        force_authenticate(request, user=self.employee1)
        
        response = view(request, document_id=doc_id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['body'], "Welcome to Knowledge Corp. Here is our onboarding policy.")
        self.assertEqual(response.data['metadata']['category'], "HR")
        
        # 3. Update Article via PUT
        update_data = {
            "title": "Onboarding Policy v2",
            "body": "Welcome to Knowledge Corp. Here is our updated onboarding policy.",
            "category": "HR Operations",
            "allowed_roles": "admin,hr"
        }
        request = self.factory.put(f'/api/knowledge/articles/{doc_id}/', update_data, format='json')
        request.org_id = self.org.id
        request.user = self.employee1
        force_authenticate(request, user=self.employee1)
        
        response = view(request, document_id=doc_id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], "Onboarding Policy v2")
        
        # Verify file content is updated
        with open(abs_path, 'r', encoding='utf-8') as f:
            self.assertEqual(f.read(), "Welcome to Knowledge Corp. Here is our updated onboarding policy.")

    @patch('knowledge.tasks.process_document.delay')
    def test_document_owner_privacy(self, mock_celery):
        # 1. Employee 1 creates a private article
        view = ArticleAPIView.as_view()
        data = {
            "title": "Secret Strategy Notes",
            "body": "Highly confidential notes on enterprise strategy.",
            "category": "Strategy",
            "allowed_roles": "private"  # only owner and admin can view
        }
        
        request = self.factory.post('/api/knowledge/articles/', data, format='json')
        request.org_id = self.org.id
        request.user = self.employee1
        force_authenticate(request, user=self.employee1)
        
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        doc_id = response.data['id']
        
        # 2. Employee 2 tries to GET this article details -> Should fail with 403
        detail_view = DocumentDetailView.as_view()
        request = self.factory.get(f'/api/knowledge/documents/{doc_id}/')
        request.org_id = self.org.id
        request.user = self.employee2
        force_authenticate(request, user=self.employee2)
        
        response = detail_view(request, document_id=doc_id)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # 3. Employee 1 gets details -> Should succeed (Owner bypass)
        request = self.factory.get(f'/api/knowledge/documents/{doc_id}/')
        request.org_id = self.org.id
        request.user = self.employee1
        force_authenticate(request, user=self.employee1)
        
        response = detail_view(request, document_id=doc_id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], "Secret Strategy Notes")

    @patch('knowledge.views.rag_service.ask')
    def test_rag_returns_excerpts(self, mock_ask):
        # Mock ask response to check structure in endpoint
        mock_ask.return_value = {
            'answer': "This is the answer.",
            'answered': True,
            'sources': [
                {'document_id': str(uuid.uuid4()), 'document_title': "Test doc", 'relevance_score': 0.9}
            ],
            'excerpts': [
                {'document_id': str(uuid.uuid4()), 'document_title': "Test doc", 'text': "Test passage", 'score': 0.9}
            ]
        }
        
        view = RAGAskView.as_view()
        data = {"question": "What is the policy?"}
        request = self.factory.post('/api/knowledge/ask/', data, format='json')
        request.org_id = self.org.id
        request.user = self.employee1
        force_authenticate(request, user=self.employee1)
        
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('excerpts', response.data)
        self.assertEqual(response.data['excerpts'][0]['text'], "Test passage")

    def test_pdf_preview_render_cache_and_invalidation(self):
        """Test that preview cache generates on first request and is served from cache on subsequent hits."""
        doc = Document.objects.create(
            org_id=self.org.id,
            title="Preview Test PDF",
            file_path="knowledge/test.pdf",
            file_type="pdf",
            file_size=1024,
            status="searchable",
            allowed_roles="admin,employee",
            uploaded_by=self.employee1
        )
        cache_dir = os.path.join(settings.MEDIA_ROOT, 'cache', 'pdf_previews', str(doc.id))
        os.makedirs(cache_dir, exist_ok=True)
        cached_page_file = os.path.join(cache_dir, 'page_0.jpg')

        # Write dummy cached jpeg
        with open(cached_page_file, 'wb') as f:
            f.write(b"fake_jpeg_data")

        view = DocumentPageView.as_view()
        request = self.factory.get(f'/api/knowledge/documents/{doc.id}/preview/0/')
        request.org_id = self.org.id
        request.user = self.employee1
        force_authenticate(request, user=self.employee1)

        # 1. Fast Path: Should hit cache (X-Cache-Status: HIT)
        response = view(request, document_id=doc.id, page_index=0)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['X-Cache-Status'], 'HIT')
        self.assertIn('max-age=31536000', response['Cache-Control'])
        self.assertEqual(response.content, b"fake_jpeg_data")

        # 2. Invalidate cache
        invalidate_pdf_preview_cache(doc.id)
        self.assertFalse(os.path.exists(cached_page_file))

    @patch('ml.rag_generator.httpx.post')
    def test_rag_generator_groq_dispatch(self, mock_post):
        from ml.rag_generator import generate_answer
        from django.test import override_settings

        # Mock Groq chat completion response
        mock_response = patch('httpx.Response').start()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "Groq AI generated answer based on documents."
                    }
                }
            ]
        }
        mock_post.return_value = mock_response

        with override_settings(GROQ_API_KEY='gsk_test_key_123', LLM_PROVIDER='groq'):
            chunks = [{'document_title': 'Policy Doc', 'chunk_text': 'Working hours are 9 to 5.'}]
            result = generate_answer("What are the working hours?", chunks)

            self.assertEqual(result['answered'], True)
            self.assertEqual(result['provider'], 'groq')
            self.assertIn("Groq AI generated answer", result['answer'])
            mock_post.assert_called_once()
            call_url = mock_post.call_args[0][0]
            self.assertEqual(call_url, "https://api.groq.com/openai/v1/chat/completions")

    @patch('ml.rag_generator.httpx.post')
    def test_rag_generator_gemini_dispatch(self, mock_post):
        from ml.rag_generator import generate_answer
        from django.test import override_settings

        # Mock Gemini generateContent response
        mock_response = patch('httpx.Response').start()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "Gemini 2.0 Flash generated answer."}
                        ]
                    }
                }
            ]
        }
        mock_post.return_value = mock_response

        with override_settings(GEMINI_API_KEY='AIza_test_key_456', LLM_PROVIDER='gemini'):
            chunks = [{'document_title': 'Policy Doc', 'chunk_text': 'Working hours are 9 to 5.'}]
            result = generate_answer("What are the working hours?", chunks)

            self.assertEqual(result['answered'], True)
            self.assertEqual(result['provider'], 'gemini')
            self.assertIn("Gemini 2.0 Flash", result['answer'])
            mock_post.assert_called_once()
            call_url = mock_post.call_args[0][0]
            self.assertIn("generativelanguage.googleapis.com", call_url)


