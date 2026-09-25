"""
Hardware: device registry API (/api/v1/hardware/devices) and the ESP32 ->
Mosquitto -> consumer -> database pipeline (architecture notes, IoT).
"""
import json
from types import SimpleNamespace

from django.test import TestCase

from hardware.management.commands.run_mqtt_consumer import Command
from hardware.models import Device, SensorObservation
from hardware.services import register_device, validate_mqtt_topic
from map.models import Area

READING = {
    "device_id": "esp32-eya-lobby-01",
    "device_type": "sensor",
    "mac_address": "24:6F:28:AA:BB:01",
    "battery_level": 87.5,
    "signal_strength": -61,
    "signal_count": 14,
    "estimated_density": 0.35,
    "observed_at": "2026-09-24T13:05:00+08:00",
}


def publish(topic="flowsense/sensors/eya/lobby", **overrides):
    """Feeds one MQTT message through the consumer's real handler."""
    message = SimpleNamespace(topic=topic, payload=json.dumps({**READING, **overrides}).encode())
    Command().on_message(client=None, userdata=None, msg=message)


class HardwareApiTests(TestCase):
    def test_device_registry_requires_an_admin(self):
        self.assertEqual(self.client.get("/api/v1/hardware/devices").status_code, 401)


class SensorPipelineTests(TestCase):
    def register(self, **extra):
        device = Device.objects.get(device_id="esp32-eya-lobby-01")
        return register_device(device, {"name": "EYA Lobby Sensor 1", "enabled": True,
                                        "sampling_interval_seconds": 30, **extra})

    def test_first_message_discovers_an_unregistered_sensor_and_stores_nothing(self):
        publish()
        device = Device.objects.get(device_id="esp32-eya-lobby-01")
        self.assertEqual(device.status, Device.STATUS_UNREGISTERED)
        self.assertEqual(device.device_type, Device.TYPE_SENSOR)
        self.assertTrue(hasattr(device, "sensor"))
        self.assertEqual(SensorObservation.objects.count(), 0)

    def test_registered_sensor_readings_are_stored(self):
        publish()
        self.register()
        publish(signal_count=17, estimated_density=0.42)
        observation = SensorObservation.objects.get()
        self.assertEqual(observation.signal_count, 17)
        self.assertEqual(float(observation.estimated_density), 0.42)
        self.assertEqual(float(observation.battery_level), 87.5)
        device = Device.objects.get(device_id="esp32-eya-lobby-01")
        self.assertIsNotNone(device.last_data_at)
        self.assertIsNotNone(device.sensor.last_transmission_at)
        self.assertEqual(float(device.sensor.battery_level), 87.5)

    def test_missing_observed_at_uses_the_receive_time(self):
        publish()
        self.register()
        publish(observed_at=None)
        self.assertIsNotNone(SensorObservation.objects.get().observed_at)

    def test_registration_saves_the_map_node(self):
        # Before the fix a typo (map_node_Id) silently discarded it.
        from map.models import Floor, Node
        from django.contrib.gis.geos import Point

        area = Area.objects.create(code="EYA", name="EYA Building", area_type="building")
        floor = Floor.objects.create(area=area, floor_order=1)
        node = Node.objects.create(floor=floor, name="Lobby sensor", node_type="sensor",
                                   geometry=Point(0, 0, 1, srid=3857))
        publish()
        self.register(map_node_id=node.id)
        self.assertEqual(Device.objects.get(device_id="esp32-eya-lobby-01").sensor.map_node_id, node.id)

    def test_sensor_assigned_to_a_building_cannot_publish_for_another(self):
        publish()
        self.register()
        sensor = Device.objects.get(device_id="esp32-eya-lobby-01").sensor
        sensor.area = Area.objects.create(code="EYA", name="EYA Building", area_type="building")
        sensor.save()
        publish(topic="flowsense/sensors/eya/lobby")         # matches EYA: stored
        publish(topic="flowsense/sensors/library/entrance")  # other building: dropped
        self.assertEqual(SensorObservation.objects.count(), 1)

    def test_malformed_topic_and_payload_are_rejected(self):
        self.assertFalse(validate_mqtt_topic("flowsense/sensors", READING))
        Command().on_message(None, None, SimpleNamespace(topic="flowsense/sensors/eya/lobby", payload=b"not json"))
        publish(device_id=None)  # missing identity fields
        self.assertEqual(Device.objects.count(), 0)

    def test_registry_list_exposes_the_ids_needed_to_register(self):
        from hardware.serializers.device import DeviceListSerializer

        publish()
        data = DeviceListSerializer(Device.objects.get()).data
        self.assertEqual(data["device_id"], "esp32-eya-lobby-01")
        self.assertIsInstance(data["id"], int)


from datetime import timedelta

from django.contrib.gis.geos import Point
from django.core.management import call_command
from django.utils import timezone

from analytics.models import Alert, AuditEvent
from common.testing import API, data, error, meta, sign_in_as_admin
from hardware.services import mark_offline_devices
from map.models import Floor, Node


class DeviceRegistryApiTests(TestCase):
    """Hardware Management: registry, register, update, enable/disable, decommission."""

    def setUp(self):
        call_command("seed_campus", stdout=open("/dev/null", "w"))
        self.admin = sign_in_as_admin(self.client)
        publish()  # discovers esp32-eya-lobby-01 as unregistered
        self.device = Device.objects.get(device_id="esp32-eya-lobby-01")
        self.url = f"{API}/hardware/devices/{self.device.id}"

    def post(self, url, body=None):
        return self.client.post(url, body or {}, content_type="application/json")

    def patch(self, body):
        return self.client.patch(self.url, body, content_type="application/json")

    def register(self):
        return self.post(f"{self.url}/register", {"name": "Lobby Sensor", "enabled": True,
                                                  "sampling_interval_seconds": 30})

    def test_registry_lists_the_discovered_device_with_filters(self):
        rows = data(self.client.get(f"{API}/hardware/devices"))
        self.assertEqual([r["device_id"] for r in rows], ["esp32-eya-lobby-01"])
        self.assertEqual(rows[0]["status"], "unregistered")
        self.assertEqual(rows[0]["location"]["label"], "Unassigned")
        self.assertEqual(data(self.client.get(f"{API}/hardware/devices?device_type=kiosk")), [])
        self.assertEqual(len(data(self.client.get(f"{API}/hardware/devices?search=lobby"))), 1)
        # Unregistered devices are not "registered sensors".
        self.assertEqual(data(self.client.get(f"{API}/hardware/sensors")), [])

    def test_register_brings_a_recently_seen_sensor_online_and_is_audited(self):
        response = self.register()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data(response)["status"], "online")
        self.assertEqual(data(response)["sensor"]["sampling_interval_seconds"], 30)
        self.assertEqual(self.register().status_code, 409)
        event = AuditEvent.objects.get(action="create")
        self.assertEqual((event.entity_type, event.entity_id, event.admin_user), ("device", self.device.id, self.admin))

    def test_sensor_registration_requires_a_sampling_interval(self):
        response = self.post(f"{self.url}/register", {"name": "Lobby Sensor"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("sampling_interval_seconds", error(response)["fields"])

    def test_update_name_location_and_interval(self):
        self.register()
        eya_floor_1 = Floor.objects.get(area__code="EYA", floor_order=1)
        response = self.patch({"name": "Main Lobby", "area_id": eya_floor_1.area_id,
                               "floor_id": eya_floor_1.id, "sampling_interval_seconds": 60})
        self.assertEqual(response.status_code, 200, response.content)
        body = data(response)
        self.assertEqual(body["name"], "Main Lobby")
        self.assertEqual(body["assignment"]["building"]["code"], "EYA")
        self.assertEqual(body["assignment"]["floor"]["label"], "1F")
        self.assertEqual(body["sensor"]["sampling_interval_seconds"], 60)
        row = data(self.client.get(f"{API}/hardware/devices"))[0]
        self.assertEqual(row["location"]["label"], "EYA Building · 1F")

    def test_map_node_can_only_belong_to_one_device(self):
        self.register()
        floor = Floor.objects.get(area__code="EYA", floor_order=1)
        node = Node.objects.create(floor=floor, name="Lobby", node_type=Node.TYPE_SENSOR, geometry=Point(0, 0, 0, srid=3857))
        self.assertEqual(self.patch({"map_node_id": node.id}).status_code, 200)
        publish(device_id="esp32-eya-hall-02", mac_address="24:6F:28:AA:BB:02")
        other = Device.objects.get(device_id="esp32-eya-hall-02")
        clash = self.post(f"{API}/hardware/devices/{other.id}/register",
                          {"name": "Hall", "sampling_interval_seconds": 30, "map_node_id": node.id})
        self.assertEqual(clash.status_code, 400)
        self.assertIn("map_node_id", error(clash)["fields"])
        self.assertEqual(error(clash)["code"], "VALIDATION_ERROR")

    def test_floor_must_be_in_the_devices_building(self):
        self.register()
        eya = Floor.objects.get(area__code="EYA", floor_order=1).area
        from map.models import Area
        other = Area.objects.create(code="ABLDG", name="A Building", area_type=Area.TYPE_BUILDING, parent_area=eya.parent_area)
        other_floor = Floor.objects.create(area=other, floor_order=1)
        response = self.patch({"area_id": eya.id, "floor_id": other_floor.id})
        self.assertEqual(response.status_code, 400)

    def test_disable_stops_storing_readings_and_enable_resumes(self):
        self.register()
        disabled = self.post(f"{self.url}/commands/disable")
        self.assertEqual(data(disabled)["status"], "disabled")
        publish(signal_count=3)
        self.assertEqual(SensorObservation.objects.count(), 0)
        self.assertEqual(data(self.post(f"{self.url}/commands/enable"))["status"], "online")
        publish(signal_count=4)
        self.assertEqual(SensorObservation.objects.get().signal_count, 4)
        self.assertEqual(AuditEvent.objects.filter(action__in=["activate", "deactivate"]).count(), 2)

    def test_unregistered_device_cant_be_enabled(self):
        self.assertEqual(self.post(f"{self.url}/commands/enable").status_code, 409)

    def test_ping_and_restart_report_not_implemented(self):
        self.register()
        ping = self.post(f"{self.url}/commands/ping")
        self.assertEqual(ping.status_code, 501)
        self.assertEqual(error(ping)["code"], "NOT_IMPLEMENTED")
        self.assertEqual(self.post(f"{self.url}/commands/restart").status_code, 501)
        self.assertEqual(self.post(f"{self.url}/commands/explode").status_code, 404)

    def test_delete_decommissions_and_hides_the_device(self):
        self.register()
        deleted = self.client.delete(self.url)
        self.assertEqual(deleted.status_code, 200)  # the contract answers DELETE with a success envelope
        self.assertEqual(deleted.json(), {"success": True, "data": None, "message": "Deleted."})
        self.device.refresh_from_db()
        self.assertEqual(self.device.status, "decommissioned")
        self.assertIsNotNone(self.device.deleted_at)
        self.assertEqual(data(self.client.get(f"{API}/hardware/devices")), [])
        self.assertEqual(self.client.get(self.url).status_code, 404)
        publish()  # a decommissioned device's messages are ignored
        self.assertEqual(SensorObservation.objects.count(), 0)
        self.assertEqual(Device.objects.get(pk=self.device.pk).status, "decommissioned")

    def test_put_is_not_allowed(self):
        self.assertEqual(self.client.put(self.url, {}, content_type="application/json").status_code, 405)

    def test_sensor_observations_and_statistics(self):
        self.register()
        for count in (5, 9, 7):
            publish(signal_count=count, observed_at=None)
        sensor_url = f"{API}/hardware/sensors/{self.device.id}"
        self.assertEqual(data(self.client.get(f"{API}/hardware/sensors"))[0]["id"], self.device.id)
        response = self.client.get(f"{sensor_url}/observations?page_size=2")
        self.assertEqual(meta(response)["total_count"], 3)
        self.assertEqual(meta(response)["total_pages"], 2)
        self.assertEqual(len(data(response)), 2)
        stats = data(self.client.get(f"{sensor_url}/statistics?hours=1"))
        self.assertEqual(stats["observations_received"], 3)
        self.assertEqual(stats["observations_expected"], 120)
        self.assertEqual(stats["peak_signal_count"], 9)
        self.assertEqual(stats["transmission_reliability_percent"], 2.5)
        self.assertEqual(self.client.get(f"{sensor_url}/statistics?hours=0").status_code, 400)


class ConnectivityTests(TestCase):
    """Online/offline tracking and the offline alert."""

    def setUp(self):
        publish()
        self.device = Device.objects.get(device_id="esp32-eya-lobby-01")
        register_device(self.device, {"name": "Lobby Sensor", "enabled": True, "sampling_interval_seconds": 30})

    def test_silent_device_goes_offline_with_an_alert_and_recovers(self):
        Device.objects.filter(pk=self.device.pk).update(last_ping_at=timezone.now() - timedelta(minutes=5))
        self.assertEqual(mark_offline_devices(), 1)
        self.device.refresh_from_db()
        self.assertEqual(self.device.status, "offline")
        alert = Alert.objects.get()
        self.assertEqual((alert.severity, alert.entity_type, alert.entity_id), ("warning", "device", self.device.id))
        # Running again doesn't duplicate the alert.
        mark_offline_devices()
        self.assertEqual(Alert.objects.count(), 1)
        publish()
        self.device.refresh_from_db()
        self.assertEqual(self.device.status, "online")
        alert.refresh_from_db()
        self.assertIsNotNone(alert.cleared_at)

    def test_recent_device_stays_online(self):
        self.assertEqual(mark_offline_devices(), 0)

    def test_registry_shows_offline_even_before_the_scheduled_check_runs(self):
        Device.objects.filter(pk=self.device.pk).update(last_ping_at=timezone.now() - timedelta(minutes=5))
        from django.test import Client
        client = Client()
        sign_in_as_admin(client)
        row = data(client.get(f"{API}/hardware/devices"))[0]
        self.assertEqual(row["status"], "offline")
        self.assertEqual(len(data(client.get(f"{API}/hardware/devices?status=offline"))), 1)
        self.assertEqual(data(client.get(f"{API}/hardware/devices?status=online")), [])
        connection = data(client.get(f"{API}/hardware/devices/{self.device.id}"))["connection"]
        self.assertEqual((connection["status"], connection["mqtt_status"]), ("offline", "offline"))


from unittest import mock

from django.core.cache import cache
from rest_framework.throttling import SimpleRateThrottle


class KioskHeartbeatTests(TestCase):
    """POST /hardware/kiosks/heartbeat: kiosk discovery and online status (QA-62)."""

    URL = f"{API}/hardware/kiosks/heartbeat"
    INFO = {
        "device_id": "kiosk-3f9a2c7e41b0",
        "display_resolution": "2360×1640",
        "orientation": "landscape",
        "touchscreen_connected": True,
        "frontend_version": "1.0.0",
        "os_version": "iPadOS 17.5",
    }

    def setUp(self):
        cache.clear()

    def beat(self, **overrides):
        return self.client.post(self.URL, {**self.INFO, **overrides}, content_type="application/json")

    def test_first_heartbeat_discovers_an_unregistered_kiosk(self):
        response = self.beat()
        self.assertEqual(response.status_code, 200)
        body = data(response)
        self.assertEqual((body["status"], body["records_sessions"]), ("unregistered", False))
        device = Device.objects.get(device_id="kiosk-3f9a2c7e41b0")
        self.assertEqual(device.device_type, "kiosk")
        self.assertEqual(device.kiosk.os_version, "iPadOS 17.5")
        self.assertEqual(device.ip_address, "127.0.0.1")
        self.assertIsNotNone(device.last_ping_at)

    def test_registered_kiosk_is_online_records_sessions_and_shows_its_details(self):
        started = (timezone.now() - timedelta(minutes=10)).isoformat()
        self.beat()
        device = Device.objects.get(device_id="kiosk-3f9a2c7e41b0")
        register_device(device, {"name": "EYA Lobby Kiosk", "enabled": True})
        body = data(self.beat(application_started_at=started))
        self.assertEqual((body["status"], body["records_sessions"], body["name"]), ("online", True, "EYA Lobby Kiosk"))
        # The id is what the kiosk session API takes.
        session = self.client.post(f"{API}/sessions/kiosk", {"kiosk": body["id"]}, content_type="application/json")
        self.assertEqual(session.status_code, 201)
        sign_in_as_admin(self.client)
        detail = data(self.client.get(f"{API}/hardware/kiosks/{body['id']}"))
        self.assertEqual(detail["kiosk"]["display_resolution"], "2360×1640")
        self.assertEqual(detail["kiosk"]["touchscreen_status"], "connected")
        self.assertEqual(detail["kiosk"]["application_status"], "running")
        self.assertGreaterEqual(detail["connection"]["uptime_seconds"], 599)

    def test_silent_kiosk_goes_offline(self):
        self.beat()
        device = Device.objects.get(device_id="kiosk-3f9a2c7e41b0")
        register_device(device, {"name": "Kiosk", "enabled": True})
        Device.objects.filter(pk=device.pk).update(last_ping_at=timezone.now() - timedelta(minutes=2))
        self.assertEqual(mark_offline_devices(), 1)
        self.assertEqual(Alert.objects.get().entity_id, device.pk)

    def test_invalid_device_id_is_rejected_in_the_error_envelope(self):
        response = self.beat(device_id="../../etc")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(error(response)["code"], "VALIDATION_ERROR")
        self.assertIn("device_id", error(response)["fields"])
        self.assertFalse(Device.objects.exists())

    def test_decommissioned_kiosk_stays_decommissioned(self):
        self.beat()
        device = Device.objects.get(device_id="kiosk-3f9a2c7e41b0")
        register_device(device, {"name": "Kiosk", "enabled": True})
        from hardware.services import decommission_device
        decommission_device(device)
        body = data(self.beat())
        self.assertEqual((body["status"], body["records_sessions"]), ("decommissioned", False))
        self.assertEqual(Device.objects.count(), 1)

    def test_heartbeats_are_rate_limited_per_ip(self):
        with mock.patch.dict(SimpleRateThrottle.THROTTLE_RATES, {"kiosk_heartbeat": "2/min"}):
            self.assertEqual(self.beat().status_code, 200)
            self.assertEqual(self.beat().status_code, 200)
            limited = self.beat()
        self.assertEqual(limited.status_code, 429)
        self.assertEqual(error(limited)["code"], "RATE_LIMITED")
