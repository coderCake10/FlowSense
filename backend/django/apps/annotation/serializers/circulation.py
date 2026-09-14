"""
apps/annotation/serializers/circulation.py

Backs:
  PATCH /api/v1/annotations/entrances/{id}
  PATCH /api/v1/annotations/stairs/{id}
  PATCH /api/v1/annotations/elevators/{id}
  PATCH /api/v1/annotations/outdoor-walkways/{id}

All four tables (campus.entrances, campus.stairs, campus.elevators,
campus.outdoor_walkways) are owned by the `map` app. Note that the API
design only defines PATCH for these four in the Annotation API — there's
no POST/DELETE anywhere in the whole API surface for any of them, and Map
API only exposes GET (list). Where these rows actually get created isn't
covered by any documented endpoint; presumably a data-seeding/import step
outside this API. Flagging that gap rather than inventing a create
endpoint that isn't asked for.
"""
from rest_framework import serializers

from common.serializers import GeoJSONField
from map.models import Elevator, Entrance, OutdoorWalkway, Stair


class EntranceAnnotationSerializer(serializers.ModelSerializer):
    """
    PATCH /annotations/entrances/{id}.

    IMPORTANT SCHEMA GAP: the API design describes this endpoint's purpose
    as "Modifies linkage data defining which exact node an entrance
    connects to" — but neither `campus.entrances` nor `navigation.nodes`
    has any column representing that link. `campus.entrances` has no
    `node_id`/FK-to-Node column at all, and `navigation.nodes` only FKs to
    `campus.rooms`, not `campus.entrances`.

    This serializer therefore exposes the fields that DO exist and are
    reasonably editable (name, type, primary flag, active, position) —
    it does NOT include a "linked node" field, because persisting one
    would require either:
      (a) a schema migration adding a node FK/column to campus.entrances, or
      (b) storing the link in the corresponding area_entrance Node's
          `metadata` JSONB instead (see
          annotation.serializers.nodes.NodeAnnotationDetailSerializer's
          `context` method, which already reads `metadata["linked_node_id"]`
          on that assumption).

    This needs a product/schema decision before "linkage" editing can
    actually be built — silently adding a field here that doesn't persist
    anywhere would be worse than leaving it out.
    """

    geometry = GeoJSONField(required=False, allow_null=True)

    class Meta:
        model = Entrance
        fields = ["name", "entrance_type", "is_primary", "active", "geometry"]


class StairAnnotationSerializer(serializers.ModelSerializer):
    """PATCH /annotations/stairs/{id}."""

    geometry = GeoJSONField(required=False, allow_null=True)

    class Meta:
        model = Stair
        fields = ["name", "description", "active", "geometry"]


class ElevatorAnnotationSerializer(serializers.ModelSerializer):
    """PATCH /annotations/elevators/{id}."""

    geometry = GeoJSONField(required=False, allow_null=True)

    class Meta:
        model = Elevator
        fields = ["name", "description", "active", "geometry"]


class OutdoorWalkwayAnnotationSerializer(serializers.ModelSerializer):
    """PATCH /annotations/outdoor-walkways/{id}."""

    geometry = GeoJSONField(required=False, allow_null=True)

    class Meta:
        model = OutdoorWalkway
        fields = ["name", "description", "navigable", "active", "geometry"]