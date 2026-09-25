"""
Metrics behind the Analytics API (07 API Design) and the Analytics page
(04 Application/02 Admin/08 Analytics.md). One function per endpoint; each
takes an analytics.ranges.DateRange.

A metric the system doesn't record yet is returned as null and explained in
`not_collected`, never estimated.
"""
from collections import Counter
from datetime import timedelta
from statistics import median

from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Max, Q
from django.db.models.functions import ExtractHour, Lower, Trim, TruncDate
from django.utils import timezone

from analytics.dashboard import density_level

NOT_COLLECTED = {
    "search_to_render": "The kiosk doesn't report how long results take to appear yet.",
    "api_success_rate": "API requests aren't logged; the database schema has no table for them.",
    "route_turns": "Routes aren't stored with their path yet; this comes with navigation on the annotated 3D models.",
    "floors_crossed": "Routes aren't stored with their path yet; this comes with navigation on the annotated 3D models.",
    "buildings_crossed": "Routes aren't stored with their path yet; this comes with navigation on the annotated 3D models.",
    "least_recommended_segments": "Route segments aren't stored yet; this comes with navigation on the annotated 3D models.",
}


def _percent(part, whole, digits=1):
    return round(part * 100.0 / whole, digits) if whole else None


def _round(value, digits=1):
    return None if value is None else round(float(value), digits)


def _per_day(queryset, field, days, **counts):
    """[{date, name: count}] for each named filter (None counts every row), over the range's local days."""
    tz = timezone.get_current_timezone()
    rows = (
        queryset.annotate(day=TruncDate(field, tzinfo=tz))
        .values("day")
        .annotate(**{
            name: Count("id", filter=condition) if condition is not None else Count("id")
            for name, condition in counts.items()
        })
    )
    by_day = {row["day"]: row for row in rows}
    return [{"date": day, **{name: by_day.get(day, {}).get(name, 0) for name in counts}} for day in days]


def _percentile(values, fraction):
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(fraction * (len(ordered) - 1))))
    return ordered[index]


def _clip_now(moment, now=None):
    return min(moment, now or timezone.now())


# ---------------------------------------------------------------- search

def search(r):
    from search.models import SearchEvent

    events = SearchEvent.objects.filter(created_at__gte=r.start, created_at__lte=r.end)
    total = events.count()
    successful = events.filter(resolved=True).count()
    trend = _per_day(events, "created_at", r.days, successful=Q(resolved=True), failed=Q(resolved=False))
    for row in trend:
        row["success_rate"] = _percent(row["successful"], row["successful"] + row["failed"])
    failed_queries = [
        {"query": row["query"], "failures": row["failures"], "last_occurrence": row["last"]}
        for row in events.filter(resolved=False)
        .annotate(query=Lower(Trim("query_text")))
        .values("query")
        .annotate(failures=Count("id"), last=Max("created_at"))
        .order_by("-failures", "-last")[:10]
    ]
    latencies = list(events.exclude(search_latency_ms=None).values_list("search_latency_ms", flat=True)[:100_000])
    return {
        "range": r.as_dict(),
        "totals": {
            "total": total,
            "successful": successful,
            "failed": total - successful,
            "success_rate": _percent(successful, total),
        },
        "trend": trend,
        "failed_queries": failed_queries,
        "latency_ms": {
            "average": _round(sum(latencies) / len(latencies)) if latencies else None,
            "p95": _percentile(latencies, 0.95),
        },
    }


# ---------------------------------------------------------------- navigation and routes

def _requests(r, area_id=None, floor_id=None):
    from analytics.models import NavigationRequest

    requests = NavigationRequest.objects.filter(started_at__gte=r.start, started_at__lte=r.end)
    if floor_id:
        requests = requests.filter(destinations__destination_node__floor_id=floor_id).distinct()
    if area_id:
        requests = requests.filter(
            Q(destinations__destination_node__floor__area_id=area_id)
            | Q(destinations__destination_node__floor__area__parent_area_id=area_id)
        ).distinct()
    return requests


def navigation(r, area_id=None, floor_id=None):
    from analytics.models import NavigationDestination, NavigationRequest

    requests = _requests(r, area_id, floor_id)
    total = requests.count()
    single = requests.filter(destination_count=1).count()
    multi = requests.filter(destination_count__gt=1).count()
    succeeded = requests.filter(status__in=(NavigationRequest.STATUS_GENERATED, NavigationRequest.STATUS_COMPLETED))
    failed = requests.filter(status=NavigationRequest.STATUS_FAILED).count()
    lengths = {
        "all": succeeded.aggregate(v=Avg("route_distance"))["v"],
        "single_destination": succeeded.filter(destination_count=1).aggregate(v=Avg("route_distance"))["v"],
        "multi_destination": succeeded.filter(destination_count__gt=1).aggregate(v=Avg("route_distance"))["v"],
    }

    top_destinations = [
        {
            "rank": rank,
            "node_id": row["destination_node"],
            "name": row["destination_node__name"],
            "room_code": row["destination_node__room__room_code"],
            "requests": row["count"],
        }
        for rank, row in enumerate(
            NavigationDestination.objects.filter(navigation_request__in=requests)
            .values("destination_node", "destination_node__name", "destination_node__room__room_code")
            .annotate(count=Count("id"))
            .order_by("-count", "destination_node__name")[:10],
            start=1,
        )
    ]

    sequences, routes = Counter(), Counter()
    for request in requests.select_related("origin_node").prefetch_related("destinations__destination_node")[:5000]:
        stops = [d.destination_node.name for d in sorted(request.destinations.all(), key=lambda d: d.destination_order)]
        if len(stops) > 1:
            sequences[tuple(stops)] += 1
        if request.origin_node and stops:
            routes[(request.origin_node.name, stops[-1])] += 1

    return {
        "range": r.as_dict(),
        "top_destinations": top_destinations,
        "queues": {
            "navigation_requests": total,
            "queue_usage": multi,
            "average_queue_size": _round(requests.filter(destination_count__gt=0).aggregate(v=Avg("destination_count"))["v"]),
            "single_destination_percent": _percent(single, single + multi),
            "multi_destination_percent": _percent(multi, single + multi),
            "route_generation_success_percent": _percent(succeeded.count(), succeeded.count() + failed),
            "common_sequences": [{"sequence": list(s), "count": n} for s, n in sequences.most_common(5)],
        },
        "routes": {
            "average_length_m": {k: _round(v) for k, v in lengths.items()},
            "most_common": [{"origin": o, "destination": d, "count": n} for (o, d), n in routes.most_common(5)],
            "average_turns": None,
            "average_floors_crossed": None,
            "average_buildings_crossed": None,
        },
        "not_collected": {k: NOT_COLLECTED[k] for k in ("route_turns", "floors_crossed", "buildings_crossed")},
    }


# ---------------------------------------------------------------- kiosks and availability

def _downtime(device, start, end, now):
    """Seconds the device was offline within [start, end], from its offline alerts."""
    from analytics.models import Alert
    from hardware import services

    total = timedelta()
    alerts = Alert.objects.filter(
        entity_type="device", entity_id=device.pk, title=services.OFFLINE_ALERT_TITLE, created_at__lte=end
    ).filter(Q(cleared_at__isnull=True) | Q(cleared_at__gte=start))
    open_alert = False
    for alert in alerts:
        down_end = alert.cleared_at or now
        open_alert = open_alert or alert.cleared_at is None
        total += max(timedelta(), min(down_end, end) - max(alert.created_at, start))
    # Offline right now but the scheduled check hasn't raised the alert yet.
    if not open_alert and services.effective_status(device, now) == "offline" and device.last_ping_at:
        went_offline = device.last_ping_at + services.offline_after(device)
        total += max(timedelta(), min(now, end) - max(went_offline, start))
    return total


def availability(device, r, now=None):
    """Percent of the range (since registration) that the device was online."""
    now = now or timezone.now()
    start = max(r.start, device.registered_at or device.discovered_at)
    end = _clip_now(r.end, now)
    window = end - start
    if window.total_seconds() <= 0:
        return None
    down = _downtime(device, start, end, now)
    return round(max(0.0, 100.0 * (1 - down / window)), 1)


def _registered(device_type, area_id=None, floor_id=None):
    """Registered devices, optionally in one building (or zone of it) or on one floor."""
    from hardware.models import Device

    devices = (
        Device.objects.filter(device_type=device_type, deleted_at__isnull=True)
        .exclude(status__in=(Device.STATUS_UNREGISTERED, Device.STATUS_DECOMMISSIONED))
        .select_related(f"{device_type}__area__parent_area", f"{device_type}__floor__area")
        .order_by("name")
    )
    if floor_id:
        devices = devices.filter(**{f"{device_type}__floor_id": floor_id})
    if area_id:
        devices = devices.filter(
            Q(**{f"{device_type}__area_id": area_id})
            | Q(**{f"{device_type}__area__parent_area_id": area_id})
            | Q(**{f"{device_type}__floor__area_id": area_id})
        )
    return devices


def kiosks(r, kiosk_id=None):
    from fs_sessions.models import KioskSession
    from search.models import SearchEvent

    tz = timezone.get_current_timezone()
    sessions = KioskSession.objects.filter(started_at__gte=r.start, started_at__lte=r.end)
    searches = SearchEvent.objects.filter(created_at__gte=r.start, created_at__lte=r.end)
    if kiosk_id:
        sessions = sessions.filter(kiosk_id=kiosk_id)
        searches = searches.filter(kiosk_session__kiosk_id=kiosk_id)

    def by_hour(queryset, field):
        return {row["hour"]: row["n"] for row in queryset.annotate(hour=ExtractHour(field, tzinfo=tz)).values("hour").annotate(n=Count("id"))}

    session_hours, search_hours = by_hour(sessions, "started_at"), by_hour(searches, "created_at")
    session_days = {row["date"]: row["n"] for row in _per_day(sessions, "started_at", r.days, n=None)}
    search_days = {row["date"]: row["n"] for row in _per_day(searches, "created_at", r.days, n=None)}
    average = sessions.filter(ended_at__isnull=False).aggregate(
        v=Avg(ExpressionWrapper(F("ended_at") - F("started_at"), output_field=DurationField()))
    )["v"]
    kiosk_devices = _registered("kiosk")
    if kiosk_id:
        kiosk_devices = kiosk_devices.filter(pk=kiosk_id)
    return {
        "range": r.as_dict(),
        "sessions": {
            "total": sessions.count(),
            "average_seconds": round(average.total_seconds()) if average else None,
        },
        "usage_by_hour": [
            {"hour": h, "sessions": session_hours.get(h, 0), "searches": search_hours.get(h, 0)} for h in range(24)
        ],
        "usage_over_time": [
            {"date": day, "sessions": session_days.get(day, 0), "searches": search_days.get(day, 0)} for day in r.days
        ],
        "availability": [
            {"device_id": d.id, "name": d.name or d.device_id, "availability_percent": availability(d, r)}
            for d in kiosk_devices
        ],
    }


# ---------------------------------------------------------------- QR handoff

def qr(r):
    from analytics.models import QrEvent
    from fs_sessions.models import NavigationSession
    from hardware.models import Device

    events = QrEvent.objects.filter(created_at__gte=r.start, created_at__lte=r.end)
    generated = events.filter(event_type=QrEvent.EVENT_GENERATED).count()
    scanned = events.filter(event_type=QrEvent.EVENT_SCANNED).count()
    over_time = _per_day(
        events, "created_at", r.days,
        generated=Q(event_type=QrEvent.EVENT_GENERATED), scanned=Q(event_type=QrEvent.EVENT_SCANNED),
    )
    for row in over_time:
        row["scan_rate"] = _percent(row["scanned"], row["generated"])

    handoffs = [
        (s.scanned_at - s.created_at).total_seconds()
        for s in NavigationSession.objects.filter(scanned_at__gte=r.start, scanned_at__lte=r.end).only("created_at", "scanned_at")[:100_000]
        if s.scanned_at >= s.created_at
    ]
    names = {d.id: d.name or d.device_id for d in Device.objects.filter(device_type="kiosk")}
    by_kiosk = [
        {
            "device_id": row["kiosk"],
            "name": names.get(row["kiosk"], "Unknown kiosk"),
            "generated": row["generated"],
            "scanned": row["scanned"],
            "scan_rate": _percent(row["scanned"], row["generated"]),
        }
        for row in events.exclude(navigation_session__kiosk_session__kiosk_id=None)
        .values(kiosk=F("navigation_session__kiosk_session__kiosk_id"))
        .annotate(
            generated=Count("id", filter=Q(event_type=QrEvent.EVENT_GENERATED)),
            scanned=Count("id", filter=Q(event_type=QrEvent.EVENT_SCANNED)),
        )
        .order_by("-generated")
    ]
    return {
        "range": r.as_dict(),
        "totals": {"generated": generated, "scanned": scanned, "scan_rate": _percent(scanned, generated)},
        "handoff_seconds": {
            "average": _round(sum(handoffs) / len(handoffs)) if handoffs else None,
            "median": _round(median(handoffs)) if handoffs else None,
            "longest": _round(max(handoffs)) if handoffs else None,
            "count": len(handoffs),
        },
        "over_time": over_time,
        "by_kiosk": by_kiosk,
    }


# ---------------------------------------------------------------- sensors and spatial

def _sensor_rows(r, now=None, area_id=None, floor_id=None):
    from hardware.serializers.device import location_of

    now = now or timezone.now()
    rows = []
    for device in _registered("sensor", area_id, floor_id):
        sensor = device.sensor
        start = max(r.start, device.registered_at or device.discovered_at)
        end = _clip_now(r.end, now)
        stats = sensor.observations.filter(observed_at__gte=r.start, observed_at__lte=r.end).aggregate(
            received=Count("id"), avg_density=Avg("estimated_density"), peak_density=Max("estimated_density"),
            avg_signal=Avg("signal_count"), peak_signal=Max("signal_count"),
        )
        expected = None
        if sensor.sampling_interval_seconds and end > start:
            expected = int((end - start).total_seconds() // sensor.sampling_interval_seconds)
        rows.append({
            "device_id": device.id,
            "name": device.name or device.device_id,
            "location": location_of(device)["label"],
            "expected": expected,
            "received": stats["received"],
            "reliability_percent": min(100.0, _percent(stats["received"], expected)) if expected else None,
            "average_density": _round(stats["avg_density"], 3),
            "peak_density": _round(stats["peak_density"], 3),
            "average_signal_count": _round(stats["avg_signal"]),
            "peak_signal_count": stats["peak_signal"],
        })
    return rows


def sensors(r, area_id=None, floor_id=None):
    rows = _sensor_rows(r, area_id=area_id, floor_id=floor_id)
    expected = sum(row["expected"] or 0 for row in rows)
    received = sum(row["received"] for row in rows if row["expected"])
    return {
        "range": r.as_dict(),
        "overall": {"expected": expected, "received": received, "reliability_percent": _percent(received, expected)},
        "sensors": rows,
    }


def spatial(r, area_id=None, floor_id=None):
    rows = [row for row in _sensor_rows(r, area_id=area_id, floor_id=floor_id) if row["received"]]
    busiest = sorted(
        (
            {
                "location": row["location"],
                "sensor": row["name"],
                "average_density": row["average_density"],
                "average_level": density_level(row["average_density"]),
                "peak_density": row["peak_density"],
                "peak_level": density_level(row["peak_density"]),
                "readings": row["received"],
            }
            for row in rows
        ),
        key=lambda item: -(item["average_density"] or 0),
    )
    densities = [row["average_density"] for row in rows if row["average_density"] is not None]
    overall = sum(densities) / len(densities) if densities else None
    return {
        "range": r.as_dict(),
        "crowd_density": {"average": _round(overall, 3), "level": density_level(overall)},
        "busiest_locations": busiest,
        "least_recommended_segments": None,
        "not_collected": {"least_recommended_segments": NOT_COLLECTED["least_recommended_segments"]},
    }


# ---------------------------------------------------------------- system and activity

def system(r):
    from analytics.models import NavigationRequest

    search_part = search(r)["latency_ms"]
    pathfinding = list(
        NavigationRequest.objects.filter(started_at__gte=r.start, started_at__lte=r.end)
        .exclude(route_generation_ms=None).values_list("route_generation_ms", flat=True)[:100_000]
    )
    return {
        "range": r.as_dict(),
        "latency_ms": {
            "search_api": search_part,
            "pathfinding": {
                "average": _round(sum(pathfinding) / len(pathfinding)) if pathfinding else None,
                "p95": _percentile(pathfinding, 0.95),
            },
            "search_to_render": None,
        },
        "api_success_rate": None,
        "sensor_reliability": sensors(r)["overall"],
        "not_collected": {k: NOT_COLLECTED[k] for k in ("search_to_render", "api_success_rate")},
    }


def activity(r):
    from analytics.models import AuditEvent, NavigationRequest, QrEvent
    from fs_sessions.models import KioskSession
    from search.models import SearchEvent

    def window(model, field):
        return model.objects.filter(**{f"{field}__gte": r.start, f"{field}__lte": r.end})

    sessions = {x["date"]: x["n"] for x in _per_day(window(KioskSession, "started_at"), "started_at", r.days, n=None)}
    searches = {x["date"]: x for x in _per_day(window(SearchEvent, "created_at"), "created_at", r.days, n=None, ok=Q(resolved=True))}
    navigation_rows = {x["date"]: x for x in _per_day(window(NavigationRequest, "started_at"), "started_at", r.days, n=None, queues=Q(destination_count__gt=1))}
    qr_rows = {x["date"]: x for x in _per_day(window(QrEvent, "created_at"), "created_at", r.days, gen=Q(event_type="generated"), scan=Q(event_type="scanned"))}
    admin = {x["date"]: x["n"] for x in _per_day(window(AuditEvent, "created_at"), "created_at", r.days, n=None)}
    return {
        "range": r.as_dict(),
        "days": [
            {
                "date": day,
                "kiosk_sessions": sessions[day],
                "searches": searches[day]["n"],
                "successful_searches": searches[day]["ok"],
                "navigation_requests": navigation_rows[day]["n"],
                "queues": navigation_rows[day]["queues"],
                "qr_generated": qr_rows[day]["gen"],
                "qr_scanned": qr_rows[day]["scan"],
                "admin_actions": admin[day],
            }
            for day in r.days
        ],
    }
