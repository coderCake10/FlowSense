"""
apps/annotation/urls.py

Wires up every Annotation API route. Included by config/urls.py, expected
to be mounted at /api/v1/annotations/.

  ''                     -> AnnotationSceneView              (GET /api/v1/annotations)
  nodes/                  -> NodeAnnotationViewSet             (POST)
  nodes/{id}/              -> NodeAnnotationViewSet             (GET, DELETE)
  edges/                  -> EdgeAnnotationViewSet              (POST)
  edges/{id}/              -> EdgeAnnotationViewSet              (GET, PATCH, DELETE)
  transitions/             -> FloorTransitionAnnotationViewSet   (POST)
  transitions/{id}/         -> FloorTransitionAnnotationViewSet   (PATCH, DELETE)
  rooms/{id}/               -> RoomAnnotationViewSet              (PATCH)
  entrances/{id}/           -> EntranceAnnotationViewSet          (PATCH)
  stairs/{id}/              -> StairAnnotationViewSet             (PATCH)
  elevators/{id}/           -> ElevatorAnnotationViewSet          (PATCH)
  outdoor-walkways/{id}/    -> OutdoorWalkwayAnnotationViewSet    (PATCH)

'' isn't a router route on purpose — see views/scene.py for why GET
/annotations is a plain APIView instead of a ViewSet. Every other route
IS on the router: DRF automatically includes/omits the list, create,
retrieve, update, and destroy URL fragments per ViewSet based on which
mixins each class actually has, so e.g. NodeAnnotationViewSet (no `list`,
no `update`) correctly ends up with just POST on the collection and
GET+DELETE on the detail route — no manual pruning needed here.
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from annotation.views import (
    AnnotationSceneView,
    EdgeAnnotationViewSet,
    ElevatorAnnotationViewSet,
    EntranceAnnotationViewSet,
    FloorTransitionAnnotationViewSet,
    NodeAnnotationViewSet,
    OutdoorWalkwayAnnotationViewSet,
    RoomAnnotationViewSet,
    StairAnnotationViewSet,
)

router = DefaultRouter(trailing_slash=True)
router.register("nodes", NodeAnnotationViewSet, basename="annotation-node")
router.register("edges", EdgeAnnotationViewSet, basename="annotation-edge")
router.register("transitions", FloorTransitionAnnotationViewSet, basename="annotation-transition")
router.register("rooms", RoomAnnotationViewSet, basename="annotation-room")
router.register("entrances", EntranceAnnotationViewSet, basename="annotation-entrance")
router.register("stairs", StairAnnotationViewSet, basename="annotation-stair")
router.register("elevators", ElevatorAnnotationViewSet, basename="annotation-elevator")
router.register(
    "outdoor-walkways", OutdoorWalkwayAnnotationViewSet, basename="annotation-outdoor-walkway"
)

urlpatterns = [
    path("", AnnotationSceneView.as_view(), name="annotation-scene"),
] + router.urls