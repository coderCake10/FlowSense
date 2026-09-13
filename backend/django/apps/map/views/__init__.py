"""
apps/map/views/__init__.py

Re-exports every Map API view so urls.py can do:

    from map.views import AreaViewSet, RoomViewSet, MapContextView, ...
"""
from map.views.areas import AreaViewSet
from map.views.circulation import (
    ElevatorViewSet,
    EntranceViewSet,
    OutdoorWalkwayViewSet,
    StairViewSet,
)
from map.views.context import MapContextView
from map.views.floors import FloorViewSet
from map.views.personnel import PersonnelViewSet
from map.views.rooms import RoomViewSet

__all__ = [
    "AreaViewSet",
    "FloorViewSet",
    "RoomViewSet",
    "PersonnelViewSet",
    "EntranceViewSet",
    "StairViewSet",
    "ElevatorViewSet",
    "OutdoorWalkwayViewSet",
    "MapContextView",
]