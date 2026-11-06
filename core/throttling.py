import logging
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

logger = logging.getLogger(__name__)


class SafeThrottleMixin:
    """
    Safely handles cache connection failures without crashing the application
    or blocking authentication when Redis or the cache layer is down.
    """
    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception as e:
            logger.warning(f"Throttling check bypassed due to cache error: {e}")
            return True

    def throttle_success(self):
        try:
            return super().throttle_success()
        except Exception as e:
            logger.warning(f"Throttling success record bypassed due to cache error: {e}")
            return True

    def throttle_failure(self):
        try:
            return super().throttle_failure()
        except Exception:
            return False


class AuthEndpointThrottle(SafeThrottleMixin, AnonRateThrottle):
    """
    Throttles unauthenticated authentication requests (login, register, token refresh)
    by client IP address to prevent brute-force attacks and credential stuffing.
    """
    scope = 'auth'


class SQLConsoleThrottle(SafeThrottleMixin, UserRateThrottle):
    """
    Throttles SQL Console query execution requests per superuser to prevent DoS.
    """
    scope = 'sql_console'


class SensitiveActionThrottle(SafeThrottleMixin, UserRateThrottle):
    """
    Throttles high-risk mutations (passkey changes, bulk delete, permissions).
    """
    scope = 'sensitive_action'

