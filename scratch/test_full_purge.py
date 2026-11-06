import sys
import os
import time
import django

sys.path.insert(0, os.path.abspath('.'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from tenants.models import Organization
from tenants.services import OrgService

org = Organization.objects.first()
service = OrgService()

t0 = time.perf_counter()
stats = service.purge_test_storage(org_id=org.id)
elapsed = time.perf_counter() - t0

print(f"purge_test_storage took {elapsed:.4f} seconds!")
print(f"Stats: {stats}")
