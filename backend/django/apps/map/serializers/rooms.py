"""
apps/map/serializers/rooms.py

Backs:
  GET /api/v1/map/rooms
  GET /api/v1/map/rooms/{id}

Room mutation (code/alias/description/image edits) happens through the
Annotation API (PATCH /annotations/rooms/{id}), so both serializers here are
read-only. Personnel are intentionally NOT nested into RoomDetailSerializer
— they have their own endpoint (GET /map/rooms/{id}/personnel, see
personnel.py) so the room detail payload stays cheap for the map/list view
that renders hundreds of rooms at once.
"""
from rest_framework import serializers

from common.serializers import GeoJSONField
from map.models import Room


class RoomListSerializer(serializers.ModelSerializer):
    """
    Used for GET /map/rooms and for the sidebar's per-floor room list. Kept
    deliberately small — no geometry, no description — since this is the
    payload rendered for every room across every building at once.
    """

    class Meta:
        model = Room
        fields = [
            "id",
            "floor",
            "room_code",
            "room_alias",
            "room_type",
            "is_searchable",
            "is_navigable",
            "is_active",
        ]
        read_only_fields = fields


class RoomDetailSerializer(serializers.ModelSerializer):
    """
    Used for GET /map/rooms/{id} — the Location Details sidebar. Includes
    the room's parent area id as a plain attribute lookup
    (`source="floor.area_id"`); this is a direct FK traversal, not a
    calculation, so it's fine to declare here.

    NOTE (business logic): the view/queryset is responsible for
    `select_related("floor")` so this traversal doesn't trigger an extra
    query per room — that's a performance concern for the view, not
    something the serializer should compensate for.
    """

    geometry = GeoJSONField(required=False, allow_null=True)
    area_id = serializers.IntegerField(source="floor.area_id", read_only=True)

    class Meta:
        model = Room
        fields = [
            "id",
            "floor",
            "area_id",
            "room_code",
            "room_alias",
            "description",
            "room_type",
            "is_searchable",
            "is_navigable",
            "is_active",
            "geometry",
            "image_path",
        ]
        read_only_fields = fields