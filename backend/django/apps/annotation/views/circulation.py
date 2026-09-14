"""
apps/annotation/views/circulation.py

Backs:
  PATCH /api/v1/annotations/entrances/{id}
  PATCH /api/v1/annotations/stairs/{id}
  PATCH /api/v1/annotations/elevators/{id}
  PATCH /api/v1/annotations/outdoor-walkways/{id}

All four are PATCH-only, same shape as RoomAnnotationViewSet — factored
into a shared base class since the update-plus-audit-log logic is
identical across all four; only the model/serializer differ. See
annotation.serializers.circulation.EntranceAnnotationSerializer's
docstring for an important schema-gap note on what the entrances endpoint
can and can't actually persist.
"""
from rest_framework import mixins
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from analytics.models import AuditEvent
from annotation import services
from annotation.serializers import (
    ElevatorAnnotationSerializer,
    EntranceAnnotationSerializer,
    OutdoorWalkwayAnnotationSerializer,
    StairAnnotationSerializer,
)
from common.permissions import IsAdminUser
from map.models import Elevator, Entrance, OutdoorWalkway, Stair


class _CirculationUpdateViewSet(mixins.UpdateModelMixin, GenericViewSet):
    """
    Shared PATCH-only + audit-log behavior. Not registered on a router
    itself — subclasses set `model` and `serializer_class`.
    """

    permission_classes = [IsAdminUser]
    http_method_names = ["patch", "head", "options"]
    model = None

    def get_queryset(self):
        return self.model.objects.all()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        services.log_annotation_change(
            actor=request.admin_user, action=AuditEvent.ACTION_UPDATE, instance=updated
        )
        return Response(serializer.data)

    partial_update = update


class EntranceAnnotationViewSet(_CirculationUpdateViewSet):
    model = Entrance
    serializer_class = EntranceAnnotationSerializer


class StairAnnotationViewSet(_CirculationUpdateViewSet):
    model = Stair
    serializer_class = StairAnnotationSerializer


class ElevatorAnnotationViewSet(_CirculationUpdateViewSet):
    model = Elevator
    serializer_class = ElevatorAnnotationSerializer


class OutdoorWalkwayAnnotationViewSet(_CirculationUpdateViewSet):
    model = OutdoorWalkway
    serializer_class = OutdoorWalkwayAnnotationSerializer