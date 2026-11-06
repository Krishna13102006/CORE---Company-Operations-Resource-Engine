import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

import pypdfium2 as pdfium
from knowledge.models import Document
from django.conf import settings
import concurrent.futures
import threading

render_lock = threading.Lock()

def render_page(doc_path, page_idx):
    try:
        with render_lock:
            with pdfium.PdfDocument(doc_path) as pdf:
                page = pdf[page_idx]
                bitmap = page.render(scale=1.5)
                pil_img = bitmap.to_pil()
                import io
                buf = io.BytesIO()
                pil_img.save(buf, format='JPEG')
                return f"Page {page_idx} rendered successfully: {len(buf.getvalue())} bytes"
    except Exception as e:
        return f"Page {page_idx} failed: {str(e)}"

def test():
    doc = Document.objects.filter(file_type='pdf', is_deleted=False).order_by('-created_at').first()
    if not doc:
        print("No PDF document found!")
        return

    doc_path = os.path.join(settings.MEDIA_ROOT, doc.file_path)
    print("Testing document with render_lock:", doc_path)

    # Let's render page 0 to 20 concurrently
    print("--- Concurrent Render with Lock ---")
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(render_page, doc_path, i) for i in range(15)]
        for fut in concurrent.futures.as_completed(futures):
            print(fut.result())

if __name__ == '__main__':
    test()
