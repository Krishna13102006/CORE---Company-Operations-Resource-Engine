import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from knowledge.views import DocumentContentView
from knowledge.models import Document
from django.contrib.auth import get_user_model

def test():
    # Let's inspect the last PDF
    doc = Document.objects.filter(file_type='pdf', is_deleted=False).order_by('-created_at').first()
    if not doc:
        print("No PDF document found!")
        return

    User = get_user_model()
    user = User.objects.filter(role='admin').first()
    if not user:
        print("No user found!")
        return

    factory = APIRequestFactory()
    request = factory.get(f'/api/knowledge/documents/{doc.id}/content/')
    request.org_id = doc.org_id
    force_authenticate(request, user=user)

    view = DocumentContentView.as_view()
    response = view(request, document_id=str(doc.id))
    print("API Response Status:", response.status_code)
    
    # Print only keys and page count
    data = response.data
    for k, v in data.items():
        if k == 'content':
            print(f"Key: {k} | Length: {len(v)}")
        else:
            print(f"Key: {k} | Value: {v}")

if __name__ == '__main__':
    test()
