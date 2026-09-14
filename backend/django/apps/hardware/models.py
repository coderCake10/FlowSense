"""
apps/hardware/models.py

Owns: 
hardware.devices, 
hardware.kiosks, 
hardware.sensors,
hardware.sensor_observations

Also referenced by: 
analytics (KioskSession.kiosk, 
HourlyKioskStatistic.kiosk,
SensorStatistic.sensor), 
system (device/kiosk/sensor counts for status page)
"""
from django.db import models

from map.models import Area, Floor, Node

class Device(models.Model):
    TYPE_KIOSK = "kiosk"
    TYPE_SENSOR = "sensor"
    DEVICE_TYPE_CHOICES = [
        (TYPE_KIOSK, "Kiosk"),
        (TYPE_SENSOR, "Sensor"),
    ]

    STATUS_UNREGISTERED = "unregistered"
    STATUS_REGISTERED = "registered"
    STATUS_ONLINE = "online"
    STATUS_OFFLINE = "offline"
    STATUS_DISABLED = "disabled"
    STATUS_DECOMMISSIONED = "decommissioned"
    STATUS_CHOICES = [
        (STATUS_UNREGISTERED, "Unregistered"),
        (STATUS_REGISTERED, "Registered"),
        (STATUS_ONLINE, "Online"),
        (STATUS_OFFLINE, "Offline"),
        (STATUS_DISABLED, "Disabled"),
        (STATUS_DECOMMISSIONED, "Decommissioned"),
    ]

    id = models.BigAutoField(primary_key=True)
    device_id = models.CharField(max_length=150, unique=True)
    device_type = models.CharField(max_length=20, choices=DEVICE_TYPE_CHOICES)
    name = models.CharField(max_length=150, null=True, blank=True)
    serial_number = models.CharField(max_length=150, unique=True, null=True, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_UNREGISTERED)
    enabled = models.BooleanField(default=False)
    # Postgres MACADDR has no native Django field; stored as text (e.g. "aa:bb:cc:dd:ee:ff")
    mac_address = models.CharField(max_length=17, null=True, blank=True)
    mqtt_client_id = models.CharField(max_length=255, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    last_ping_at = models.DateTimeField(null=True, blank=True)
    last_data_at = models.DateTimeField(null=True, blank=True)
    uptime_seconds = models.BigIntegerField(null=True, blank=True)
    discovered_at = models.DateTimeField(auto_now_add=True)
    registered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"hardware"."devices"'
        indexes = [
            models.Index(fields=["status"], name="idx_devices_status"),
            models.Index(fields=["device_type"], name="idx_devices_type"),
        ]

    def __str__(self):
        return f"{self.device_id} ({self.device_type})"


class Kiosk(models.Model):
    device = models.OneToOneField(
        Device,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="kiosk",
        db_column="device_id",
    )
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kiosks",
        db_column="area_id",
    )
    floor = models.ForeignKey(
        Floor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kiosks",
        db_column="floor_id",
    )
    map_node = models.OneToOneField(
        Node,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kiosk",
        db_column="map_node_id",
    )
    display_resolution = models.CharField(max_length=50, null=True, blank=True)
    touchscreen_connected = models.BooleanField(null=True, blank=True)
    touchscreen_status = models.CharField(max_length=50, null=True, blank=True)
    orientation = models.CharField(max_length=30, null=True, blank=True)
    hardware_status = models.CharField(max_length=50, null=True, blank=True)
    flowsense_version = models.CharField(max_length=50, null=True, blank=True)
    frontend_version = models.CharField(max_length=50, null=True, blank=True)
    last_application_restart_at = models.DateTimeField(null=True, blank=True)
    application_status = models.CharField(max_length=50, null=True, blank=True)
    os_version = models.CharField(max_length=100, null=True, blank=True)
    firmware_version = models.CharField(max_length=100, null=True, blank=True)
    firmware_updated_at = models.DateTimeField(null=True, blank=True)
    firmware_status = models.CharField(max_length=30, null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"hardware"."kiosks"'
        indexes = [
            models.Index(fields=["map_node"], name="idx_devices_map_lookup"),
        ]

    def __str__(self):
        return self.device.name or self.device.device_id


class Sensor(models.Model):
    MQTT_ONLINE = "online"
    MQTT_OFFLINE = "offline"
    MQTT_UNKNOWN = "unknown"
    MQTT_STATUS_CHOICES = [
        (MQTT_ONLINE, "Online"),
        (MQTT_OFFLINE, "Offline"),
        (MQTT_UNKNOWN, "Unknown"),
    ]

    device = models.OneToOneField(
        Device,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="sensor",
        db_column="device_id",
    )
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sensors",
        db_column="area_id",
    )
    floor = models.ForeignKey(
        Floor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sensors",
        db_column="floor_id",
    )
    map_node = models.OneToOneField(
        Node,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sensor",
        db_column="map_node_id",
    )
    sampling_interval_seconds = models.IntegerField(null=True, blank=True)
    sensor_enabled = models.BooleanField(default=False)
    battery_level = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    signal_strength = models.IntegerField(null=True, blank=True)
    mqtt_status = models.CharField(
        max_length=30, choices=MQTT_STATUS_CHOICES, default=MQTT_UNKNOWN, null=True, blank=True
    )
    firmware_version = models.CharField(max_length=100, null=True, blank=True)
    firmware_status = models.CharField(max_length=30, null=True, blank=True)
    last_transmission_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"hardware"."sensors"'

    def __str__(self):
        return self.device.name or self.device.device_id


class SensorObservation(models.Model):
    id = models.BigAutoField(primary_key=True)
    sensor = models.ForeignKey(
        Sensor,
        on_delete=models.CASCADE,
        related_name="observations",
        db_column="sensor_id",
        to_field="device_id",
    )
    observed_at = models.DateTimeField()
    estimated_density = models.DecimalField(max_digits=11, decimal_places=3, null=True, blank=True)
    signal_count = models.IntegerField(null=True, blank=True)
    battery_level = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    signal_strength = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = '"hardware"."sensor_observations"'
        indexes = [
            models.Index(
                fields=["sensor", "-observed_at"], name="idx_sensor_obs_sensor_time"
            ),
            models.Index(fields=["-observed_at"], name="idx_sensor_observations_time"),
        ]

    def __str__(self):
        return f"{self.sensor_id} @ {self.observed_at}"