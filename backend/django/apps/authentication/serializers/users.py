"""
apps/authentication/serializers/users.py

Backs the Users API:
  GET    /api/v1/users
  POST   /api/v1/users
  GET    /api/v1/users/{id}
  PATCH  /api/v1/users/{id}
  DELETE /api/v1/users/{id}   (no serializer needed — see views)

`AdminUserSerializer` is also reused directly for GET /auth/me (see
auth.py) — "the profile, role, and identity of the currently logged-in
administrator" is exactly the same shape as looking up any other admin by
id, so there's no separate profile-only serializer duplicating these
fields.

There's no separate "list" vs "detail" split here (unlike, say, map's
Area/Room) because operations.admin_users has no expensive fields
(no geometry, no image, no long free-text column) worth trimming for a
list view — the User Registry Table shows nearly every field anyway (per
the Admin User Management notes: Name, Email, Role, Status).
"""
from rest_framework import serializers

from authentication.models import AdminUser


class AdminUserSerializer(serializers.ModelSerializer):
    """Read shape for GET /users, GET /users/{id}, and GET /auth/me."""

    class Meta:
        model = AdminUser
        fields = [
            "id",
            "full_name",
            "email",
            "role",
            "is_active",
            "created_at",
            "updated_at",
            "last_login_at",
        ]
        read_only_fields = fields


class AdminUserCreateSerializer(serializers.ModelSerializer):
    """
    POST /users.

    No password field — FlowSense authentication is passwordless (see the
    Authentication design notes). Creating an admin here only registers
    their identity; their first login happens through the normal
    POST /auth/login -> POST /auth/verify flow once this row exists.

    Field-level validation only (role is a real choice, email is
    well-formed and unique via the model's own constraint).

    NOTE (business logic) — lives in a service, not here:
      - Sending any "you've been added as an administrator" notification
        email (Celery, given the stack).
      - Logging this creation to analytics.AuditEvent
        (event_type='administrative').
    """

    class Meta:
        model = AdminUser
        fields = ["full_name", "email", "role"]

    def validate_role(self, value):
        valid_roles = {choice for choice, _ in AdminUser.ROLE_CHOICES}
        if value not in valid_roles:
            raise serializers.ValidationError(f"role must be one of {sorted(valid_roles)}.")
        return value


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """
    PATCH /users/{id}. Per the User Management notes, this covers
    "changing their role or disabling their login" — full_name/email are
    reasonably part of "editing an admin's profile" too, even though the
    notes only explicitly call out role/status, so they're included as
    well.

    NOTE (business logic) — lives in a service, NOT here, because each of
    these requires knowing about OTHER rows (how many active super admins
    exist, who the requester is) — not something a serializer validating
    one instance in isolation can determine:
      - Preventing an admin from demoting or disabling their own account
        (a standard self-lockout guard for admin-management APIs).
      - Preventing the last remaining 'super admin' from being demoted or
        disabled — would permanently lock everyone out of User
        Management, since only a super admin can reach it.
      - If `is_active` is flipped to False, invalidating that admin's
        currently-live operations.admin_sessions rows — otherwise a
        disabled admin whose session cookie is still valid stays logged
        in until it naturally expires.
      - Auditing the change (analytics.AuditEvent).
    """

    class Meta:
        model = AdminUser
        fields = ["full_name", "email", "role", "is_active"]

    def validate_role(self, value):
        valid_roles = {choice for choice, _ in AdminUser.ROLE_CHOICES}
        if value not in valid_roles:
            raise serializers.ValidationError(f"role must be one of {sorted(valid_roles)}.")
        return value