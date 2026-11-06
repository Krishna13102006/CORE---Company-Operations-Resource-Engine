import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

import pypdfium2 as pdfium
from knowledge.models import Document
from django.conf import settings

def test():
    # Let's inspect the last PDF
    doc = Document.objects.filter(file_type='pdf', is_deleted=False).order_by('-created_at').first()
    if not doc:
        print("No PDF document found!")
        return

    print("Document ID:", doc.id)
    print("File path:", doc.file_path)
    absolute_path = os.path.join(settings.MEDIA_ROOT, doc.file_path)
    print("Absolute path:", absolute_path)
    print("Does file exist?", os.path.exists(absolute_path))

    # Test PDF loading and page count
    try:
        pdf = pdfium.PdfDocument(absolute_path)
        print("Success loading pdf, length =", len(pdf))
        pdf.close()
    except Exception as e:
        import traceback
        print("Failed loading pdf:")
        traceback.print_exc()

if __name__ == '__main__':
    test()
