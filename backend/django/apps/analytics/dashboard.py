"""
Data for the Admin Dashboard landing page (04 Application/02 Admin/03 Dashboard.md),
served by GET /api/v1/analytics/dashboard.

"Today" is the server's local day (settings.TIME_ZONE).
"""
from datetime import timedelta

from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F
from django.db.models.functions import Lower, TruncDate
from django.utils import timezone

# Crowd density levels. The ESP32 firmware reports estimated_density; these
# cut-offs assume a 0-1 ratio of the zone's capacity and are confirmed with
# the team once the firmware's scale is known.
DENSITY_MODERATE = 0.34
DENSITY_HIGH = 0.67
# A sensor reading older than this isn't "current" crowd density.
DENSITY_FRESH_FOR = timedelta(minutes=15)
INSIGHT_WINDOW = timedelta(days=30)


def density_level(value):
    if value is None:
        return None
    value = float(value)
    if value >= DENSITY_HIGH:
        return "high"
    if value >= DENSITY_MODERATE:
        return "moderate"
    return "low"


def _today_bounds(now):
    start = timezone.localtime(now).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, now


def _today(now):
    from fs_sessions.models import KioskSession
    from search.models import SearchEvent
    from analytics.models import NavigationRequest

    start, end = _today_bounds(now)
    sessions = KioskSession.objects.filter(started_at__gte=start, started_at__lte=end)
    searches = SearchEvent.objects.filter(created_at__gte=start, created_at__lte=end)
    average = sessions.filter(ended_at__isnull=False).aggregate(
        value=Avg(ExpressionWrapper(F("ended_at") - F("started_at"), output_field=DurationField()))
    )["value"]
    return {
        "kiosk_sessions": sessions.count(),
        "navigation_queries": NavigationRequest.objects.filter(started_at__gte=start, started_at__lte=end).count(),
        "successful_searches": searches.filter(resolved=True).count(),
        "failed_searches": searches.filter(resolved=False).count(),
        "average_session_seconds": round(average.total_seconds()) if average else None,
    }


def _kiosk_activity(now, days=7):
    from fs_sessions.models import KioskSession

    start, _ = _today_bounds(now)
    first_day = start - timedelta(days=days - 1)
    counts = {
        row["day"]: row["sessions"]
        for row in KioskSession.objects.filter(started_at__gte=first_day)
        .annotate(day=TruncDate("started_at", tzinfo=timezone.get_current_timezone()))
        .values("day")
        .annotate(sessions=Count("id"))
    }
    return [
        {"date": (first_day + timedelta(days=i)).date(), "sessions": counts.get((first_day + timedelta(days=i)).date(), 0)}
        for i in range(days)
    ]


def _crowd_density(now):
    from hardware.models import Device
    from hardware.serializers.device import location_of

    rows = []
    sensors = Device.objects.filter(device_type=Device.TYPE_SENSOR, deleted_at__isnull=True).exclude(
        status__in=(Device.STATUS_UNREGISTERED, Device.STATUS_DISABLED)
    ).select_related("sensor__area__parent_area", "sensor__floor__area")
    for device in sensors:
        latest = device.sensor.observations.order_by("-observed_at").first()
        fresh = latest is not None and now - latest.observed_at <= DENSITY_FRESH_FOR
        location = location_of(device)
        rows.append({
            "device_id": device.id,
            "sensor": device.name or device.device_id,
            "area": location["label"] if location["area"] is None else f"{location['area']['name']} · {location['label']}",
            "estimated_density": float(latest.estimated_density) if fresh and latest.estimated_density is not None else None,
            "level": density_level(latest.estimated_density) if fresh else None,
            "signal_count": latest.signal_count if fresh else None,
            "observed_at": latest.observed_at if latest else None,
        })
    return sorted(rows, key=lambda r: (r["estimated_density"] is None, -(r["estimated_density"] or 0)))


def _top_destinations(now):
    from analytics.models import NavigationDestination

    return [
        {"node_id": row["destination_node"], "name": row["destination_node__name"], "count": row["count"]}
        for row in NavigationDestination.objects.filter(navigation_request__started_at__gte=now - INSIGHT_WINDOW)
        .values("destination_node", "destination_node__name")
        .annotate(count=Count("id"))
        .order_by("-count", "destination_node__name")[:5]
    ]


def _failed_searches(now):
    from search.models import SearchEvent

    return [
        {"query": row["query"], "count": row["count"]}
        for row in SearchEvent.objects.filter(resolved=False, created_at__gte=now - INSIGHT_WINDOW)
        .annotate(query=Lower("query_text"))
        .values("query")
        .annotate(count=Count("id"))
        .order_by("-count", "query")[:5]
    ]


def _summary():
    from assets.models import Asset
    from hardware.models import Device
    from map.models import Area, Floor, Room

    registered = Device.objects.filter(deleted_at__isnull=True).exclude(status=Device.STATUS_UNREGISTERED)
    rooms = Room.objects.filter(deleted_at__isnull=True)
    return {
        "buildings": Area.objects.filter(area_type=Area.TYPE_BUILDING, deleted_at__isnull=True).count(),
        "floors": Floor.objects.filter(deleted_at__isnull=True).count(),
        "rooms": rooms.count(),
        "mapped_rooms": rooms.filter(geometry__isnull=False).count(),
        "assets": Asset.objects.filter(deleted_at__isnull=True).count(),
        "kiosks": registered.filter(device_type=Device.TYPE_KIOSK).count(),
        "sensors": registered.filter(device_type=Device.TYPE_SENSOR).count(),
    }


def build(now=None):
    from analytics.models import Alert, AuditEvent
    from analytics.serializers import AlertSerializer, AuditEventSerializer
    from common.system import health

    now = now or timezone.now()
    status = health.check()
    components = status.get("components", {})
    open_alerts = Alert.objects.filter(cleared_at__isnull=True).select_related("acknowledged_by").order_by("-created_at")
    return {
        "generated_at": now,
        "system": {
            "status": status["status"],
            "kiosks": {k: components.get("kiosks", {}).get(k, 0) for k in ("online", "total")},
            "sensors": {k: components.get("sensors", {}).get(k, 0) for k in ("online", "total")},
        },
        "today": _today(now),
        "kiosk_activity": _kiosk_activity(now),
        "crowd_density": _crowd_density(now),
        "top_destinations": _top_destinations(now),
        "failed_searches": _failed_searches(now),
        "alerts": {
            "open": open_alerts.count(),
            "latest": AlertSerializer(open_alerts[:5], many=True).data,
        },
        "recent_activity": AuditEventSerializer(
            AuditEvent.objects.select_related("admin_user").order_by("-created_at")[:5], many=True
        ).data,
        "summary": _summary(),
    }
