from .models import Document, DocumentMetadata
from django.utils import timezone


class DocumentRepository:

    def get_by_id(self, document_id, org_id=None):
        qs = Document.objects.filter(
            id=document_id,
            is_deleted=False
        )
        if org_id:
            qs = qs.filter(org_id=org_id)
        return qs.select_related('metadata', 'uploaded_by').first()

    def list_by_org(self, org_id, filters=None, user_role=None, user_id=None):
        qs = Document.objects.filter(
            org_id=org_id,
            is_deleted=False
        ).select_related('metadata', 'uploaded_by').order_by('-created_at')

        # Filter by user role and ownership if the user is not an admin
        if user_role and user_role != 'admin':
            from django.db.models import Q
            if user_id:
                qs = qs.filter(
                    Q(allowed_roles__icontains=user_role) | Q(uploaded_by_id=user_id)
                )
            else:
                qs = qs.filter(allowed_roles__icontains=user_role)

        if filters:
            if filters.get('category'):
                qs = qs.filter(metadata__category=filters['category'])
            if filters.get('status'):
                qs = qs.filter(status=filters['status'])
            if filters.get('file_type'):
                qs = qs.filter(file_type=filters['file_type'])
            if filters.get('search'):
                qs = qs.filter(title__icontains=filters['search'])
            if filters.get('uploaded_by'):
                qs = qs.filter(uploaded_by_id=filters['uploaded_by'])

        return qs

    def create(self, org_id, title, file_path, file_type, file_size, uploaded_by, allowed_roles=None):
        if not allowed_roles:
            allowed_roles = 'admin,hr,manager,employee'
        doc = Document.objects.create(
            org_id=org_id,
            title=title,
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
            uploaded_by=uploaded_by,
            allowed_roles=allowed_roles,
            status='uploaded'
        )
        DocumentMetadata.objects.create(document=doc)
        return doc

    def update_metadata(self, document_id, org_id, category=None, keywords=None, entities=None):
        doc = self.get_by_id(document_id, org_id)
        if not doc:
            return None
        meta = doc.metadata
        if category is not None:
            meta.category = category
        if keywords is not None:
            meta.keywords = keywords
        if entities is not None:
            meta.entities = entities
        meta.save()
        return doc

    def update_status(self, document_id, status):
        Document.objects.filter(id=document_id).update(status=status)

    def soft_delete(self, document_id, org_id=None):
        doc = self.get_by_id(document_id, org_id)
        if doc:
            doc.soft_delete()
        return doc

    def count_by_org(self, org_id):
        return Document.objects.filter(org_id=org_id, is_deleted=False).count()

    def count_by_category(self, org_id):
        from django.db.models import Count
        return (
            Document.objects
            .filter(org_id=org_id, is_deleted=False)
            .exclude(metadata__category='')
            .values('metadata__category')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

    def count_by_status(self, org_id):
        from django.db.models import Count
        return (
            Document.objects
            .filter(org_id=org_id, is_deleted=False)
            .values('status')
            .annotate(count=Count('id'))
        )

    def total_size_by_org(self, org_id):
        from django.db.models import Sum
        result = Document.objects.filter(
            org_id=org_id,
            is_deleted=False
        ).aggregate(total=Sum('file_size'))
        return result['total'] or 0

    def get_chunks_by_document(self, document_id):
        from .models import DocumentChunk
        return DocumentChunk.objects.filter(
            document_id=document_id
        ).order_by('chunk_index')

    def delete_chunks_for_document(self, document_id):
        """Delete all existing chunks for a document before re-chunking.
        This is what makes the pipeline idempotent."""
        from .models import DocumentChunk
        DocumentChunk.objects.filter(document_id=document_id).delete()

    def create_chunks(self, document, org_id, chunks_data):
        """
        Bulk create DocumentChunk rows from the chunker output.

        Args:
            document: Document model instance
            org_id: UUID of the organisation
            chunks_data: List of dicts from chunker.chunk_text()
                         Each dict: {chunk_index, chunk_text, token_count}

        Returns:
            List of created DocumentChunk instances
        """
        from .models import DocumentChunk
        chunk_objects = [
            DocumentChunk(
                document=document,
                org_id=org_id,
                chunk_index=c['chunk_index'],
                chunk_text=c['chunk_text'],
                token_count=c['token_count'],
                page_number=c.get('page_number'),
            )
            for c in chunks_data
        ]
        return DocumentChunk.objects.bulk_create(chunk_objects)

    def count_chunks_by_document(self, document_id):
        from .models import DocumentChunk
        return DocumentChunk.objects.filter(document_id=document_id).count()

