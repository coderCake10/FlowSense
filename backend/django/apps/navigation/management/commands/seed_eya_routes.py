"""
Loads the EYA Building's navigation network: corridor centre lines, a door
for each of the 97 rooms, both stair cores and the elevator on all six
floors, and the kiosk. It is generated from the 3D model
(map/seed_data/eya_navigation.json, made by
frontend/scripts/blender/build_navigation.py).

    python manage.py seed_eya_routes

Run seed_campus first. Safe to run repeatedly, e.g. after regenerating the
file for a new model:

- Loaded rows are tagged with metadata {"seed": "eya-network", "key": ...}
  and updated in place; points dropped from the file are removed (soft
  delete, like Map Annotation's), with their connections.
- It replaces the earlier starter routes (tag "eya-demo": the kiosk and three
  first-floor offices). The starter kiosk point becomes the network's kiosk,
  so kiosks assigned to it keep it.
- Stairs and elevators put out of service in Map Annotation stay so.
- Points added in Map Annotation are never touched. A room renumbered there
  no longer matches the file: its door is loaded unlinked, and listed. A room whose door was
  placed there keeps that door: the network's door for it is loaded as an
  unlinked corridor point, and the command lists the room.
"""
import json
from pathlib import Path

from django.contrib.gis.geos import LineString
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from map.models import Edge, Floor, FloorTransition, Node, Room
from map.seed_data import eya
from navigation.coordinates import model_to_point

TAG = "eya-network"
STARTER_TAG = "eya-demo"
NODE_TYPES = {"room": Node.TYPE_ROOM, "kiosk": Node.TYPE_KIOSK, "auxiliary": Node.TYPE_AUXILIARY,
              "area_entrance": Node.TYPE_AREA_ENTRANCE}
TRANSITION_TYPES = {"stairs": FloorTransition.TYPE_STAIRS, "elevator": FloorTransition.TYPE_ELEVATOR}


def load_network(data=eya):
    path = Path(data.__file__).with_name(data.NAVIGATION_FILE)
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


class Command(BaseCommand):
    help = "Load the EYA Building's navigation network (all floors, every room)."
    # What differs between buildings (seed_a_routes subclasses this).
    data = eya
    tag = TAG
    starter_tag = STARTER_TAG
    label = "EYA"

    def position(self, xyz):
        """The file's point in campus coordinates (the EYA model's)."""
        return xyz

    def extra(self, now):
        """More to load after the network (seed_a_routes: the walk to EYA)."""
        return ""

    @transaction.atomic
    def handle(self, *args, **options):
        network = load_network(self.data)
        now = timezone.now()
        floors = {
            floor.floor_order: floor
            for floor in Floor.objects.filter(area__code=self.data.BUILDING["code"], deleted_at__isnull=True)
        }
        missing = [f["floor"] for f in network["floors"] if f["floor"] not in floors]
        if missing:
            raise CommandError(f"{self.label} floors {missing} not found; run seed_campus first.")

        existing = {
            node.metadata.get("key"): node
            for node in Node.objects.filter(metadata__seed=self.tag, deleted_at__isnull=True)
        }
        retired = 0
        if self.starter_tag:
            # The starter kiosk point becomes the network's kiosk (kiosks may be
            # assigned to it); the rest of the starter routes are retired.
            starter = Node.objects.filter(metadata__seed=self.starter_tag, deleted_at__isnull=True)
            if "kiosk" not in existing:
                adopted = starter.filter(node_type=Node.TYPE_KIOSK).first()
                if adopted is not None:
                    existing["kiosk"] = adopted
            retired = self.retire(starter.exclude(pk=getattr(existing.get("kiosk"), "pk", None)), now)

        manual_rooms = {
            room_id
            for room_id, metadata in Node.objects.filter(
                room__isnull=False, deleted_at__isnull=True
            ).values_list("room_id", "metadata")
            if (metadata or {}).get("seed") not in (self.tag, self.starter_tag)
        }
        rooms = {
            (room.floor_id, room.room_code): room
            for room in Room.objects.filter(floor__in=floors.values(), deleted_at__isnull=True)
        }
        if not rooms:
            raise CommandError(f"No {self.label} rooms found; run seed_campus first.")
        nodes, kept_manual, unmatched = {}, [], []
        for floor_data in network["floors"]:
            floor = floors[floor_data["floor"]]
            for item in floor_data["nodes"]:
                room = None
                node_type = NODE_TYPES[item["type"]]
                if "room" in item:
                    room = rooms.get((floor.id, item["room"]))
                    if room is None:
                        # Renumbered or removed since the network was made.
                        unmatched.append(item["room"])
                        node_type = Node.TYPE_AUXILIARY
                    elif room.id in manual_rooms:
                        kept_manual.append(item["room"])
                        room, node_type = None, Node.TYPE_AUXILIARY
                node = existing.get(item["key"]) or Node()
                node.floor = floor
                node.name = item["name"]
                node.node_type = node_type
                node.room = room
                node.geometry = model_to_point(*self.position(item["position"]))
                node.active = True
                node.navigable = True
                node.deleted_at = None
                node.metadata = {**node.metadata, "seed": self.tag, "key": item["key"],
                                 **({"role": item["role"]} if "role" in item else {})}
                node.save()
                nodes[item["key"]] = node
        retired += self.retire(
            Node.objects.filter(metadata__seed=self.tag, deleted_at__isnull=True).exclude(
                pk__in=[n.pk for n in nodes.values()]
            ),
            now,
        )

        wanted = set()
        for floor_data in network["floors"]:
            for a_key, b_key in floor_data["edges"]:
                a, b = nodes[a_key], nodes[b_key]
                edge = (
                    Edge.objects.filter(metadata__seed=self.tag, from_node=a, to_node=b).first()
                    or Edge.objects.filter(metadata__seed=self.tag, from_node=b, to_node=a).first()
                    or Edge(from_node=a, to_node=b, metadata={"seed": self.tag})
                )
                edge.direction = Edge.DIRECTION_BIDIRECTIONAL
                edge.geometry = LineString(edge.from_node.geometry, edge.to_node.geometry, srid=a.geometry.srid)
                edge.active = True
                edge.deleted_at = None
                edge.save()
                wanted.add(edge.pk)
        Edge.objects.filter(metadata__seed=self.tag, deleted_at__isnull=True).exclude(pk__in=wanted).update(
            active=False, deleted_at=now
        )

        links = set()
        for item in network["transitions"]:
            a, b = nodes[item["from"]], nodes[item["to"]]
            link = FloorTransition.objects.filter(
                from_node=a, to_node=b, transition_type=TRANSITION_TYPES[item["type"]]
            ).order_by("deleted_at", "-id").first()
            if link is None:
                link = FloorTransition.objects.create(
                    from_node=a, to_node=b, transition_type=TRANSITION_TYPES[item["type"]], active=True
                )
            elif link.deleted_at is not None:
                link.deleted_at, link.active = None, True
                link.save(update_fields=["deleted_at", "active", "updated_at"])
            # A live link keeps its in-service setting: an elevator an admin
            # put out of service stays out of service.
            links.add(link.pk)
        ours = [n.pk for n in nodes.values()]
        FloorTransition.objects.filter(from_node__in=ours, to_node__in=ours, deleted_at__isnull=True).exclude(
            pk__in=links
        ).update(active=False, deleted_at=now)

        routable = sum(1 for n in nodes.values() if n.room_id)
        extra = self.extra(now)
        self.stdout.write(
            self.style.SUCCESS(
                f"{self.label} routes: {len(nodes)} points, {len(wanted)} connections, {len(links)} stair and "
                f"elevator links; {routable + len(kept_manual)} rooms routable"
                + (f"; {retired} old points removed" if retired else "")
                + extra
                + "."
            )
        )
        if unmatched:
            self.stdout.write(
                "No room numbered " + ", ".join(sorted(unmatched))
                + " (renumbered?): their doors are loaded as corridor points. Place the"
                " renumbered rooms' doors in Map Annotation."
            )
        if kept_manual:
            self.stdout.write(
                "Kept the doors placed in Map Annotation for: " + ", ".join(sorted(kept_manual))
                + ". Check they're connected, or delete them to use the generated doors."
            )

    @staticmethod
    def retire(queryset, now):
        """Soft-delete points and their connections (routes history keeps them)."""
        ids = list(queryset.values_list("pk", flat=True))
        if not ids:
            return 0
        Node.objects.filter(pk__in=ids).update(active=False, deleted_at=now)
        Edge.objects.filter(deleted_at__isnull=True).filter(
            from_node__in=ids
        ).update(active=False, deleted_at=now)
        Edge.objects.filter(deleted_at__isnull=True, to_node__in=ids).update(active=False, deleted_at=now)
        FloorTransition.objects.filter(deleted_at__isnull=True, from_node__in=ids).update(active=False, deleted_at=now)
        FloorTransition.objects.filter(deleted_at__isnull=True, to_node__in=ids).update(active=False, deleted_at=now)
        return len(ids)
