"""
apps/map/urls.py

Wires up every Map API route. Included by config/urls.py, expected to be
mounted at /api/v1/map/.

Router-generated paths line up 1:1 with 00 API Design.md:
  areas/                       -> AreaViewSet (list, create)
  areas/{id}/                  -> AreaViewSet (retrieve, partial_update, destroy)
  areas/{id}/floors/           -> AreaViewSet.floors (list)
  floors/{id}/                 -> FloorViewSet (retrieve only)
  rooms/                       -> RoomViewSet (list)
  rooms/{id}/                  -> RoomViewSet (retrieve)
  rooms/{id}/personnel/        -> RoomViewSet.personnel (list)
  entrances/                   -> EntranceViewSet (list only)
  stairs/                      -> StairViewSet (list only)
  elevators/                   -> ElevatorViewSet (list only)
  outdoor-walkways/            -> OutdoorWalkwayViewSet (list only)
  personnel/                   -> PersonnelViewSet (list only)
  context/                     -> MapContextView (APIView, not a router route)
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from map.views import (
    AreaViewSet,
    ElevatorViewSet,
    EntranceViewSet,
    FloorViewSet,
    MapContextView,
    OutdoorWalkwayViewSet,
    PersonnelViewSet,
    RoomViewSet,
    StairViewSet,
)

router = DefaultRouter(trailing_slash=True)
router.register("areas", AreaViewSet, basename="area")
router.register("floors", FloorViewSet, basename="floor")
router.register("rooms", RoomViewSet, basename="room")
router.register("entrances", EntranceViewSet, basename="entrance")
router.register("stairs", StairViewSet, basename="stair")
router.register("elevators", ElevatorViewSet, basename="elevator")
router.register("outdoor-walkways", OutdoorWalkwayViewSet, basename="outdoor-walkway")
router.register("personnel", PersonnelViewSet, basename="personnel")

urlpatterns = [
    # Not a router route on purpose — see views/context.py for why this is
    # a plain APIView instead of a ViewSet.
    path("context/", MapContextView.as_view(), name="map-context"),
] + router.urls