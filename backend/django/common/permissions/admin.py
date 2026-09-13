"""
common/permissions/admin.py

Permission classes gating admin-only endpoints, backed by the
AdminSessionCookie described in the Authentication design (passwordless
admin login -> operations.admin_sessions row -> long-lived secure HTTP
cookie holding a raw session token).

These are self-contained: they don't rely on DRF's authentication framework
(no matching entry in DEFAULT_AUTHENTICATION_CLASSES is required). Each
class reads the cookie, hashes the token, looks up the session, validates
it, and stashes the resolved admin user/session on the request for
downstream code.
"""
import hashlib

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import NotAuthenticated, PermissionDenied
from rest_framework.permissions import BasePermission

from authentication.models import AdminSession, AdminUser

# NOTE: this really belongs in common/constants alongside the rest of
# FlowSense's shared config constants — left as a settings-driven default
# here so it's overridable per-environment without touching this file.
ADMIN_SESSION_COOKIE_NAME = getattr(
    settings, "ADMIN_SESSION_COOKIE_NAME", "flowsense_admin_session"
)


def hash_session_token(raw_token: str) -> str:
    """
    Hashes a raw session token the same way the login flow must before
    writing it to operations.admin_sessions.session_token_hash. Centralized
    here (rather than duplicated in the authentication app's login service
    and this permission class) so the two sides can never drift out of
    sync on hashing algorithm.

    NOTE (business logic): issuing the raw token, setting the cookie, and
    creating the AdminSession row happens in the authentication app's own
    service layer (POST /auth/login, /auth/verify) — not here. This helper
    only covers the one piece of logic both sides must agree on.
    """
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _resolve_admin_session(request) -> AdminSession:
    """
    Reads the AdminSessionCookie off `request`, validates it, and returns
    the matching AdminSession. Raises a DRF exception (caught and turned
    into the appropriate 401/403 response) if the cookie is missing or the
    session is invalid, revoked, expired, or belongs to a disabled admin.

    Shared by every permission class in this module so validation logic
    lives in exactly one place.
    """
    raw_token = request.COOKIES.get(ADMIN_SESSION_COOKIE_NAME)
    if not raw_token:
        raise NotAuthenticated("No administrator session cookie was provided.")

    token_hash = hash_session_token(raw_token)

    try:
        session = AdminSession.objects.select_related("admin_user").get(
            session_token_hash=token_hash
        )
    except AdminSession.DoesNotExist:
        raise NotAuthenticated("Administrator session is invalid.")

    if not session.is_active:
        raise NotAuthenticated("Administrator session has been revoked.")

    if session.expires_at <= timezone.now():
        raise NotAuthenticated("Administrator session has expired.")

    admin_user = session.admin_user
    if admin_user is None or not admin_user.is_active or admin_user.deleted_at is not None:
        raise PermissionDenied("Administrator account is disabled.")

    return session


class IsAdminUser(BasePermission):
    """
    Grants access only to requests carrying a valid AdminSessionCookie tied
    to an active administrator. Use this on any endpoint the Authentication
    scope table marks as Admin-only (Map write actions, Annotation,
    Hardware, Assets, Analytics, Alerts, Activity, Settings, most of
    System).

    On success, sets:
      request.admin_user     -> authentication.models.AdminUser instance
      request.admin_session  -> authentication.models.AdminSession instance
    so views/services downstream (e.g. audit-trail logging) don't have to
    re-resolve the session.
    """

    message = "A valid administrator session is required."

    def has_permission(self, request, view):
        session = _resolve_admin_session(request)
        request.admin_user = session.admin_user
        request.admin_session = session
        return True


class IsSuperAdminUser(IsAdminUser):
    """
    Same as IsAdminUser, plus requires the 'super admin' role. Per the
    Admin Overview notes, User Management is "only accessible by super
    admins" — use this instead of IsAdminUser on the Users API
    (GET/POST/PATCH/DELETE /api/v1/users*).
    """

    message = "A super administrator session is required."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.admin_user.role != AdminUser.ROLE_SUPER_ADMIN:
            raise PermissionDenied(self.message)
        return True