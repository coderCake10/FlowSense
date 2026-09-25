"""
apps/hardware/serializers/device.py

Serializers for the device registry and Device Details view
(04 Application/02 Admin/06 Hardware Management.md).
"""
from rest_framework import serializers

from hardware.models import Device, Kiosk, Sensor
from hardware.services import effective_status
from map.models import Area, Floor, Node


def _building_of(area):
    """Walk up from a zone to its building area (or return the area itself)."""
    seen = 0
    while area is not None and area.area_type != Area.TYPE_BUILDING and seen < 10:
        area = area.parent_area
        seen += 1
    return area


def _area_ref(area):
    return {"id": area.id, "code": area.code, "name": area.name} if area else None


def _floor_ref(floor):
    return {"id": floor.id, "floor_order": floor.floor_order, "label": f"{floor.floor_order}F"} if floor else None


def _node_ref(node):
    return {"id": node.id, "name": node.name, "node_type": node.node_type} if node else None


def location_of(device):
    """Building, floor, zone, and a display label ("EYA Building · 1F")."""
    profile = getattr(device, device.device_type, None)
    area = getattr(profile, "area", None)
    floor = getattr(profile, "floor", None)
    building = _building_of(area) or (floor.area if floor else None)
    zone = area if area is not None and building is not None and area.id != building.id else None
    parts = [p for p in ((building.name if building else None), (f"{floor.floor_order}F" if floor else None)) if p]
    return {
        "building": _area_ref(building),
        "floor": _floor_ref(floor),
        "area": _area_ref(zone),
        "label": " · ".join(parts) if parts else "Unassigned",
    }


class DeviceListSerializer(serializers.ModelSerializer):
    """One row of the device registry table (Name, Type, Location, Status, Last Ping)."""

    status = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()

    class Meta:
        model = Device
        fields = ["id", "device_id", "name", "device_type", "status", "enabled", "last_ping_at", "mac_address", "location"]

    def get_status(self, obj):
        return effective_status(obj)

    def get_location(self, obj):
        return location_of(obj)


class DeviceDetailSerializer(serializers.ModelSerializer):
    """Device Details view, grouped into the sections the admin spec lists."""

    status = serializers.SerializerMethodField()
    identity = serializers.SerializerMethodField()
    assignment = serializers.SerializerMethodField()
    connection = serializers.SerializerMethodField()
    sensor = serializers.SerializerMethodField()
    kiosk = serializers.SerializerMethodField()
    firmware = serializers.SerializerMethodField()

    class Meta:
        model = Device
        fields = ["id", "device_id", "name", "device_type", "status", "enabled",
                  "identity", "assignment", "connection", "sensor", "kiosk", "firmware"]

    def _profile(self, obj):
        return getattr(obj, obj.device_type, None)

    def get_status(self, obj):
        return effective_status(obj)

    def get_identity(self, obj):
        return {
            "device_name": obj.name,
            "device_type": obj.device_type,
            "device_id": obj.device_id,
            "mac_address": obj.mac_address,
            "serial_number": obj.serial_number,
            "registration_date": obj.registered_at,
            "discovered_at": obj.discovered_at,
        }

    def get_assignment(self, obj):
        location = location_of(obj)
        profile = self._profile(obj)
        location["map_node"] = _node_ref(getattr(profile, "map_node", None))
        return location

    def get_connection(self, obj):
        profile = self._profile(obj)
        status = effective_status(obj)
        mqtt_status = getattr(profile, "mqtt_status", None)
        # Like the status, MQTT status follows the last ping between runs of
        # the scheduled offline check.
        if mqtt_status == Sensor.MQTT_ONLINE and status == Device.STATUS_OFFLINE:
            mqtt_status = Sensor.MQTT_OFFLINE
        return {
            "status": status,
            "last_ping_at": obj.last_ping_at,
            "last_data_transmission": getattr(profile, "last_transmission_at", None) or obj.last_data_at,
            "mqtt_status": mqtt_status,
            "ip_address": obj.ip_address,
            "uptime_seconds": obj.uptime_seconds,
        }

    def get_sensor(self, obj):
        profile = self._profile(obj)
        if not isinstance(profile, Sensor):
            return None
        latest = profile.observations.order_by("-observed_at").first()
        return {
            "sensor_enabled": profile.sensor_enabled,
            "sampling_interval_seconds": profile.sampling_interval_seconds,
            "battery_level": profile.battery_level,
            "signal_strength": profile.signal_strength,
            "current_signal_count": latest.signal_count if latest else None,
            "last_reading": {
                "observed_at": latest.observed_at,
                "signal_count": latest.signal_count,
                "estimated_density": latest.estimated_density,
            } if latest else None,
        }

    def get_kiosk(self, obj):
        profile = self._profile(obj)
        if not isinstance(profile, Kiosk):
            return None
        return {
            "display_resolution": profile.display_resolution,
            "touchscreen_connected": profile.touchscreen_connected,
            "touchscreen_status": profile.touchscreen_status,
            "orientation": profile.orientation,
            "hardware_status": profile.hardware_status,
            "flowsense_version": profile.flowsense_version,
            "frontend_version": profile.frontend_version,
            "last_application_restart": profile.last_application_restart_at,
            "application_status": profile.application_status,
            "os_version": profile.os_version,
        }

    def get_firmware(self, obj):
        profile = self._profile(obj)
        return {
            "version": getattr(profile, "firmware_version", None),
            "last_update": getattr(profile, "firmware_updated_at", None),
            "status": getattr(profile, "firmware_status", None),
        }


class DeviceRegisterSerializer(serializers.Serializer):
    """The Register modal: Device Name, Map Node, Enabled, and (sensors) Sampling Interval."""

    name = serializers.CharField(max_length=150)
    enabled = serializers.BooleanField(default=True)
    map_node_id = serializers.IntegerField(required=False, allow_null=True)
    sampling_interval_seconds = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=86400)

    def validate_map_node_id(self, value):
        return _validate_free_node(value, self.context["device"])

    def validate(self, data):
        device = self.context["device"]
        if device.device_type == Device.TYPE_SENSOR and data.get("sampling_interval_seconds") is None:
            raise serializers.ValidationError(
                {"sampling_interval_seconds": "Required when registering a sensor."}
            )
        if device.device_type == Device.TYPE_KIOSK:
            data.pop("sampling_interval_seconds", None)
        return data


class DeviceUpdateSerializer(serializers.Serializer):
    """PATCH /hardware/devices/{id}: name, map node, building/zone, floor, sampling interval."""

    name = serializers.CharField(max_length=150, required=False)
    map_node_id = serializers.IntegerField(required=False, allow_null=True)
    area_id = serializers.IntegerField(required=False, allow_null=True)
    floor_id = serializers.IntegerField(required=False, allow_null=True)
    sampling_interval_seconds = serializers.IntegerField(required=False, min_value=1, max_value=86400)

    def validate_map_node_id(self, value):
        return _validate_free_node(value, self.context["device"])

    def validate(self, data):
        device = self.context["device"]
        profile = getattr(device, device.device_type, None)
        out = {}
        if "name" in data:
            out["name"] = data["name"]
        if "map_node_id" in data:
            out["map_node"] = Node.objects.get(pk=data["map_node_id"]) if data["map_node_id"] else None
        if "area_id" in data:
            area = None
            if data["area_id"] is not None:
                area = Area.objects.filter(pk=data["area_id"], deleted_at__isnull=True).first()
                if area is None:
                    raise serializers.ValidationError({"area_id": "No such area."})
            out["area"] = area
        if "floor_id" in data:
            floor = None
            if data["floor_id"] is not None:
                floor = Floor.objects.filter(pk=data["floor_id"], deleted_at__isnull=True).select_related("area").first()
                if floor is None:
                    raise serializers.ValidationError({"floor_id": "No such floor."})
            out["floor"] = floor
        area = out.get("area", getattr(profile, "area", None))
        floor = out.get("floor", getattr(profile, "floor", None))
        if area is not None and floor is not None and _building_of(area) != floor.area:
            raise serializers.ValidationError({"floor_id": "The floor isn't in the device's building."})
        if "sampling_interval_seconds" in data:
            if device.device_type != Device.TYPE_SENSOR:
                raise serializers.ValidationError({"sampling_interval_seconds": "Only sensors have a sampling interval."})
            out["sampling_interval_seconds"] = data["sampling_interval_seconds"]
        return out


def _validate_free_node(node_id, device):
    """A map node exists and isn't already attached to another device."""
    if node_id is None:
        return None
    node = Node.objects.filter(pk=node_id).first()
    if node is None:
        raise serializers.ValidationError("No such map node.")
    for model in (Sensor, Kiosk):
        holder = model.objects.filter(map_node_id=node_id).exclude(device=device).select_related("device").first()
        if holder is not None:
            raise serializers.ValidationError(
                f"Map node already attached to {holder.device.name or holder.device.device_id}."
            )
    return node_id
