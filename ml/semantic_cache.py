"""
ml/semantic_cache.py

Redis Semantic Cache helper for Knowledge Base RAG.
Stores previous questions and their answered payloads.
Uses cosine similarity on prompt embeddings to return cached matches.
"""

import redis
import json
import uuid
import math
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _cosine_similarity(v1, v2):
    dot_prod = sum(a * b for a, b in zip(v1, v2))
    mag1 = math.sqrt(sum(a * a for a in v1))
    mag2 = math.sqrt(sum(b * b for b in v2))
    if not mag1 or not mag2:
        return 0.0
    return dot_prod / (mag1 * mag2)


def _is_redis_available(host='localhost', port=6379, timeout=0.05) -> bool:
    import socket
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


class SemanticCache:

    def __init__(self):
        # Retrieve Redis settings, defaulting to local Redis dev configuration
        self.redis_host = getattr(settings, 'REDIS_HOST', 'localhost')
        self.redis_port = getattr(settings, 'REDIS_PORT', 6379)
        self.redis_db   = getattr(settings, 'REDIS_CACHE_DB', 2)

        if not _is_redis_available(self.redis_host, self.redis_port, timeout=0.05):
            self.client = None
            return

        try:
            self.client = redis.Redis(
                host=self.redis_host,
                port=self.redis_port,
                db=self.redis_db,
                socket_connect_timeout=0.05,
                socket_timeout=0.05,
                decode_responses=True
            )
        except Exception:
            self.client = None

    def get(self, org_id: str, query_vector: list, threshold: float = 0.92, user_role: str = None):
        """
        Check if a semantically similar query exists in the cache for the user's role.
        Returns the cached dictionary response or None.
        """
        if not self.client:
            return None

        try:
            role_key = user_role or 'employee'
            pattern = f"knowledge:cache:{org_id}:{role_key}:*"
            keys = self.client.keys(pattern)
            if not keys:
                return None

            best_match = None
            best_score = -1.0

            # Scan cached keys to check cosine similarity
            for key in keys:
                raw_data = self.client.get(key)
                if not raw_data:
                    continue

                try:
                    cached_entry = json.loads(raw_data)
                    cached_emb   = cached_entry.get('embedding')
                    if not cached_emb or len(cached_emb) != len(query_vector):
                        continue

                    similarity = _cosine_similarity(query_vector, cached_emb)
                    if similarity > best_score:
                        best_score = similarity
                        best_match = cached_entry
                except Exception as parse_err:
                    logger.warning(f"SemanticCache: Failed parsing key {key}: {parse_err}")
                    continue

            if best_score >= threshold:
                logger.info(f"SemanticCache: HIT for role {role_key}! Best similarity score: {best_score:.4f} (threshold: {threshold})")
                return {
                    'answer':   best_match['answer'],
                    'answered': best_match.get('answered', True),
                    'sources':  best_match['sources'],
                    'question': best_match['question'],
                }

            logger.info(f"SemanticCache: MISS for role {role_key}. Best similarity score: {best_score:.4f} (threshold: {threshold})")
            return None

        except Exception as e:
            logger.error(f"SemanticCache error during get: {e}")
            return None

    def set(self, org_id: str, question: str, answer: str, sources: list, query_vector: list, user_role: str = None, ttl: int = 86400):
        """
        Store a generated query response in the semantic cache partitioned by user role.
        """
        if not self.client:
            return False

        try:
            cache_id = str(uuid.uuid4())
            role_key = user_role or 'employee'
            key = f"knowledge:cache:{org_id}:{role_key}:{cache_id}"
            
            payload = {
                'question':  question,
                'answer':    answer,
                'sources':   sources,
                'embedding': query_vector,
            }
            
            self.client.setex(key, ttl, json.dumps(payload))
            logger.info(f"SemanticCache: Saved cached query key {key} for role {role_key} (TTL: {ttl}s)")
            return True
        except Exception as e:
            logger.error(f"SemanticCache error during set: {e}")
            return False

    def invalidate_cache(self, org_id: str):
        """
        Clear all cached query keys for the given organization.
        """
        if not self.client:
            return False

        try:
            pattern = f"knowledge:cache:{org_id}:*"
            keys = self.client.keys(pattern)
            if keys:
                self.client.delete(*keys)
                logger.info(f"SemanticCache: Invalidated {len(keys)} cached keys for org {org_id}")
            return True
        except Exception as e:
            logger.error(f"SemanticCache error during invalidation: {e}")
            return False
