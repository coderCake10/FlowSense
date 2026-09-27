"""
Where buildings stand in the campus (step 14).

Each building's 3D model has its own coordinates. The campus uses the kiosk
building's (EYA's): a building's `placement` turns its model about the
vertical axis (`rotation_y`, radians) and moves it to `position`, as three.js
places the model in the kiosk's campus view. Navigation points are stored in
campus coordinates, so routes can run between buildings; when a building's
placement changes, its points move with it.
"""
import math

from django.contrib.gis.geos import LineString
from django.db import transaction

from map.models import Area, Edge, Node
from navigation.coordinates import model_to_point, point_to_model

IDENTITY = {"position": [0.0, 0.0, 0.0], "rotation_y": 0.0}


def normalise(placement):
    """A placement as {"position": [x, y, z], "rotation_y": r} (floats);
    None stays None (the building is at the campus origin)."""
    if placement is None:
        return None
    position = [float(v) for v in placement.get("position", [0, 0, 0])]
    if len(position) != 3:
        raise ValueError("position needs three numbers: x, height, z.")
    return {"position": position, "rotation_y": float(placement.get("rotation_y", 0))}


def to_campus(placement, xyz):
    """A point in the building's model -> campus coordinates."""
    p = normalise(placement) or IDENTITY
    x, y, z = xyz
    (px, py, pz), turn = p["position"], p["rotation_y"]
    cos, sin = math.cos(turn), math.sin(turn)
    return (round(px + x * cos + z * sin, 3), round(py + y, 3), round(pz - x * sin + z * cos, 3))


def to_model(placement, xyz):
    """Campus coordinates -> a point in the building's model."""
    p = normalise(placement) or IDENTITY
    x, y, z = xyz
    (px, py, pz), turn = p["position"], p["rotation_y"]
    cos, sin = math.cos(turn), math.sin(turn)
    dx, dz = x - px, z - pz
    return (round(dx * cos - dz * sin, 3), round(y - py, 3), round(dx * sin + dz * cos, 3))


@transaction.atomic
def place_building(area: Area, placement) -> int:
    """Sets `area`'s placement and moves its navigation points (and their
    connections' lines) with it, so routes stay on its model. Returns how
    many points moved."""
    old = area.placement
    new = normalise(placement)
    area.placement = new
    area.save(update_fields=["placement", "updated_at"])
    if (normalise(old) or IDENTITY) == (new or IDENTITY):
        return 0
    nodes = list(Node.objects.filter(floor__area=area, deleted_at__isnull=True))
    for node in nodes:
        local = to_model(old, point_to_model(node.geometry))
        moved = model_to_point(*to_campus(new, local))
        moved.srid = node.geometry.srid
        node.geometry = moved
        node.save(update_fields=["geometry", "updated_at"])
    ids = [n.pk for n in nodes]
    for edge in Edge.objects.filter(deleted_at__isnull=True).filter(from_node__in=ids) | Edge.objects.filter(
        deleted_at__isnull=True, to_node__in=ids
    ):
        edge.geometry = LineString(edge.from_node.geometry, edge.to_node.geometry, srid=edge.from_node.geometry.srid)
        edge.save(update_fields=["geometry", "updated_at"])
    return len(nodes)
