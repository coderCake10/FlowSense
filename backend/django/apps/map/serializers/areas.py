"""
apps/map/serializers/areas.py

Backs:
  GET    /api/v1/map/areas
  POST   /api/v1/map/areas
  GET    /api/v1/map/areas/{id}
  PATCH  /api/v1/map/areas/{id}
  DELETE /api/v1/map/areas/{id}
  GET    /api/v1/map/areas/{id}/floors   (reuses FloorSerializer, see floors.py)

Area is the only Map API resource with a full CRUD surface — everything else
in this app is read-only from the Map API's point of view (writes happen
through the Annotation API instead).
"""
from rest_framework import serializers

from common.serializers import GeoJSONField, TimestampedSerializerMixin
from map.models import Area


class AreaListSerializer(serializers.ModelSerializer):
    """
    Lightweight representation for GET /map/areas — the area picker
    dropdown and the sidebar's building/area list only need identity
    fields, not geometry or description.
    """

    class Meta:
        model = Area
        fields = [
            "id",
            "parent_area",
            "code",
            "name",
            "area_type",
        ]


class AreaDetailSerializer(TimestampedSerializerMixin, serializers.ModelSerializer):
    """
    Full representation for GET /map/areas/{id}.

    NOTE (business logic): `floor_count` / `room_count` style aggregates are
    NOT included here. If a future endpoint needs them, compute them via
    queryset annotation (e.g. `.annotate(floor_count=Count("floors"))`) in
    the view/service layer and expose the annotated attribute as a plain
    `IntegerField(read_only=True)` — the serializer should only ever read an
    already-computed value off the instance, never call `.count()` or run
    aggregate logic itself.
    """

    geometry = GeoJSONField(required=False, allow_null=True)

    class Meta:
        model = Area
        fields = [
            "id",
            "parent_area",
            "code",
            "name",
            "description",
            "area_type",
            "geometry",
            "created_at",
            "updated_at",
        ]


class AreaWriteSerializer(serializers.ModelSerializer):
    """
    POST /map/areas and PATCH /map/areas/{id}.

    Field-level validation (required-ness, `area_type` choice membership,
    `code` uniqueness) is ordinary DRF/model validation and is fine to leave
    here. What must NOT live here:

    NOTE (business logic):
      - Geometry topology/validity checks (self-intersection, containment
        within a parent area, etc.) — belongs in a service function called
        from the view before save.
      - Cascading behavior when `parent_area` changes (e.g. re-validating
        child areas/floors still make spatial sense) — service layer.
      - Any side effects like invalidating a cached map-context payload —
        service layer / signal, not the serializer.
    """

    geometry = GeoJSONField(required=False, allow_null=True)

    class Meta:
        model = Area
        fields = [
            "parent_area",
            "code",
            "name",
            "description",
            "area_type",
            "geometry",
        ]

    def validate_area_type(self, value):
        valid_types = {choice for choice, _ in Area.AREA_TYPE_CHOICES}
        if value not in valid_types:
            raise serializers.ValidationError(f"area_type must be one of {sorted(valid_types)}.")
        return value