"""
apps/annotation/serializers/campus.py  (step 14, additive)

Campus editing in Map Annotation: labels in the campus view, floors, adding
rooms, and adding a building.
"""
from rest_framework import serializers

from annotation.serializers.rooms import default_alias
from common.serializers import GeoJSONField
from map.models import Area, CampusLabel, Floor, Room

ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"]


def floor_names(order):
    """Default names for a floor: ("1F", "First floor")."""
    ordinal = ORDINALS[order - 1] if 0 < order <= len(ORDINALS) else f"Floor {order}"
    return f"{order}F", ordinal if ordinal.startswith("Floor") else f"{ordinal} floor"


class CampusLabelSerializer(serializers.ModelSerializer):
    geometry = GeoJSONField()
    area = serializers.PrimaryKeyRelatedField(
        queryset=Area.objects.filter(deleted_at__isnull=True, area_type=Area.TYPE_CAMPUS), required=False
    )

    class Meta:
        model = CampusLabel
        fields = ["id", "area", "name", "geometry", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Enter the label's text.")
        return value

    def validate_geometry(self, value):
        if value is None or value.geom_type != "Point" or not value.hasz:
            raise serializers.ValidationError("Use a GeoJSON Point with three coordinates.")
        return value

    def create(self, validated_data):
        if "area" not in validated_data:
            campus = Area.objects.filter(deleted_at__isnull=True, area_type=Area.TYPE_CAMPUS).order_by("id").first()
            if campus is None:
                raise serializers.ValidationError({"area": "There is no campus area; run seed_campus."})
            validated_data["area"] = campus
        return super().create(validated_data)


class FloorAnnotationSerializer(serializers.ModelSerializer):
    area = serializers.PrimaryKeyRelatedField(queryset=Area.objects.filter(deleted_at__isnull=True))

    class Meta:
        model = Floor
        fields = [
            "id", "area", "floor_order", "glb_node_name", "elevation", "display_name", "short_name",
            "visible_in_kiosk",
        ]
        read_only_fields = ["id"]
        # uq_floor_order is checked in validate() (soft-deleted floors count).
        validators = []

    def validate(self, attrs):
        area = attrs.get("area", getattr(self.instance, "area", None))
        order = attrs.get("floor_order", getattr(self.instance, "floor_order", None))
        if self.instance is not None and "area" in attrs and attrs["area"] != self.instance.area:
            raise serializers.ValidationError({"area": "A floor can't move to another building."})
        if order is not None and order < 1:
            raise serializers.ValidationError({"floor_order": "Floors are numbered from 1."})
        taken = Floor.objects.filter(area=area, floor_order=order, deleted_at__isnull=True)
        if self.instance is not None:
            taken = taken.exclude(pk=self.instance.pk)
        if taken.exists():
            raise serializers.ValidationError({"floor_order": f"{area.name} already has floor {order}."})
        for key in ("display_name", "short_name"):
            if key in attrs:
                attrs[key] = (attrs[key] or "").strip() or None
        return attrs

    def create(self, validated_data):
        validated_data.setdefault("glb_node_name", f"FLOOR_{validated_data['floor_order']}")
        # A floor deleted earlier comes back (floor numbers are unique per building).
        old = Floor.objects.filter(
            area=validated_data["area"], floor_order=validated_data["floor_order"], deleted_at__isnull=False
        ).first()
        if old is not None:
            for key, value in validated_data.items():
                setattr(old, key, value)
            old.deleted_at = None
            old.active = True
            old.save()
            return old
        return super().create(validated_data)


class RoomCreateSerializer(serializers.ModelSerializer):
    floor = serializers.PrimaryKeyRelatedField(queryset=Floor.objects.filter(deleted_at__isnull=True))
    room_code = serializers.CharField(max_length=100)
    room_alias = serializers.CharField(max_length=255, allow_blank=True, required=False)
    description = serializers.CharField(allow_blank=True, allow_null=True, required=False)

    class Meta:
        model = Room
        fields = ["id", "floor", "room_code", "room_alias", "room_type", "description"]
        read_only_fields = ["id"]
        validators = []

    def validate(self, attrs):
        code = attrs["room_code"].strip()
        if not code:
            raise serializers.ValidationError({"room_code": "Enter the room number."})
        if Room.objects.filter(floor=attrs["floor"], room_code=code, deleted_at__isnull=True).exists():
            raise serializers.ValidationError({"room_code": f"{code} is already used on this floor."})
        attrs["room_code"] = code
        attrs["room_alias"] = (attrs.get("room_alias") or "").strip() or default_alias(code)
        attrs["description"] = (attrs.get("description") or "").strip() or None
        attrs.setdefault("room_type", Room.TYPE_ROOM)
        return attrs


class BuildingCreateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=150)
    floors = serializers.IntegerField(min_value=1, max_value=50)

    def validate_code(self, value):
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError("Enter a short code, e.g. B.")
        if Area.objects.filter(code__iexact=value).exists():
            raise serializers.ValidationError(f"The code {value} is already used.")
        return value

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Enter the building's name.")
        return value
