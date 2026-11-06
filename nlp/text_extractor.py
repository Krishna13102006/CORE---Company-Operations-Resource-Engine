"""
text_extractor.py

Extracts raw text from PDF, DOCX, and TXT files.
Returns a single string of raw text.
Raises ValueError if extraction fails or file type is unsupported.

Phase 3 will feed this text into spaCy NER and KeyBERT keyword extraction.
This module has no knowledge of Django models, Celery, or NLP — it only reads files.
"""

import os


def extract_text(file_path: str, file_type: str) -> str:
    """
    Extract raw text from a document file.

    Args:
        file_path: Absolute path to the file on disk
        file_type: One of 'pdf', 'docx', 'txt'

    Returns:
        Raw text as a single string. May be empty if document has no extractable text.

    Raises:
        ValueError: If file does not exist, file type is unsupported, or extraction fails
    """
    if not os.path.exists(file_path):
        raise ValueError(f'File not found at path: {file_path}')

    if file_type == 'pdf':
        text = _extract_pdf(file_path)
    elif file_type == 'docx':
        text = _extract_docx(file_path)
    elif file_type == 'txt':
        text = _extract_txt(file_path)
    else:
        raise ValueError(f'Unsupported file type: {file_type}')

    # PostgreSQL character fields cannot store NUL (0x00) bytes.
    # Strip them out entirely to prevent database transaction aborts.
    return text.replace('\x00', '')


def _extract_pdf(file_path: str) -> str:
    """Extract text from PDF using pypdfium2 or pdfplumber fallback."""
    # 1. Try pypdfium2 (ultra-fast C-bindings)
    try:
        import pypdfium2 as pdfium
        text_parts = []
        with pdfium.PdfDocument(file_path) as pdf:
            for page in pdf:
                textpage = page.get_textpage()
                text = textpage.get_text_range()
                if text:
                    text_parts.append(text.strip())
        if text_parts:
            return '\n\n'.join(text_parts)
    except Exception:
        pass

    # 2. Try pdfplumber
    try:
        import pdfplumber
        text_parts = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text.strip())
        if text_parts:
            return '\n\n'.join(text_parts)
    except Exception:
        pass

    # 3. Try pypdf / PyPDF2
    try:
        import pypdf
        reader = pypdf.PdfReader(file_path)
        text_parts = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t.strip())
        if text_parts:
            return '\n\n'.join(text_parts)
    except Exception:
        pass

    return ""


def _extract_docx(file_path: str) -> str:
    """Extract text from DOCX using python-docx."""
    try:
        from docx import Document as DocxDocument
        doc = DocxDocument(file_path)
        paragraphs = []
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                paragraphs.append(text)
        return '\n\n'.join(paragraphs)
    except ImportError:
        raise ValueError('python-docx is not installed. Run: pip install python-docx')
    except Exception as e:
        raise ValueError(f'DOCX extraction failed: {str(e)}')


def _extract_txt(file_path: str) -> str:
    """Extract text from plain TXT file."""
    try:
        # Try UTF-8 first, fall back to latin-1 for legacy files
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='latin-1') as f:
                return f.read()
    except Exception as e:
        raise ValueError(f'TXT extraction failed: {str(e)}')


def extract_text_by_page(file_path: str, file_type: str) -> list:
    """
    Extract raw text from a document file page-by-page.
    Returns a list of dicts: [{'page_number': 1, 'text': '...'}, ...]
    """
    if not os.path.exists(file_path):
        raise ValueError(f'File not found at path: {file_path}')

    pages = []
    if file_type == 'pdf':
        # 1. Try pypdfium2
        try:
            import pypdfium2 as pdfium
            with pdfium.PdfDocument(file_path) as pdf:
                for idx, page in enumerate(pdf):
                    textpage = page.get_textpage()
                    text = textpage.get_text_range()
                    if text:
                        text = text.replace('\x00', '')
                        pages.append({
                            'page_number': idx + 1,
                            'text': text.strip()
                        })
            if pages:
                return pages
        except Exception:
            pass

        # 2. Try pdfplumber
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                for idx, page in enumerate(pdf.pages):
                    text = page.extract_text() or ""
                    text = text.replace('\x00', '').strip()
                    if text:
                        pages.append({
                            'page_number': idx + 1,
                            'text': text
                        })
            if pages:
                return pages
        except Exception:
            pass

        # 3. Try pypdf
        try:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            for idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                text = text.replace('\x00', '').strip()
                if text:
                    pages.append({
                        'page_number': idx + 1,
                        'text': text
                    })
            if pages:
                return pages
        except Exception:
            pass

        # If all PDF libraries failed to extract text (e.g. scanned image-only PDF), return empty page list safely
        return []

    elif file_type == 'docx':
        text = _extract_docx(file_path).replace('\x00', '')
        pages.append({'page_number': 1, 'text': text})
    elif file_type == 'txt':
        text = _extract_txt(file_path).replace('\x00', '')
        pages.append({'page_number': 1, 'text': text})
    else:
        raise ValueError(f'Unsupported file type: {file_type}')

    return pages
