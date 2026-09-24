"""
apps/authentication/services.py

The business logic explicitly kept out of the Authentication + Users API
serializers (see apps/authentication/serializers/*.py's NOTE comments):
passwordless login challenge generation/verification, session creation,
logout, and the two safety guards admin-user updates need (self-lockout,
last-super-admin protection).

Views call these functions; they never build this logic themselves.

GET /auth/session needs NO function here — common.permissions.IsAdminUser
already resolves and validates the current session on every admin-gated
request (setting request.admin_session), so that view just serializes
request.admin_session directly rather than re-deriving it.
"""
import logging
import secrets
from datetime import timedelta
from typing import Optional

from django.db import transaction
from django.utils import timezone

from analytics.models import AuditEvent
from authentication.models import AdminSession, AdminUser, AuthChallenge
from common.permissions.admin import hash_session_token

logger = logging.getLogger(__name__)


def _enqueue(task, *args) -> None:
    """
    Queue a Celery email task once the surrounding transaction commits (so the
    worker can see the rows it reads). A broker outage is logged rather than
    raised: the login response is deliberately identical whether or not an
    email goes out, so failing the request would only leak information.
    retry=False and ignore_result=True make an outage fail fast: otherwise the
    request stalls ~20 s while Celery retries the broker and result store.
    Email tasks have no result anyone reads.
    """

    def send():
        try:
            task.apply_async(args=args, retry=False, ignore_result=True)
        except Exception:  # noqa: BLE001 - any broker/connection failure
            logger.exception("Could not queue %s", task.name)

    transaction.on_commit(send)

# `hash_session_token` is genuinely just `sha256(x).hexdigest()` — reused
# here under a clearer local name for challenge tokens too, rather than
# maintaining a second, functionally identical hasher. Using the SAME
# function for session tokens matters for correctness: whatever creates
# operations.admin_sessions.session_token_hash (this module) and whatever
# looks it up (common.permissions.admin._resolve_admin_session) must agree
# on the exact hashing algorithm, or every session would fail to validate.
_hash_secret = hash_session_token

# --------------------------------------------------------------------------
# Tunables
# --------------------------------------------------------------------------

# NOTE: these are reasonable defaults, not measured/product-approved
# values. They'd fit naturally as operations.settings rows (like
# 'informational_alert_clear_time' already is) if they ever need to be
# admin-configurable rather than a code constant — not done here since
# that's a Settings API concern, out of scope for this module.
CHALLENGE_TTL = timedelta(minutes=10)
SESSION_TTL = timedelta(hours=12)


# --------------------------------------------------------------------------
# Errors
# --------------------------------------------------------------------------


class InvalidChallengeError(Exception):
    """Raised when a login/verify token doesn't match a live, unconsumed challenge."""


class SelfLockoutError(Exception):
    """Raised when an action would disable or delete the acting admin's own account."""


class LastSuperAdminError(Exception):
    """Raised when an action would leave zero active super admins."""


# --------------------------------------------------------------------------
# Token generation
# --------------------------------------------------------------------------


def _generate_otp_code() -> str:
    """6-digit numeric code, zero-padded (e.g. "004821")."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _generate_login_link_token() -> str:
    return secrets.token_urlsafe(32)


def _generate_session_token() -> str:
    return secrets.token_urlsafe(32)


# --------------------------------------------------------------------------
# Login (POST /auth/login)
# --------------------------------------------------------------------------


def initiate_login(email: str) -> None:
    """
    POST /auth/login.

    Always completes silently, whether or not `email` matches a real,
    active admin — LoginRequestSerializer's own NOTE flags this as a
    deliberate anti-enumeration choice, not an oversight. The view should
    return the same generic response either way; this function gives it
    nothing to distinguish on (it returns None in both cases).

    Creates two AuthChallenge rows per request (one 'otp', one
    'login_link') rather than one — per the Admin Authentication page
    notes, both the code and the link are sent together in the same
    email ("Should the login link fail to function, a code will be sent
    along with the link"), and the schema only lets a single row
    represent one challenge_type, so a matched pair is the natural fit.
    """
    admin_user = AdminUser.objects.filter(
        email__iexact=email, is_active=True, deleted_at__isnull=True
    ).first()
    if admin_user is None:
        return

    otp_code = _generate_otp_code()
    login_link_token = _generate_login_link_token()
    expires_at = timezone.now() + CHALLENGE_TTL

    with transaction.atomic():
        AuthChallenge.objects.create(
            admin_user=admin_user,
            challenge_type=AuthChallenge.CHALLENGE_OTP,
            token_hash=_hash_secret(otp_code),
            expires_at=expires_at,
        )
        AuthChallenge.objects.create(
            admin_user=admin_user,
            challenge_type=AuthChallenge.CHALLENGE_LOGIN_LINK,
            token_hash=_hash_secret(login_link_token),
            expires_at=expires_at,
        )

    _send_login_challenge_email(admin_user, otp_code=otp_code, login_link_token=login_link_token)


def _send_login_challenge_email(
    admin_user: AdminUser, *, otp_code: str, login_link_token: str
) -> None:
    """
    Emails `admin_user` their OTP code and login link through Celery
    (authentication.tasks.send_login_challenge_email), not synchronously:
    the request thread must not wait on SMTP.
    """
    from authentication import tasks

    _enqueue(tasks.send_login_challenge_email, admin_user.id, otp_code, login_link_token)


# --------------------------------------------------------------------------
# Verify (POST /auth/verify)
# --------------------------------------------------------------------------


def verify_challenge(*, email: str, token: str, request_meta: Optional[dict] = None) -> dict:
    """
    POST /auth/verify. `token` may be either challenge_type's secret —
    the lookup below doesn't filter on challenge_type at all, since
    VerifyRequestSerializer deliberately doesn't ask which kind was
    submitted (see its NOTE).

    On success:
      - marks the matched challenge consumed,
      - invalidates every OTHER outstanding (unconsumed, unexpired)
        challenge for this admin — including this challenge's sibling
        from the same initiate_login() call, so a stale OTP can't still
        be used after the admin already logged in via the link (or vice
        versa),
      - creates a new operations.admin_sessions row,
      - stamps admin_user.last_login_at.

    Raises InvalidChallengeError for any failure mode (no such admin, no
    matching challenge, expired, already consumed) — deliberately not
    distinguishing which, for the same anti-enumeration reasoning as
    initiate_login().

    Returns {"admin_user": AdminUser, "session": AdminSession, "raw_session_token": str}.
    The view is responsible for setting `raw_session_token` as the
    AdminSessionCookie and MUST NOT include it in any JSON response body
    (see VerifyResponseSerializer's own NOTE on this).
    """
    admin_user = AdminUser.objects.filter(
        email__iexact=email, is_active=True, deleted_at__isnull=True
    ).first()
    if admin_user is None:
        raise InvalidChallengeError("Invalid or expired code.")

    token_hash = _hash_secret(token)
    challenge = AuthChallenge.objects.filter(
        admin_user=admin_user,
        token_hash=token_hash,
        consumed_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()
    if challenge is None:
        raise InvalidChallengeError("Invalid or expired code.")

    with transaction.atomic():
        now = timezone.now()
        challenge.consumed_at = now
        challenge.save(update_fields=["consumed_at"])

        AuthChallenge.objects.filter(admin_user=admin_user, consumed_at__isnull=True).exclude(
            id=challenge.id
        ).update(consumed_at=now)

        session, raw_session_token = _create_admin_session(admin_user, request_meta=request_meta)

        admin_user.last_login_at = now
        admin_user.save(update_fields=["last_login_at"])

    return {
        "admin_user": admin_user,
        "session": session,
        "raw_session_token": raw_session_token,
    }


def _create_admin_session(admin_user: AdminUser, *, request_meta: Optional[dict] = None) -> tuple:
    """
    Returns (AdminSession, raw_token). The raw token exists only in this
    return value and whatever cookie the view sets from it — it is never
    written to the database, only its hash is (operations.admin_sessions
    is defined that way specifically so a DB leak can't be used to replay
    live sessions).
    """
    request_meta = request_meta or {}
    raw_token = _generate_session_token()
    session = AdminSession.objects.create(
        admin_user=admin_user,
        session_token_hash=_hash_secret(raw_token),
        ip_address=request_meta.get("ip_address"),
        user_agent=request_meta.get("user_agent"),
        expires_at=timezone.now() + SESSION_TTL,
    )
    return session, raw_token


# --------------------------------------------------------------------------
# Logout (POST /auth/logout)
# --------------------------------------------------------------------------


def logout(session: AdminSession) -> None:
    """
    POST /auth/logout. `session` is expected to be request.admin_session —
    already resolved by common.permissions.IsAdminUser for the current
    request — so this function has nothing left to do but invalidate it.
    """
    session.is_active = False
    session.save(update_fields=["is_active"])


# --------------------------------------------------------------------------
# Admin user management (Users API)
# --------------------------------------------------------------------------


def create_admin_user(*, validated_data: dict, actor: Optional[AdminUser] = None) -> AdminUser:
    """
    POST /users. The create itself is a plain model create — the only
    reason this is a service function rather than left to the
    serializer's own .save() is the audit log and the "you've been added as
    an administrator" email (authentication.tasks.send_admin_welcome_email).
    """
    from authentication import tasks

    with transaction.atomic():
        admin_user = AdminUser.objects.create(**validated_data)
        _log_admin_change(actor=actor, action=AuditEvent.ACTION_CREATE, instance=admin_user)
        _enqueue(tasks.send_admin_welcome_email, admin_user.id)
    return admin_user


def update_admin_user(
    admin_user: AdminUser, *, validated_data: dict, actor: AdminUser
) -> AdminUser:
    """
    PATCH /users/{id}. Applies the two safety guards
    AdminUserUpdateSerializer's own NOTE flagged as out of its scope —
    neither can be a field-level serializer validator because both need
    to know about rows OTHER than the one being edited (who's making the
    request; how many other active super admins exist):

      1. An admin can't disable their own account (self-lockout).
      2. The last remaining active super admin can't be demoted or
         disabled — would permanently lock everyone out of User
         Management, since only a super admin can reach it.

    If the account is being disabled, also invalidates its currently-live
    sessions (see _invalidate_admin_sessions() for why this is a
    consistency cleanup rather than the only thing standing between a
    disabled admin and continued access).
    """
    new_role = validated_data.get("role", admin_user.role)
    new_is_active = validated_data.get("is_active", admin_user.is_active)

    if actor.id == admin_user.id and new_is_active is False:
        raise SelfLockoutError("You cannot disable your own administrator account.")

    losing_super_admin_status = admin_user.role == AdminUser.ROLE_SUPER_ADMIN and (
        new_role != AdminUser.ROLE_SUPER_ADMIN or new_is_active is False
    )
    if losing_super_admin_status and not _other_active_super_admins_exist(admin_user):
        raise LastSuperAdminError(
            "Cannot remove super admin access from the last remaining active super admin."
        )

    was_active = admin_user.is_active

    with transaction.atomic():
        for field, value in validated_data.items():
            setattr(admin_user, field, value)
        admin_user.save(update_fields=list(validated_data.keys()) + ["updated_at"])

        if was_active and new_is_active is False:
            _invalidate_admin_sessions(admin_user)

        _log_admin_change(actor=actor, action=AuditEvent.ACTION_UPDATE, instance=admin_user)

    return admin_user


def delete_admin_user(admin_user: AdminUser, *, actor: AdminUser) -> None:
    """
    DELETE /users/{id} — "soft-deletes an administrator, revoking system
    access." The same two guards as update_admin_user() apply: from
    their perspective, a delete is just is_active=False with extra steps.
    """
    if actor.id == admin_user.id:
        raise SelfLockoutError("You cannot delete your own administrator account.")

    if admin_user.role == AdminUser.ROLE_SUPER_ADMIN and not _other_active_super_admins_exist(
        admin_user
    ):
        raise LastSuperAdminError("Cannot delete the last remaining active super admin.")

    with transaction.atomic():
        admin_user.deleted_at = timezone.now()
        admin_user.is_active = False
        admin_user.save(update_fields=["deleted_at", "is_active", "updated_at"])
        _invalidate_admin_sessions(admin_user)
        _log_admin_change(actor=actor, action=AuditEvent.ACTION_DELETE, instance=admin_user)


def _other_active_super_admins_exist(admin_user: AdminUser) -> bool:
    return (
        AdminUser.objects.filter(
            role=AdminUser.ROLE_SUPER_ADMIN, is_active=True, deleted_at__isnull=True
        )
        .exclude(id=admin_user.id)
        .exists()
    )


def _invalidate_admin_sessions(admin_user: AdminUser) -> None:
    """
    Called whenever an admin's is_active flips to False (via update or
    delete). Worth being precise about what this does and doesn't
    guarantee: common.permissions.IsAdminUser already checks
    admin_user.is_active on every request (see _resolve_admin_session), so
    a disabled admin's existing session cookie would ALREADY be rejected
    without this. This function is a consistency cleanup — it makes
    operations.admin_sessions honestly reflect that those sessions are
    dead, rather than sitting around with is_active=True until they
    naturally expire — not the only thing preventing continued access.
    """
    AdminSession.objects.filter(admin_user=admin_user, is_active=True).update(is_active=False)


def _log_admin_change(
    *, actor: Optional[AdminUser], action: str, instance: AdminUser
) -> AuditEvent:
    return AuditEvent.objects.create(
        admin_user=actor,
        event_type=AuditEvent.TYPE_ADMINISTRATIVE,
        entity_type="admin_user",
        entity_id=instance.pk,
        action=action,
        description=f"{action} admin_user #{instance.pk} ({instance.email})",
    )