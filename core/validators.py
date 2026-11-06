import re
import unicodedata
from rest_framework.exceptions import ValidationError


# Zero-width, invisible, and format control unicode characters
INVISIBLE_CHARS_REGEX = re.compile(
    r'[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060-\u206F\u00A0\u180E\uFFF9-\uFFFB]'
)

# HTML tag detection regex
HTML_TAG_REGEX = re.compile(r'<[^>]*>')


def sanitize_string(text: str) -> str:
    """
    Strips invisible unicode, control characters, and excess whitespace.
    """
    if not text:
        return ''
    # Normalize unicode to NFKC
    normalized = unicodedata.normalize('NFKC', str(text))
    # Remove invisible zero-width characters
    cleaned = INVISIBLE_CHARS_REGEX.sub('', normalized)
    # Remove control characters except normal whitespace
    cleaned = ''.join(c for c in cleaned if unicodedata.category(c) != 'Cc')
    # Collapse multiple consecutive spaces
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def is_emoji_or_symbol(char: str) -> bool:
    """
    Determines if a unicode character is an emoji, pictograph, or decorative symbol.
    """
    cat = unicodedata.category(char)
    # So = Symbol, other (covers emojis, pictographs, dingbats)
    # Sk = Symbol, modifier (covers emoji skin tones, modifiers)
    # Sm = Symbol, math
    # Sc = Symbol, currency
    # Cs = Surrogate
    # Co = Private use
    if cat in ('So', 'Sk', 'Cs', 'Co'):
        return True
    
    # Check explicit emoji ranges (including pictographs, emoticons, transport, supplemental)
    code = ord(char)
    if (
        (0x1F600 <= code <= 0x1F64F) or  # Emoticons
        (0x1F300 <= code <= 0x1F5FF) or  # Misc Symbols and Pictographs
        (0x1F680 <= code <= 0x1F6FF) or  # Transport and Map
        (0x1F700 <= code <= 0x1F77F) or  # Alchemical
        (0x1F780 <= code <= 0x1F7FF) or  # Geometric Shapes Extended
        (0x1F800 <= code <= 0x1F8FF) or  # Supplemental Arrows-C
        (0x1F900 <= code <= 0x1F9FF) or  # Supplemental Symbols and Pictographs
        (0x1FA00 <= code <= 0x1FA6F) or  # Chess Symbols
        (0x1FA70 <= code <= 0x1FAFF) or  # Symbols and Pictographs Extended-A
        (0x2600  <= code <= 0x26FF)  or  # Misc symbols (sun, umbrella, etc.)
        (0x2700  <= code <= 0x27BF)  or  # Dingbats (checkmarks, crosses, arrows)
        (0x2B50  <= code <= 0x2B55)  or  # Stars
        (0x2300  <= code <= 0x23FF)  or  # Misc Technical
        (0x2B05  <= code <= 0x2B07)  or  # Arrows
        (0x2934  <= code <= 0x2935)  or  # Arrows
        (0x3297  <= code <= 0x3299)      # Circled ideographs
    ):
        return True
    return False


def validate_and_clean_name(value: str, field_label: str = 'Name', min_length: int = 1, max_length: int = 50) -> str:
    """
    Strict validator for person names (First Name, Last Name).
    - Disallows emojis, symbols, HTML tags, script injection, control characters.
    - Allows letters (Unicode international letters), hyphens, apostrophes, and spaces.
    - Requires at least 1 alphabetic character (disallows purely punctuation/numeric names).
    """
    if not value or not str(value).strip():
        raise ValidationError(f"{field_label} is required.")

    cleaned = sanitize_string(value)

    if HTML_TAG_REGEX.search(cleaned):
        raise ValidationError(f"{field_label} cannot contain HTML or script tags.")

    if len(cleaned) < min_length:
        raise ValidationError(f"{field_label} must be at least {min_length} character(s) long.")
    if len(cleaned) > max_length:
        raise ValidationError(f"{field_label} cannot exceed {max_length} characters.")

    # Check for emojis or disallowed symbol characters
    for char in cleaned:
        if is_emoji_or_symbol(char):
            raise ValidationError(
                f"{field_label} cannot contain emojis or decorative symbols."
            )

    # Validate character composition: Letters (all languages), spaces, hyphens, apostrophes, periods
    has_letter = False
    for char in cleaned:
        cat = unicodedata.category(char)
        if cat.startswith('L'):  # Lu, Ll, Lt, Lm, Lo (Letters)
            has_letter = True
        elif char in " -'.":
            continue
        else:
            raise ValidationError(
                f"{field_label} can only contain letters, spaces, hyphens, and apostrophes."
            )

    if not has_letter:
        raise ValidationError(f"{field_label} must contain at least one letter.")

    return cleaned


def validate_and_clean_org_name(value: str, field_label: str = 'Organization name', min_length: int = 2, max_length: int = 100) -> str:
    """
    Validator for organization, department, and company names.
    Allows letters, numbers, spaces, and common business punctuation (&, -, ., ', ,, /).
    Disallows emojis and script injection.
    """
    if not value or not str(value).strip():
        raise ValidationError(f"{field_label} is required.")

    cleaned = sanitize_string(value)

    if HTML_TAG_REGEX.search(cleaned):
        raise ValidationError(f"{field_label} cannot contain HTML or script tags.")

    if len(cleaned) < min_length:
        raise ValidationError(f"{field_label} must be at least {min_length} characters long.")
    if len(cleaned) > max_length:
        raise ValidationError(f"{field_label} cannot exceed {max_length} characters.")

    # Disallow emojis
    for char in cleaned:
        if is_emoji_or_symbol(char):
            raise ValidationError(f"{field_label} cannot contain emojis or symbols.")

    # Must contain at least one alphanumeric character
    has_alnum = any(unicodedata.category(c).startswith('L') or c.isdigit() for c in cleaned)
    if not has_alnum:
        raise ValidationError(f"{field_label} must contain alphanumeric characters.")

    return cleaned


def validate_uploaded_file(file_obj, allowed_types=('pdf', 'docx', 'txt', 'md'), max_size_mb=50) -> str:
    """
    Validates uploaded file size, extension, and sanitizes filename against path traversal.
    Returns safe sanitized filename string.
    """
    import os
    if not file_obj:
        raise ValidationError('No file provided.')

    name = getattr(file_obj, 'name', '') or 'document'
    # Sanitize filename: strip path traversal and control characters
    safe_name = os.path.basename(name).replace('\\', '/').split('/')[-1]
    safe_name = re.sub(r'[^a-zA-Z0-9._ -]', '_', safe_name).strip()
    if not safe_name:
        safe_name = 'uploaded_document'

    ext = os.path.splitext(safe_name)[1].lower().lstrip('.')
    if allowed_types and ext not in allowed_types:
        raise ValidationError(f'Unsupported file format .{ext}. Allowed formats: {", ".join(allowed_types)}')

    file_size = getattr(file_obj, 'size', 0)
    max_bytes = max_size_mb * 1024 * 1024
    if file_size > max_bytes:
        raise ValidationError(f'File size ({file_size / (1024*1024):.1f}MB) exceeds maximum limit of {max_size_mb}MB.')

    return safe_name
