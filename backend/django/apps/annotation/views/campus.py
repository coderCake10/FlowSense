"""
apps/annotation/views/campus.py  (step 14, additive to the API design)

  GET, POST          /api/v1/annotations/labels         campus labels
  PATCH, DELETE      /api/v1/annotations/labels/{id}
  POST               /api/v1/annotations/floors         add a floor
  PATCH, DELETE      /api/v1/annotations/floors/{id}    rename, reorder, remove
  POST               /api/v1/annotations/rooms/new      add a room (rooms/{id} stays PATCH)
  DELETE             /api/v1/annotations/rooms/{id}/remove
  POST               /api/v1/annotations/buildings      add a building: area and floors

A building's placement in the campus and its kiosk settings are PATCH
/api/v1/map/areas/{id} (`placement`, `map_settings`).
"""
from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from analytics.models import AuditEvent
from annotation import services
from annotation.serializers.campus import (
    BuildingCreateSerializer,
    CampusLabelSerializer,
    FloorAnnotationSerializer,
    RoomCreateSerializer,
    floor_names,
)
from common.permissions import IsAdminUser
from map.models import Area, CampusLabel, Floor, Node, Room


class CampusLabelViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    serializer_class = CampusLabelSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    pagination_class = None

    def get_permissions(self):
        # The kiosk reads them; admins edit them.
        return [AllowAny()] if self.action == "list" else [IsAdminUser()]

    def get_queryset(self):
        return CampusLabel.objects.filter(deleted_at__isnull=True).order_by("name", "id")

    def perform_create(self, serializer):
        label = serializer.save()
        services.log_annotation_change(actor=self.request.admin_user, action=AuditEvent.ACTION_CREATE, instance=label)

    def perform_update(self, serializer):
        label = serializer.save()
        services.log_annotation_change(actor=self.request.admin_user, action=AuditEvent.ACTION_UPDATE, instance=label)

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at", "updated_at"])
        services.log_annotation_change(actor=self.request.admin_user, action=AuditEvent.ACTION_DELETE, instance=instance)


class FloorAnnotationViewSet(mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, GenericViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = FloorAnnotationSerializer
    http_method_names = ["post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Floor.objects.filter(deleted_at__isnull=True)

    def perform_create(self, serializer):
        floor = serializer.save()
        services.log_annotation_change(actor=self.request.admin_user, action=AuditEvent.ACTION_CREATE, instance=floor)

    def perform_update(self, serializer):
        floor = serializer.save()
        services.log_annotation_change(actor=self.request.admin_user, action=AuditEvent.ACTION_UPDATE, instance=floor)

    def destroy(self, request, *args, **kwargs):
        floor = self.get_object()
        if Node.objects.filter(floor=floor, deleted_at__isnull=True).exists() or Room.objects.filter(
            floor=floor, deleted_at__isnull=True
        ).exists():
            return Response(
                {"detail": "Remove this floor's rooms and points first."}, status=status.HTTP_409_CONFLICT
            )
        floor.deleted_at = timezone.now()
        floor.active = False
        floor.save(update_fields=["deleted_at", "active", "updated_at"])
        services.log_annotation_change(actor=request.admin_user, action=AuditEvent.ACTION_DELETE, instance=floor)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RoomCreateView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = RoomCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        old = Room.objects.filter(
            floor=serializer.validated_data["floor"],
            room_code=serializer.validated_data["room_code"],
            deleted_at__isnull=False,
        ).first()
        if old is not None:  # a room removed earlier comes back
            for key, value in serializer.validated_data.items():
                setattr(old, key, value)
            old.deleted_at = None
            old.save()
            room = old
        else:
            room = serializer.save(is_searchable=True)
        services.log_annotation_change(actor=request.admin_user, action=AuditEvent.ACTION_CREATE, instance=room)
        return Response(RoomCreateSerializer(room).data, status=status.HTTP_201_CREATED)


class RoomRemoveView(APIView):
    permission_classes = [IsAdminUser]

    def delete(self, request, pk):
        room = Room.objects.filter(pk=pk, deleted_at__isnull=True).first()
        if room is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        now = timezone.now()
        # Its door points stay on the map as plain points.
        Node.objects.filter(room=room, deleted_at__isnull=True).update(
            room=None, node_type=Node.TYPE_AUXILIARY, updated_at=now
        )
        room.deleted_at = now
        room.save(update_fields=["deleted_at", "updated_at"])
        services.log_annotation_change(actor=request.admin_user, action=AuditEvent.ACTION_DELETE, instance=room)
        return Response(status=status.HTTP_204_NO_CONTENT)


class BuildingCreateView(APIView):
    """A new building: its area (under the campus) and floors 1..n, named
    FLOOR_1..n like the models' floor groups. Upload its model in Asset
    Management, then place it on the campus and annotate it here."""

    permission_classes = [IsAdminUser]

    @transaction.atomic
    def post(self, request):
        serializer = BuildingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        campus = Area.objects.filter(deleted_at__isnull=True, area_type=Area.TYPE_CAMPUS).order_by("id").first()
        area = Area.objects.create(
            code=data["code"], name=data["name"], area_type=Area.TYPE_BUILDING, parent_area=campus,
            map_settings={"exterior": ["EXTERIOR", "ROOF"], "start_label": "Entrance"},
        )
        for order in range(1, data["floors"] + 1):
            short, name = floor_names(order)
            Floor.objects.create(
                area=area, floor_order=order, glb_node_name=f"FLOOR_{order}", short_name=short, display_name=name
            )
        services.log_annotation_change(actor=request.admin_user, action=AuditEvent.ACTION_CREATE, instance=area)
        return Response(
            {"id": area.pk, "code": area.code, "name": area.name, "floors": data["floors"]},
            status=status.HTTP_201_CREATED,
        )
