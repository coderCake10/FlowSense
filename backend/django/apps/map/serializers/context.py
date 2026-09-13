"""
apps/map/serializers/context.py

Backs:
  GET /api/v1/map/context

This is the one Map API endpoint that doesn't map cleanly onto a single
table — "overall campus spatial context and coordinate configuration" is an
aggregate of the root campus area(s), the spatial extent of the whole
mapped area, and the CRS FlowSense operates in. Because it spans multiple
tables and requires a spatial aggregate query, this serializer takes a
plain object/dict (NOT a model instance) that the view/service has already
assembled.

NOTE (business logic — lives in a service, e.g. `map.services.get_map_context()`):
  - Computing the campus-wide bounding box (e.g. via
    `Area.objects.aggregate(extent=Extent("geometry"))`) is a PostGIS
    aggregate call and does not belong in a serializer.
  - Determining which area(s) count as "root" (area_type="campus", or
    parent_area is null — whichever the product decides) is a query/filter
    decision, not a serialization concern.
  - Any caching of this payload (it changes rarely — campus geometry is
    close to static) is an infrastructure concern; Redis/Celery-driven
    cache warming belongs in the service layer, not here.

The service is expected to hand this serializer something shaped like:

    {
        "srid": 3857,
        "coordinate_unit": "meters",
        "bounds": {"xmin": ..., "ymin": ..., "xmax": ..., "ymax": ...},
        "root_areas": <QuerySet[Area]>,
    }
"""
from rest_framework import serializers

from map.serializers.areas import AreaListSerializer


class MapBoundsSerializer(serializers.Serializer):
    """Plain bounding-box shape — not tied to a model."""

    xmin = serializers.FloatField()
    ymin = serializers.FloatField()
    xmax = serializers.FloatField()
    ymax = serializers.FloatField()


class MapContextSerializer(serializers.Serializer):
    srid = serializers.IntegerField()
    coordinate_unit = serializers.CharField()
    bounds = MapBoundsSerializer()
    root_areas = AreaListSerializer(many=True)