"""
apps/annotation/views/__init__.py

Re-exports every Annotation API view so urls.py can do:

    from annotation.views import NodeAnnotationViewSet, AnnotationSceneView, ...
"""
from annotation.views.circulation import (
    ElevatorAnnotationViewSet,
    EntranceAnnotationViewSet,
    OutdoorWalkwayAnnotationViewSet,
    StairAnnotationViewSet,
)
from annotation.views.edges import EdgeAnnotationViewSet
from annotation.views.nodes import NodeAnnotationViewSet
from annotation.views.rooms import RoomAnnotationViewSet
from annotation.views.scene import AnnotationSceneView
from annotation.views.transitions import FloorTransitionAnnotationViewSet

__all__ = [
    "AnnotationSceneView",
    "NodeAnnotationViewSet",
    "EdgeAnnotationViewSet",
    "FloorTransitionAnnotationViewSet",
    "RoomAnnotationViewSet",
    "EntranceAnnotationViewSet",
    "StairAnnotationViewSet",
    "ElevatorAnnotationViewSet",
    "OutdoorWalkwayAnnotationViewSet",
]