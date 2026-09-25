"""
apps/navigation/coordinates.py

How positions in the 3D building model map to stored geometry.

The kiosk and the Map Annotation page work in the exported model's
coordinates (glTF: metres, Y up). Nodes and edges are stored as PointZ /
LineStringZ in SRID 3857 (metres) with Z as height, so:

    stored X = model x
    stored Y = -model z
    stored Z = model y   (height)

The frontend applies the same mapping (client/src/lib/mapCoordinates.ts).
Distances are unchanged by it, so routing costs are real metres.
"""
from django.contrib.gis.geos import Point

SRID = 3857


def model_to_point(x: float, y: float, z: float) -> Point:
    return Point(x, -z, y, srid=SRID)


def point_to_model(point: Point) -> tuple:
    return (point.x, point.z, -point.y)
