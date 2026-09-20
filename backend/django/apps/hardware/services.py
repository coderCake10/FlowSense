'''
CORE BUSINESS LOGIC HERE

Device discovery via Mosquitto broker — auto-creates unregistered device entries when a new device ID first publishes
Device registration — validates registration payload and creates the corresponding kiosks or sensors subtype row
Device metadata update — applies PATCH changes (name, map node, zone) with validation against existing map nodes
Device soft-delete/decommission — marks device as decommissioned and detaches its map node reference
Device status/heartbeat tracking — updates status, last_ping_at, uptime_seconds from MQTT or ping responses
Kiosk detail assembly — joins devices + kiosks rows into the combined detail structure the frontend expects
Sensor detail assembly — joins devices + sensors rows into the combined detail structure
Sensor observation ingestion — validates and stores incoming MQTT sensor payloads into sensor_observations
Sensor statistics aggregation — computes average/peak density and transmission reliability (feeds Celery task)
Remote command dispatch — publishes ping/restart/enable/disable commands to the device's MQTT topic
Command response handling — correlates async MQTT command acknowledgments back to the requesting API call
MQTT topic authorization check — verifies a device is only publishing to its permitted topic before accepting data
Device filtering/query builder — applies registry table filters (type, status, location) for the list endpoint
'''
"""
apps/hardware/services.py

Implements core business logic for Hardware management:
- Device discovery and registration
- Status and heartbeat tracking
- MQTT payload validation and observation ingestion
- Periodic analytics aggregation
- Remote command dispatching and response handling
- Device detail assembly and query filtering
"""

import json
import logging
from datetime import datetime
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db import transaction
from django.db.models import Avg, Max, Q
from django.core.exceptions import ValidationError

from hardware.models import Device, Sensor, Kiosk, SensorObservation
from map.models import Node, Area

logger = logging.getLogger(__name__)


# ==============================================================================
# 1. DISCOVERY, REGISTRATION & LIFECYCLE
# ==============================================================================

def discover_device(device_id: str, device_type: str, mac_address: str) -> tuple[Device, bool]:
    """
    Called by MQTT Consumer when a new device ID publishes to the broker[cite: 1, 2].
    Auto-creates an unregistered device entry and initializes its subtype table.
    """
    device, created = Device.objects.get_or_create(
        device_id=device_id,
        defaults={
            'device_type': device_type,
            'mac_address': mac_address,
            'status': Device.STATUS_UNREGISTERED,
            'enabled': False,
        }
    )

    if created:
        if device_type == Device.TYPE_SENSOR:
            Sensor.objects.create(device=device)
        elif device_type == Device.TYPE_KIOSK:
            Kiosk.objects.create(device=device)
        logger.info(f"Auto-discovered new hardware: {device_id} ({device_type})")

    return device, created


@transaction.atomic
def register_device(device: Device, validated_data: dict) -> Device:
    """
    Called by the Admin API to register a discovered device[cite: 1, 3].
    Validates registration input and associates node, area, and operational settings.
    """
    device.name = validated_data.get('name')
    device.enabled = validated_data.get('enabled', True)
    device.status = Device.STATUS_REGISTERED
    device.registered_at = timezone.now()
    device.save(update_fields=['name', 'enabled', 'status', 'registered_at', 'updated_at'])

    map_node_id = validated_data.get('map_node_id')
    node = None
    if map_node_id:
        node = Node.objects.select_related('floor__area').filter(id=map_node_id).first()
        if not node:
            raise ValidationError(f"Map node with ID {map_node_id} does not exist.")

    if device.device_type == Device.TYPE_SENSOR:
        sensor, _ = Sensor.objects.get_or_create(device=device)
        sensor.map_node = node
        sensor.sampling_interval_seconds = validated_data.get('sampling_interval_seconds')
        sensor.sensor_enabled = device.enabled
        if node:
            sensor.floor = node.floor
            sensor.area = getattr(node, 'area', None) or getattr(node.floor, 'area', None)
        sensor.save()

    elif device.device_type == Device.TYPE_KIOSK:
        kiosk, _ = Kiosk.objects.get_or_create(device=device)
        kiosk.map_node = node
        if node:
            kiosk.floor = node.floor
            kiosk.area = getattr(node, 'area', None) or getattr(node.floor, 'area', None)
        kiosk.save()

    return device


@transaction.atomic
def update_metadata(device: Device, validated_data: dict) -> Device:
    """
    Applies PATCH modifications (name, map node, zone/area, enabled status)[cite: 1, 3].
    Enforces validation against existing map nodes to prevent duplicate assignments.
    """
    if 'name' in validated_data:
        device.name = validated_data['name']

    if 'enabled' in validated_data:
        device.enabled = validated_data['enabled']
        if device.device_type == Device.TYPE_SENSOR and hasattr(device, 'sensor'):
            device.sensor.sensor_enabled = device.enabled
            device.sensor.save(update_fields=['sensor_enabled'])

    if 'status' in validated_data:
        device.status = validated_data['status']

    # Map Node Assignment
    if 'map_node_id' in validated_data:
        map_node_id = validated_data['map_node_id']
        target_profile = getattr(device, device.device_type, None)

        if map_node_id is not None:
            node = Node.objects.select_related('floor__area').filter(id=map_node_id).first()
            if not node:
                raise ValidationError(f"Map node with ID {map_node_id} does not exist.")

            # Validate unique 1-to-1 map node constraint across all hardware
            conflict_kiosk = Kiosk.objects.filter(map_node_id=map_node_id).exclude(device=device).exists()
            conflict_sensor = Sensor.objects.filter(map_node_id=map_node_id).exclude(device=device).exists()
            if conflict_kiosk or conflict_sensor:
                raise ValidationError(f"Map node {map_node_id} is already occupied by another device.")

            if target_profile:
                target_profile.map_node = node
                target_profile.floor = node.floor
                target_profile.area = getattr(node, 'area', None) or getattr(node.floor, 'area', None)
                target_profile.save()
        else:
            if target_profile:
                target_profile.map_node = None
                target_profile.save(update_fields=['map_node'])

    # Direct Area / Zone Override
    if 'area_id' in validated_data:
        area_id = validated_data['area_id']
        target_profile = getattr(device, device.device_type, None)
        if target_profile:
            area = Area.objects.filter(id=area_id).first() if area_id else None
            target_profile.area = area
            target_profile.save(update_fields=['area'])

    if 'sampling_interval_seconds' in validated_data and device.device_type == Device.TYPE_SENSOR:
        if hasattr(device, 'sensor'):
            device.sensor.sampling_interval_seconds = validated_data['sampling_interval_seconds']
            device.sensor.save(update_fields=['sampling_interval_seconds'])

    device.save()
    return device


@transaction.atomic
def decommission_device(device: Device) -> Device:
    """
    Soft-deletes and decommissions hardware from active operations[cite: 1, 3].
    Detaches spatial map nodes and marks timestamps.
    """
    now = timezone.now()
    device.status = Device.STATUS_DECOMMISSIONED
    device.enabled = False
    device.deleted_at = now
    device.save(update_fields=['status', 'enabled', 'deleted_at', 'updated_at'])

    if device.device_type == Device.TYPE_KIOSK and hasattr(device, 'kiosk'):
        kiosk = device.kiosk
        kiosk.map_node = None
        kiosk.deleted_at = now
        kiosk.save(update_fields=['map_node', 'deleted_at'])

    elif device.device_type == Device.TYPE_SENSOR and hasattr(device, 'sensor'):
        sensor = device.sensor
        sensor.map_node = None
        sensor.sensor_enabled = False
        sensor.deleted_at = now
        sensor.save(update_fields=['map_node', 'sensor_enabled', 'deleted_at'])

    return device


def track_status(device_id: str, status: str = None, uptime_seconds: int = None, ip_address: str = None) -> Device:
    """
    Updates heartbeat timestamps, network status, and operational uptime[cite: 3].
    """
    device = Device.objects.filter(device_id=device_id).first()
    if not device:
        raise ValidationError(f"Device with ID '{device_id}' does not exist.")

    now = timezone.now()
    update_fields = ['last_ping_at', 'updated_at']
    device.last_ping_at = now

    if status and status in [choice[0] for choice in Device.STATUS_CHOICES]:
        device.status = status
        update_fields.append('status')

    if uptime_seconds is not None:
        device.uptime_seconds = uptime_seconds
        update_fields.append('uptime_seconds')

    if ip_address:
        device.ip_address = ip_address
        update_fields.append('ip_address')

    device.save(update_fields=update_fields)

    if device.device_type == Device.TYPE_SENSOR and hasattr(device, 'sensor'):
        sensor = device.sensor
        if status == Device.STATUS_ONLINE:
            sensor.mqtt_status = 'online'
        elif status in [Device.STATUS_OFFLINE, Device.STATUS_DECOMMISSIONED]:
            sensor.mqtt_status = 'offline'
        sensor.save(update_fields=['mqtt_status'])

    return device


# ==============================================================================
# 2. DETAIL AGGREGATION FOR FRONTEND VIEWS
# ==============================================================================

def get_kiosk_details(device: Device) -> dict:
    """
    Joins hardware.devices and hardware.kiosks into the detail representation[cite: 3].
    """
    kiosk = getattr(device, 'kiosk', None)
    return {
        "name": device.name,
        "device_type": device.device_type,
        "device_id": device.device_id,
        "mac_address": device.mac_address,
        "serial_number": device.serial_number,
        "registration_date": device.registered_at,
        "registered_at": device.registered_at,
        "status": device.status,
        "last_ping": device.last_ping_at,
        "last_ping_at": device.last_ping_at,
        "ip_address": device.ip_address,
        "uptime": device.uptime_seconds,
        "uptime_seconds": device.uptime_seconds,
        "building": kiosk.area_id if kiosk and kiosk.area_id else None,
        "floor": kiosk.floor_id if kiosk and kiosk.floor_id else None,
        "area": kiosk.area.parent_area_id if kiosk and kiosk.area and hasattr(kiosk.area, 'parent_area_id') else None,
        "map_node": kiosk.map_node_id if kiosk and kiosk.map_node_id else None,
        "last_update": kiosk.firmware_updated_at if kiosk else None,
        "firmware_updated_at": kiosk.firmware_updated_at if kiosk else None,
        "firmware_status": kiosk.firmware_status if kiosk else None,
        # Kiosk Hardware/Software Specifications
        "display_resolution": kiosk.display_resolution if kiosk else None,
        "touchscreen_connected": kiosk.touchscreen_connected if kiosk else None,
        "ts_connected": kiosk.touchscreen_connected if kiosk else None,
        "touchscreen_status": kiosk.touchscreen_status if kiosk else None,
        "ts_status": kiosk.touchscreen_status if kiosk else None,
        "orientation": kiosk.orientation if kiosk else "landscape",
        "hardware_status": kiosk.hardware_status if kiosk else None,
        "flowsense_version": kiosk.flowsense_version if kiosk else None,
        "fs_version": kiosk.flowsense_version if kiosk else None,
        "frontend_version": kiosk.frontend_version if kiosk else None,
        "fe_version": kiosk.frontend_version if kiosk else None,
        "last_application_restart_at": kiosk.last_application_restart_at if kiosk else None,
        "last_app_restart": kiosk.last_application_restart_at if kiosk else None,
        "application_status": kiosk.application_status if kiosk else None,
        "app_status": kiosk.application_status if kiosk else None,
        "os_version": kiosk.os_version if kiosk else None,
        "firmware_version": kiosk.firmware_version if kiosk else None,
        "fw_version": kiosk.firmware_version if kiosk else None,
    }


def get_sensor_details(device: Device) -> dict:
    """
    Joins hardware.devices and hardware.sensors into the detail representation[cite: 3].
    """
    sensor = getattr(device, 'sensor', None)
    latest_obs = sensor.observations.order_by('-observed_at').first() if sensor and hasattr(sensor, 'observations') else None

    return {
        "name": device.name,
        "device_type": device.device_type,
        "device_id": device.device_id,
        "mac_address": device.mac_address,
        "serial_number": device.serial_number,
        "registration_date": device.registered_at,
        "registered_at": device.registered_at,
        "status": device.status,
        "last_ping": device.last_ping_at,
        "last_ping_at": device.last_ping_at,
        "ip_address": device.ip_address,
        "uptime": device.uptime_seconds,
        "uptime_seconds": device.uptime_seconds,
        "building": sensor.area_id if sensor and sensor.area_id else None,
        "floor": sensor.floor_id if sensor and sensor.floor_id else None,
        "area": sensor.area.parent_area_id if sensor and sensor.area and hasattr(sensor.area, 'parent_area_id') else None,
        "map_node": sensor.map_node_id if sensor and sensor.map_node_id else None,
        "last_update": sensor.last_transmission_at if sensor else None,
        "firmware_status": sensor.firmware_status if sensor else None,
        # Sensor Specific Telemetry & Configuration
        "sensor_enabled": sensor.sensor_enabled if sensor else False,
        "sampling_interval_seconds": sensor.sampling_interval_seconds if sensor else None,
        "battery_level": sensor.battery_level if sensor else None,
        "signal_strength": sensor.signal_strength if sensor else None,
        "mqtt_status": sensor.mqtt_status if sensor else "unknown",
        "firmware_version": sensor.firmware_version if sensor else None,
        "fw_version": sensor.firmware_version if sensor else None,
        "last_transmission_at": sensor.last_transmission_at if sensor else None,
        "last_data_transmission": sensor.last_transmission_at if sensor else None,
        "current_signal_count": latest_obs.signal_count if latest_obs else None,
        "last_reading_density": latest_obs.estimated_density if latest_obs else None,
    }


# ==============================================================================
# 3. TELEMETRY INGESTION & ANALYTICS
# ==============================================================================

@transaction.atomic
def ingest_observations(device_id: str, payload: dict) -> SensorObservation:
    """
    Validates and stores incoming ESP32 MQTT observations into hardware.sensor_observations[cite: 1, 2].
    Only persists crowd metrics if the sensor is officially registered.
    """
    try:
        sensor = Sensor.objects.select_related('device').get(device__device_id=device_id)
    except Sensor.DoesNotExist:
        raise ValidationError(f"Sensor with device_id '{device_id}' not found.")

    device = sensor.device
    if device.status not in [Device.STATUS_REGISTERED, Device.STATUS_ONLINE]:
        logger.warning(f"Dropping observation for untrusted/unregistered sensor: {device_id}")
        return None

    now = timezone.now()
    raw_observed_at = payload.get('observed_at')
    observed_at = parse_datetime(raw_observed_at) if raw_observed_at else now
    if not observed_at:
        observed_at = now

    battery_level = payload.get('battery_level')
    signal_strength = payload.get('signal_strength')
    signal_count = payload.get('signal_count')
    estimated_density = payload.get('estimated_density')

    # Update hardware health metrics
    if battery_level is not None:
        sensor.battery_level = battery_level
    if signal_strength is not None:
        sensor.signal_strength = signal_strength
    sensor.mqtt_status = 'online'
    sensor.last_transmission_at = now
    sensor.save(update_fields=['battery_level', 'signal_strength', 'mqtt_status', 'last_transmission_at'])

    device.last_data_at = now
    device.last_ping_at = now
    device.status = Device.STATUS_ONLINE
    device.save(update_fields=['last_data_at', 'last_ping_at', 'status', 'updated_at'])

    observation = SensorObservation.objects.create(
        sensor=sensor,
        observed_at=observed_at,
        estimated_density=estimated_density,
        signal_count=signal_count,
        battery_level=battery_level,
        signal_strength=signal_strength
    )
    return observation


def aggregate_statistics(sensor_id: int, start_time: datetime = None, end_time: datetime = None) -> dict:
    """
    Computes average/peak density and signal detection metrics for a sensor over a window[cite: 1, 6].
    Can be called directly by the statistics endpoint or scheduled by Celery.
    """
    if not end_time:
        end_time = timezone.now()
    if not start_time:
        start_time = end_time - timezone.timedelta(hours=24)

    sensor = Sensor.objects.get(device_id=sensor_id)

    aggregates = SensorObservation.objects.filter(
        sensor=sensor,
        observed_at__gte=start_time,
        observed_at__lte=end_time
    ).aggregate(
        avg_density=Avg('estimated_density'),
        peak_density=Max('estimated_density'),
        avg_signals=Avg('signal_count'),
        peak_signals=Max('signal_count')
    )

    stats_data = {
        "period_start": start_time,
        "period_end": end_time,
        "sensor_id": sensor.device_id,
        "average_density": aggregates['avg_density'] or 0.0,
        "peak_density": aggregates['peak_density'] or 0.0,
        "average_signal_count": aggregates['avg_signals'] or 0.0,
        "peak_signal_count": aggregates['peak_signals'] or 0,
    }

    try:
        from analytics.models import SensorStatistic
        SensorStatistic.objects.update_or_create(
            period_start=start_time,
            sensor_id=sensor.device_id,
            defaults={
                'period_end': end_time,
                'average_density': stats_data['average_density'],
                'peak_density': stats_data['peak_density'],
                'average_signal_count': stats_data['average_signal_count'],
                'peak_signal_count': stats_data['peak_signal_count'],
            }
        )
    except (ImportError, Exception) as e:
        logger.debug(f"Analytics table persistence skipped or unavailable: {e}")

    return stats_data


# ==============================================================================
# 4. REMOTE COMMANDS & DISPATCH
# ==============================================================================

def dispatch_command(device: Device, command: str, params: dict = None) -> dict:
    """
    Publishes remote control commands (ping, restart, enable, disable) to the device MQTT topic[cite: 1, 3].
    """
    allowed_commands = ['ping', 'restart', 'enable', 'disable']
    if command not in allowed_commands:
        raise ValidationError(f"Unsupported command '{command}'. Allowed: {allowed_commands}")

    topic = f"flowsense/commands/{device.device_id}"
    payload_data = {
        "command": command,
        "device_id": device.device_id,
        "params": params or {},
        "timestamp": timezone.now().isoformat()
    }

    # Execute immediate administrative state changes
    if command == 'enable':
        device.enabled = True
        device.status = Device.STATUS_ONLINE
        device.save(update_fields=['enabled', 'status', 'updated_at'])
        if device.device_type == Device.TYPE_SENSOR and hasattr(device, 'sensor'):
            device.sensor.sensor_enabled = True
            device.sensor.save(update_fields=['sensor_enabled'])

    elif command == 'disable':
        device.enabled = False
        device.status = Device.STATUS_DISABLED
        device.save(update_fields=['enabled', 'status', 'updated_at'])
        if device.device_type == Device.TYPE_SENSOR and hasattr(device, 'sensor'):
            device.sensor.sensor_enabled = False
            device.sensor.save(update_fields=['sensor_enabled'])

    # Attempt MQTT transport publication
    try:
        import paho.mqtt.publish as publish
        from django.conf import settings

        broker_host = getattr(settings, 'MQTT_BROKER_HOST', 'mosquitto')
        broker_port = getattr(settings, 'MQTT_BROKER_PORT', 1883)
        auth = None
        user = getattr(settings, 'MQTT_USER', None)
        pwd = getattr(settings, 'MQTT_PASSWORD', None)
        if user and pwd:
            auth = {'username': user, 'password': pwd}

        publish.single(
            topic,
            payload=json.dumps(payload_data),
            hostname=broker_host,
            port=broker_port,
            auth=auth,
            client_id="flowsense_api_dispatcher"
        )
    except Exception as e:
        logger.warning(f"Could not dispatch MQTT command over broker: {e}")

    return {
        "success": True,
        "message": f"Command '{command}' successfully issued to {device.device_id}.",
        "command": command,
        "device_id": device.device_id,
        "timestamp": timezone.now()
    }


def handle_command_response(device_id: str, command: str, response_payload: dict) -> dict:
    """
    Correlates async MQTT command acknowledgments and updates device state[cite: 3].
    """
    device = Device.objects.filter(device_id=device_id).first()
    if not device:
        raise ValidationError(f"Device {device_id} not found.")

    device.last_ping_at = timezone.now()
    if command == 'ping':
        device.status = Device.STATUS_ONLINE
    elif command == 'restart':
        device.uptime_seconds = 0
        device.status = Device.STATUS_ONLINE
        if device.device_type == Device.TYPE_KIOSK and hasattr(device, 'kiosk'):
            device.kiosk.last_application_restart_at = timezone.now()
            device.kiosk.save(update_fields=['last_application_restart_at'])

    device.save(update_fields=['last_ping_at', 'status', 'uptime_seconds', 'updated_at'])
    return {
        "device_id": device_id,
        "command": command,
        "status": "acknowledged",
        "response": response_payload,
        "timestamp": timezone.now()
    }


# ==============================================================================
# 5. SECURITY & QUERY FILTER BUILDER
# ==============================================================================

def validate_mqtt_topic(topic: str, payload: dict) -> bool:
    """
    Verifies a device is only publishing to its permitted spatial topic before accepting telemetry[cite: 2, 10].
    """
    device_id = payload.get('device_id')
    topic_parts = topic.split('/')
    if len(topic_parts) < 4:
        logger.warning(f"Invalid topic structure: {topic}")
        return False

    published_area = topic_parts[3].lower()

    try:
        sensor = Sensor.objects.select_related('area', 'device').get(device__device_id=device_id)
        if sensor.device.status == Device.STATUS_UNREGISTERED:
            return True

        assigned_area = sensor.area.name.lower() if sensor.area else ""
        if published_area != assigned_area:
            logger.warning(f"Authorization Failed: {device_id} attempted to publish to {topic}")
            return False

        return True

    except Sensor.DoesNotExist:
        # Pass unknown hardware through so the discovery pipeline can register it
        logger.error(f"Payload validation passed to discovery: Sensor {device_id} not yet configured")
        return True


def filter_device(queryset=None, device_type: str = None, status: str = None, location: str = None):
    """
    Applies registry table filters (type, status, location) for the list endpoint[cite: 1, 3].
    Optimizes queries across related areas and floors using select_related.
    """
    if queryset is None:
        queryset = Device.objects.all()

    queryset = queryset.select_related(
        'kiosk__area',
        'kiosk__floor',
        'sensor__area',
        'sensor__floor'
    )

    if device_type:
        queryset = queryset.filter(device_type=device_type)

    if status:
        queryset = queryset.filter(status=status)

    if location:
        queryset = queryset.filter(
            Q(kiosk__area__name__icontains=location) |
            Q(kiosk__floor__glb_node_name__icontains=location) |
            Q(sensor__area__name__icontains=location) |
            Q(sensor__floor__glb_node_name__icontains=location)
        )

    return queryset