"""
apps/map/services.py

Business logic that doesn't belong in a serializer (per the Map API
serializers' NOTE comments) and shouldn't be inlined into a view either —
mainly the spatial aggregate query behind GET /map/context.

Views call these functions; they never build this logic themselves.
"""
from django.contrib.gis.db.models import Extent

from map.models import Area

DEFAULT_SRID = 3857
DEFAULT_COORDINATE_UNIT = "meters"


def get_map_context() -> dict:
    """
    Assembles the payload for GET /map/context:
      - the campus-wide bounding box (PostGIS `Extent` aggregate over every
        non-deleted area's geometry)
      - the set of "root" areas (no parent — i.e. top-level campuses/
        buildings, not sub-areas)
      - the coordinate system FlowSense operates in

    Returns a plain dict shaped for `map.serializers.MapContextSerializer`.

    NOTE (business logic): this is intentionally the one place that decides
    (a) what counts as a "root" area and (b) how the bounding box is
    computed. If GET /map/context needs to be cached (its output changes
    rarely — campus geometry is close to static), that's a Celery
    Beat/Redis concern layered on top of this function, not a change to the
    function itself.
    """
    root_areas = Area.objects.filter(
        parent_area__isnull=True, deleted_at__isnull=True
    ).order_by("name")

    extent = Area.objects.filter(deleted_at__isnull=True).aggregate(extent=Extent("geometry"))[
        "extent"
    ]

    if extent:
        xmin, ymin, xmax, ymax = extent
        bounds = {"xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax}
    else:
        # No geometry configured yet (fresh deployment) — degenerate bounds
        # rather than raising, so the endpoint stays usable during setup.
        bounds = {"xmin": 0.0, "ymin": 0.0, "xmax": 0.0, "ymax": 0.0}

    return {
        "srid": DEFAULT_SRID,
        "coordinate_unit": DEFAULT_COORDINATE_UNIT,
        "bounds": bounds,
        "root_areas": root_areas,
    }