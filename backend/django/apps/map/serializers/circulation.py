"""
apps/map/serializers/circulation.py

Backs:
  GET /api/v1/map/entrances
  GET /api/v1/map/stairs
  GET /api/v1/map/elevators
  GET /api/v1/map/outdoor-walkways

All four are read-only from the Map API — configuration/linkage edits
happen through the Annotation API (PATCH /annotations/entrances/{id},
/annotations/stairs/{id}, /annotations/elevators/{id},
/annotations/outdoor-walkways/{id}).
"""
from rest_framework import serializers

from common.serializers import GeoJSONField
from map.models import Elevator, Entrance, OutdoorWalkway, Stair


class EntranceSerializer(serializers.ModelSerializer):
    geometry = GeoJSONField(required=False, allow_null=True)

    class Meta:
        model = Entrance
        fields = [
            "id",
            "area",
            "name",
            "entrance_type",
            "is_primary",
            "active",
            "geometry",
        ]
        read_only_fields = fields


class StairSerializer(serializers.ModelSerializer):
    geometry = GeoJSONField(required=False, allow_null=True)

    class Meta:
        model = Stair
        fields = [
            "id",
            "area",
            "name",
            "description",
            "active",
            "geometry",
        ]
        read_only_fields = fields


class ElevatorSerializer(serializers.ModelSerializer):
    geometry = GeoJSONField(required=False, allow_null=True)

    class Meta:
        model = Elevator
        fields = [
            "id",
            "area",
            "name",
            "description",
            "active",
            "geometry",
        ]
        read_only_fields = fields


class OutdoorWalkwaySerializer(serializers.ModelSerializer):
    geometry = GeoJSONField(required=False, allow_null=True)

    class Meta:
        model = OutdoorWalkway
        fields = [
            "id",
            "area",
            "name",
            "description",
            "navigable",
            "active",
            "geometry",
        ]
        read_only_fields = fields