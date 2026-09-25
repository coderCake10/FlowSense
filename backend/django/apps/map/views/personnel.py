"""
apps/map/views/personnel.py

Backs:
  GET /api/v1/map/personnel

The personnel *directory*. Only ListModelMixin is wired up — there's no
GET /map/personnel/{id} in the API design (personnel are only ever looked
up in the context of a room, via RoomViewSet.personnel).
"""
from rest_framework import mixins
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import GenericViewSet

from map.models import Personnel
from map.serializers import PersonnelSerializer
from common.pagination import StandardPagination


class PersonnelViewSet(mixins.ListModelMixin, GenericViewSet):
    pagination_class = StandardPagination
    serializer_class = PersonnelSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = Personnel.objects.filter(deleted_at__isnull=True)

        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        # NOTE: exact filtering only — free-text personnel search (by name)
        # is the Search API's job, not this endpoint.
        return queryset.order_by("full_name")