import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

import time
from knowledge.models import Document
from django.conf import settings

def test_speed():
    doc = Document.objects.filter(title__icontains='pythonnotes').first()
    if not doc:
        print("Document not found!")
        return

    file_path = os.path.join(settings.MEDIA_ROOT, doc.file_path)
    print(f"Testing speed on PDF: {file_path}")

    # 1. Test pdfplumber
    try:
        t0 = time.time()
        import pdfplumber
        text_parts = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
        raw_text_plumber = '\n\n'.join(text_parts)
        dur_plumber = time.time() - t0
        print(f"pdfplumber: Extracted {len(raw_text_plumber)} chars in {dur_plumber:.2f} seconds")
    except Exception as e:
        print("pdfplumber failed:", e)

    # 2. Test pypdfium2
    try:
        t0 = time.time()
        import pypdfium2 as pdfium
        text_parts = []
        pdf = pdfium.PdfDocument(file_path)
        for page in pdf:
            textpage = page.get_textpage()
            text = textpage.get_text_range()
            if text:
                text_parts.append(text)
        raw_text_pdfium = '\n\n'.join(text_parts)
        dur_pdfium = time.time() - t0
        print(f"pypdfium2: Extracted {len(raw_text_pdfium)} chars in {dur_pdfium:.2f} seconds")
    except Exception as e:
        print("pypdfium2 failed:", e)

if __name__ == '__main__':
    test_speed()
