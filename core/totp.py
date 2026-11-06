import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote
from django.contrib.auth.hashers import make_password, check_password


def generate_totp_secret() -> str:
    """Generate a random 32-character base32 TOTP secret."""
    raw_bytes = secrets.token_bytes(20)
    return base64.b32encode(raw_bytes).decode('utf-8').rstrip('=')


def get_totp_uri(secret: str, account_name: str, issuer: str = "CORE") -> str:
    """Generate otpauth:// URI for authenticator apps (Google Authenticator, Authy, Apple)."""
    return f"otpauth://totp/{quote(issuer)}:{quote(account_name)}?secret={secret}&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period=30"


def generate_qr_code_data_uri(otpauth_url: str) -> str:
    """Generate a base64 PNG data URI from an otpauth:// URI for instant <img> rendering."""
    try:
        import qrcode
        import io
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=6,
            border=2,
        )
        qr.add_data(otpauth_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        b64_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{b64_str}"
    except Exception:
        return ""


def _generate_totp_code_for_time(secret: str, for_time: float, interval: int = 30, digits: int = 6) -> str:
    padding = '=' * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode((secret + padding).upper(), casefold=True)
    counter = int(for_time // interval)
    msg = struct.pack('>Q', counter)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    offset = h[-1] & 0x0F
    code = struct.unpack('>I', h[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10 ** digits)).zfill(digits)


def verify_totp(secret: str, token: str, window: int = 1) -> bool:
    """
    Verify a 6-digit TOTP token against a secret.
    Allows window=1 (current +/- 30s) to tolerate slight client/server clock drift.
    """
    if not secret or not token:
        return False
    clean_token = str(token).strip()
    if len(clean_token) != 6 or not clean_token.isdigit():
        return False

    current_time = time.time()
    for offset in range(-window, window + 1):
        expected_code = _generate_totp_code_for_time(secret, current_time + (offset * 30))
        if hmac.compare_digest(expected_code, clean_token):
            return True
    return False


def generate_backup_codes(count: int = 8):
    """
    Generate readable 8-character backup codes (e.g. 'a1b2-c3d4').
    Returns (raw_codes_list, hashed_codes_list).
    """
    raw_codes = []
    hashed_codes = []
    for _ in range(count):
        code = f"{secrets.token_hex(2)}-{secrets.token_hex(2)}"
        raw_codes.append(code)
        hashed_codes.append(make_password(code))
    return raw_codes, hashed_codes


def verify_and_consume_backup_code(user, submitted_code: str) -> bool:
    """
    Check if submitted_code matches one of the user's stored backup codes.
    If matched, remove that code from storage and return True.
    """
    if not submitted_code or not getattr(user, 'two_factor_backup_codes', None):
        return False

    submitted_clean = submitted_code.strip()
    codes = list(user.two_factor_backup_codes)
    for idx, stored_hash in enumerate(codes):
        if check_password(submitted_clean, stored_hash):
            codes.pop(idx)
            user.two_factor_backup_codes = codes
            user.save(update_fields=['two_factor_backup_codes'])
            return True
    return False
