"""
common/throttling.py

Rate limits for the passwordless admin sign-in (QA-20). A 6-digit OTP has a
million values and no per-challenge attempt counter, so guessing must be
throttled. Rates live in settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"].
"""
from rest_framework.throttling import SimpleRateThrottle


class _PerIpThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class LoginIpThrottle(_PerIpThrottle):
    """POST /auth/login per client IP (limits email spam and enumeration probing)."""

    scope = "auth_login"


class VerifyIpThrottle(_PerIpThrottle):
    """POST /auth/verify per client IP."""

    scope = "auth_verify"


class VerifyEmailThrottle(SimpleRateThrottle):
    """
    POST /auth/verify per target email, across all IPs, so guessing one
    admin's code can't be spread over many addresses.
    """

    scope = "auth_verify_email"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower()
        if not email:
            return None
        return self.cache_format % {"scope": self.scope, "ident": email}
