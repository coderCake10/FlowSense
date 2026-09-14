"""
apps/annotation/serializers/rooms.py

Backs:
  PATCH /api/v1/annotations/rooms/{id}

`campus.rooms` is owned by the `map` app. Per the Admin Map Annotation
notes, the Room node's edit-info modal explicitly lists what's modifiable:
"Room Code, Room Alias, Image, Description" — nothing else. This
serializer is scoped to exactly that set on purpose: `room_type`,
`is_searchable`, `is_navigable`, `is_active`, `floor`, and `geometry` are
all real, editable Room fields, but none of them are what this specific
endpoint is documented to touch, so they're left out rather than quietly
made PATCH-able through a side door.
"""
from rest_framework import serializers

from map.models import Room


class RoomAnnotationUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ["room_code", "room_alias", "description", "image_path"]