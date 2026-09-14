"""
apps/authentication/tasks.py

Celery tasks for the authentication app: the two email-sending gaps
authentication/services.py explicitly flagged as "not implemented" (see
_send_login_challenge_email()'s and create_admin_user()'s NOTEs), plus
scheduled cleanup of the two tables in this app that accumulate ephemeral
rows over time (operations.auth_challenges, operations.admin_sessions).

The cleanup tasks weren't named by either services.py NOTE specifically —
they're added because auth_challenges/admin_sessions are exactly the kind
of ever-growing, time-bound data the Architecture notes call out
"Scheduled cleanup" for in general, and because neither table has a
`deleted_at` column: there's nothing to soft-delete here, so a hard
DELETE is the correct (and only) cleanup mechanism, unlike most of the
rest of the schema.

Per the Architecture notes ("Celery — Kept inside the apps that own them
in tasks.py"), these live here rather than in a shared tasks module.

IMPORTANT — NOT YET WIRED UP: authentication/services.py's
_send_login_challenge_email() and create_admin_user() still need a
one-line change each to actually call
send_login_challenge_email.delay(...) / send_admin_welcome_email.delay(...).
Neither call exists yet (that file wasn't touched as part of adding this
one) — until it is, these two tasks exist but are never enqueued.
"""
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from authentication.models import AdminSession, AdminUser, AuthChallenge

# How long past expiry to keep a consumed/expired row around before a hard
# delete — long enough to be useful for a "why did my login fail" support
# question, short enough not to accumulate forever. Tunable, not a
# measured/product-approved value.
CHALLENGE_RETENTION = timedelta(days=7)
SESSION_RETENTION = timedelta(days=30)


# --------------------------------------------------------------------------
# Email
# --------------------------------------------------------------------------


@shared_task(
    name="authentication.send_login_challenge_email",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def send_login_challenge_email(self, admin_user_id: int, otp_code: str, login_link_token: str) -> None:
    """
    Should be fired by authentication.services._send_login_challenge_email()
    via `.delay(...)` — see this file's own NOTE at the top on why that
    call doesn't exist yet.

    Takes `admin_user_id` (not an AdminUser instance): Celery task
    arguments must be JSON-serializable, which is why every task in this
    module takes ids rather than model instances.

    `autoretry_for`/`retry_backoff` are configured because email delivery
    (SMTP timeouts, transient provider errors) is exactly the kind of
    failure worth retrying automatically rather than losing a login
    attempt outright.
    """
    try:
        admin_user = AdminUser.objects.get(id=admin_user_id)
    except AdminUser.DoesNotExist:
        # The admin could have been deleted between initiate_login()
        # enqueueing this task and it actually running — nothing useful
        # to do but skip; there's no one left to email.
        return

    login_link_url = f"{_admin_base_url()}/login/verify?token={login_link_token}"

    # NOTE: plain-text and minimal on purpose — an HTML template
    # (django.template.loader.render_to_string) is a presentation-layer
    # concern for whoever owns the admin frontend, not this backend task.
    # This is the complete, functional minimum.
    message = (
        f"Hi {admin_user.full_name},\n\n"
        f"Your FlowSense administrator login code is: {otp_code}\n\n"
        f"Or click this link to log in directly:\n{login_link_url}\n\n"
        f"This code and link both expire in {_challenge_ttl_minutes():.0f} minutes "
        f"and can only be used once.\n\n"
        f"If you didn't request this, you can safely ignore this email."
    )

    send_mail(
        subject="Your FlowSense administrator login code",
        message=message,
        from_email=None,  # falls back to settings.DEFAULT_FROM_EMAIL
        recipient_list=[admin_user.email],
        fail_silently=False,
    )


@shared_task(
    name="authentication.send_admin_welcome_email",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def send_admin_welcome_email(self, admin_user_id: int) -> None:
    """
    Should be fired by authentication.services.create_admin_user() via
    `.delay(admin_user.id)` — same not-yet-wired-up gap as
    send_login_challenge_email() above.
    """
    try:
        admin_user = AdminUser.objects.get(id=admin_user_id)
    except AdminUser.DoesNotExist:
        return

    login_url = f"{_admin_base_url()}/login"

    message = (
        f"Hi {admin_user.full_name},\n\n"
        f"You've been added as a FlowSense administrator "
        f"({admin_user.get_role_display()}).\n\n"
        f"FlowSense uses passwordless login — go to {login_url} and enter "
        f"your email ({admin_user.email}) to receive a one-time login code.\n\n"
        f"If you weren't expecting this, please contact your FlowSense "
        f"system administrator."
    )

    send_mail(
        subject="You've been added as a FlowSense administrator",
        message=message,
        from_email=None,  # falls back to settings.DEFAULT_FROM_EMAIL
        recipient_list=[admin_user.email],
        fail_silently=False,
    )


def _admin_base_url() -> str:
    """
    NOTE: no FLOWSENSE_ADMIN_BASE_URL (or similarly named) setting exists
    yet in config/settings — falls back to an obviously-a-placeholder URL
    so emails are at least generated (and visibly wrong, not silently
    broken) rather than this task crashing outright until that setting is
    actually added.
    """
    return getattr(settings, "FLOWSENSE_ADMIN_BASE_URL", "https://admin.flowsense.example")


def _challenge_ttl_minutes() -> float:
    # Imported lazily (rather than at module load) to avoid any import-time
    # coupling beyond what's needed for this one value.
    from authentication.services import CHALLENGE_TTL

    return CHALLENGE_TTL.total_seconds() / 60


# --------------------------------------------------------------------------
# Scheduled cleanup
# --------------------------------------------------------------------------
# NOTE: neither task is wired into a Celery Beat schedule anywhere — that's
# a config/celery.py / CELERY_BEAT_SCHEDULE concern, not this file. They
# just need to exist so that schedule can reference them once someone sets
# one up (e.g. cleanup_expired_auth_challenges every hour,
# cleanup_expired_admin_sessions daily).


@shared_task(name="authentication.cleanup_expired_auth_challenges")
def cleanup_expired_auth_challenges() -> int:
    """
    Hard-deletes operations.auth_challenges rows that expired more than
    CHALLENGE_RETENTION ago — including already-consumed ones (a
    successfully-used challenge has zero value once its retention window
    passes either). Returns the number of rows deleted, for task-run
    logging.
    """
    cutoff = timezone.now() - CHALLENGE_RETENTION
    deleted_count, _ = AuthChallenge.objects.filter(expires_at__lt=cutoff).delete()
    return deleted_count


@shared_task(name="authentication.cleanup_expired_admin_sessions")
def cleanup_expired_admin_sessions() -> dict:
    """
    Two related, cheap steps run together:

      1. Flip any session whose expires_at has passed but is still
         is_active=True — a session that simply outlived its TTL without
         an explicit logout. common.permissions.IsAdminUser already
         independently rejects these on every request (it checks
         expires_at itself, not just is_active) — this step is database
         hygiene, not a security boundary.
      2. Hard-delete sessions that have been inactive for longer than
         SESSION_RETENTION — old enough to no longer be useful for a
         "which devices am I logged in on" style UI or support debugging.

    Returns {"deactivated": <int>, "deleted": <int>}.
    """
    now = timezone.now()

    deactivated_count = AdminSession.objects.filter(is_active=True, expires_at__lt=now).update(
        is_active=False
    )

    delete_cutoff = now - SESSION_RETENTION
    deleted_count, _ = AdminSession.objects.filter(
        is_active=False, expires_at__lt=delete_cutoff
    ).delete()

    return {"deactivated": deactivated_count, "deleted": deleted_count}