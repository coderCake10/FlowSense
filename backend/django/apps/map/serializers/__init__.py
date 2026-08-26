"""
apps/map/serializers/__init__.py

Re-exports every Map API serializer so views can do:

    from map.serializers import AreaListSerializer, RoomDetailSerializer, ...

instead of reaching into individual submodules.
"""
from map.serializers.areas import (
    AreaDetailSerializer,
    AreaListSerializer,
    AreaWriteSerializer,
)
from map.serializers.circulation import (
    ElevatorSerializer,
    EntranceSerializer,
    OutdoorWalkwaySerializer,
    StairSerializer,
)
from map.serializers.context import MapBoundsSerializer, MapContextSerializer
from map.serializers.floors import FloorSerializer
from map.serializers.personnel import PersonnelSerializer, RoomPersonnelSerializer
from map.serializers.rooms import RoomDetailSerializer, RoomListSerializer

__all__ = [
    "AreaListSerializer",
    "AreaDetailSerializer",
    "AreaWriteSerializer",
    "FloorSerializer",
    "RoomListSerializer",
    "RoomDetailSerializer",
    "PersonnelSerializer",
    "RoomPersonnelSerializer",
    "EntranceSerializer",
    "StairSerializer",
    "ElevatorSerializer",
    "OutdoorWalkwaySerializer",
    "MapContextSerializer",
    "MapBoundsSerializer",
]