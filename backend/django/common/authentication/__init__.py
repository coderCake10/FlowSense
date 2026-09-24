"""
common/authentication

DRF authentication for the AdminSessionCookie.

Session validation itself lives in common.permissions (IsAdminUser resolves
and validates the cookie). This class exists for one reason: DRF only answers
"not authenticated" with HTTP 401 when the first authentication class
provides a WWW-Authenticate challenge; otherwise it downgrades to 403. The
admin frontend needs a reliable 401 to redirect to the sign-in page, and the
challenge must not be "Basic" (browsers would pop up a password dialog).
"""
from rest_framework.authentication import BaseAuthentication


class AdminSessionCookieAuthentication(BaseAuthentication):
    def authenticate(self, request):
        # Deliberately anonymous here; permission classes validate the cookie.
        return None

    def authenticate_header(self, request):
        return 'AdminSession realm="flowsense"'
