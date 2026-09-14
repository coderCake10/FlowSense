"""
apps/annotation/serializers/__init__.py

Re-exports every Annotation API serializer so views can do:

    from annotation.serializers import NodeAnnotationCreateSerializer, ...

The `annotation` app owns no models of its own (see
apps/annotation/models.py) — every serializer here reads/writes models
owned by `map` (Node, Edge, FloorTransition, Room, Entrance, Stair,
Elevator, OutdoorWalkway). Mutations are expected to log an
`analytics.AuditEvent` via the service layer, not from these serializers
directly.
"""
from annotation.serializers.circulation import (
    ElevatorAnnotationSerializer,
    EntranceAnnotationSerializer,
    OutdoorWalkwayAnnotationSerializer,
    StairAnnotationSerializer,
)
from annotation.serializers.edges import (
    EdgeAnnotationCreateSerializer,
    EdgeAnnotationSerializer,
    EdgeAnnotationUpdateSerializer,
)
from annotation.serializers.nodes import (
    NodeAnnotationCreateSerializer,
    NodeAnnotationDetailSerializer,
    NodeAnnotationSerializer,
)
from annotation.serializers.rooms import RoomAnnotationUpdateSerializer
from annotation.serializers.scene import AnnotationSceneSerializer
from annotation.serializers.transitions import (
    FloorTransitionAnnotationSerializer,
    FloorTransitionCreateSerializer,
    FloorTransitionUpdateSerializer,
)

__all__ = [
    "AnnotationSceneSerializer",
    "NodeAnnotationSerializer",
    "NodeAnnotationCreateSerializer",
    "NodeAnnotationDetailSerializer",
    "EdgeAnnotationSerializer",
    "EdgeAnnotationCreateSerializer",
    "EdgeAnnotationUpdateSerializer",
    "FloorTransitionAnnotationSerializer",
    "FloorTransitionCreateSerializer",
    "FloorTransitionUpdateSerializer",
    "RoomAnnotationUpdateSerializer",
    "EntranceAnnotationSerializer",
    "StairAnnotationSerializer",
    "ElevatorAnnotationSerializer",
    "OutdoorWalkwayAnnotationSerializer",
]