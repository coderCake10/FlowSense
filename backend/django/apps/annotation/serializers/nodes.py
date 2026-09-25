"""
apps/annotation/serializers/nodes.py

Backs:
  POST   /api/v1/annotations/nodes/{id}   (see NOTE on the {id} below)
  GET    /api/v1/annotations/nodes/{id}
  DELETE /api/v1/annotations/nodes/{id}   (no serializer needed — see views)

`navigation.nodes` is owned by the `map` app (map/models.py). This app
doesn't own the table; it's the CRUD/editing surface over it for the
Admin's 3D Map Annotation workspace, distinct from map's own read-oriented
serializers and navigation's routing-oriented ones.

NOTE on the doc: 00 API Design.md lists the create endpoint as
`POST /api/v1/annotations/nodes/{id}`, which doesn't make sense for a
creation route (the id doesn't exist yet) — almost certainly a copy/paste
artifact from the GET/DELETE rows directly below it. Treated here as
`POST /api/v1/annotations/nodes` (no id), consistent with REST convention
and with how every other POST-then-GET/PATCH/DELETE resource in this API
is shaped elsewhere in the same document.
"""
from rest_framework import serializers

from common.serializers import GeoJSONField
from map.models import Node


class NodeAnnotationSerializer(serializers.ModelSerializer):
    """
    Read shape used both standalone (GET /annotations/nodes/{id}'s base
    fields) and embedded in the aggregate scene payload (see scene.py).
    """

    geometry = GeoJSONField(read_only=True)

    class Meta:
        model = Node
        fields = [
            "id",
            "floor",
            "room",
            "name",
            "node_type",
            "geometry",
            "active",
            "navigable",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class NodeAnnotationCreateSerializer(serializers.ModelSerializer):
    """
    POST /annotations/nodes — creates a Room, Auxiliary, Kiosk, Sensor, or
    Area/Building Entrance node.

    NOTE (business logic) — lives in a service (e.g.
    annotation.services.create_node(...)), NOT here:
      - Room nodes auto-anchor to door objects detected in the building's
        .glb hierarchy (per the Admin Map Annotation notes: "Room node
        will no longer be freely placeable but will automatically anchor
        to door objects") — that means resolving `geometry` from the
        asset's parsed structure, not trusting whatever point the client
        sends, for node_type='room'.
      - Auxiliary node auto-connection (Nearest Node / Place Order / No
        Connection) and the resulting Edge creation is an entirely
        separate step the service performs after the node itself is
        created — this serializer only creates the Node row.
      - Kiosk/Sensor hardware assignment (which physical device this node
        represents) happens through the Hardware API
        (PATCH /hardware/devices/{id}, setting map_node), not here — this
        serializer intentionally has no hardware-linkage fields.

    Field-level validation only: node_type is a real choice, and `room` is
    required when node_type is "room" (a room node with no room to point
    at is meaningless) — that's data integrity, not business logic.
    """

    geometry = GeoJSONField()
    # Auxiliary Node Tool connection modes (annotation.services
    # .connect_auxiliary_node): connect the new node to the previously
    # placed one ("place_order"), to the nearest node ("nearest_node"), or
    # not at all (default). Not stored on the node.
    connection_mode = serializers.ChoiceField(
        choices=["no_connection", "place_order", "nearest_node"],
        required=False,
        default="no_connection",
        write_only=True,
    )
    previous_node_id = serializers.IntegerField(
        required=False, allow_null=True, write_only=True
    )

    class Meta:
        model = Node
        fields = [
            "floor",
            "room",
            "name",
            "node_type",
            "geometry",
            "active",
            "navigable",
            "metadata",
            "connection_mode",
            "previous_node_id",
        ]

    def validate(self, attrs):
        if attrs.get("node_type") == Node.TYPE_ROOM and not attrs.get("room"):
            raise serializers.ValidationError(
                {"room": "A room must be specified for a node_type of 'room'."}
            )
        return attrs


class NodeAnnotationDetailSerializer(NodeAnnotationSerializer):
    """
    GET /annotations/nodes/{id} — adds the type-specific "contextual
    configuration" the Admin editor's Node Tree panel shows (per the Map
    Annotation notes: Room nodes get an edit-info modal, Kiosk/Sensor
    nodes get an assign-hardware modal).

    This is plain relational traversal (FK/reverse-O2O lookups), not a
    computation — if it grows to need anything beyond "look up the related
    row" (e.g. live MQTT online/offline status for a sensor), that belongs
    in a service function instead of expanding this method further.
    """

    context = serializers.SerializerMethodField()

    class Meta(NodeAnnotationSerializer.Meta):
        fields = NodeAnnotationSerializer.Meta.fields + ["context"]
        read_only_fields = fields

    def get_context(self, obj):
        if obj.node_type == Node.TYPE_ROOM:
            if obj.room_id is None:
                return None
            return {
                "room_id": obj.room_id,
                "room_code": obj.room.room_code,
                "room_alias": obj.room.room_alias,
                "description": obj.room.description,
                "image_path": obj.room.image_path,
            }

        if obj.node_type == Node.TYPE_KIOSK:
            kiosk = getattr(obj, "kiosk", None)
            if kiosk is None:
                return None
            return {
                "device_id": kiosk.device.device_id,
                "device_name": kiosk.device.name,
                "mac_address": kiosk.device.mac_address,
            }

        if obj.node_type == Node.TYPE_SENSOR:
            sensor = getattr(obj, "sensor", None)
            if sensor is None:
                return None
            return {
                "device_id": sensor.device.device_id,
                "device_name": sensor.device.name,
                "mac_address": sensor.device.mac_address,
            }

        if obj.node_type == Node.TYPE_AREA_ENTRANCE:
            # Per the Admin notes, an Area/Building Entrance node is
            # "configured to link the exact node it will be connected to"
            # — there's no dedicated column for that anywhere in the
            # schema, so this reads it out of the node's own `metadata`
            # JSONB blob (e.g. {"linked_node_id": 123}), on the assumption
            # that's where a service would write it. Returns None if
            # nothing's been configured yet.
            linked_node_id = obj.metadata.get("linked_node_id") if obj.metadata else None
            return {"linked_node_id": linked_node_id} if linked_node_id else None

        # Auxiliary nodes have no additional contextual configuration.
        return None