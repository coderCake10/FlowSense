import json
import logging
import paho.mqtt.client as mqtt
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils.dateparse import parse_datetime
from hardware.services import discover_device, validate_mqtt_topic
from hardware.models import Device, SensorObservation

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Starts the MQTT consumer daemon to listen for ESP32 telemetry and trigger auto-discovery.'

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.stdout.write(self.style.SUCCESS("Successfully connected to Mosquitto broker."))
            # Subscribe to the wildcard topic to catch all campus sensor traffic
            client.subscribe("flowsense/sensors/#")
        else:
            self.stderr.write(f"Failed to connect to broker, return code {rc}")

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
                
            # 4. Write Telemetry (Only if the admin has officially registered the sensor)
            if device_type == 'sensor' and device.status == Device.STATUS_REGISTERED:
                # Update hardware health metrics
                sensor = device.sensor
                sensor.battery_level = payload.get('battery_level')
                sensor.signal_strength = payload.get('signal_strength')
                sensor.save(update_fields=['battery_level', 'signal_strength'])

                # Log the specific crowd traffic analytics
                SensorObservation.objects.create(
                    sensor=sensor,
                    signal_count=payload.get('signal_count'),
                    estimated_density=payload.get('estimated_density'),
                    observed_at=parse_datetime(payload.get('observed_at'))
                )

        except json.JSONDecodeError:
            logger.error("Failed to decode incoming JSON payload.")
        except Exception as e:
            logger.error(f"Error processing MQTT message: {str(e)}")

    def handle(self, *args, **options):
        # Initialize the Paho MQTT client
        client = mqtt.Client(client_id="flowsense_django_consumer")
        
        # Note: If your Mosquitto broker strictly enforces passwords for all clients, 
        # you must set the backend's credentials here before connecting.
        #client.username_pw_set('flowsense_backend', 'backend')
        client.username_pw_set(settings.MQTT_USER, settings.MQTT_PASSWORD)
        
        client.on_connect = self.on_connect
        client.on_message = self.on_message

        self.stdout.write("Connecting to Mosquitto broker...")
        
        # Connect using the internal Docker network hostname ('mosquitto') on port 1883
        client.connect("mosquitto", 1883, 60)
        
        self.stdout.write("Starting MQTT consumer listening loop...")
        client.loop_forever()