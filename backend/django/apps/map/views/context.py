"""
apps/map/views/context.py

Backs:
  GET /api/v1/map/context

Not a ViewSet: this endpoint doesn't correspond to a single model/queryset —
it's an aggregate spatial-configuration payload (bounds, SRID, root areas)
assembled by `map.services.get_map_context()`. A plain APIView is the
right tool for a single-action, non-CRUD endpoint like this; forcing it into
a ViewSet would mean a `list`-shaped action returning a non-list payload,
which is more confusing than just writing `get()`.
"""
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from map.serializers import MapContextSerializer
from map.services import get_map_context


class MapContextView(APIView):
    """
    Public endpoint — Kiosk, Mobile, and Admin all consume this on startup
    to learn the coordinate system and spatial bounds before rendering
    anything.
    """

    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        context_data = get_map_context()
        serializer = MapContextSerializer(context_data)
        return Response(serializer.data)