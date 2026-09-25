"""Test helpers shared by the apps' API tests."""
import secrets
from datetime import timedelta

from django.utils import timezone

from authentication.models import AdminSession, AdminUser
from common.permissions.admin import ADMIN_SESSION_COOKIE_NAME, hash_session_token

API = "/api/v1"


def sign_in_as_admin(client, email="admin@auf.edu.ph", role=AdminUser.ROLE_SUPER_ADMIN):
    """Create an administrator and give `client` a valid session cookie for them."""
    admin, _ = AdminUser.objects.get_or_create(email=email, defaults={"full_name": "Ada Admin", "role": role})
    token = secrets.token_urlsafe(32)
    AdminSession.objects.create(
        admin_user=admin,
        session_token_hash=hash_session_token(token),
        expires_at=timezone.now() + timedelta(days=1),
    )
    client.cookies[ADMIN_SESSION_COOKIE_NAME] = token
    return admin


def data(response):
    """The `data` of a success envelope ({"success": true, "data": ...})."""
    body = response.json()
    assert body["success"] is True, body
    return body["data"]


def meta(response):
    """The pagination `meta` of a paginated success envelope."""
    return response.json()["meta"]


def error(response):
    """The `error` of an error envelope ({"success": false, "error": {"code", "message"}})."""
    body = response.json()
    assert body["success"] is False, body
    return body["error"]
