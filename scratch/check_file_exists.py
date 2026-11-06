import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from knowledge.models import Document
from django.conf import settings

def check():
    doc_id = '5b42108a-8326-4e60-b90f-f6d0d60f786a'
    d = Document.objects.filter(id=doc_id).first()
    if d:
        abs_path = os.path.join(settings.MEDIA_ROOT, d.file_path)
        print("Document ID:", d.id)
        print("Title:", d.title)
        print("File Path in model:", d.file_path)
        print("Absolute path constructed:", abs_path)
        print("Does file exist on disk?", os.path.exists(abs_path))
    else:
        print("Document not found!")

if __name__ == '__main__':
    check()
