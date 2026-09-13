"""
apps/map/serializers/personnel.py

Backs:
  GET /api/v1/map/personnel
  GET /api/v1/map/rooms/{id}/personnel
"""
from rest_framework import serializers

from map.models import Personnel, RoomPersonnel


class PersonnelSerializer(serializers.ModelSerializer):
    """GET /map/personnel — full personnel directory."""

    class Meta:
        model = Personnel
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "is_active",
        ]
        read_only_fields = fields


class RoomPersonnelSerializer(serializers.ModelSerializer):
    """
    GET /map/rooms/{id}/personnel

    `campus.room_personnel` is a pure join table with no attributes of its
    own, so this flattens straight through to the personnel fields via
    `source=`. The view is expected to filter by room
    (`RoomPersonnel.objects.filter(room_id=...)`)  — that filtering is a
    queryset concern, not something this serializer does.
    """

    id = serializers.IntegerField(source="personnel.id", read_only=True)
    full_name = serializers.CharField(source="personnel.full_name", read_only=True)
    email = serializers.CharField(source="personnel.email", read_only=True)
    phone = serializers.CharField(source="personnel.phone", read_only=True)
    is_active = serializers.BooleanField(source="personnel.is_active", read_only=True)

    class Meta:
        model = RoomPersonnel
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "is_active",
        ]