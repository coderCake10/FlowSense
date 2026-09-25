"""
apps/map/views/rooms.py

Backs:
  GET /api/v1/map/rooms
  GET /api/v1/map/rooms/{id}
  GET /api/v1/map/rooms/{id}/personnel

Read-only from the Map API — room metadata edits happen through the
Annotation API (PATCH /annotations/rooms/{id}).
"""
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from map.models import Room, RoomPersonnel
from map.services import with_room_node
from map.serializers import RoomDetailSerializer, RoomListSerializer, RoomPersonnelSerializer
from common.pagination import StandardPagination


class RoomViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    pagination_class = StandardPagination
    permission_classes = [AllowAny]

    def get_queryset(self):
        # select_related("floor") so RoomDetailSerializer's
        # source="floor.area_id" traversal doesn't cost an extra query per
        # row — see the serializer's own note about this being the view's
        # responsibility.
        queryset = with_room_node(Room.objects.filter(deleted_at__isnull=True).select_related("floor"))

        floor_id = self.request.query_params.get("floor_id")
        if floor_id:
            queryset = queryset.filter(floor_id=floor_id)

        area_id = self.request.query_params.get("area_id")
        if area_id:
            queryset = queryset.filter(floor__area_id=area_id)

        room_type = self.request.query_params.get("room_type")
        if room_type:
            queryset = queryset.filter(room_type=room_type)

        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        # NOTE: this is simple exact/equality filtering only. Fuzzy /
        # free-text matching against room_code, room_alias, or description
        # is the Search API's job (GET /api/v1/search), not this endpoint —
        # don't grow this into a search implementation.
        return queryset.order_by("room_code")

    def get_serializer_class(self):
        if self.action == "list":
            return RoomListSerializer
        return RoomDetailSerializer

    @action(detail=True, methods=["get"], url_path="personnel")
    def personnel(self, request, pk=None):
        """GET /api/v1/map/rooms/{id}/personnel"""
        room = self.get_object()
        assignments = RoomPersonnel.objects.filter(room=room).select_related("personnel")
        serializer = RoomPersonnelSerializer(assignments, many=True)
        return Response(serializer.data)