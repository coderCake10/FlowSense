"""
apps/analytics/models.py

Owns: 
analytics.navigation_requests, 
analytics.navigation_destinations,
analytics.qr_events, 
analytics.audit_events,
analytics.hourly_kiosk_statistics, 
analytics.sensor_statistics,
operations.alerts

`operations.alerts` is owned here (despite the `operations` schema prefix)
because both the Analytics API and the Alerts API list their Django
Application as `analytics` in 00 API Design.md.

This single app backs four API sections from the design doc: Analytics API,
Alerts API, and Activity API (Activity API has no table of its own — it's
just a read surface over AuditEvent).

Also referenced by: 
navigation (creates/updates NavigationRequest +
NavigationDestination during route generation), 
fs_sessions (QrEvent.navigation_session),
annotation (writes AuditEvent on every annotation change), 
assets (writes AuditEvent on asset/version/validation changes), 
authentication (Alert.acknowledged_by),
system (Alert counts for system status)
"""
from django.db import models

from authentication.models import AdminUser
from hardware.models import Kiosk, Sensor
from map.models import Node
from fs_sessions.models import NavigationSession
from common.db import choice_check


class NavigationRequest(models.Model):
    STATUS_REQUESTED = "requested"
    STATUS_GENERATED = "generated"
    STATUS_FAILED = "failed"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = [
        (STATUS_REQUESTED, "Requested"),
        (STATUS_GENERATED, "Generated"),
        (STATUS_FAILED, "Failed"),
        (STATUS_COMPLETED, "Completed"),
    ]

    id = models.BigAutoField(primary_key=True)
    navigation_session = models.ForeignKey(
        NavigationSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="navigation_requests",
        db_column="navigation_session_id",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    origin_node = models.ForeignKey(
        Node,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="navigation_requests_originating",
        db_column="origin_node_id",
    )
    route_distance = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    route_generation_ms = models.IntegerField(null=True, blank=True)
    destination_count = models.IntegerField(default=0)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_REQUESTED)

    class Meta:
        db_table = '"analytics"."navigation_requests"'
        constraints = [
            choice_check("chk_navigation_requests_status", "status", ['requested', 'generated', 'failed', 'completed']),
        ]
        indexes = [
            models.Index(fields=["-started_at"], name="idx_navigation_requests_time"),
        ]

    def __str__(self):
        return f"NavigationRequest #{self.pk} ({self.status})"


class NavigationDestination(models.Model):
    id = models.BigAutoField(primary_key=True)
    navigation_request = models.ForeignKey(
        NavigationRequest,
        on_delete=models.CASCADE,
        related_name="destinations",
        db_column="navigation_request_id",
    )
    destination_node = models.ForeignKey(
        Node,
        on_delete=models.RESTRICT,
        related_name="navigation_destinations",
        db_column="destination_node_id",
    )
    destination_order = models.IntegerField()
    reached_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"analytics"."navigation_destinations"'
        constraints = [
            models.UniqueConstraint(
                fields=["navigation_request", "destination_order"],
                name="navigation_destinations_request_order_uq",
            ),
        ]

    def __str__(self):
        return f"Destination #{self.destination_order} of request {self.navigation_request_id}"


class QrEvent(models.Model):
    EVENT_GENERATED = "generated"
    EVENT_SCANNED = "scanned"
    EVENT_EXPIRED = "expired"
    EVENT_INVALID = "invalid"
    EVENT_TYPE_CHOICES = [
        (EVENT_GENERATED, "Generated"),
        (EVENT_SCANNED, "Scanned"),
        (EVENT_EXPIRED, "Expired"),
        (EVENT_INVALID, "Invalid"),
    ]

    id = models.BigAutoField(primary_key=True)
    navigation_session = models.ForeignKey(
        NavigationSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="qr_events",
        db_column="navigation_session_id",
    )
    event_type = models.CharField(max_length=30, choices=EVENT_TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = '"analytics"."qr_events"'
        constraints = [
            choice_check("chk_qr_events_event_type", "event_type", ['generated', 'scanned', 'expired', 'invalid']),
        ]
        indexes = [
            models.Index(fields=["-created_at"], name="idx_qr_events_created"),
        ]

    def __str__(self):
        return f"{self.event_type} @ {self.created_at}"


class AuditEvent(models.Model):
    TYPE_ASSET = "asset"
    TYPE_CONFIGURATION = "configuration"
    TYPE_VALIDATION = "validation"
    TYPE_ADMINISTRATIVE = "administrative"
    EVENT_TYPE_CHOICES = [
        (TYPE_ASSET, "Asset"),
        (TYPE_CONFIGURATION, "Configuration"),
        (TYPE_VALIDATION, "Validation"),
        (TYPE_ADMINISTRATIVE, "Administrative"),
    ]

    ACTION_CREATE = "create"
    ACTION_UPDATE = "update"
    ACTION_DELETE = "delete"
    ACTION_UPLOAD = "upload"
    ACTION_REPLACE = "replace"
    ACTION_RESTORE = "restore"
    ACTION_VALIDATE = "validate"
    ACTION_ACTIVATE = "activate"
    ACTION_DEACTIVATE = "deactivate"
    ACTION_CHOICES = [
        (ACTION_CREATE, "Create"),
        (ACTION_UPDATE, "Update"),
        (ACTION_DELETE, "Delete"),
        (ACTION_UPLOAD, "Upload"),
        (ACTION_REPLACE, "Replace"),
        (ACTION_RESTORE, "Restore"),
        (ACTION_VALIDATE, "Validate"),
        (ACTION_ACTIVATE, "Activate"),
        (ACTION_DEACTIVATE, "Deactivate"),
    ]

    id = models.BigAutoField(primary_key=True)
    admin_user = models.ForeignKey(
        AdminUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_events",
        db_column="admin_user_id",
    )
    event_type = models.CharField(max_length=50, choices=EVENT_TYPE_CHOICES)
    entity_type = models.CharField(max_length=100, null=True, blank=True)
    entity_id = models.BigIntegerField(null=True, blank=True)
    action = models.CharField(max_length=100, choices=ACTION_CHOICES)
    description = models.TextField(null=True, blank=True)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = '"analytics"."audit_events"'
        constraints = [
            choice_check("chk_audit_events_event_type", "event_type", ['asset', 'configuration', 'validation', 'administrative']),
            choice_check("chk_audit_events_action", "action", ['create', 'update', 'delete', 'upload', 'replace', 'restore', 'validate', 'activate', 'deactivate']),
        ]
        indexes = [
            models.Index(fields=["-created_at"], name="idx_audit_events_created"),
            models.Index(fields=["admin_user"], name="idx_audit_events_user"),
            models.Index(fields=["entity_type", "entity_id"], name="idx_audit_events_entity"),
            models.Index(fields=["event_type", "-created_at"], name="idx_audit_events_type_time"),
        ]

    def __str__(self):
        return f"{self.event_type}.{self.action} on {self.entity_type}#{self.entity_id}"


class HourlyKioskStatistic(models.Model):
    """
    Composite PK (hour_start, kiosk_id) in the DB. Simulated here with a
    surrogate BigAutoField + UniqueConstraint — see README.
    """

    id = models.BigAutoField(primary_key=True)
    hour_start = models.DateTimeField()
    kiosk = models.ForeignKey(
        Kiosk,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="hourly_statistics",
        db_column="kiosk_id",
        to_field="device_id",
    )
    session_count = models.IntegerField(default=0)
    search_count = models.IntegerField(default=0)
    successful_searches = models.IntegerField(default=0)
    failed_searches = models.IntegerField(default=0)
    qr_generated = models.IntegerField(default=0)
    qr_scanned = models.IntegerField(default=0)
    average_session_seconds = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True
    )

    class Meta:
        db_table = '"analytics"."hourly_kiosk_statistics"'
        constraints = [
            models.UniqueConstraint(
                fields=["hour_start", "kiosk"], name="hourly_kiosk_statistics_pk"
            ),
        ]

    def __str__(self):
        return f"{self.kiosk_id} @ {self.hour_start}"


class SensorStatistic(models.Model):
    """
    Composite PK (period_start, sensor_id) in the DB. Simulated here with a
    surrogate BigAutoField + UniqueConstraint — see README.
    """

    id = models.BigAutoField(primary_key=True)
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    sensor = models.ForeignKey(
        Sensor,
        on_delete=models.CASCADE,
        related_name="statistics",
        db_column="sensor_id",
        to_field="device_id",
    )
    average_density = models.DecimalField(max_digits=11, decimal_places=3, null=True, blank=True)
    peak_density = models.DecimalField(max_digits=11, decimal_places=3, null=True, blank=True)
    average_signal_count = models.DecimalField(
        max_digits=11, decimal_places=3, null=True, blank=True
    )
    peak_signal_count = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = '"analytics"."sensor_statistics"'
        constraints = [
            models.UniqueConstraint(fields=["period_start", "sensor"], name="sensor_statistics_pk"),
        ]

    def __str__(self):
        return f"{self.sensor_id}: {self.period_start} - {self.period_end}"


class Alert(models.Model):
    SEVERITY_INFORMATIONAL = "informational"
    SEVERITY_WARNING = "warning"
    SEVERITY_CRITICAL = "critical"
    SEVERITY_CHOICES = [
        (SEVERITY_INFORMATIONAL, "Informational"),
        (SEVERITY_WARNING, "Warning"),
        (SEVERITY_CRITICAL, "Critical"),
    ]
    # NOTE: the SQL schema gives `alert_type` the exact same CHECK options as
    # `severity` (informational/warning/critical) — kept as-written even
    # though this looks like it may have been intended as a free-form type
    # field (e.g. "sensor_offline", "high_failed_search_rate").
    ALERT_TYPE_CHOICES = SEVERITY_CHOICES

    id = models.BigAutoField(primary_key=True)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    alert_type = models.CharField(max_length=100, choices=ALERT_TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    entity_type = models.CharField(max_length=100, null=True, blank=True)
    entity_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    cleared_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        AdminUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="acknowledged_alerts",
        db_column="acknowledged_by",
    )

    class Meta:
        db_table = '"operations"."alerts"'
        constraints = [
            choice_check("chk_alerts_severity", "severity", ['informational', 'warning', 'critical']),
            choice_check("chk_alerts_alert_type", "alert_type", ['informational', 'warning', 'critical']),
        ]
        indexes = [
            models.Index(
                fields=["-created_at"],
                name="idx_alerts_active",
                condition=models.Q(cleared_at__isnull=True),
            ),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.title}"