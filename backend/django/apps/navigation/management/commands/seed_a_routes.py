"""
Loads the A Building's navigation network (corridors, a door for each room
with a sign in the model, the three stair cores on all four floors, and the
front entrance) from map/seed_data/a_navigation.json, and the walk between
the buildings: from the EYA kiosk out of the EYA Building's front doors,
along MacArthur Highway, over the overpass and in at the A Building's front
gate (map/seed_data/a_building.py WALK).

    python manage.py seed_a_routes

Run seed_campus and seed_eya_routes first. It works like seed_eya_routes
(tagged rows updated in place, points placed in Map Annotation never
touched). The file is in the A model's own coordinates; points are stored in
campus coordinates (the EYA model's), using the A Building's placement, so
one route can run from building to building.
"""
import math

from django.contrib.gis.geos import LineString
from django.core.management.base import CommandError

from map.models import Area, Edge, Floor, Node
from map.seed_data import a_building
from map.placement import to_campus
from navigation.coordinates import model_to_point
from navigation.management.commands import seed_eya_routes

WALK_TAG = "campus-walk"


def place(xyz, placement=a_building.PLACEMENT):
    """A model point -> campus coordinates: turned about the vertical axis,
    then moved (as three.js places the model in the kiosk's campus view)."""
    return to_campus(placement, xyz)


class Command(seed_eya_routes.Command):
    help = "Load the A Building's navigation network and the walk to it from the EYA Building."
    data = a_building
    tag = "a-network"
    starter_tag = None
    label = "A Building"

    def position(self, xyz):
        return place(xyz, self.placement)

    def handle(self, *args, **options):
        # Where the A Building stands now (moved in Map Annotation, or set by
        # seed_campus), so a re-seed keeps its points on its model.
        area = Area.objects.filter(code=a_building.BUILDING["code"], deleted_at__isnull=True).first()
        self.placement = (area.placement if area is not None and area.placement else a_building.PLACEMENT)
        return super().handle(*args, **options)

    def extra(self, now):
        walkways = Floor.objects.filter(
            area__code=a_building.WALKWAYS["code"], floor_order=1, deleted_at__isnull=True
        ).first()
        if walkways is None:
            raise CommandError("The campus walkways aren't there; run seed_campus first.")
        eya_floor = Floor.objects.filter(area__code="EYA", floor_order=1, deleted_at__isnull=True).first()
        kiosk = Node.objects.filter(metadata__seed=seed_eya_routes.TAG, metadata__key="kiosk",
                                    deleted_at__isnull=True).first()
        entrance = Node.objects.filter(metadata__seed=self.tag, metadata__key="entrance",
                                       deleted_at__isnull=True).first()
        if kiosk is None or eya_floor is None:
            self.stderr.write("The EYA routes aren't loaded (run seed_eya_routes): no walk from the EYA kiosk.")
            return ""

        existing = {
            node.metadata.get("key"): node
            for node in Node.objects.filter(metadata__seed=WALK_TAG, deleted_at__isnull=True)
        }
        chain = [kiosk]
        for (key, name, position), floor in [(a_building.WALK_EYA_DOOR, eya_floor)] + [
            (item, walkways) for item in a_building.WALK
        ]:
            node = existing.pop(key, None) or Node()
            node.floor = floor
            node.name = name
            node.node_type = Node.TYPE_AUXILIARY
            node.room = None
            node.geometry = model_to_point(*position)
            node.active = node.navigable = True
            node.deleted_at = None
            node.metadata = {**(node.metadata or {}), "seed": WALK_TAG, "key": key}
            node.save()
            chain.append(node)
        chain.append(entrance)
        self.retire(Node.objects.filter(pk__in=[n.pk for n in existing.values()]), now)

        wanted = set()
        for a, b in zip(chain, chain[1:]):
            edge = (
                Edge.objects.filter(metadata__seed=WALK_TAG, from_node=a, to_node=b).first()
                or Edge.objects.filter(metadata__seed=WALK_TAG, from_node=b, to_node=a).first()
                or Edge(from_node=a, to_node=b, metadata={"seed": WALK_TAG})
            )
            edge.direction = Edge.DIRECTION_BIDIRECTIONAL
            edge.geometry = LineString(edge.from_node.geometry, edge.to_node.geometry, srid=a.geometry.srid)
            edge.active = True
            edge.deleted_at = None
            edge.save()
            wanted.add(edge.pk)
        Edge.objects.filter(metadata__seed=WALK_TAG, deleted_at__isnull=True).exclude(pk__in=wanted).update(
            active=False, deleted_at=now
        )
        length = sum(math.dist(a.geometry.coords, b.geometry.coords) for a, b in zip(chain, chain[1:]))
        return f"; walk from the EYA kiosk to the front entrance: {len(chain) - 2} points, {length:.0f} m"
