"""
System status and health (07 API Design: System API, common/system).

Admin Dashboard spec, System Status:
- Operational: the system is working as intended
- Degraded: some damaged and/or missing components
- Critical: many damaged and/or missing components
- Maintenance: administratively set (the `maintenance_mode` setting)
"""
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.utils import timezone

OK, DEGRADED, DOWN, NOT_USED = "ok", "degraded", "down", "not_used"
CACHE_KEY = "flowsense:system-health"
CACHE_SECONDS = 15


def _database():
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return {"state": OK, "detail": "Responding"}
    except Exception as error:  # noqa: BLE001 - any failure means the database is down
        return {"state": DOWN, "detail": type(error).__name__}


def _redis():
    if settings.CELERY_TASK_ALWAYS_EAGER:
        return {"state": NOT_USED, "detail": "Background tasks run inline (CELERY_TASK_ALWAYS_EAGER)"}
    try:
        import redis

        redis.Redis.from_url(settings.CELERY_BROKER_URL, socket_connect_timeout=1, socket_timeout=1).ping()
        return {"state": OK, "detail": "Responding"}
    except Exception as error:  # noqa: BLE001
        return {"state": DOWN, "detail": type(error).__name__}


def _celery(redis_state):
    if settings.CELERY_TASK_ALWAYS_EAGER:
        return {"state": NOT_USED, "detail": "Background tasks run inline (CELERY_TASK_ALWAYS_EAGER)"}
    if redis_state == DOWN:
        return {"state": DOWN, "detail": "Broker unavailable"}
    try:
        from config.celery import app

        replies = app.control.ping(timeout=1.0) or []
        if replies:
            return {"state": OK, "detail": f"{len(replies)} worker(s) responding"}
        return {"state": DOWN, "detail": "No worker responded"}
    except Exception as error:  # noqa: BLE001
        return {"state": DOWN, "detail": type(error).__name__}


def _devices(device_type):
    from hardware.models import Device
    from hardware.services import effective_status

    registered = list(
        Device.objects.filter(device_type=device_type, deleted_at__isnull=True)
        .exclude(status=Device.STATUS_UNREGISTERED)
        .select_related("sensor")
    )
    statuses = [effective_status(device) for device in registered]
    total = len(statuses)
    online = statuses.count(Device.STATUS_ONLINE)
    disabled = statuses.count(Device.STATUS_DISABLED)
    expected = total - disabled
    if expected == 0:
        state = NOT_USED
    elif online == expected:
        state = OK
    elif online == 0:
        state = DOWN
    else:
        state = DEGRADED
    return {"state": state, "online": online, "total": total, "disabled": disabled}


def maintenance_enabled():
    from common.models import Setting

    setting = Setting.objects.filter(key="maintenance_mode").first()
    return bool(setting and isinstance(setting.value, dict) and setting.value.get("enabled"))


def overall_status(components, maintenance):
    """
    Critical: the database is down, or every kiosk is offline (the kiosk is
    the primary user interface, HR-01). Degraded: anything else is down or
    partly down. Operational: everything in use is working.
    """
    if maintenance:
        return "maintenance"
    if components["database"]["state"] == DOWN:
        return "critical"
    if components.get("kiosks", {}).get("state") == DOWN:
        return "critical"
    states = [c["state"] for c in components.values()]
    if DOWN in states or DEGRADED in states:
        return "degraded"
    return "operational"


def check(use_cache=True):
    """Run every health check (cached briefly so dashboards polling it stay cheap)."""
    if use_cache:
        cached = cache.get(CACHE_KEY)
        if cached is not None:
            return cached
    components = {"database": _database()}
    if components["database"]["state"] == DOWN:
        result = {"status": "critical", "checked_at": timezone.now(), "components": components}
        return result
    components["redis"] = _redis()
    components["celery"] = _celery(components["redis"]["state"])
    components["kiosks"] = _devices("kiosk")
    components["sensors"] = _devices("sensor")
    result = {
        "status": overall_status(components, maintenance_enabled()),
        "checked_at": timezone.now(),
        "components": components,
    }
    cache.set(CACHE_KEY, result, CACHE_SECONDS)
    return result
