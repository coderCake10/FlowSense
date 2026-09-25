"""
common/serializers/fields.py

Shared DRF fields used across apps that expose PostGIS geometry (map,
hardware, annotation, navigation). Centralized here so every app renders
geometry the same way instead of five slightly-different ad-hoc
implementations.
"""
import json

from django.contrib.gis.geos import GEOSGeometry
from rest_framework import serializers


class GeoJSONField(serializers.Field):
    """
    Serializes a GEOSGeometry model value to/from a plain GeoJSON dict.

    FlowSense stores every spatial column in EPSG:3857 (see the OpenAPI spec
    / Architecture notes). This field passes coordinates through as-is in
    whatever SRID the geometry column is defined with — it does NOT
    reproject.

    NOTE (business logic): if an endpoint ever needs to hand back WGS84
    (EPSG:4326) coordinates for an external mapping widget, that's a
    coordinate transform (`geometry.transform(4326, clone=True)`) and
    belongs in a service function / view, not in this field or any
    serializer that uses it.
    """

    default_error_messages = {
        "invalid": "Value must be valid GeoJSON.",
    }

    def __init__(self, *, srid=3857, **kwargs):
        self.srid = srid
        super().__init__(**kwargs)

    def to_representation(self, value):
        if value is None:
            return None
        # GEOSGeometry.geojson does not reproject; it reflects the geometry's
        # own SRID as stored.
        return json.loads(value.geojson)

    def to_internal_value(self, data):
        if data in (None, ""):
            return None
        try:
            parsed = json.loads(data) if isinstance(data, str) else data
            geom = GEOSGeometry(json.dumps(parsed))
        except Exception:
            self.fail("invalid")
        # GEOS reads GeoJSON as EPSG:4326 (the GeoJSON default), which would
        # make PostGIS reproject these metre coordinates as if they were
        # longitude/latitude. Coordinates are in the column's SRID unless
        # the payload names a CRS explicitly.
        if not (isinstance(parsed, dict) and parsed.get("crs")):
            geom.srid = self.srid
        return geom