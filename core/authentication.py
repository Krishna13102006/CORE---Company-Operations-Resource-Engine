from rest_framework_simplejwt.authentication import JWTAuthentication


class JWTCookieAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication class that supports both Authorization Bearer headers
    and HttpOnly cookies, prioritizing Authorization headers for cross-origin SPAs.
    """
    def authenticate(self, request):
        # 1. First priority: Authorization header (most reliable for cross-origin SPAs)
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                try:
                    validated_token = self.get_validated_token(raw_token)
                    return self.get_user(validated_token), validated_token
                except Exception:
                    pass

        # 2. Second priority: Cookie named 'access_token'
        cookie_token = request.COOKIES.get('access_token')
        if cookie_token:
            try:
                validated_token = self.get_validated_token(cookie_token)
                return self.get_user(validated_token), validated_token
            except Exception:
                pass

        return None
