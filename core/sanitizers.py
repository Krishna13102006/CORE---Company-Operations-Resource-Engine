import re
import html
import bleach

ALLOWED_TAGS = [
    'a', 'abbr', 'acronym', 'b', 'blockquote', 'code', 'em', 'i', 'li', 'ol',
    'strong', 'ul', 'p', 'br', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'
]

ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target', 'rel'],
    'abbr': ['title'],
    'acronym': ['title'],
    'span': ['class'],
    'code': ['class'],
    'th': ['colspan', 'rowspan'],
    'td': ['colspan', 'rowspan'],
}

ALLOWED_PROTOCOLS = ['http', 'https', 'mailto']


def sanitize_html(content: str) -> str:
    """
    Sanitizes rich text / HTML input to prevent Stored & Reflected Cross-Site Scripting (XSS).
    Strips script tags, style blocks, event handlers (onclick/onerror/onload), iframe/embed tags, and javascript: URIs.
    """
    if not content:
        return ''

    # 1. Strip <script>...</script> and <style>...</style> content entirely
    pre_cleaned = re.sub(r'<script[\s\S]*?</script>', '', content, flags=re.IGNORECASE)
    pre_cleaned = re.sub(r'<style[\s\S]*?</style>', '', pre_cleaned, flags=re.IGNORECASE)

    # 2. Bleach HTML tags and attributes against allowlist
    cleaned = bleach.clean(
        pre_cleaned,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True
    )
    return cleaned.strip()


def sanitize_plain_text(content: str) -> str:
    """
    Completely strips script/style blocks and all HTML tags, leaving only plain text.
    """
    if not content:
        return ''
    pre_cleaned = re.sub(r'<script[\s\S]*?</script>', '', content, flags=re.IGNORECASE)
    pre_cleaned = re.sub(r'<style[\s\S]*?</style>', '', pre_cleaned, flags=re.IGNORECASE)
    cleaned = bleach.clean(pre_cleaned, tags=[], strip=True).strip()
    return html.unescape(re.sub(r'[ \t]+', ' ', cleaned).strip())
