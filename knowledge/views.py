from django.conf import settings
from django.http import HttpResponse, StreamingHttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from core.permissions import IsAdmin, IsEmployee
from core.exceptions import ServiceError
from core.pagination import StandardPagination
from core.audit import log_action
from .services import DocumentService
from .serializers import DocumentSerializer, DocumentUpdateSerializer, DocumentUploadSerializer

doc_service = DocumentService()
from .repositories import DocumentRepository
doc_repo = DocumentRepository()
import os
import shutil
import threading
from django.core.cache import cache
pdf_render_lock = threading.Lock()

def invalidate_pdf_preview_cache(document_id):
    """Purge rendered PDF page previews and cached page count for a document."""
    try:
        cache.delete(f'doc_page_count_{document_id}')
        cache_dir = os.path.join(settings.MEDIA_ROOT, 'cache', 'pdf_previews', str(document_id))
        if os.path.exists(cache_dir):
            shutil.rmtree(cache_dir, ignore_errors=True)
    except Exception:
        pass


class DocumentListView(APIView):
    permission_classes = [IsEmployee]  # all roles can browse documents

    def get(self, request):
        filters = {
            'category':  request.query_params.get('category'),
            'status':    request.query_params.get('status'),
            'file_type': request.query_params.get('file_type'),
            'search':    request.query_params.get('search'),
            'uploaded_by': request.query_params.get('uploaded_by'),
        }
        filters = {k: v for k, v in filters.items() if v}
        docs = doc_service.list_documents(
            request.org_id,
            filters,
            user_role=request.user.role,
            user_id=str(request.user.id)
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(docs, request)
        return paginator.get_paginated_response(DocumentSerializer(page, many=True).data)


class DocumentUploadView(APIView):
    permission_classes = [IsAdmin]
    parser_classes     = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            doc = doc_service.upload_document(
                org_id=request.org_id,
                title=serializer.validated_data['title'],
                file=serializer.validated_data['file'],
                category=serializer.validated_data.get('category', ''),
                uploaded_by=request.user,
                allowed_roles=serializer.validated_data.get('allowed_roles'),
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='upload_document',
                target_type='document',
                target_id=doc.id,
                detail=f"Uploaded document: {doc.title}"
            )

            # Trigger compliance sync automation if policy / compliance doc
            cat_lower = (doc.title + ' ' + (serializer.validated_data.get('category') or '')).lower()
            if any(k in cat_lower for k in ['compliance', 'policy', 'legal', 'security', 'iso', 'soc']):
                try:
                    from automations.services import AutomationService
                    AutomationService.execute_compliance_expiry_sync(
                        org_id=request.org_id,
                        document=doc,
                        actor_user=request.user
                    )
                except Exception as auto_err:
                    import logging
                    logging.getLogger(__name__).warning(f"Compliance automation trigger failed: {auto_err}")

            return Response(DocumentSerializer(doc).data, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class DocumentDetailView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, document_id):
        try:
            doc = doc_service.get_document(document_id, request.org_id)
            # Enforce Row-Level Security checks on document retrieval
            user_role = request.user.role
            allowed_list = [r.strip() for r in doc.allowed_roles.split(',') if r.strip()]
            is_owner = doc.uploaded_by_id and (str(doc.uploaded_by_id) == str(request.user.id))
            if user_role != 'admin' and user_role not in allowed_list and not is_owner:
                return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
            return Response(DocumentSerializer(doc).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def patch(self, request, document_id):
        is_admin = request.user.role == 'admin' or getattr(request.user, 'is_superuser', False)
        if not is_admin:
            return Response({'detail': 'Permission denied. Only admins can edit documents.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = DocumentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            doc = doc_service.update_document(
                document_id=document_id,
                org_id=request.org_id,
                title=serializer.validated_data.get('title'),
                category=serializer.validated_data.get('category'),
                keywords=serializer.validated_data.get('keywords'),
                allowed_roles=serializer.validated_data.get('allowed_roles'),
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='update_document',
                target_type='document',
                target_id=doc.id,
                detail=f"Updated metadata/title for document: {doc.title}"
            )
            return Response(DocumentSerializer(doc).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def delete(self, request, document_id):
        is_admin = request.user.role == 'admin' or getattr(request.user, 'is_superuser', False)
        if not is_admin:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            org_id = getattr(request, 'org_id', None) or getattr(request.user, 'org_id', None)
            doc_service.delete_document(document_id, org_id)
            # Invalidate semantic cache since context has changed
            try:
                from ml.semantic_cache import SemanticCache
                SemanticCache().invalidate_cache(org_id or request.org_id)
            except Exception:
                pass
            invalidate_pdf_preview_cache(document_id)

            log_action(
                org_id=org_id or request.org_id,
                user=request.user,
                action='delete_document',
                target_type='document',
                target_id=document_id,
                detail=f"Soft deleted document ID: {document_id}"
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class DocumentReprocessView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, document_id):
        try:
            invalidate_pdf_preview_cache(document_id)
            doc = doc_service.reprocess_document(document_id, request.org_id)
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='reprocess_document',
                target_type='document',
                target_id=doc.id,
                detail=f"Reprocess requested for document: {doc.title}"
            )
            return Response(DocumentSerializer(doc).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class DocumentStatsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        stats = doc_service.get_stats(request.org_id)
        return Response(stats)


class KnowledgeUploadView(APIView):
    permission_classes = [IsEmployee]
    parser_classes     = [MultiPartParser, FormParser]

    def post(self, request):
        files = request.FILES.getlist('files')
        category = request.data.get('category', '')
        allowed_roles = request.data.get('allowed_roles', 'admin,hr,manager,employee')

        if not files:
            return Response({'error': 'No files uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        import os
        from core.audit import log_action
        from core.validators import validate_uploaded_file
        from rest_framework.exceptions import ValidationError
        from knowledge.serializers import DocumentSerializer

        uploaded_count = 0
        errors = []
        uploaded_docs = []

        for file_obj in files:
            try:
                # Validate file size, extension, and binary magic bytes
                safe_name = validate_uploaded_file(file_obj, allowed_types=('pdf', 'docx', 'txt'), max_size_mb=25)
                file_obj.name = safe_name
            except ValidationError as ve:
                errors.append(str(ve.detail[0]) if hasattr(ve, 'detail') and isinstance(ve.detail, list) else str(ve))
                continue

            try:
                # Derive title from filename
                base_name = os.path.splitext(file_obj.name)[0]
                title = base_name.replace('_', ' ').replace('-', ' ').title()

                doc = doc_service.upload_document(
                    org_id=request.org_id,
                    title=title,
                    file=file_obj,
                    category=category,
                    uploaded_by=request.user,
                    allowed_roles=allowed_roles,
                )
                log_action(
                    org_id=request.org_id,
                    user=request.user,
                    action='upload_document',
                    target_type='document',
                    target_id=doc.id,
                    detail=f'Uploaded via Knowledge bulk panel: {doc.title}'
                )
                uploaded_docs.append(doc)
                uploaded_count += 1
            except Exception as e:
                errors.append(f"Failed to process {file_obj.name}: {str(e)}")

        if uploaded_count == 0:
            return Response({'error': 'No documents could be uploaded.', 'details': errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'uploaded_count': uploaded_count,
            'documents': DocumentSerializer(uploaded_docs, many=True).data,
            'errors': errors
        }, status=status.HTTP_201_CREATED)


from django.utils.decorators import method_decorator
from django.views.decorators.clickjacking import xframe_options_exempt

@method_decorator(xframe_options_exempt, name='dispatch')
class DocumentDownloadView(APIView):
    permission_classes = []  # Open permission list to authenticate query param tokens manually

    def get(self, request, document_id):
        import os
        import mimetypes
        from django.http import FileResponse

        # Manual JWT Authentication for iframe request compatibility (since browsers don't send auth headers)
        token = request.query_params.get('token')
        user = None
        org_id = None
        if token:
            try:
                from rest_framework_simplejwt.tokens import AccessToken
                from django.contrib.auth import get_user_model
                access_token = AccessToken(token)
                user = get_user_model().objects.get(id=access_token['user_id'])
                org_id = access_token.get('org_id')
            except Exception:
                pass

        if not user:
            if request.user and request.user.is_authenticated:
                user = request.user
                org_id = request.org_id

        if not user:
            return Response({'error': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            doc = doc_service.get_document(str(document_id), org_id)
            user_role = getattr(user, 'role', '')
            allowed_list = [r.strip() for r in doc.allowed_roles.split(',') if r.strip()]
            is_owner = doc.uploaded_by_id and (str(doc.uploaded_by_id) == str(user.id))
            if user_role != 'admin' and user_role not in allowed_list and not is_owner:
                return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

        file_path = os.path.join(settings.MEDIA_ROOT, doc.file_path)

        if not os.path.exists(file_path):
            return Response(
                {'error': 'File not found on server.'},
                status=status.HTTP_404_NOT_FOUND
            )

        content_type, _ = mimetypes.guess_type(file_path)
        response = FileResponse(
            open(file_path, 'rb'),
            content_type=content_type or 'application/octet-stream'
        )
        safe_title = doc.title.replace('"', "'")
        ext = os.path.splitext(doc.file_path)[1]
        
        # Use inline Content-Disposition for document preview requests
        preview = request.query_params.get('preview') == 'true'
        disposition = 'inline' if preview else 'attachment'
        
        response['Content-Disposition'] = (
            f'{disposition}; filename="{safe_title}{ext}"'
        )
        return response


class DocumentContentView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, document_id):
        import os
        from django.conf import settings
        from nlp.text_extractor import extract_text

        try:
            doc = doc_service.get_document(str(document_id), request.org_id)
            user_role = request.user.role
            allowed_list = [r.strip() for r in doc.allowed_roles.split(',') if r.strip()]
            is_owner = doc.uploaded_by_id and (str(doc.uploaded_by_id) == str(request.user.id))
            if user_role != 'admin' and user_role not in allowed_list and not is_owner:
                return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
            chunks = doc.chunks.order_by('chunk_index')
            full_text = "\n\n".join([chunk.chunk_text for chunk in chunks if chunk.chunk_text])

            # Fallback 1: Native Markdown article content
            if not full_text and getattr(doc, 'article_content', None):
                full_text = doc.article_content

            # Fallback 2: Audio transcript
            if not full_text and getattr(doc, 'audio_transcript', None):
                full_text = doc.audio_transcript

            # Fallback 3: Direct raw text extraction if physical file exists
            if not full_text and doc.file_path:
                try:
                    clean_rel_path = doc.file_path.lstrip('/\\')
                    absolute_path = doc.file_path if os.path.isabs(doc.file_path) else os.path.join(settings.MEDIA_ROOT, clean_rel_path)
                    if os.path.exists(absolute_path):
                        if (doc.file_type in ['md', 'txt']) or absolute_path.endswith('.md') or absolute_path.endswith('.txt'):
                            with open(absolute_path, 'r', encoding='utf-8', errors='ignore') as f:
                                full_text = f.read()
                        else:
                            full_text = extract_text(absolute_path, doc.file_type)
                except Exception:
                    pass

            page_count = 0
            is_pdf = (doc.file_type and doc.file_type.lower() == 'pdf') or (doc.file_path and doc.file_path.lower().endswith('.pdf'))
            if is_pdf:
                cache_key = f'doc_page_count_{doc.id}'
                page_count = cache.get(cache_key)
                if page_count is None:
                    clean_rel_path = doc.file_path.lstrip('/\\') if doc.file_path else ''
                    absolute_path = doc.file_path if (doc.file_path and os.path.isabs(doc.file_path)) else os.path.join(settings.MEDIA_ROOT, clean_rel_path)
                    if os.path.exists(absolute_path):
                        # 1. Try pypdfium2
                        try:
                            import pypdfium2 as pdfium
                            with pdf_render_lock:
                                with pdfium.PdfDocument(absolute_path) as pdf:
                                    page_count = len(pdf)
                        except Exception:
                            page_count = 0

                        # 2. Try pypdf
                        if not page_count:
                            try:
                                import pypdf
                                reader = pypdf.PdfReader(absolute_path)
                                page_count = len(reader.pages)
                            except Exception:
                                pass

                        # 3. Try pdfplumber
                        if not page_count:
                            try:
                                import pdfplumber
                                with pdfplumber.open(absolute_path) as pdf:
                                    page_count = len(pdf.pages)
                            except Exception:
                                pass

                        if page_count:
                            cache.set(cache_key, page_count, timeout=86400 * 30)

            return Response({
                'id': doc.id,
                'title': doc.title,
                'file_type': doc.file_type,
                'file_size': doc.file_size,
                'status': doc.status,
                'uploaded_by_name': f'{doc.uploaded_by.first_name} {doc.uploaded_by.last_name}' if doc.uploaded_by else 'System',
                'created_at': doc.created_at,
                'category': doc.metadata.category if hasattr(doc, 'metadata') else '',
                'keywords': doc.metadata.keywords if hasattr(doc, 'metadata') else [],
                'entities': doc.metadata.entities if hasattr(doc, 'metadata') else {},
                'allowed_roles': doc.allowed_roles,
                'chunk_count': doc.chunks.count(),
                'content': full_text,
                'page_count': page_count
            })
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class KnowledgeStatsView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        stats = doc_service.get_stats(request.org_id)
        return Response({
            'total_documents': stats['total_documents'],
            'by_category':     stats['by_category'],
        })


from .services import RAGService

rag_service = RAGService()


class SemanticSearchView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({'error': 'Query parameter q is required.'}, status=400)

        try:
            results = rag_service.semantic_search(
                query=query,
                org_id=request.org_id,
                user_role=request.user.role,
                user_id=str(request.user.id),
            )
            data = [
                {
                    'document': DocumentSerializer(r['document']).data,
                    'score':    r['score'],
                    'excerpt':  r['excerpt'],
                }
                for r in results
            ]
            return Response({'results': data, 'query': query})
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class RAGAskView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request):
        question = request.data.get('question', '').strip()
        history = request.data.get('history', [])
        document_ids = request.data.get('document_ids', [])
        if not question:
            return Response({'error': 'question field is required.'}, status=400)

        try:
            result = rag_service.ask(
                question=question,
                org_id=request.org_id,
                user_role=request.user.role,
                user_id=str(request.user.id),
                history=history,
                document_ids=document_ids,
            )
            return Response(result)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


from django.http import StreamingHttpResponse
import json

class RAGStreamView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request):
        question = request.data.get('question', '').strip()
        history = request.data.get('history', [])
        document_ids = request.data.get('document_ids', [])
        if not question:
            return Response({'error': 'question field is required.'}, status=400)

        def event_stream():
            try:
                for chunk in rag_service.ask_stream(question, request.org_id, user_role=request.user.role, user_id=str(request.user.id), history=history, document_ids=document_ids):
                    yield f"data: {json.dumps(chunk)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['X-Accel-Buffering'] = 'no'
        response['Cache-Control'] = 'no-cache'
        return response


class DocumentRecommendationsView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, document_id):
        try:
            recommendations = rag_service.get_recommendations(
                document_id=str(document_id),
                org_id=request.org_id,
            )
            data = [
                {
                    'document': DocumentSerializer(r['document']).data,
                    'score':    r['score'],
                }
                for r in recommendations
            ]
            return Response({'recommendations': data})
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class DocumentPageView(APIView):
    permission_classes = []  # Bypass dispatch-level auth to check query params and cookies manually

    def get(self, request, document_id, page_index):
        import os
        import pypdfium2 as pdfium
        from django.http import HttpResponse

        # 1. Manual JWT Authentication for easy image rendering (img src requests don't send auth headers)
        token = request.query_params.get('token') or request.COOKIES.get('access_token') or request.COOKIES.get('jwt_access')
        user = None
        org_id = None
        if token:
            try:
                from rest_framework_simplejwt.tokens import AccessToken
                from django.contrib.auth import get_user_model
                access_token = AccessToken(token)
                user = get_user_model().objects.get(id=access_token['user_id'])
                org_id = access_token.get('org_id') or getattr(user, 'org_id', None)
            except Exception:
                pass

        if not user:
            if request.user and request.user.is_authenticated:
                user = request.user
                org_id = getattr(request, 'org_id', None) or getattr(user, 'org_id', None)

        if not user:
            return Response({'error': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            doc = doc_repo.get_by_id(str(document_id))
            if not doc:
                return Response({'error': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)

            user_role = getattr(user, 'role', '')
            allowed_list = [r.strip() for r in doc.allowed_roles.split(',') if r.strip()]
            is_owner = doc.uploaded_by_id and (str(doc.uploaded_by_id) == str(user.id))
            is_admin = user_role == 'admin' or getattr(user, 'is_superuser', False)

            if not is_admin and str(doc.org_id) != str(org_id):
                return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

            if not is_admin and user_role not in allowed_list and not is_owner:
                return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Fast Path: Check persistent disk/storage render cache first
        cache_dir = os.path.join(settings.MEDIA_ROOT, 'cache', 'pdf_previews', str(doc.id))
        cached_file = os.path.join(cache_dir, f'page_{page_index}.jpg')

        if os.path.exists(cached_file):
            try:
                with open(cached_file, 'rb') as f:
                    image_bytes = f.read()
                resp = HttpResponse(image_bytes, content_type='image/jpeg')
                resp['Cache-Control'] = 'public, max-age=31536000, immutable'
                resp['Access-Control-Allow-Origin'] = '*'
                resp['ETag'] = f'"{doc.id}-p{page_index}"'
                resp['X-Cache-Status'] = 'HIT'
                return resp
            except Exception:
                pass

        clean_rel_path = doc.file_path.lstrip('/\\') if doc.file_path else ''
        file_path = doc.file_path if (doc.file_path and os.path.isabs(doc.file_path)) else os.path.join(settings.MEDIA_ROOT, clean_rel_path)
        if not os.path.exists(file_path):
            return Response({'error': 'File not found'}, status=status.HTTP_404_NOT_FOUND)

        # 3. Cache Miss: Render under lock, save to cache, and stream with CDN headers
        try:
            with pdf_render_lock:
                # Double-check cache inside lock in case another concurrent request just completed it
                if os.path.exists(cached_file):
                    with open(cached_file, 'rb') as f:
                        image_bytes = f.read()
                    resp = HttpResponse(image_bytes, content_type='image/jpeg')
                    resp['Cache-Control'] = 'public, max-age=31536000, immutable'
                    resp['Access-Control-Allow-Origin'] = '*'
                    resp['ETag'] = f'"{doc.id}-p{page_index}"'
                    resp['X-Cache-Status'] = 'HIT'
                    return resp

                pil_img = None
                try:
                    import pypdfium2 as pdfium
                    with pdfium.PdfDocument(file_path) as pdf:
                        if page_index < 0 or page_index >= len(pdf):
                            return Response({'error': 'Page index out of range'}, status=status.HTTP_400_BAD_REQUEST)
                        page = pdf[page_index]
                        bitmap = page.render(scale=2.0)
                        pil_img = bitmap.to_pil()
                except Exception:
                    try:
                        import pdfplumber
                        with pdfplumber.open(file_path) as pdf:
                            if page_index < 0 or page_index >= len(pdf.pages):
                                return Response({'error': 'Page index out of range'}, status=status.HTTP_400_BAD_REQUEST)
                            page = pdf.pages[page_index]
                            pil_img = page.to_image(resolution=150).original
                    except Exception:
                        pass

                if not pil_img:
                    return Response({'error': 'Failed to render PDF page'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

                import io
                buf = io.BytesIO()
                pil_img.save(buf, format='JPEG', quality=90)
                image_bytes = buf.getvalue()

                # Persist to disk cache
                try:
                    os.makedirs(cache_dir, exist_ok=True)
                    with open(cached_file, 'wb') as f:
                        f.write(image_bytes)
                except Exception:
                    pass

                resp = HttpResponse(image_bytes, content_type='image/jpeg')
                resp['Cache-Control'] = 'public, max-age=31536000, immutable'
                resp['Access-Control-Allow-Origin'] = '*'
                resp['ETag'] = f'"{doc.id}-p{page_index}"'
                resp['X-Cache-Status'] = 'MISS'
                return resp
        except Exception as e:
            return Response({'error': f'Failed to render page: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ArticleAPIView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request):
        title = request.data.get('title', '').strip()
        body = request.data.get('body', '').strip()
        category = request.data.get('category', '').strip()
        allowed_roles = request.data.get('allowed_roles', 'admin,hr,manager,employee').strip()

        if not title or not body:
            return Response({'error': 'Title and Body are required fields.'}, status=400)

        import os
        import uuid
        from django.conf import settings
        from knowledge.serializers import DocumentSerializer
        from core.audit import log_action

        try:
            # 1. Create file in media/knowledge/<org_id>/page-<uuid>.txt
            upload_dir = os.path.join(settings.MEDIA_ROOT, 'knowledge', str(request.org_id))
            os.makedirs(upload_dir, exist_ok=True)
            unique_name = f"page-{uuid.uuid4()}.txt"
            file_path = os.path.join(upload_dir, unique_name)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(body)

            relative_path = os.path.join('knowledge', str(request.org_id), unique_name)
            file_size = len(body.encode('utf-8'))

            # 2. Create database entries
            doc = doc_repo.create(
                org_id=request.org_id,
                title=title,
                file_path=relative_path,
                file_type='txt',
                file_size=file_size,
                uploaded_by=request.user,
                allowed_roles=allowed_roles
            )

            # Update category metadata
            doc_repo.update_metadata(doc.id, request.org_id, category=category)

            # 3. Trigger processing task
            from knowledge.tasks import process_document
            process_document.delay(str(doc.id))

            log_action(
                org_id=request.org_id,
                user=request.user,
                action='create_article',
                target_type='document',
                target_id=doc.id,
                detail=f"Created browser page article: {title}"
            )

            # Refresh and return
            doc = doc_repo.get_by_id(doc.id, request.org_id)
            return Response(DocumentSerializer(doc).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def get(self, request, document_id):
        try:
            doc = doc_service.get_document(document_id, request.org_id)
            
            # Enforce Row-Level Security checks
            user_role = request.user.role
            allowed_list = [r.strip() for r in doc.allowed_roles.split(',') if r.strip()]
            is_owner = doc.uploaded_by_id and (str(doc.uploaded_by_id) == str(request.user.id))
            if user_role != 'admin' and user_role not in allowed_list and not is_owner:
                return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

            # Read text file content
            import os
            from django.conf import settings
            absolute_path = os.path.join(settings.MEDIA_ROOT, doc.file_path)
            
            body = ""
            if os.path.exists(absolute_path):
                with open(absolute_path, 'r', encoding='utf-8') as f:
                    body = f.read()

            from knowledge.serializers import DocumentSerializer
            data = DocumentSerializer(doc).data
            data['body'] = body
            return Response(data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def put(self, request, document_id):
        title = request.data.get('title', '').strip()
        body = request.data.get('body', '').strip()
        category = request.data.get('category', '').strip()
        allowed_roles = request.data.get('allowed_roles', 'admin,hr,manager,employee').strip()

        if not title or not body:
            return Response({'error': 'Title and Body are required fields.'}, status=400)

        import os
        from django.conf import settings
        from knowledge.serializers import DocumentSerializer
        from core.audit import log_action

        try:
            doc = doc_service.get_document(document_id, request.org_id)
            
            # Enforce permission checks: only admin can update it
            is_admin = request.user.role == 'admin' or getattr(request.user, 'is_superuser', False)
            if not is_admin:
                return Response({'error': 'Permission denied. Only admins can modify articles.'}, status=status.HTTP_403_FORBIDDEN)

            # 1. Overwrite physical file
            absolute_path = os.path.join(settings.MEDIA_ROOT, doc.file_path)
            os.makedirs(os.path.dirname(absolute_path), exist_ok=True)
            with open(absolute_path, 'w', encoding='utf-8') as f:
                f.write(body)

            # 2. Update PostgreSQL fields
            doc.title = title
            doc.allowed_roles = allowed_roles
            doc.file_size = len(body.encode('utf-8'))
            doc.status = 'uploaded'  # reset status for reprocessing
            doc.save()

            doc_repo.update_metadata(doc.id, request.org_id, category=category)

            # Remove previous vector database chunks before re-processing (so we don't have stray chunks)
            try:
                from ml.search_engine import delete_document_vectors
                delete_document_vectors(str(request.org_id), str(doc.id))
            except Exception:
                pass

            # 3. Trigger processing task
            from knowledge.tasks import process_document
            process_document.delay(str(doc.id))

            log_action(
                org_id=request.org_id,
                user=request.user,
                action='update_article',
                target_type='document',
                target_id=doc.id,
                detail=f"Updated browser page article: {title}"
            )

            # Refresh and return
            doc = doc_repo.get_by_id(doc.id, request.org_id)
            return Response(DocumentSerializer(doc).data)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


# ==============================================================================
# Feature 1: Native Markdown Wiki & Article Editor Views
# ==============================================================================

class ArticleCreateOrUpdateView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request):
        from .serializers import ArticleSerializer
        from .services import ArticleService

        serializer = ArticleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        article_id = serializer.validated_data.get('id')
        title = serializer.validated_data['title']
        content = serializer.validated_data['content']
        category = serializer.validated_data.get('category', 'Wiki')
        allowed_roles = serializer.validated_data.get('allowed_roles', 'admin,hr,manager,employee')

        try:
            doc = ArticleService.create_or_update_article(
                org_id=request.org_id,
                title=title,
                content=content,
                user=request.user,
                article_id=article_id if article_id else None,
                category=category,
                allowed_roles=allowed_roles,
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='create_or_update_wiki_article',
                target_type='document',
                target_id=doc.id,
                detail=f"{'Updated' if article_id else 'Created'} native Markdown Wiki article: {doc.title}"
            )
            return Response(DocumentSerializer(doc).data, status=status.HTTP_200_OK if article_id else status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception(f"Unhandled error creating/updating article: {e}")
            return Response({'error': f"Failed to publish article: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==============================================================================
# Feature 3: AI Document Executive Summary & FAQ Generation View
# ==============================================================================

class DocumentSummaryView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request, document_id):
        from .services import DocSummaryService
        from .models import Document

        try:
            doc = Document.objects.select_related('metadata').get(id=document_id, org_id=request.org_id, is_deleted=False)
            metadata = getattr(doc, 'metadata', None)
            if metadata and metadata.summary and metadata.faq_list:
                return Response({
                    'summary': metadata.summary,
                    'faq_list': metadata.faq_list,
                })
            
            # Generate if missing
            res = DocSummaryService.generate_summary_and_faqs(str(document_id), str(request.org_id))
            return Response(res)
        except Document.DoesNotExist:
            return Response({'error': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)

    def post(self, request, document_id):
        # Force re-generation of summary and FAQs
        from .services import DocSummaryService
        try:
            res = DocSummaryService.generate_summary_and_faqs(str(document_id), str(request.org_id))
            return Response(res)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


# ==============================================================================
# Feature 4: Audio Transcription & Voice Memo Ingestion View (Groq Whisper)
# ==============================================================================

class AudioUploadView(APIView):
    permission_classes = [IsEmployee]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        from .serializers import AudioUploadSerializer
        from .services import AudioTranscriptionService

        serializer = AudioUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        audio_file = serializer.validated_data['audio_file']
        title = serializer.validated_data.get('title') or os.path.splitext(audio_file.name)[0]
        category = serializer.validated_data.get('category', 'Voice Memos')
        allowed_roles = serializer.validated_data.get('allowed_roles', 'admin,hr,manager,employee')

        try:
            doc = AudioTranscriptionService.transcribe_and_ingest(
                org_id=request.org_id,
                audio_file=audio_file,
                title=title,
                user=request.user,
                category=category,
                allowed_roles=allowed_roles,
            )
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='transcribe_voice_memo',
                target_type='document',
                target_id=doc.id,
                detail=f"Transcribed and indexed audio memo via Whisper AI: {doc.title}"
            )
            return Response(DocumentSerializer(doc).data, status=status.HTTP_201_CREATED)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


# ==============================================================================
# Feature 5: Cloud Connector Live Sync Views (Google Drive / Notion / OneDrive)
# ==============================================================================

class CloudConnectorListView(APIView):
    permission_classes = [IsEmployee]

    def get(self, request):
        from .models import CloudConnector
        from .serializers import CloudConnectorSerializer
        connectors = CloudConnector.objects.filter(org_id=request.org_id, is_deleted=False)
        return Response(CloudConnectorSerializer(connectors, many=True).data)

    def post(self, request):
        if request.user.role not in ['admin', 'hr', 'manager']:
            return Response({'error': 'Only managers and admins can configure cloud connectors.'}, status=status.HTTP_403_FORBIDDEN)

        from .serializers import CloudConnectorSerializer
        from .services import CloudConnectorService

        serializer = CloudConnectorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        connector = CloudConnectorService.create_connector(
            org_id=request.org_id,
            name=serializer.validated_data['name'],
            connector_type=serializer.validated_data['connector_type'],
            target_url=serializer.validated_data.get('target_url', ''),
            access_token=serializer.validated_data.get('access_token', ''),
            folder_id=serializer.validated_data.get('folder_id', ''),
            auto_sync=serializer.validated_data.get('auto_sync', True),
        )
        return Response(CloudConnectorSerializer(connector).data, status=status.HTTP_201_CREATED)


class CloudConnectorSyncView(APIView):
    permission_classes = [IsEmployee]

    def post(self, request, connector_id):
        from .services import CloudConnectorService
        try:
            res = CloudConnectorService.sync_connector(str(connector_id), str(request.org_id), request.user)
            log_action(
                org_id=request.org_id,
                user=request.user,
                action='sync_cloud_connector',
                target_type='cloud_connector',
                target_id=connector_id,
                detail=f"Triggered live cloud connector sync for ID: {connector_id}"
            )
            return Response(res)
        except ServiceError as e:
            return Response({'error': e.message}, status=e.status_code)


class CloudConnectorDeleteView(APIView):
    permission_classes = [IsEmployee]

    def delete(self, request, connector_id):
        if request.user.role != 'admin':
            return Response({'error': 'Only admins can delete cloud connectors.'}, status=status.HTTP_403_FORBIDDEN)

        from .models import CloudConnector
        try:
            connector = CloudConnector.objects.get(id=connector_id, org_id=request.org_id, is_deleted=False)
            connector.soft_delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except CloudConnector.DoesNotExist:
            return Response({'error': 'Connector not found.'}, status=status.HTTP_404_NOT_FOUND)

