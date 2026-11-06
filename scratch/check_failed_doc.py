import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from knowledge.models import Document
from django.conf import settings

def check():
    docs = Document.objects.filter(is_deleted=False).order_by('-created_at')[:5]
    for d in docs:
        print(f"ID: {d.id} | Title: {d.title} | Status: {d.status} | Size: {d.file_size}")
        # If there's metadata
        try:
            print(f"  Metadata: category={d.metadata.category}, keywords={d.metadata.keywords[:3] if d.metadata.keywords else 'None'}")
        except Exception as e:
            print("  No metadata record found or failed:", e)

if __name__ == '__main__':
    check()
