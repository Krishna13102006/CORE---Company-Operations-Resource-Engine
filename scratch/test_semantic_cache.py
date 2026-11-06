import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from ml.semantic_cache import SemanticCache
from nlp.embedding_generator import embed_text
from knowledge.services import RAGService

def run_test():
    print("Testing Redis Semantic Cache...")
    cache = SemanticCache()
    org_id = '21cfbe19-c7a4-439b-8e13-5f2ae743df45'
    
    # 1. Clear any existing cache for this org
    cache.invalidate_cache(org_id)
    
    # 2. Embed a test query
    q1 = "What is docker ?"
    emb1 = embed_text(q1)
    
    # 3. Check get (should be None since we cleared it)
    res = cache.get(org_id, emb1, user_role='admin')
    print("Initial cache get (should be None):", res)
    assert res is None, "Cache should be empty initially"
    
    # 4. Set query response in cache for admin
    answer = "Docker is a containerization platform."
    sources = [{'document_id': 'test-doc-id', 'document_title': 'Test Doc'}]
    cache.set(org_id, q1, answer, sources, emb1, user_role='admin')
    
    # 5. Check exact match get for admin (should hit)
    res_admin = cache.get(org_id, emb1, user_role='admin')
    print("Admin cache get (should HIT):", res_admin)
    assert res_admin is not None, "Cache get for admin failed"
    assert res_admin['answer'] == answer
    
    # 6. Check exact match get for employee (should MISS to prevent security leak)
    res_employee = cache.get(org_id, emb1, user_role='employee')
    print("Employee cache get (should MISS):", res_employee)
    assert res_employee is None, "Cache get leaked to employee!"
    
    # 7. Check semantic similarity match get for admin (should hit)
    q2 = "tell me about docker"
    emb2 = embed_text(q2)
    res_semantic = cache.get(org_id, emb2, threshold=0.90, user_role='admin')
    print("Semantic match cache get for admin (should HIT):", res_semantic)
    assert res_semantic is not None, "Cache semantic get for admin failed"
    assert res_semantic['answer'] == answer
    
    # 8. Invalidate cache
    cache.invalidate_cache(org_id)
    res_after_invalidation = cache.get(org_id, emb1, user_role='admin')
    print("Cache get after invalidation (should be None):", res_after_invalidation)
    assert res_after_invalidation is None, "Cache invalidation failed"
    
    print("ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    run_test()
