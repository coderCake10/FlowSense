"""
apps/annotation/views/scene.py

Backs:
  GET /api/v1/annotations

Plain APIView, not a ViewSet: this endpoint doesn't correspond to a single
queryset/model instance — it's an aggregate of seven different querysets
(nodes, edges, floor_transitions, entrances, stairs, elevators,
outdoor_walkways) assembled by annotation.services.get_scene(). Same
reasoning as map.views.context.MapContextView and
navigation.views.routes.NavigationRouteDetailView.
"""
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from annotation import services
from annotation.serializers import AnnotationSceneSerializer
from common.permissions import IsAdminUser


class AnnotationSceneView(APIView):
    """
    Admin-only — unlike Map/Navigation/Search, the Annotation API has no
    public consumers at all (per the Authentication scope table).
    """

    permission_classes = [IsAdminUser]

    def get(self, request, *args, **kwargs):
        area_id = self._parse_int_param(request, "area_id")
        floor_id = self._parse_int_param(request, "floor_id")

        scene = services.get_scene(area_id=area_id, floor_id=floor_id)
        serializer = AnnotationSceneSerializer(scene)
        return Response(serializer.data)

    @staticmethod
    def _parse_int_param(request, key):
        raw = request.query_params.get(key)
        if raw is None:
            return None
        try:
            return int(raw)
        except (TypeError, ValueError):
            raise ValidationError({key: f"{key} must be an integer."})