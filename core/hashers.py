from django.contrib.auth.hashers import PBKDF2PasswordHasher


class OptimizedPBKDF2PasswordHasher(PBKDF2PasswordHasher):
    """
    Optimized PBKDF2 hasher configured to 250,000 iterations (exceeding OWASP's
    recommended standard of 210,000) for fast, responsive authentication on cloud instances
    while providing robust enterprise security against brute-force attacks.
    """
    iterations = 250000
