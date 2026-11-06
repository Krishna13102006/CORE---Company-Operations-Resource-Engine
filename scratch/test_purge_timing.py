import time
import os
import django

import sys
sys.path.insert(0, os.path.abspath('.'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from tenants.models import Organization
from tenants.services import OrgService

org = Organization.objects.first()
print(f"Testing purge for org: {org.name} ({org.id})")

t0 = time.time()
from knowledge.models import Document as KDoc, DocumentChunk
chunks_count = DocumentChunk.objects.filter(document__org_id=org.id).count()
docs_count = KDoc.objects.filter(org_id=org.id).count()
print(f"Step 1 DB count docs: {docs_count}, chunks: {chunks_count} (time: {time.time()-t0:.3f}s)")

t0 = time.time()
try:
    from ml.search_engine import delete_org_vectors
    res = delete_org_vectors(str(org.id))
    print(f"Step 2 Qdrant delete_org_vectors: {res} (time: {time.time()-t0:.3f}s)")
except Exception as e:
    print(f"Step 2 Qdrant failed: {e} (time: {time.time()-t0:.3f}s)")

t0 = time.time()
from expenses.models import ExpenseClaim
exp_count = ExpenseClaim.objects.filter(org_id=org.id).count()
print(f"Step 3 Expenses count: {exp_count} (time: {time.time()-t0:.3f}s)")

t0 = time.time()
from hiring.models import Candidate
h_count = Candidate.objects.filter(org_id=org.id).count()
print(f"Step 4 Hiring count: {h_count} (time: {time.time()-t0:.3f}s)")

t0 = time.time()
from meetings.models import Meeting
m_count = Meeting.objects.filter(org_id=org.id).count()
print(f"Step 5 Meetings count: {m_count} (time: {time.time()-t0:.3f}s)")
