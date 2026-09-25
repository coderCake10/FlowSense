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

The alias is optional for admins. `room_alias` is NOT NULL in the schema,
so a blank alias is stored as "Room <code>", the same name `seed_campus`
gives rooms without one. A blank description is stored as NULL.
"""
from rest_framework import serializers

from map.models import Room


def default_alias(room_code):
    return f"Room {room_code}"


class RoomAnnotationUpdateSerializer(serializers.ModelSerializer):
    room_code = serializers.CharField(max_length=100)
    room_alias = serializers.CharField(max_length=255, allow_blank=True, required=False)
    description = serializers.CharField(allow_blank=True, allow_null=True, required=False)

    class Meta:
        model = Room
        fields = ["room_code", "room_alias", "description", "image_path"]

    def validate_room_code(self, value):
        code = value.strip()
        if not code:
            raise serializers.ValidationError("Enter the room number.")
        # uq_room_code_per_floor: `floor` isn't writable here, so DRF can't
        # build the unique-together check itself.
        taken = Room.objects.filter(floor=self.instance.floor, room_code=code).exclude(
            pk=self.instance.pk
        )
        if taken.exists():
            raise serializers.ValidationError(f"{code} is already used on this floor.")
        return code

    def validate(self, attrs):
        room = self.instance
        code = attrs.get("room_code", room.room_code)
        if "room_alias" in attrs:
            attrs["room_alias"] = attrs["room_alias"].strip() or default_alias(code)
        elif code != room.room_code and room.room_alias == default_alias(room.room_code):
            # An unnamed room keeps following its number.
            attrs["room_alias"] = default_alias(code)
        if "description" in attrs:
            attrs["description"] = (attrs["description"] or "").strip() or None
        return attrs
