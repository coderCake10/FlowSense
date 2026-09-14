"""
apps/annotation/serializers/transitions.py

Backs:
  POST   /api/v1/annotations/transitions
  PATCH  /api/v1/annotations/transitions/{id}
  DELETE /api/v1/annotations/transitions/{id}   (no serializer needed — see views)

`navigation.floor_transitions` is owned by the `map` app. There's no
standalone GET /annotations/transitions/{id} in the API design (transitions
are presumably read back as part of the aggregate scene payload — see
scene.py — rather than fetched individually), so no read-only detail
serializer is defined here beyond the one embedded in the scene.
"""
from rest_framework import serializers

from map.models import FloorTransition


class FloorTransitionAnnotationSerializer(serializers.ModelSerializer):
    """Read shape embedded in the aggregate scene payload (scene.py)."""

    class Meta:
        model = FloorTransition
        fields = [
            "id",
            "transition_type",
            "from_node",
            "to_node",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class FloorTransitionCreateSerializer(serializers.ModelSerializer):
    """
    POST /annotations/transitions — connects a node on one floor to a node
    on another (stairs/elevator/escalator/other).

    Field-level validation only: `from_node` and `to_node` must sit on
    different floors — a "floor transition" that starts and ends on the
    same floor isn't one. This is a sanity check, not a computation (no
    distance/weight math happens here — that's navigation/services.py's
    FLOOR_TRANSITION_WEIGHT_MULTIPLIERS at pathfinding time).
    """

    class Meta:
        model = FloorTransition
        fields = ["transition_type", "from_node", "to_node", "active"]

    def validate(self, attrs):
        from_node = attrs["from_node"]
        to_node = attrs["to_node"]
        if from_node.floor_id == to_node.floor_id:
            raise serializers.ValidationError(
                {"to_node": "A floor transition must connect nodes on different floors."}
            )
        return attrs


class FloorTransitionUpdateSerializer(serializers.ModelSerializer):
    """
    PATCH /annotations/transitions/{id}.

    Excludes `from_node`/`to_node` for the same reason
    EdgeAnnotationUpdateSerializer excludes them — reassigning endpoints is
    a topology change, handled by delete + re-create.
    """

    class Meta:
        model = FloorTransition
        fields = ["transition_type", "active"]