"""
apps/annotation/views/rooms.py

Backs:
  PATCH /api/v1/annotations/rooms/{id}

PATCH-only — no create/retrieve/delete for rooms through the Annotation
API (rooms are created/read through the Map API; this is purely the
Admin's room-metadata edit modal). A ViewSet with only UpdateModelMixin is
still the right tool: DRF's router emits just the `{pk}/` PATCH route and
nothing else, since no other mixin is present here.
"""
from rest_framework import mixins
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from analytics.models import AuditEvent
from annotation import services
from annotation.serializers import RoomAnnotationUpdateSerializer
from common.permissions import IsAdminUser
from map.models import Room


class RoomAnnotationViewSet(mixins.UpdateModelMixin, GenericViewSet):
    permission_classes = [IsAdminUser]
    http_method_names = ["patch", "head", "options"]
    serializer_class = RoomAnnotationUpdateSerializer

    def get_queryset(self):
        return Room.objects.filter(deleted_at__isnull=True)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        old_code = instance.room_code
        room = serializer.save()
        if room.room_code != old_code:
            services.rename_room_nodes(room, old_code)
        services.log_annotation_change(
            actor=request.admin_user, action=AuditEvent.ACTION_UPDATE, instance=room
        )
        return Response(serializer.data)

    partial_update = update