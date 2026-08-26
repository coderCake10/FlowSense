"""
apps/map/views/circulation.py

Backs:
  GET /api/v1/map/entrances
  GET /api/v1/map/stairs
  GET /api/v1/map/elevators
  GET /api/v1/map/outdoor-walkways

All four are simple list-only viewsets over static circulation elements —
none of them have a detail endpoint in the API design. They share the same
`?area_id=` / `?active=` filtering, factored into a common base class below
(not itself registered on a router).
"""
from rest_framework import mixins
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import GenericViewSet

from map.models import Elevator, Entrance, OutdoorWalkway, Stair
from map.serializers import (
    ElevatorSerializer,
    EntranceSerializer,
    OutdoorWalkwaySerializer,
    StairSerializer,
)


class _CirculationListViewSet(mixins.ListModelMixin, GenericViewSet):
    """
    Shared filtering for the four circulation-element viewsets below.
    Subclasses set `model` and `serializer_class`. Not registered on a
    router itself.
    """

    permission_classes = [AllowAny]
    model = None

    def get_queryset(self):
        queryset = self.model.objects.all()

        area_id = self.request.query_params.get("area_id")
        if area_id:
            queryset = queryset.filter(area_id=area_id)

        active_param = self.request.query_params.get("active")
        if active_param is not None:
            queryset = queryset.filter(active=active_param.lower() == "true")
        else:
            # Default to active-only for the public Kiosk/Mobile clients;
            # pass ?active=false explicitly (e.g. from Admin) to include
            # disabled elements too.
            queryset = queryset.filter(active=True)

        return queryset.order_by("name")


class EntranceViewSet(_CirculationListViewSet):
    model = Entrance
    serializer_class = EntranceSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        is_primary = self.request.query_params.get("is_primary")
        if is_primary is not None:
            queryset = queryset.filter(is_primary=is_primary.lower() == "true")
        return queryset


class StairViewSet(_CirculationListViewSet):
    model = Stair
    serializer_class = StairSerializer


class ElevatorViewSet(_CirculationListViewSet):
    model = Elevator
    serializer_class = ElevatorSerializer


class OutdoorWalkwayViewSet(_CirculationListViewSet):
    model = OutdoorWalkway
    serializer_class = OutdoorWalkwaySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        navigable = self.request.query_params.get("navigable")
        if navigable is not None:
            queryset = queryset.filter(navigable=navigable.lower() == "true")
        return queryset