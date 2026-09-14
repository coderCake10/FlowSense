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
import logging

from django.utils import timezone
from .models import Device, Sensor, Kiosk

logger = logging.getLogger(__name__)

def discover_device(device_id: str, device_type: str, mac_address: str) -> tuple[Device, bool]:
    """
    Called by MQTT Consumer. Creates a device if it doesn't exist yet. Auto-creates unregistered
    device entries when a new device ID first publishes
    """
    device, created = Device.objects.get_or_create(
        device_id=device_id,
        defaults={
            'device_type': device_type,
            'mac_address': mac_address,
            'status': Device.TYPE_SENSOR if device_type == 'sensor' else Device.TYPE_KIOSK,
            'status': 'unregistered',
        }
    )

    if created and device_type == 'sensor':
        Sensor.objects.create(device=device)

    return device, created

def register_device(device: Device, validated_data: dict) -> Device:
    """
    Called by the Admin API to officially register a discovered device. Validates registration 
    payload and creates the corresponding kiosks or sensors subtype row
    """
    device.name = validated_data.get('name')
    device.enabled = validated_data.get('enabled', True)
    device.status = 'registered'
    device.registered_at = timezone.now()
    device.save()

    if device.device_type == Device.TYPE_SENSOR:
        sensor = device.sensor
        sensor.map_node_Id = validated_data.get('map_node_id')
        sensor.sampling_interval_seconds = validated_data.get('sampling_interval_seconds')
        sensor.sensor_enabled = device.enabled
        sensor.save()

    return device

def update_metadata():
    pass

def decommission_device():
    pass

def track_status():
    pass

def get_kiosk_details():
    pass

def get_sensor_details():
    pass

def ingest_observations():
    pass

def aggregate_statistics():
    pass

def dispatch_command():
    pass

def handle_command_response():
    pass

def validate_mqtt_topic(topic: str, payload: dict) -> bool:
    """
    Verifies a device is only publishing to its permitted topic before accepting data
    """
    device_id = payload.get('device_id')
    topic_parts = topic.split('/')
    if len(topic_parts) < 4:
        logger.warning(f"Invalid topic structure: {topic}")
        return False

    published_area = topic_parts[3].lower()

    try:
        sensor = Sensor.objects.select_related('area').get(device_id=device_id)
        if sensor.device.status == Device.STATUS_UNREGISTERED:
            return True

        assigned_area = sensor.area.name.lower() if sensor.area else ""

        if published_area != assigned_area:
            logger.warning(f"Authorization Failed: {device_id} attempted to publish to {topic}")
            return False

        return True

    except Sensor.DoesNotExist:
        logger.error(f"Payload validation failed: Sensor {device_id} not found")
        return True

def filter_device():
    pass