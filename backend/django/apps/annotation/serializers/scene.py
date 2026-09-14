"""
apps/annotation/serializers/scene.py

Backs:
  GET /api/v1/annotations

"Retrieves all current map annotations, logical objects, and routes for
rendering in the admin 3D editor" — spans navigation.nodes/edges/
floor_transitions plus campus.entrances/stairs/elevators/outdoor_walkways,
scoped to whatever area/floor the Admin is currently editing. That's
several querysets, not one model, so — same pattern as
map.serializers.context.MapContextSerializer and
navigation.serializers.routes.NavigationRouteSerializer — this is a plain
Serializer, not a ModelSerializer. The view/service is expected to hand it
an object/dict shaped like:

    {
        "nodes": <QuerySet[map.Node]>,
        "edges": <QuerySet[map.Edge]>,
        "floor_transitions": <QuerySet[map.FloorTransition]>,
        "entrances": <QuerySet[map.Entrance]>,
        "stairs": <QuerySet[map.Stair]>,
        "elevators": <QuerySet[map.Elevator]>,
        "outdoor_walkways": <QuerySet[map.OutdoorWalkway]>,
    }

NOTE (business logic — lives in a service, e.g.
annotation.services.get_scene(area_id=..., floor_id=...)):
  - Deciding the area/floor scope from query params and filtering each of
    the seven querysets to it.
  - Any select_related/prefetch_related needed to keep this from firing
    dozens of queries — this serializer just renders whatever querysets
    it's handed.
"""
from rest_framework import serializers

from annotation.serializers.circulation import (
    ElevatorAnnotationSerializer,
    EntranceAnnotationSerializer,
    OutdoorWalkwayAnnotationSerializer,
    StairAnnotationSerializer,
)
from annotation.serializers.edges import EdgeAnnotationSerializer
from annotation.serializers.nodes import NodeAnnotationSerializer
from annotation.serializers.transitions import FloorTransitionAnnotationSerializer


class AnnotationSceneSerializer(serializers.Serializer):
    nodes = NodeAnnotationSerializer(many=True, read_only=True)
    edges = EdgeAnnotationSerializer(many=True, read_only=True)
    floor_transitions = FloorTransitionAnnotationSerializer(many=True, read_only=True)
    entrances = EntranceAnnotationSerializer(many=True, read_only=True)
    stairs = StairAnnotationSerializer(many=True, read_only=True)
    elevators = ElevatorAnnotationSerializer(many=True, read_only=True)
    outdoor_walkways = OutdoorWalkwayAnnotationSerializer(many=True, read_only=True)