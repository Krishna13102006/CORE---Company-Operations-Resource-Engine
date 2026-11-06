"""
search_engine.py

Qdrant operations and high-speed fallback for the Knowledge panel.

Responsibilities:
  - Create per-org collections in Qdrant (when Qdrant server is running)
  - Store chunk embeddings in Qdrant with payload (document metadata)
  - Query Qdrant for semantically similar chunks given a query vector
  - Seamless zero-latency fallback to PostgreSQL chunk search when Qdrant is offline
  - Delete all vectors for a document (called on soft-delete or reprocess)

Vector dimensions: 384 (all-MiniLM-L6-v2)
Distance metric: Cosine
"""

import socket
import logging
import uuid as uuid_lib
from typing import List, Dict, Any
from django.conf import settings

logger = logging.getLogger(__name__)

_qdrant_client_cache = None
_qdrant_checked = False


def _is_qdrant_server_running(host="localhost", port=6333, timeout=0.05) -> bool:
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return True
    except Exception:
        return False


def _get_client():
    global _qdrant_client_cache, _qdrant_checked
    if _qdrant_checked:
        return _qdrant_client_cache

    _qdrant_checked = True
    host = getattr(settings, 'QDRANT_HOST', 'localhost')
    port = getattr(settings, 'QDRANT_PORT', 6333)
    api_key = getattr(settings, 'QDRANT_API_KEY', None)

    try:
        from qdrant_client import QdrantClient
        if host.startswith('http://') or host.startswith('https://'):
            client = QdrantClient(url=host, api_key=api_key, timeout=3.0)
            _qdrant_client_cache = client
            return client
        elif _is_qdrant_server_running(host, port, timeout=0.05):
            client = QdrantClient(host=host, port=int(port), api_key=api_key, timeout=1.0)
            _qdrant_client_cache = client
            return client
    except Exception as e:
        logger.warning(f"Could not initialize Qdrant client: {e}")

    _qdrant_client_cache = None
    return None


def _collection_name(org_id: str) -> str:
    return f'knowledge_{org_id}'


def ensure_collection_exists(org_id: str):
    """
    Create the Qdrant collection for this org if it does not already exist.
    Safe to call multiple times — does nothing if collection already exists or Qdrant is offline.
    """
    client = _get_client()
    if not client:
        return

    from qdrant_client.models import Distance, VectorParams
    collection_name = _collection_name(org_id)

    try:
        existing = [c.name for c in client.get_collections().collections]
        if collection_name in existing:
            try:
                info = client.get_collection(collection_name)
                curr_size = getattr(getattr(info.config.params, 'vectors', None), 'size', None)
                if curr_size and curr_size != 768:
                    logger.info(f"Recreating Qdrant collection {collection_name} to update vector size from {curr_size} to 768")
                    client.delete_collection(collection_name)
                    existing.remove(collection_name)
            except Exception:
                pass

        if collection_name not in existing:
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=768,
                    distance=Distance.COSINE,
                ),
            )
            # Create keyword payload index for high-speed tenant and role filtering
            try:
                client.create_payload_index(
                    collection_name=collection_name,
                    field_name="org_id",
                    field_schema="keyword",
                )
                client.create_payload_index(
                    collection_name=collection_name,
                    field_name="allowed_roles",
                    field_schema="keyword",
                )
            except Exception:
                pass
    except Exception as e:
        logger.warning(f"Qdrant ensure_collection_exists failed: {e}")


def delete_org_vectors(org_id: str, async_mode: bool = True) -> bool:
    """
    Deletes the entire Qdrant vector collection for an organization and recreates a fresh collection.
    If async_mode is True, runs Qdrant network roundtrips in a background daemon thread so HTTP requests return instantly.
    """
    def _run_purge():
        try:
            client = _get_client()
            if not client:
                return
            collection_name = _collection_name(org_id)
            existing = [c.name for c in client.get_collections().collections]
            if collection_name in existing:
                client.delete_collection(collection_name)
            ensure_collection_exists(org_id)
        except Exception as e:
            logger.warning(f"Could not purge Qdrant collection for org {org_id}: {e}")

    if async_mode:
        import threading
        threading.Thread(target=_run_purge, daemon=True).start()
        return True
    else:
        _run_purge()
        return True


def store_chunk_vectors(
        org_id: str,
        document_id: str,
        document_title: str,
        chunks,
        embeddings: List[List[float]],
        allowed_roles: str = None,
) -> List[str]:
    """
    Store chunk embeddings in Qdrant (or return generated point IDs if offline).
    """
    if not org_id:
        raise ValueError("org_id is strictly required for store_chunk_vectors")

    client = _get_client()
    qdrant_ids = [str(uuid_lib.uuid4()) for _ in range(len(chunks))]

    if not client:
        return qdrant_ids

    from qdrant_client.models import PointStruct

    ensure_collection_exists(org_id)
    collection_name = _collection_name(org_id)

    roles_list = [r.strip() for r in allowed_roles.split(',') if r.strip()] if allowed_roles else ['admin', 'hr', 'manager', 'employee']

    points = []
    for chunk, vector, point_id in zip(chunks, embeddings, qdrant_ids):
        points.append(PointStruct(
            id=point_id,
            vector=vector,
            payload={
                'document_id':    str(document_id),
                'document_title': document_title,
                'chunk_index':    chunk.chunk_index,
                'page_number':    getattr(chunk, 'page_number', None),
                'chunk_text':     chunk.chunk_text,
                'org_id':         str(org_id),
                'allowed_roles':  roles_list,
            }
        ))

    if points:
        try:
            client.upsert(
                collection_name=collection_name,
                points=points,
            )
        except Exception as e:
            logger.warning(f"Qdrant upsert failed (non-fatal): {e}")

    return qdrant_ids


STOPWORDS = {
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'in', 'on', 'at', 'to', 'for', 'with', 'about', 'against', 'between',
    'into', 'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up',
    'down', 'of', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'it', 'its'
}


def search_chunks(
        org_id: str,
        query_vector: List[float] = None,
        top_k: int = 5,
        user_role: str = None,
        query_text: str = "",
        document_ids: List[str] = None,
) -> List[Dict[str, Any]]:
    """
    Find top-k most semantically and contextually relevant chunks.
    Routes to Qdrant if running, or intelligent high-precision PostgreSQL search when offline.
    Enforces strict mathematical tenant isolation (org_id filter).
    Supports multi-document comparative synthesis filtering (document_ids).
    """
    if not org_id:
        raise ValueError("org_id is strictly required for search_chunks")

    client = _get_client()
    if client and query_vector:
        from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchAny

        collection_name = _collection_name(org_id)
        try:
            existing = [c.name for c in client.get_collections().collections]
            if collection_name in existing:
                must_conditions = [
                    FieldCondition(
                        key='org_id',
                        match=MatchValue(value=str(org_id))
                    )
                ]
                if user_role and user_role != 'admin':
                    must_conditions.append(
                        FieldCondition(
                            key='allowed_roles',
                            match=MatchValue(value=user_role)
                        )
                    )
                if document_ids:
                    doc_id_strs = [str(d) for d in document_ids if d]
                    if doc_id_strs:
                        must_conditions.append(
                            FieldCondition(
                                key='document_id',
                                match=MatchAny(any=doc_id_strs)
                            )
                        )

                query_filter = Filter(must=must_conditions)

                results = client.query_points(
                    collection_name=collection_name,
                    query=query_vector,
                    query_filter=query_filter,
                    limit=top_k,
                    with_payload=True,
                )

                if results and results.points:
                    points_data = []
                    for r in results.points:
                        # Defense-in-depth tenant verification
                        point_org_id = r.payload.get('org_id')
                        if point_org_id and str(point_org_id) != str(org_id):
                            logger.error(f"SECURITY ALERT: Cross-tenant Qdrant leakage blocked! Expected {org_id}, got {point_org_id}")
                            continue

                        points_data.append({
                            'document_id':    r.payload.get('document_id', ''),
                            'document_title': r.payload.get('document_title', ''),
                            'chunk_index':    r.payload.get('chunk_index', 0),
                            'page_number':    r.payload.get('page_number', None),
                            'chunk_text':     r.payload.get('chunk_text', ''),
                            'score':          round(float(r.score), 4),
                        })
                    return points_data
        except Exception as e:
            logger.warning(f"Qdrant search failed, falling back to PostgreSQL: {e}")

    # High-Precision PostgreSQL Search Fallback
    import re
    import math
    from knowledge.models import DocumentChunk

    chunks_qs = DocumentChunk.objects.filter(
        org_id=org_id,
        document__is_deleted=False
    ).select_related('document')

    if document_ids:
        doc_id_strs = [str(d) for d in document_ids if d]
        if doc_id_strs:
            chunks_qs = chunks_qs.filter(document_id__in=doc_id_strs)

    # Filter roles
    valid_chunks = []
    for c in chunks_qs:
        doc_roles = [r.strip() for r in c.document.allowed_roles.split(',') if r.strip()]
        if not user_role or user_role == 'admin' or not doc_roles or user_role in doc_roles or 'all' in doc_roles:
            valid_chunks.append(c)

    if not valid_chunks:
        return []

    # Tokenize query_text
    query_tokens = [w.lower() for w in re.findall(r'\w+', query_text) if w.lower() not in STOPWORDS]
    if not query_tokens:
        query_tokens = [w.lower() for w in re.findall(r'\w+', query_text)]

    scored_chunks = []
    for c in valid_chunks:
        doc_title = c.document.title.lower()
        chunk_lower = c.chunk_text.lower()
        score = 0.0

        if query_tokens:
            for token in query_tokens:
                if token in doc_title:
                    score += 8.0
                matches = len(re.findall(r'\b' + re.escape(token) + r'\b', chunk_lower))
                if matches > 0:
                    score += math.log(1 + matches) * 3.0
                elif token in chunk_lower:
                    score += 0.2
        else:
            score = 1.0

        if score > 0:
            scored_chunks.append((score, c))

    if scored_chunks:
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        max_score = scored_chunks[0][0]
        
        # Relative drop-off threshold: must be within 50% of the top-ranking chunk
        threshold = max(2.0, max_score * 0.5)
        filtered = [item for item in scored_chunks if item[0] >= threshold]

        # Prioritize the dominant target document(s)
        top_doc_id = filtered[0][1].document_id
        top_doc_score = max_score

        final_items = []
        for score, c in filtered[:top_k]:
            if c.document_id != top_doc_id and score < top_doc_score * 0.8:
                continue
            final_items.append((score, c))

        return [
            {
                'document_id':    str(c.document_id),
                'document_title': c.document.title,
                'chunk_index':    c.chunk_index,
                'page_number':    c.page_number,
                'chunk_text':     c.chunk_text,
                'score':          round(min(0.99, max(0.65, score / 12.0 + 0.45)), 4),
            }
            for score, c in final_items
        ]

    # Fallback to most recent chunks if no tokens matched
    fallback_items = valid_chunks[:top_k]
    return [
        {
            'document_id':    str(c.document_id),
            'document_title': c.document.title,
            'chunk_index':    c.chunk_index,
            'page_number':    c.page_number,
            'chunk_text':     c.chunk_text,
            'score':          0.70,
        }
        for c in fallback_items
    ]


def delete_document_vectors(org_id: str, document_id: str):
    """Delete all Qdrant points for a given document."""
    client = _get_client()
    if not client:
        return

    from qdrant_client.models import Filter, FieldCondition, MatchValue
    collection_name = _collection_name(org_id)

    try:
        existing = [c.name for c in client.get_collections().collections]
        if collection_name in existing:
            client.delete(
                collection_name=collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key='document_id',
                            match=MatchValue(value=str(document_id))
                        )
                    ]
                )
            )
    except Exception as e:
        logger.warning(f"Qdrant delete_document_vectors failed: {e}")


def get_collection_count(org_id: str) -> int:
    """Return total number of vectors in this org's collection."""
    client = _get_client()
    if not client:
        from knowledge.models import DocumentChunk
        return DocumentChunk.objects.filter(org_id=org_id, document__is_deleted=False).count()

    collection_name = _collection_name(org_id)
    try:
        info = client.get_collection(collection_name)
        return info.points_count or 0
    except Exception:
        from knowledge.models import DocumentChunk
        return DocumentChunk.objects.filter(org_id=org_id, document__is_deleted=False).count()
