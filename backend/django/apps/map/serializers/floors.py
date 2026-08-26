"""
apps/map/serializers/floors.py

Backs:
  GET /api/v1/map/areas/{id}/floors  (list, filtered by area in the view's
                                       get_queryset — not here)
  GET /api/v1/map/floors/{id}        (detail)

Both endpoints are read-only from the Map API (floor creation/reordering
happens through the building configuration workflow under the Asset API, and
per-floor metadata edits happen through the Annotation API's building
config). One serializer covers both list and detail since the field set is
small and identical either way.
"""
from rest_framework import serializers

from common.serializers import GeoJSONField
from map.models import Floor


class FloorSerializer(serializers.ModelSerializer):
    geometry = GeoJSONField(required=False, allow_null=True)

    class Meta:
        model = Floor
        fields = [
            "id",
            "area",
            "glb_node_name",
            "floor_order",
            "elevation",
            "navigable",
            "visible_in_kiosk",
            "active",
            "geometry",
        ]
        read_only_fields = fields