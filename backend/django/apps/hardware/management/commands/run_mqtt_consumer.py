import json
import logging
import paho.mqtt.client as mqtt
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from hardware import services
from hardware.services import discover_device, validate_mqtt_topic
from hardware.models import Device, SensorObservation

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Starts the MQTT consumer daemon to listen for ESP32 telemetry and trigger auto-discovery.'

    def on_connect(self, client, userdata, flags, reason_code, properties):
        if not reason_code.is_failure:
            self.stdout.write(self.style.SUCCESS("Successfully connected to Mosquitto broker."))
            # Subscribe to the wildcard topic to catch all campus sensor traffic
            client.subscribe("flowsense/sensors/#")
        else:
            self.stderr.write(f"Failed to connect to broker: {reason_code}")

    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode('utf-8'))
            topic = msg.topic
            
            # 1. Extract the hardware identity required for auto-discovery
            device_id = payload.get('device_id')
            device_type = payload.get('device_type')
            mac_address = payload.get('mac_address')
            
            if not all([device_id, device_type, mac_address]):
                logger.warning("Malformed MQTT payload: Missing identity fields.")
                return

            # 2. Trigger Auto-Discovery
            device, created = discover_device(device_id, device_type, mac_address)
            if created:
                logger.warning(f"Auto-discovered new hardware: {device_id}")

            # 3. Security Checkpoint: Validate Topic Authorization
            if not validate_mqtt_topic(topic, payload):
                return # Silently drop unauthorized or spoofed location data
                
            # 4. Decommissioned devices are ignored entirely.
            if device.status == Device.STATUS_DECOMMISSIONED:
                return

            # 5. Every accepted message counts as contact: last ping, and
            #    online again for a registered, enabled device.
            now = timezone.now()
            stores_telemetry = device_type == 'sensor' and device.status in services.ACTIVE_STATUSES
            services.record_contact(device, now, data_received=stores_telemetry)

            # 6. Write telemetry only for registered, enabled sensors
            #    (unregistered and disabled devices are seen but not stored).
            if stores_telemetry:
                sensor = device.sensor
                sensor.battery_level = payload.get('battery_level')
                sensor.signal_strength = payload.get('signal_strength')
                sensor.last_transmission_at = now
                sensor.save(update_fields=['battery_level', 'signal_strength', 'last_transmission_at'])

                # observed_at is the sensor's own timestamp (ISO 8601); a sensor
                # without clock sync (NTP) may omit it, in which case the
                # receive time is used.
                observed_at = parse_datetime(payload['observed_at']) if payload.get('observed_at') else None
                SensorObservation.objects.create(
                    sensor=sensor,
                    signal_count=payload.get('signal_count'),
                    estimated_density=payload.get('estimated_density'),
                    battery_level=payload.get('battery_level'),
                    signal_strength=payload.get('signal_strength'),
                    observed_at=observed_at or now,
                )

        except json.JSONDecodeError:
            logger.error("Failed to decode incoming JSON payload.")
        except Exception as e:
            logger.error(f"Error processing MQTT message: {str(e)}")

    def handle(self, *args, **options):
        # Initialize the Paho MQTT client
        # Callback API v2 (paho-mqtt >= 2.0); v1 is deprecated.
        client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2, client_id="flowsense_django_consumer"
        )
        client.username_pw_set(settings.MQTT_USER, settings.MQTT_PASSWORD)
        
        client.on_connect = self.on_connect
        client.on_message = self.on_message

        self.stdout.write("Connecting to Mosquitto broker...")
        
        # MQTT_HOST defaults to the Docker service name ('mosquitto').
        client.connect(settings.MQTT_HOST, settings.MQTT_PORT, 60)
        
        self.stdout.write("Starting MQTT consumer listening loop...")
        client.loop_forever()