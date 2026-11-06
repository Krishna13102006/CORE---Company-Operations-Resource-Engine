import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

import traceback
from knowledge.models import Document
from knowledge.tasks import process_document

def run_test():
    docs = Document.objects.filter(is_deleted=False)
    if not docs.exists():
        print("No documents found!")
        return

    for doc in docs:
        print(f"Running pipeline synchronously for Document: {doc.title} ({doc.id})")
        try:
            # Call process_document task method directly, bypassing celery queue
            result = process_document.run(str(doc.id))
            print("Pipeline result:", result)
        except Exception as e:
            print(f"Pipeline failed for {doc.title}: {str(e)}")
            traceback.print_exc()

if __name__ == '__main__':
    run_test()
