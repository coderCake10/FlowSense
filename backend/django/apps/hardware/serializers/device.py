'''
apps/hardware/serializers/device.py

DeviceListSerializer
DeviceDetailSerializer
DeviceRegisterSerializer
DeviceUpdateSerializer
'''
from rest_framework import serializers

from hardware.models import Device

DEVICE_TYPES = [
        'kiosk', 
        'sensor'
    ]

DEVICE_STATUS = [
    'unregistered',
    'registered',
    'online',
    'offline',
    'disabled',
    'decommissioned'
]

class DeviceListSerializer(serializers.Serializer):
    """
    Summarized fields for the device registry table (name, type, location, status, 
    last ping)

    NOTE: Device location should be determined by the area_id and floor_id from 
    the hardware.<device_type> that references the hardware.device
    """
    name = serializers.CharField(max_length=150, required=True)
    device_type = serializers.ChoiceField(choices=DEVICE_TYPES, default='sensor')
    status = serializers.ChoiceField(choices=DEVICE_STATUS, default='unregistered')
    last_ping = serializers.DateTimeField(read_only=True)

    location = serializers.SerializerMethodField()

    def get_location(self, obj):

        if hasattr(obj, 'kiosk') and obj.kiosk:
            kiosk_record = obj.kiosk

            area_name = kiosk_record.area.name if kiosk_record.area else "Unassigned Area"
            floor_name = kiosk_record.floor.glb_node_name if kiosk_record.floor else "Unassigned Floor"

            return f"{area_name}, {floor_name}"
        
        elif hasattr(obj, 'sensor') and obj.sensor:
            sensor_record = obj.sensor

            area_name = sensor_record.area.name if sensor_record.area else "Unassigned Area"
            floor_name = sensor_record.floor.glb_node_name if sensor_record.floor else "Unassigned Floor"

            return f"{area_name}, {floor_name}"

        return "Location Unknown"

class DeviceDetailSerializer(serializers.Serializer):
    """
    Base identity/connection fields shared across device types
    
    Includes:
    Identity - Device Name, Device Type, Device ID, Registration Date
    Assignment - Building, Floor, Area, Map Node
    Connection - Status, Last Ping, IP Address, Uptime
    Firmware - Status (Up to Date/Out of Date)

    Found in hardware.device:
    Device Name (name)
    Device Type (device_type)
    Device ID (device_id)
    Registration Date (registered_at)
    Status (status)
    Last Ping (last_ping_at)
    IP Address (ip_address)
    Uptime (uptime_seconds)

    Found in hardware.<device_type>:
    Building (area_id)
    Floor (floor_id)
    Area (area_id.parent_area_id)
    Map Node (map_node_id)
    Last Update (firmware_updated_at)
    Status (firmware_status)
    """
    name = serializers.CharField(max_length=150, required=True)
    device_type = serializers.ChoiceField(choices=DEVICE_TYPES)
    device_id = serializers.CharField(max_length=150, required=True)
    registration_date = serializers.DateTimeField()
    status = serializers.ChoiceField(choices=DEVICE_STATUS)
    last_ping = serializers.DateTimeField()
    ip_address = serializers.CharField()
    uptime = serializers.IntegerField()

    building = serializers.SerializerMethodField()
    floor = serializers.SerializerMethodField()
    area = serializers.SerializerMethodField()
    map_node = serializers.SerializerMethodField()
    #fw = firmware
    fw_status = serializers.SerializerMethodField()

    def _get_hardware_profile(self, obj):
        if obj.device_type == 'kiosk' and hasattr(obj, 'kiosk'):
            return obj.kiosk
        elif obj.device_type == 'sensor' and hasattr(obj, 'sensor'):
            return obj.sensor
        return None

    def get_building(self, obj):
        profile = self._get_hardware_profile(obj)
        return profile.area_id if profile and profile.area else None

    def get_floor(self, obj):
        profile = self._get_hardware_profile(obj)
        return profile.floor_id if profile and profile.floor else None

    def get_area(self, obj):
        profile = self._get_hardware_profile(obj)
        if profile and profile.area and profile.area.parent_area:
            return profile.area.parent_area.id
        return None

    def get_map_node(self, obj):
        profile = self._get_hardware_profile(obj)
        return profile.map_node_id if profile and profile.map_node else None

    def get_fw_status(self, obj):
        profile = self._get_hardware_profile(obj)
        return profile.firmware_status if profile else None

class DeviceRegisterSerializer(serializers.Serializer):
    """
    Input validation for the device registration modal
    """
    name = serializers.CharField(max_length=150, required=True)
    enabled = serializers.BooleanField(default=True)
    map_node_id = serializers.IntegerField(required=False, allow_null=True)
    sampling_interval_seconds = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, data):
        device = self.context.get('device')

        if device.device_type == 'sensor' and data.get('sampling_interval_seconds') is None:
            raise serializers.ValidationError(
                {"sampling_interval_seconds": "This field is required when registering a sensor."}
            )

        if device.device_type == 'kiosk' and data.get('sampling_interval_seconds') is not None:
            data.pop('sampling_interval_seconds', None)

        return data

class DeviceUpdateSerializer(serializers.ModelSerializer):
    """
    Input validation for PATCH metadata (name, node, zone)[cite: 3].
    """
    class Meta:
        model = Device
        fields = ['name', 'enabled', 'status']