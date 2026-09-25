"""
apps/hardware/services.py

Business logic for the Hardware API and the MQTT consumer:
- discovery: a device that publishes for the first time is created as
  `unregistered` (Hardware Management: "Newly connected devices will be
  discovered through MQTT")
- registration, metadata updates, enable/disable, and decommissioning
  (soft delete) requested from the admin dashboard
- connectivity: every message marks the device as seen; a scheduled task
  marks devices that stop reporting as offline and raises an alert
- MQTT topic authorization

Device lifecycle (hardware.devices.status), as shown in the device registry:
    unregistered -> online/offline (registered and enabled)
                 -> disabled (registered, administratively disabled)
                 -> decommissioned (soft-deleted; hidden from the registry)
"""
import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import Device, Kiosk, Sensor

logger = logging.getLogger(__name__)

# A device is offline once it has been silent for this many expected
# reporting intervals (never less than OFFLINE_MINIMUM_SECONDS).
MISSED_INTERVALS_BEFORE_OFFLINE = 3
OFFLINE_MINIMUM_SECONDS = 90
DEFAULT_SAMPLING_INTERVAL_SECONDS = 30

OFFLINE_ALERT_TITLE = "Device offline"

# Statuses of a registered device that is not administratively disabled.
ACTIVE_STATUSES = (Device.STATUS_ONLINE, Device.STATUS_OFFLINE, Device.STATUS_REGISTERED)


class DeviceStateError(Exception):
    """The requested change isn't allowed in the device's current status."""


def discover_device(device_id: str, device_type: str, mac_address: str) -> tuple[Device, bool]:
    """
    Called by the MQTT consumer. Creates an `unregistered` device (and its
    sensors/kiosks row) the first time a device ID publishes.
    """
    device, created = Device.objects.get_or_create(
        device_id=device_id,
        defaults={
            "device_type": device_type,
            "mac_address": mac_address,
            "status": Device.STATUS_UNREGISTERED,
        },
    )
    if created:
        if device_type == Device.TYPE_SENSOR:
            Sensor.objects.create(device=device)
        elif device_type == Device.TYPE_KIOSK:
            Kiosk.objects.create(device=device)
    return device, created


def profile_of(device: Device):
    """The device's sensors or kiosks row, or None."""
    if device.device_type == Device.TYPE_SENSOR:
        return getattr(device, "sensor", None)
    if device.device_type == Device.TYPE_KIOSK:
        return getattr(device, "kiosk", None)
    return None


def offline_after(device: Device) -> timedelta:
    interval = DEFAULT_SAMPLING_INTERVAL_SECONDS
    sensor = getattr(device, "sensor", None) if device.device_type == Device.TYPE_SENSOR else None
    if sensor is not None and sensor.sampling_interval_seconds:
        interval = sensor.sampling_interval_seconds
    return timedelta(seconds=max(interval * MISSED_INTERVALS_BEFORE_OFFLINE, OFFLINE_MINIMUM_SECONDS))


def connectivity_status(device: Device, now=None) -> str:
    """online if the device has reported recently, otherwise offline."""
    now = now or timezone.now()
    if device.last_ping_at and now - device.last_ping_at <= offline_after(device):
        return Device.STATUS_ONLINE
    return Device.STATUS_OFFLINE


def effective_status(device: Device, now=None) -> str:
    """
    The status the registry shows. For a registered, enabled device it's
    worked out from the last ping, so it's correct even between runs of the
    scheduled offline check (which also raises the alert).
    """
    if device.status in ACTIVE_STATUSES:
        return connectivity_status(device, now)
    return device.status


@transaction.atomic
def register_device(device: Device, validated_data: dict) -> Device:
    """Register a discovered device from the dashboard's Register modal."""
    if device.status != Device.STATUS_UNREGISTERED:
        raise DeviceStateError("Only an unregistered device can be registered.")

    device.name = validated_data["name"]
    device.enabled = validated_data.get("enabled", True)
    device.registered_at = timezone.now()
    device.status = connectivity_status(device) if device.enabled else Device.STATUS_DISABLED
    device.save()

    profile = profile_of(device)
    if profile is not None:
        profile.map_node_id = validated_data.get("map_node_id")
        if isinstance(profile, Sensor):
            profile.sampling_interval_seconds = validated_data.get("sampling_interval_seconds")
            profile.sensor_enabled = device.enabled
        profile.save()
    return device


@transaction.atomic
def update_device(device: Device, validated_data: dict) -> Device:
    """Apply PATCH changes: name, map node, building/zone, floor, sampling interval."""
    if device.status == Device.STATUS_DECOMMISSIONED:
        raise DeviceStateError("A decommissioned device can't be changed.")

    if "name" in validated_data:
        device.name = validated_data["name"]
        device.save(update_fields=["name", "updated_at"])

    profile = profile_of(device)
    if profile is not None:
        fields = []
        for field in ("map_node", "area", "floor"):
            if field in validated_data:
                setattr(profile, field, validated_data[field])
                fields.append(field)
        if isinstance(profile, Sensor) and "sampling_interval_seconds" in validated_data:
            profile.sampling_interval_seconds = validated_data["sampling_interval_seconds"]
            fields.append("sampling_interval_seconds")
        if fields:
            profile.save(update_fields=fields)
    return device


@transaction.atomic
def set_enabled(device: Device, enabled: bool) -> Device:
    """Administratively enable or disable a registered device."""
    if device.status in (Device.STATUS_UNREGISTERED, Device.STATUS_DECOMMISSIONED):
        raise DeviceStateError(f"A device that is {device.status} can't be enabled or disabled.")

    device.enabled = enabled
    device.status = connectivity_status(device) if enabled else Device.STATUS_DISABLED
    device.save(update_fields=["enabled", "status", "updated_at"])
    sensor = getattr(device, "sensor", None) if device.device_type == Device.TYPE_SENSOR else None
    if sensor is not None:
        sensor.sensor_enabled = enabled
        sensor.save(update_fields=["sensor_enabled"])
    if not enabled:
        _clear_offline_alert(device)
    return device


@transaction.atomic
def decommission_device(device: Device) -> Device:
    """Soft delete: hide the device from the registry and free its map node."""
    if device.status == Device.STATUS_DECOMMISSIONED:
        raise DeviceStateError("The device is already decommissioned.")

    device.status = Device.STATUS_DECOMMISSIONED
    device.enabled = False
    device.deleted_at = timezone.now()
    device.save(update_fields=["status", "enabled", "deleted_at", "updated_at"])
    profile = profile_of(device)
    if profile is not None:
        profile.map_node = None
        fields = ["map_node"]
        if isinstance(profile, Sensor):
            profile.sensor_enabled = False
            fields.append("sensor_enabled")
        profile.save(update_fields=fields)
    _clear_offline_alert(device)
    return device


def record_contact(device: Device, now=None, data_received=False) -> None:
    """
    Called by the MQTT consumer for every accepted message. Marks the device
    as seen and brings a registered, enabled device back online.
    """
    now = now or timezone.now()
    device.last_ping_at = now
    fields = ["last_ping_at"]
    if data_received:
        device.last_data_at = now
        fields.append("last_data_at")
    came_back = device.status in (Device.STATUS_OFFLINE, Device.STATUS_REGISTERED)
    if device.status in ACTIVE_STATUSES:
        device.status = Device.STATUS_ONLINE
        fields.append("status")
    device.save(update_fields=fields)

    sensor = getattr(device, "sensor", None) if device.device_type == Device.TYPE_SENSOR else None
    if sensor is not None and sensor.mqtt_status != Sensor.MQTT_ONLINE:
        sensor.mqtt_status = Sensor.MQTT_ONLINE
        sensor.save(update_fields=["mqtt_status"])
    if came_back:
        _clear_offline_alert(device)


def kiosk_heartbeat(device_id: str, info: dict, ip_address=None, now=None) -> Device:
    """
    A kiosk (the kiosk web app on its screen) reports that it's running.

    The first heartbeat discovers the kiosk as `unregistered`, like MQTT
    discovery for sensors; an admin then registers it on the Hardware page.
    Every heartbeat marks it as seen and stores what the browser can tell:
    screen, touch support, versions, and how long the app has been running.
    """
    now = now or timezone.now()
    device, _ = discover_device(device_id, Device.TYPE_KIOSK, None)
    if device.device_type != Device.TYPE_KIOSK:
        raise DeviceStateError("That device ID belongs to a sensor.")
    if device.status == Device.STATUS_DECOMMISSIONED:
        return device

    kiosk = device.kiosk
    started = info.get("application_started_at")
    for field in ("display_resolution", "orientation", "touchscreen_connected", "os_version"):
        if field in info:
            setattr(kiosk, field, info[field])
    if "touchscreen_connected" in info:
        kiosk.touchscreen_status = "connected" if info["touchscreen_connected"] else "not detected"
    if info.get("frontend_version"):
        kiosk.frontend_version = info["frontend_version"]
        kiosk.flowsense_version = info["frontend_version"]
    if started:
        kiosk.last_application_restart_at = started
    kiosk.application_status = "running"
    kiosk.save()

    device.ip_address = ip_address
    device.uptime_seconds = max(0, int((now - started).total_seconds())) if started else None
    device.save(update_fields=["ip_address", "uptime_seconds"])
    record_contact(device, now)
    return device


def kiosk_origin_node_id(device: Device):
    """
    The navigation node routes start from for this kiosk: the node assigned
    on the Hardware page, or, when none is assigned, the only active kiosk
    node on the kiosk's floor (or in the whole map, if there is just one).
    None when that's ambiguous or no kiosk node exists yet.
    """
    from map.models import Node

    kiosk = getattr(device, "kiosk", None)
    if kiosk is None:
        return None
    if kiosk.map_node_id:
        return kiosk.map_node_id
    candidates = Node.objects.filter(
        node_type=Node.TYPE_KIOSK, active=True, navigable=True, deleted_at__isnull=True
    )
    if kiosk.floor_id:
        on_floor = candidates.filter(floor_id=kiosk.floor_id)
        if on_floor.count() == 1:
            return on_floor.first().id
    ids = list(candidates.values_list("id", flat=True)[:2])
    return ids[0] if len(ids) == 1 else None


def mark_offline_devices(now=None) -> int:
    """
    Scheduled task body: registered devices that stopped reporting become
    offline, and a warning alert is raised for each (dashboard Alerts panel).
    """
    from analytics.alerts import raise_alert

    now = now or timezone.now()
    marked = 0
    candidates = Device.objects.filter(
        status__in=(Device.STATUS_ONLINE, Device.STATUS_REGISTERED), deleted_at__isnull=True
    ).select_related("sensor")
    for device in candidates:
        if connectivity_status(device, now) == Device.STATUS_ONLINE:
            continue
        device.status = Device.STATUS_OFFLINE
        device.save(update_fields=["status"])
        sensor = getattr(device, "sensor", None) if device.device_type == Device.TYPE_SENSOR else None
        if sensor is not None:
            sensor.mqtt_status = Sensor.MQTT_OFFLINE
            sensor.save(update_fields=["mqtt_status"])
        last_seen = timezone.localtime(device.last_ping_at).strftime("%b %d, %I:%M %p") if device.last_ping_at else "never"
        # Analytics spec, Alert Panel: an unavailable kiosk is critical (it's
        # the primary user interface); a silent sensor is a warning.
        raise_alert(
            "critical" if device.device_type == Device.TYPE_KIOSK else "warning",
            OFFLINE_ALERT_TITLE,
            f"{device.name or device.device_id} ({device.device_type}) stopped reporting. Last seen: {last_seen}.",
            entity_type="device",
            entity_id=device.pk,
        )
        marked += 1
    return marked


def _clear_offline_alert(device: Device) -> None:
    from analytics.alerts import clear_alerts

    clear_alerts("device", device.pk, title=OFFLINE_ALERT_TITLE)


def validate_mqtt_topic(topic: str, payload: dict) -> bool:
    """
    Verifies a device is only publishing to its permitted topic before accepting data.

    Topics follow the IoT architecture notes: flowsense/sensors/<building>/<zone>
    (e.g. flowsense/sensors/eya/lobby). Once a sensor is assigned to a building
    (hardware.sensors.area), the <building> segment must equal that area's code
    (case-insensitive), so a sensor cannot report traffic for another building.
    A sensor with no building assigned yet is accepted.
    """
    device_id = payload.get('device_id')
    topic_parts = topic.split('/')
    if len(topic_parts) < 4:
        logger.warning(f"Invalid topic structure: {topic}")
        return False

    published_building = topic_parts[2].lower()

    try:
        # payload device_id is the ESP32's own ID (hardware.devices.device_id),
        # not the numeric primary key that Sensor.device_id holds.
        sensor = Sensor.objects.select_related('area', 'device').get(device__device_id=device_id)
    except Sensor.DoesNotExist:
        logger.error(f"Payload validation failed: Sensor {device_id} not found")
        return False

    if sensor.device.status == Device.STATUS_UNREGISTERED or sensor.area is None:
        return True

    if published_building != sensor.area.code.lower():
        logger.warning(f"Authorization Failed: {device_id} attempted to publish to {topic}")
        return False

    return True
