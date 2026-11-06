import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

import time
import torch
from sentence_transformers import SentenceTransformer

def test_threads():
    model = SentenceTransformer('all-MiniLM-L6-v2')
    texts = ["This is a test sentence for embedding generation speed comparison."] * 100
    
    for threads in [1, 2, 4]:
        torch.set_num_threads(threads)
        # Warmup
        model.encode(["Warmup text"], normalize_embeddings=True)
        
        t0 = time.time()
        model.encode(texts, normalize_embeddings=True, batch_size=64)
        dur = time.time() - t0
        print(f"Threads: {threads} | Duration for 100 sentences: {dur:.4f} seconds")

if __name__ == '__main__':
    test_threads()
