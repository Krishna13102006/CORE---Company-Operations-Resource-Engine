"""
hiring_search.py

Vector operations for the ATS / Hiring pipeline.
Used for semantic matching between candidate resumes and job descriptions.
"""

import socket
import logging
import uuid as uuid_lib
from typing import List, Dict, Optional
from django.conf import settings

logger = logging.getLogger(__name__)

_hiring_qdrant_client_cache = None
_hiring_qdrant_checked = False


def _is_qdrant_server_running(host="localhost", port=6333, timeout=0.05) -> bool:
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return True
    except Exception:
        return False


def _get_client():
    global _hiring_qdrant_client_cache, _hiring_qdrant_checked
    if _hiring_qdrant_checked:
        return _hiring_qdrant_client_cache

    _hiring_qdrant_checked = True
    host = getattr(settings, 'QDRANT_HOST', 'localhost')
    port = getattr(settings, 'QDRANT_PORT', 6333)
    api_key = getattr(settings, 'QDRANT_API_KEY', None)

    try:
        from qdrant_client import QdrantClient
        if host.startswith('http://') or host.startswith('https://'):
            client = QdrantClient(url=host, api_key=api_key, timeout=3.0)
            _hiring_qdrant_client_cache = client
            return client
        elif _is_qdrant_server_running(host, port, timeout=0.05):
            client = QdrantClient(host=host, port=int(port), api_key=api_key, timeout=1.0)
            _hiring_qdrant_client_cache = client
            return client
    except Exception as e:
        logger.warning(f"Could not initialize Hiring Qdrant client: {e}")

    _hiring_qdrant_client_cache = None
    return None


def _collection_name(org_id: str) -> str:
    return f'hiring_{org_id}'


def ensure_hiring_collection(org_id: str):
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
            try:
                client.create_payload_index(
                    collection_name=collection_name,
                    field_name="org_id",
                    field_schema="keyword",
                )
            except Exception:
                pass
    except Exception as e:
        logger.warning(f"Qdrant ensure_hiring_collection failed: {e}")


def store_resume_vector(
        org_id: str,
        candidate_id: str,
        candidate_name: str,
        embedding: List[float],
) -> str:
    if not org_id:
        raise ValueError("org_id is strictly required for store_resume_vector")

    client = _get_client()
    point_id = str(uuid_lib.uuid4())

    if not client:
        return point_id

    from qdrant_client.models import PointStruct

    ensure_hiring_collection(org_id)
    collection_name = _collection_name(org_id)

    try:
        client.upsert(
            collection_name=collection_name,
            points=[
                PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={
                        'candidate_id':   str(candidate_id),
                        'candidate_name': candidate_name,
                        'org_id':         str(org_id),
                    }
                )
            ]
        )
    except Exception as e:
        logger.warning(f"Qdrant store_resume_vector failed: {e}")

    return point_id


def compute_semantic_match_score(
        org_id: str,
        resume_embedding: List[float],
        job_embedding: List[float],
) -> float:
    import numpy as np
    a = np.array(resume_embedding)
    b = np.array(job_embedding)

    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    similarity = float(np.dot(a, b) / (norm_a * norm_b))
    return max(0.0, min(1.0, similarity))


def delete_resume_vector(org_id: str, point_id: str):
    client = _get_client()
    if not client or not point_id:
        return

    collection_name = _collection_name(org_id)
    try:
        existing = [c.name for c in client.get_collections().collections]
        if collection_name in existing:
            client.delete(
                collection_name=collection_name,
                points_selector=[point_id],
            )
    except Exception:
        pass
