"""
knowledge/tasks.py

Celery tasks for document processing pipeline.

COMPLETE PHASE 3 PIPELINE:
  1.  Set document status → processing
  2.  Resolve absolute file path
  3.  Extract raw text (pdfplumber / python-docx / plain text)
  4.  Run spaCy NER → save entities to DocumentMetadata
  5.  Run KeyBERT → save keywords to DocumentMetadata
  6.  Run SVM classifier → save category to DocumentMetadata
  7.  Split text into chunks (500 tokens, 50-token overlap)
  8.  Delete existing chunks (idempotency)
  9.  Save chunks to PostgreSQL (DocumentChunk table)
  10. Embed all chunks in batch (sentence-transformers)
  11. Store vectors in Qdrant (org-scoped collection)
  12. Save qdrant_id back to each DocumentChunk row
  13. Set document status → searchable
"""

import os
import logging
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name='knowledge.process_document'
)
def process_document(self_or_id, document_id: str = None):
    # Support both Celery invocation (self, document_id) and direct thread execution (document_id)
    if document_id is None and isinstance(self_or_id, str):
        document_id = self_or_id
        task_self = None
    else:
        task_self = self_or_id

    from knowledge.models import Document
    from knowledge.repositories import DocumentRepository
    from nlp.text_extractor import extract_text_by_page
    from nlp.chunker import chunk_text_by_pages
    from nlp.entity_extractor import extract_entities
    from nlp.keyword_extractor import extract_keywords
    from nlp.embedding_generator import embed_batch
    from ml.svm_classifier import classify_document
    from ml.search_engine import store_chunk_vectors, delete_document_vectors

    doc_repo = DocumentRepository()

    def _safe_retry(exc, countdown=2):
        if task_self and hasattr(task_self, 'request') and hasattr(task_self, 'retry'):
            retries = getattr(task_self.request, 'retries', 0)
            max_retries = getattr(task_self, 'max_retries', 3)
            if retries < max_retries:
                raise task_self.retry(exc=exc, countdown=countdown)

    # ── Step 1: Load document ─────────────────────────────────────────────

    try:
        document = Document.objects.select_related('metadata').get(
            id=document_id,
            is_deleted=False
        )
    except Document.DoesNotExist:
        logger.warning(f'process_document: {document_id} not found. Skipping.')
        return {'status': 'skipped', 'reason': 'document_not_found'}

    org_id = document.org_id
    logger.info(f'process_document: Starting for "{document.title}" ({document_id})')

    # ── Step 2: Mark as processing ────────────────────────────────────────

    doc_repo.update_status(document_id, 'processing')

    # ── Step 3: Resolve file path ─────────────────────────────────────────

    try:
        absolute_path = os.path.join(settings.MEDIA_ROOT, document.file_path)
        if not os.path.exists(absolute_path):
            raise FileNotFoundError(f'File not found: {absolute_path}')
    except Exception as exc:
        logger.error(f'process_document: File path error for {document_id}: {exc}')
        _safe_retry(exc, countdown=2)
        doc_repo.update_status(document_id, 'failed')
        return {'status': 'failed', 'reason': str(exc)}

    # ── Step 4: Extract raw text ──────────────────────────────────────────

    try:
        pages = extract_text_by_page(absolute_path, document.file_type)
        raw_text = "\n\n".join([p['text'] for p in pages])
        logger.info(f'process_document: Extracted {len(pages)} pages ({len(raw_text)} chars) from {document_id}')

        if not raw_text or not raw_text.strip():
            doc_repo.update_status(document_id, 'searchable')
            return {'status': 'searchable', 'chunks': 0, 'reason': 'no_text_extracted'}

    except Exception as exc:
        logger.error(f'process_document: Text extraction failed for {document_id}: {exc}')
        _safe_retry(exc, countdown=2)
        doc_repo.update_status(document_id, 'failed')
        return {'status': 'failed', 'reason': f'extraction_failed: {str(exc)}'}

    # ── Step 5: NLP — Named Entity Recognition ────────────────────────────

    try:
        entities = extract_entities(raw_text)
        doc_repo.update_metadata(document_id, org_id, entities=entities)
        logger.info(f'process_document: Extracted {sum(len(v) for v in entities.values())} entities')
    except Exception as exc:
        logger.warning(f'process_document: NER failed for {document_id} (non-fatal): {exc}')
        # NER failure is non-fatal — continue pipeline

    # ── Step 6: NLP — Keyword Extraction ─────────────────────────────────

    try:
        keywords = extract_keywords(raw_text)
        doc_repo.update_metadata(document_id, org_id, keywords=keywords)
        logger.info(f'process_document: Extracted {len(keywords)} keywords')
    except Exception as exc:
        logger.warning(f'process_document: Keyword extraction failed for {document_id} (non-fatal): {exc}')

    # ── Step 7: ML — Document Classification ─────────────────────────────

    try:
        category = classify_document(raw_text)
        if category:
            # Only override category if not already manually set by admin
            current_meta = document.metadata
            if not current_meta.category:
                doc_repo.update_metadata(document_id, org_id, category=category)
                logger.info(f'process_document: Classified as "{category}"')
    except Exception as exc:
        logger.warning(f'process_document: Classification failed for {document_id} (non-fatal): {exc}')

    # ── Step 8: Chunk the text ────────────────────────────────────────────

    chunks_data = []
    try:
        chunks_data = chunk_text_by_pages(pages)
        logger.info(f'process_document: Created {len(chunks_data)} chunks')
    except Exception as exc:
        logger.warning(f'process_document: chunk_text_by_pages failed for {document_id} ({exc}). Using paragraph fallback.')
        # Fallback to direct paragraph chunking
        paras = [p.strip() for p in raw_text.split('\n\n') if p.strip()]
        for idx, p in enumerate(paras):
            chunks_data.append({
                'chunk_index': idx,
                'chunk_text': p[:2000],
                'token_count': max(1, len(p) // 4),
                'page_number': 1
            })

    # ── Step 9: Save chunks to PostgreSQL ────────────────────────────────

    try:
        doc_repo.delete_chunks_for_document(document_id)

        if chunks_data:
            created_chunks = doc_repo.create_chunks(
                document=document,
                org_id=org_id,
                chunks_data=chunks_data
            )
        else:
            created_chunks = []

    except Exception as exc:
        logger.error(f'process_document: Chunk save failed for {document_id}: {exc}')
        # Mark searchable so document is not completely locked out
        doc_repo.update_status(document_id, 'searchable')
        return {'status': 'searchable', 'chunks': 0, 'reason': str(exc)}

    # ── Step 10: Embed chunks ─────────────────────────────────────────────

    if not created_chunks:
        doc_repo.update_status(document_id, 'searchable')
        return {'status': 'searchable', 'chunks': 0}

    embeddings = []
    import gc
    try:
        # Embed in small sub-batches of 10 chunks with garbage collection to protect 512MB RAM
        chunk_texts = [c.chunk_text for c in created_chunks]
        sub_batch_size = 10
        for i in range(0, len(chunk_texts), sub_batch_size):
            sub_texts = chunk_texts[i:i + sub_batch_size]
            sub_embeddings = embed_batch(sub_texts)
            embeddings.extend(sub_embeddings)
            gc.collect()

        logger.info(f'process_document: Generated {len(embeddings)} embeddings')
    except Exception as exc:
        logger.warning(f'process_document: Embedding failed for {document_id} (non-fatal, chunks saved in DB): {exc}')

    # ── Step 11: Store vectors in Qdrant ──────────────────────────────────

    qdrant_ids = []
    if embeddings:
        try:
            # Remove old vectors first (idempotency)
            delete_document_vectors(str(org_id), document_id)

            qdrant_ids = store_chunk_vectors(
                org_id=str(org_id),
                document_id=document_id,
                document_title=document.title,
                chunks=created_chunks,
                embeddings=embeddings,
                allowed_roles=document.allowed_roles,
            )
            logger.info(f'process_document: Stored {len(qdrant_ids)} vectors in Qdrant')

        except Exception as exc:
            logger.warning(f'process_document: Qdrant storage failed for {document_id} (non-fatal): {exc}')

    # ── Step 12: Save Qdrant IDs back to chunks ───────────────────────────

    try:
        for chunk, qdrant_id in zip(created_chunks, qdrant_ids):
            chunk.qdrant_id = qdrant_id
            chunk.save(update_fields=['qdrant_id'])
    except Exception as exc:
        logger.warning(f'process_document: Failed to save qdrant_ids to chunks (non-fatal): {exc}')
        # Non-fatal — vectors are in Qdrant, document is still searchable

    # ── Step 13: Mark as searchable ───────────────────────────────────────

    doc_repo.update_status(document_id, 'searchable')

    # Invalidate semantic cache for this organization since we have new context
    try:
        from ml.semantic_cache import SemanticCache
        SemanticCache().invalidate_cache(str(org_id))
    except Exception as cache_exc:
        logger.warning(f'process_document: Cache invalidation failed (non-fatal): {cache_exc}')

    logger.info(
        f'process_document: Complete for "{document.title}". '
        f'Chunks: {len(created_chunks)}, Vectors in Qdrant: {len(qdrant_ids)}'
    )

    return {
        'status':      'searchable',
        'document_id': document_id,
        'chunks':      len(created_chunks),
        'characters':  len(raw_text),
    }
