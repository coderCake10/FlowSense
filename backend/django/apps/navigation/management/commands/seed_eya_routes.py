"""
Loads the EYA first floor's starter navigation graph (the kiosk, corridor
junctions, three office doors, and the connections between them) from
map/seed_data/eya.py, so the kiosk can route before the floor is annotated.

    python manage.py seed_eya_routes

Run seed_campus first. Safe to run repeatedly: seeded rows are tagged with
metadata {"seed": "eya-demo"} and updated in place. Nodes and edges added in
Map Annotation are never touched.
"""
from django.core.management.base import BaseCommand, CommandError
from django.contrib.gis.geos import LineString
from django.db import transaction

from map.models import Edge, Floor, Node, Room
from map.seed_data import eya
from navigation.coordinates import model_to_point

SEED_TAG = {"seed": "eya-demo"}


class Command(BaseCommand):
    help = "Load the EYA first floor's starter navigation graph."

    @transaction.atomic
    def handle(self, *args, **options):
        floor = Floor.objects.filter(
            area__code=eya.BUILDING["code"], floor_order=1, deleted_at__isnull=True
        ).first()
        if floor is None:
            raise CommandError("EYA first floor not found; run seed_campus first.")

        def upsert(key, name, node_type, position, room=None):
            node = Node.objects.filter(
                floor=floor, metadata__seed=SEED_TAG["seed"], metadata__key=key
            ).first() or Node(floor=floor, metadata={**SEED_TAG, "key": key})
            node.name = name
            node.node_type = node_type
            node.room = room
            node.geometry = model_to_point(*position)
            node.active = True
            node.navigable = True
            node.deleted_at = None
            node.save()
            return node

        nodes = {"kiosk": upsert("kiosk", eya.DEMO_KIOSK["name"], Node.TYPE_KIOSK, eya.DEMO_KIOSK["position"])}
        for key, position in eya.DEMO_JUNCTIONS:
            nodes[key] = upsert(key, f"Corridor {key}", Node.TYPE_AUXILIARY, position)
        for code, position in eya.DEMO_ROOM_DOORS:
            room = Room.objects.filter(floor=floor, room_code=code, deleted_at__isnull=True).first()
            if room is None:
                raise CommandError(f"Room {code} not found; run seed_campus first.")
            nodes[code] = upsert(code, f"{code} door", Node.TYPE_ROOM, position, room=room)

        for start, end in eya.DEMO_EDGES:
            a, b = nodes[start], nodes[end]
            edge = Edge.objects.filter(
                metadata__seed=SEED_TAG["seed"], from_node=a, to_node=b
            ).first() or Edge(from_node=a, to_node=b, metadata=dict(SEED_TAG))
            edge.direction = Edge.DIRECTION_BIDIRECTIONAL
            edge.geometry = LineString(a.geometry, b.geometry, srid=a.geometry.srid)
            edge.active = True
            edge.deleted_at = None
            edge.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"EYA starter routes: {len(nodes)} nodes, {len(eya.DEMO_EDGES)} edges."
            )
        )
