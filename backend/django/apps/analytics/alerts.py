"""
Raises and clears operations.alerts rows (Alerts API, dashboard Alerts panel).

Alerts are raised by the system, for example when a device stops reporting,
and cleared either by an administrator (POST /alerts/{id}/clear), by the
system when the condition ends, or, for informational alerts, automatically
after the `informational_alert_clear_time` setting.
"""
from datetime import timedelta

from django.utils import timezone

from analytics.models import Alert

DEFAULT_INFORMATIONAL_CLEAR_SECONDS = 3600


def raise_alert(severity, title, message, entity_type=None, entity_id=None):
    """Create an alert unless an uncleared one already exists for the same entity and title."""
    existing = Alert.objects.filter(
        cleared_at__isnull=True, entity_type=entity_type, entity_id=entity_id, title=title
    ).first()
    if existing:
        return existing
    # The schema constrains alert_type to the severity values (spec note in
    # the conformance review), so it mirrors the severity.
    return Alert.objects.create(
        severity=severity,
        alert_type=severity,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
    )


def clear_alerts(entity_type, entity_id, title=None):
    """Clear the uncleared alerts for an entity (optionally only those with `title`)."""
    alerts = Alert.objects.filter(cleared_at__isnull=True, entity_type=entity_type, entity_id=entity_id)
    if title is not None:
        alerts = alerts.filter(title=title)
    return alerts.update(cleared_at=timezone.now())


def informational_clear_seconds():
    from common.models import Setting

    setting = Setting.objects.filter(key="informational_alert_clear_time").first()
    try:
        return int(setting.value["seconds"])
    except (AttributeError, KeyError, TypeError, ValueError):
        return DEFAULT_INFORMATIONAL_CLEAR_SECONDS


def clear_expired_informational_alerts(now=None):
    now = now or timezone.now()
    cutoff = now - timedelta(seconds=informational_clear_seconds())
    return Alert.objects.filter(
        cleared_at__isnull=True,
        severity=Alert.SEVERITY_INFORMATIONAL,
        created_at__lt=cutoff,
    ).update(cleared_at=now)


# Trend alerts for the Analytics page's Alert Panel (08 Analytics.md).
HIGH_FAILED_SEARCH_TITLE = "High failed-search rate"
INCREASED_USAGE_TITLE = "Increased kiosk usage"
MIN_SEARCHES = 20      # don't judge a rate on a handful of searches
MIN_SESSIONS = 20
FAILED_RATE_FLOOR = 5.0          # percent
FAILED_RATE_MULTIPLIER = 2.0     # versus the previous 7 days' rate
USAGE_INCREASE = 20.0            # percent, week over week


def evaluate_trends(now=None):
    """
    Raise the analytics alerts the spec describes:
    - warning: failed searches in the last 24 h are at least double the
      previous 7 days' rate and at least 5%
    - informational: kiosk sessions in the last 7 days rose at least 20% over
      the 7 days before
    Returns the titles raised.
    """
    from fs_sessions.models import KioskSession
    from search.models import SearchEvent

    now = now or timezone.now()
    raised = []

    recent = SearchEvent.objects.filter(created_at__gte=now - timedelta(days=1))
    baseline = SearchEvent.objects.filter(created_at__gte=now - timedelta(days=8), created_at__lt=now - timedelta(days=1))
    recent_total, baseline_total = recent.count(), baseline.count()
    if recent_total >= MIN_SEARCHES:
        recent_rate = recent.filter(resolved=False).count() * 100.0 / recent_total
        baseline_rate = baseline.filter(resolved=False).count() * 100.0 / baseline_total if baseline_total else 0.0
        if recent_rate >= FAILED_RATE_FLOOR and recent_rate >= FAILED_RATE_MULTIPLIER * baseline_rate:
            raise_alert(
                "warning", HIGH_FAILED_SEARCH_TITLE,
                f"Failed searches rose to {recent_rate:.1f}% in the last 24 hours, "
                f"compared with {baseline_rate:.1f}% over the previous 7 days.",
                entity_type="analytics",
            )
            raised.append(HIGH_FAILED_SEARCH_TITLE)

    this_week = KioskSession.objects.filter(started_at__gte=now - timedelta(days=7)).count()
    last_week = KioskSession.objects.filter(
        started_at__gte=now - timedelta(days=14), started_at__lt=now - timedelta(days=7)
    ).count()
    if this_week >= MIN_SESSIONS and last_week and (this_week - last_week) * 100.0 / last_week >= USAGE_INCREASE:
        raise_alert(
            "informational", INCREASED_USAGE_TITLE,
            f"Kiosk sessions rose {(this_week - last_week) * 100.0 / last_week:.0f}% compared with the previous week "
            f"({this_week} versus {last_week}).",
            entity_type="analytics",
        )
        raised.append(INCREASED_USAGE_TITLE)
    return raised
