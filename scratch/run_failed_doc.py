import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from knowledge.tasks import process_document
from knowledge.models import Document

def run_test():
    doc_id = '5b42108a-8326-4e60-b90f-f6d0d60f786a'
    doc = Document.objects.filter(id=doc_id).first()
    if not doc:
        print(f"Document {doc_id} not found in DB!")
        return

    print(f"Running pipeline synchronously for Document: {doc.title} ({doc.id})")
    try:
        result = process_document.run(str(doc.id))
        print("Pipeline result:", result)
    except Exception as e:
        import traceback
        print("Pipeline failed with exception:")
        traceback.print_exc()

if __name__ == '__main__':
    run_test()
