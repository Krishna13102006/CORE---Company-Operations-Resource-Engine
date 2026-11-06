"""
embedding_generator.py

Text embedding using Google Gemini Cloud Embeddings API (models/gemini-embedding-001).
Converts text strings into 768-dimensional float vectors with zero server RAM footprint.

Used in two places:
  1. During document processing (Celery task) — embed each chunk
  2. During search/RAG (query time) — embed the user's question

The same model must be used for both document chunks and queries.
Model: models/gemini-embedding-001 (output_dimensionality: 768)
  - 768 dimensions
  - Zero RAM usage on Render web server (pure HTTP REST JSON)
  - Ultra-fast batching via batchEmbedContents
  - Distance metric: cosine similarity
"""

import os
import json
import logging
import urllib.request
import urllib.error
import time
from typing import List
from django.conf import settings

logger = logging.getLogger(__name__)

VECTOR_DIMENSION = 768
DEFAULT_EMBEDDING_MODEL = "models/gemini-embedding-001"


def _get_api_key() -> str:
    """Retrieve Gemini API key from Django settings or environment."""
    key = ""
    try:
        if settings.configured:
            key = getattr(settings, 'GEMINI_API_KEY', '')
    except Exception:
        pass
    if not key:
        key = os.getenv('GEMINI_API_KEY', '')
    return key.strip()


def _generate_fallback_vector(text: str) -> List[float]:
    """
    Generate a deterministic 768-dimensional normalized embedding vector
    using term hashing and positional frequency.
    Ensures zero-crash offline and keyless operation.
    """
    import math
    import hashlib
    
    vec = [0.0] * VECTOR_DIMENSION
    if not text or not text.strip():
        return vec

    words = text.lower().split()
    for i, word in enumerate(words):
        # Hash word to multiple vector indices
        h = int(hashlib.md5(word.encode('utf-8')).hexdigest(), 16)
        idx1 = h % VECTOR_DIMENSION
        idx2 = (h >> 8) % VECTOR_DIMENSION
        idx3 = (h >> 16) % VECTOR_DIMENSION
        
        weight = 1.0 / (1.0 + math.log(1 + i * 0.1))
        vec[idx1] += weight
        vec[idx2] += weight * 0.5
        vec[idx3] += weight * 0.25

    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [round(x / norm, 6) for x in vec]
    return vec


def embed_text(text: str) -> List[float]:
    """
    Embed a single text string using Google Gemini API or deterministic fallback.

    Args:
        text: Text to embed

    Returns:
        List of 768 floats representing the text's meaning vector.
    """
    if not text or not text.strip():
        return [0.0] * VECTOR_DIMENSION

    try:
        results = embed_batch([text])
        if results and results[0]:
            return results[0]
    except Exception as e:
        logger.warning(f"embed_text falling back to local vector synthesis: {e}")

    return _generate_fallback_vector(text)


def embed_batch(texts: List[str]) -> List[List[float]]:
    """
    Embed a list of texts in memory-safe and rate-safe batches using Gemini API.
    Falls back to deterministic vector generation if Gemini API is unconfigured or unavailable.
    """
    if not texts:
        return []

    # Clean and sanitize texts
    sanitized = [t.strip() if (t and t.strip()) else " " for t in texts]

    api_key = _get_api_key()
    if not api_key:
        return [_generate_fallback_vector(t) for t in sanitized]

    all_embeddings: List[List[float]] = []
    chunk_batch_size = 30  # Safe batch size per HTTP request

    for i in range(0, len(sanitized), chunk_batch_size):
        sub_batch = sanitized[i:i + chunk_batch_size]
        url = f"https://generativelanguage.googleapis.com/v1beta/{DEFAULT_EMBEDDING_MODEL}:batchEmbedContents?key={api_key}"

        requests_payload = [
            {
                "model": DEFAULT_EMBEDDING_MODEL,
                "content": {"parts": [{"text": t}]},
                "output_dimensionality": VECTOR_DIMENSION
            }
            for t in sub_batch
        ]

        payload_bytes = json.dumps({"requests": requests_payload}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload_bytes,
            headers={"Content-Type": "application/json"}
        )

        max_retries = 2
        success = False

        for attempt in range(max_retries):
            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    res_json = json.loads(response.read().decode("utf-8"))
                    embeddings = [item["values"] for item in res_json.get("embeddings", [])]
                    if len(embeddings) == len(sub_batch):
                        all_embeddings.extend(embeddings)
                        success = True
                        break
            except Exception as e:
                logger.warning(f"Gemini embedding attempt {attempt + 1} failed: {e}")
                time.sleep(0.5)

        if not success:
            logger.warning("Gemini batch embedding failed, using deterministic local vectors.")
            all_embeddings.extend([_generate_fallback_vector(t) for t in sub_batch])

    return all_embeddings
