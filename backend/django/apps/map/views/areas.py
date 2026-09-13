"""
apps/map/views/areas.py

Backs:
  GET    /api/v1/map/areas
  POST   /api/v1/map/areas
  GET    /api/v1/map/areas/{id}
  PATCH  /api/v1/map/areas/{id}
  DELETE /api/v1/map/areas/{id}
  GET    /api/v1/map/areas/{id}/floors

Area is the only Map API resource with a full write surface. Per the
Authentication scope table, Kiosk/Mobile/Admin can all read map data, but
only an authenticated Admin may create/edit/delete areas.
"""
from django.utils import timezone
from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from common.permissions import IsAdminUser  # validates the AdminSessionCookie
from map.models import Area, Floor
from map.serializers import (
    AreaDetailSerializer,
    AreaListSerializer,
    AreaWriteSerializer,
    FloorSerializer,
)


class AreaViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    # API design only exposes PATCH (partial update), not PUT — drop `put`
    # so a full-replace request 405s instead of silently working.
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        queryset = Area.objects.filter(deleted_at__isnull=True)

        area_type = self.request.query_params.get("area_type")
        if area_type:
            queryset = queryset.filter(area_type=area_type)

        parent_area_id = self.request.query_params.get("parent_area_id")
        if parent_area_id is not None:
            if parent_area_id.lower() == "null":
                queryset = queryset.filter(parent_area__isnull=True)
            else:
                queryset = queryset.filter(parent_area_id=parent_area_id)

        return queryset.order_by("name")

    def get_serializer_class(self):
        if self.action == "list":
            return AreaListSerializer
        if self.action in ("create", "update", "partial_update"):
            return AreaWriteSerializer
        if self.action == "floors":
            return FloorSerializer
        return AreaDetailSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminUser()]
        return [AllowAny()]

    def create(self, request, *args, **kwargs):
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        area = write_serializer.save()
        # NOTE (business logic): writing an analytics.AuditEvent for this
        # change belongs in a service call (e.g.
        # map.services.log_area_change(area, actor=request.admin_user,
        # action="create")), not inlined here. Not implemented yet — flagging
        # so it isn't silently forgotten.
        return Response(AreaDetailSerializer(area).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", True)
        instance = self.get_object()
        write_serializer = self.get_serializer(instance, data=request.data, partial=partial)
        write_serializer.is_valid(raise_exception=True)
        area = write_serializer.save()
        # Same audit-logging note as create() above applies here.
        return Response(AreaDetailSerializer(area).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Soft delete — sets `deleted_at` rather than removing the row, since
        Floor/Entrance/Stair/Elevator/OutdoorWalkway/Node all FK to Area and
        the whole schema is built around soft deletes.

        NOTE (business logic): cascading soft-delete (or blocking delete)
        of an area's floors/rooms/nodes when the area itself is removed is
        NOT handled here. Decide and implement that as a service function —
        right now this only marks the Area row itself.
        """
        instance = self.get_object()
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="floors")
    def floors(self, request, pk=None):
        """GET /api/v1/map/areas/{id}/floors"""
        area = self.get_object()
        floor_queryset = Floor.objects.filter(area=area, deleted_at__isnull=True).order_by(
            "floor_order"
        )
        serializer = FloorSerializer(floor_queryset, many=True)
        return Response(serializer.data)