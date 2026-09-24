"""
apps/fs_sessions/tasks.py

Scheduled maintenance for kiosk, navigation, and QR sessions. Runs from
settings.CELERY_BEAT_SCHEDULE ("cleanup-expired-sessions-every-hour").
"""
from celery import shared_task

from fs_sessions import services


@shared_task(name="fs_sessions.tasks.cleanup_expired_sessions")
def cleanup_expired_sessions() -> None:
    """Expires stale navigation/QR sessions and ends idle kiosk sessions."""
    services.sweep_expired_sessions()
