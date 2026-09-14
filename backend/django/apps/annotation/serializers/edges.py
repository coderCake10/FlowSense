"""
apps/annotation/serializers/edges.py

Backs:
  POST   /api/v1/annotations/edges
  GET    /api/v1/annotations/edges/{id}
  PATCH  /api/v1/annotations/edges/{id}
  DELETE /api/v1/annotations/edges/{id}   (no serializer needed — see views)

`navigation.edges` is owned by the `map` app.
"""
from rest_framework import serializers

from common.serializers import GeoJSONField
from map.models import Edge


class EdgeAnnotationSerializer(serializers.ModelSerializer):
    """Read shape for GET /annotations/edges/{id} and the aggregate scene payload."""

    geometry = GeoJSONField(read_only=True)

    class Meta:
        model = Edge
        fields = [
            "id",
            "from_node",
            "to_node",
            "direction",
            "geometry",
            "active",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class EdgeAnnotationCreateSerializer(serializers.ModelSerializer):
    """
    POST /annotations/edges — connects two existing nodes.

    `geometry` is optional: if the client doesn't supply a walked path,
    NOTE (business logic) a service function is responsible for
    synthesizing a default straight-line LineStringZ between the two
    nodes' points — that computation does not belong here, this field is
    simply passed through as-is (or left null) otherwise.

    Field-level validation only: from_node != to_node, mirroring the
    model's own `chk_edge_nodes_different` CHECK constraint (so the error
    surfaces as a clean 400 instead of an IntegrityError). The Admin UI's
    Edge Tool is described as connecting "two auxiliary nodes" specifically,
    but that's a tool-level constraint, not enforced here — Room/Kiosk/
    Sensor nodes must also be reachable via edges for the graph to route
    to them at all (see navigation/services.py's graph construction), so
    this endpoint deliberately does not restrict node_type.
    """

    geometry = GeoJSONField(required=False, allow_null=True)

    class Meta:
        model = Edge
        fields = ["from_node", "to_node", "direction", "geometry", "active", "metadata"]

    def validate(self, attrs):
        if attrs["from_node"] == attrs["to_node"]:
            raise serializers.ValidationError(
                {"to_node": "An edge cannot connect a node to itself."}
            )
        return attrs


class EdgeAnnotationUpdateSerializer(serializers.ModelSerializer):
    """
    PATCH /annotations/edges/{id} — per the API design, this is for
    "changing its directionality (Bidirectional, Forward, or Reverse)".

    Deliberately excludes `from_node`/`to_node`: reassigning an edge's
    endpoints is a topology change the Admin UI handles via delete +
    re-create (the Edge Tool doesn't describe an endpoint-reassignment
    flow), not a partial update. `geometry` is also excluded here for the
    same reason — repositioning an edge's path is a re-draw, not a
    metadata edit.
    """

    class Meta:
        model = Edge
        fields = ["direction", "active", "metadata"]