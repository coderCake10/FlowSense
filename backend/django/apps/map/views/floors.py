"""
apps/map/views/floors.py

Backs:
  GET /api/v1/map/floors/{id}

There's no standalone GET /map/floors list endpoint in the API design —
floor listing is nested under an area (AreaViewSet.floors, see areas.py).
Only RetrieveModelMixin is wired up here; DRF's router will correctly skip
generating a list route for a viewset that has no `list` method.
"""
from rest_framework import mixins
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import GenericViewSet

from map.models import Floor
from map.serializers import FloorSerializer


class FloorViewSet(mixins.RetrieveModelMixin, GenericViewSet):
    serializer_class = FloorSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Floor.objects.filter(deleted_at__isnull=True)