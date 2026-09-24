"""
apps/sessions/models.py

Owns: 
operations.navigation_sessions, 
analytics.kiosk_sessions

`analytics.kiosk_sessions` lives in the `sessions` schema/app rather than
`analytics` because the Kiosk Sessions endpoints (POST /sessions/kiosk,
heartbeat, end) are the ones actually creating and mutating its lifecycle —
`analytics` and `search` only read from it. See README for the full ownership
table.

Also referenced by: 
navigation (NavigationRequest.navigation_session),
search (SearchEvent.kiosk_session), 
analytics (dashboard/session metrics,
QrEvent.navigation_session)
"""
import uuid

from django.db import models

from hardware.models import Kiosk
from common.db import choice_check


class NavigationSession(models.Model):
    STATUS_CREATED = "created"
    STATUS_ACTIVE = "active"
    STATUS_SCANNED = "scanned"
    STATUS_COMPLETED = "completed"
    STATUS_EXPIRED = "expired"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_CREATED, "Created"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_SCANNED, "Scanned"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Circular dependency in the raw SQL (this FK is added via a trailing
    # ALTER TABLE after analytics.kiosk_sessions exists) — expressed directly
    # here since Django resolves cross-model FKs at migration-apply time
    # rather than file-definition order.
    kiosk_session = models.ForeignKey(
        "KioskSession",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="navigation_sessions",
        db_column="kiosk_session_id",
    )
    session_token_hash = models.CharField(max_length=255, unique=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_CREATED)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    scanned_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"operations"."navigation_sessions"'
        constraints = [
            choice_check("chk_navigation_sessions_status", "status", ['created', 'active', 'scanned', 'completed', 'expired', 'cancelled']),
        ]

    def __str__(self):
        return f"NavigationSession {self.id} ({self.status})"


class KioskSession(models.Model):
    END_COMPLETED = "completed"
    END_IDLE_TIMEOUT = "idle_timeout"
    END_MANUAL_EXIT = "manual_exit"
    END_ERROR = "error"
    END_UNKNOWN = "unknown"
    END_REASON_CHOICES = [
        (END_COMPLETED, "Completed"),
        (END_IDLE_TIMEOUT, "Idle Timeout"),
        (END_MANUAL_EXIT, "Manual Exit"),
        (END_ERROR, "Error"),
        (END_UNKNOWN, "Unknown"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kiosk = models.ForeignKey(
        Kiosk,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kiosk_sessions",
        db_column="kiosk_id",
        to_field="device_id",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True)
    end_reason = models.CharField(
        max_length=30, choices=END_REASON_CHOICES, null=True, blank=True
    )

    class Meta:
        db_table = '"analytics"."kiosk_sessions"'
        constraints = [
            choice_check("chk_kiosk_sessions_end_reason", "end_reason", ['completed', 'idle_timeout', 'manual_exit', 'error', 'unknown'], nullable=True),
        ]

    def __str__(self):
        return f"KioskSession {self.id} @ {self.kiosk_id}"