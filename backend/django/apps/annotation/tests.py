"""
Annotation API as the Map Annotation page uses it (step 8b): placing nodes in
model coordinates, chaining corridor points, linking floors with stairs,
deleting, and the resulting multi-floor route.
"""
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from common.testing import API, data, sign_in_as_admin
from map.models import Edge, Floor, FloorTransition, Node, Room
from navigation.coordinates import model_to_point


def point(x, y, z):
    """GeoJSON body for a model position (the page converts the same way)."""
    stored = model_to_point(x, y, z)
    return {"type": "Point", "coordinates": [stored.x, stored.y, stored.z]}


class AnnotationApiTests(TestCase):
    def setUp(self):
        call_command("seed_campus", stdout=StringIO())
        self.first = Floor.objects.get(area__code="EYA", floor_order=1)
        self.third = Floor.objects.get(area__code="EYA", floor_order=3)

    def place(self, **body):
        return self.client.post(
            f"{API}/annotations/nodes/", body, content_type="application/json"
        )

    def test_annotation_needs_an_admin(self):
        response = self.place(
            floor=self.first.id, name="X", node_type="auxiliary", geometry=point(0, 1, 0)
        )
        self.assertIn(response.status_code, (401, 403))

    def test_room_node_links_to_its_room(self):
        sign_in_as_admin(self.client)
        room = Room.objects.get(room_code="EA-305")
        response = self.place(
            floor=self.third.id,
            room=room.id,
            name="EA-305 door",
            node_type="room",
            geometry=point(-5.6, 8.09, 10),
        )
        self.assertEqual(response.status_code, 201)
        # Stored exactly where it was placed (model x, -z, y), not reprojected.
        stored = Node.objects.get(id=data(response)["id"]).geometry
        self.assertEqual(
            (stored.x, stored.y, stored.z), (-5.6, -10.0, 8.09)
        )
        rooms = {
            r["room_code"]: r
            for r in data(self.client.get(f"{API}/map/rooms?page_size=100"))
        }
        self.assertEqual(rooms["EA-305"]["node_id"], data(response)["id"])

    def test_room_node_requires_a_room(self):
        sign_in_as_admin(self.client)
        response = self.place(
            floor=self.first.id, name="Door", node_type="room", geometry=point(0, 1, 0)
        )
        self.assertEqual(response.status_code, 400)

    def test_corridor_points_chain_in_place_order(self):
        sign_in_as_admin(self.client)
        first = data(
            self.place(floor=self.first.id, name="A", node_type="auxiliary", geometry=point(0, 1, 0))
        )
        second = data(
            self.place(
                floor=self.first.id,
                name="B",
                node_type="auxiliary",
                geometry=point(0, 1, -5),
                connection_mode="place_order",
                previous_node_id=first["id"],
            )
        )
        edge = Edge.objects.get(deleted_at__isnull=True)
        self.assertEqual({edge.from_node_id, edge.to_node_id}, {first["id"], second["id"]})
        self.assertAlmostEqual(edge.geometry.length, 5.0)

    def test_scene_lists_the_building_and_deleting_a_node_drops_its_edges(self):
        sign_in_as_admin(self.client)
        a = data(self.place(floor=self.first.id, name="A", node_type="auxiliary", geometry=point(0, 1, 0)))
        b = data(self.place(floor=self.first.id, name="B", node_type="auxiliary", geometry=point(3, 1, 0)))
        self.client.post(
            f"{API}/annotations/edges/",
            {"from_node": a["id"], "to_node": b["id"]},
            content_type="application/json",
        )
        area = self.first.area_id
        scene = data(self.client.get(f"{API}/annotations?area_id={area}"))
        self.assertEqual(len(scene["nodes"]), 2)
        self.assertEqual(len(scene["edges"]), 1)
        self.assertEqual(self.client.delete(f"{API}/annotations/nodes/{a['id']}/").status_code, 200)
        scene = data(self.client.get(f"{API}/annotations?area_id={area}"))
        self.assertEqual([n["id"] for n in scene["nodes"]], [b["id"]])
        self.assertEqual(scene["edges"], [])

    def test_stairs_link_floors_into_one_route(self):
        call_command("seed_eya_routes", stdout=StringIO())
        sign_in_as_admin(self.client)
        junction = Node.objects.get(metadata__key="west-lobby")
        stairs_1 = data(self.place(floor=self.first.id, name="Stairs 1F", node_type="auxiliary", geometry=point(-4.6, 1.02, 24)))
        self.client.post(
            f"{API}/annotations/edges/",
            {"from_node": junction.id, "to_node": stairs_1["id"]},
            content_type="application/json",
        )
        stairs_3 = data(self.place(floor=self.third.id, name="Stairs 3F", node_type="auxiliary", geometry=point(-4.6, 8.09, 24)))
        room = Room.objects.get(room_code="EA-305")
        door = data(
            self.place(
                floor=self.third.id,
                room=room.id,
                name="EA-305 door",
                node_type="room",
                geometry=point(-5.6, 8.09, 10),
                connection_mode="no_connection",
            )
        )
        self.client.post(
            f"{API}/annotations/edges/",
            {"from_node": stairs_3["id"], "to_node": door["id"]},
            content_type="application/json",
        )
        link = self.client.post(
            f"{API}/annotations/transitions/",
            {"transition_type": "stairs", "from_node": stairs_1["id"], "to_node": stairs_3["id"]},
            content_type="application/json",
        )
        self.assertEqual(link.status_code, 201)
        self.assertEqual(FloorTransition.objects.count(), 1)

        kiosk = Node.objects.get(node_type=Node.TYPE_KIOSK)
        route = self.client.post(
            f"{API}/navigation/routes",
            {"origin_node_id": kiosk.id, "destination_node_ids": [door["id"]]},
            content_type="application/json",
        )
        self.assertEqual(route.status_code, 201)
        heights = {
            round(c[2], 2)
            for segment in data(route)["segments"]
            for c in segment["geometry"]["coordinates"]
        }
        self.assertEqual(heights, {1.02, 8.09})


class RoomDetailsTests(TestCase):
    """Editing a room's number, name and purpose (PATCH /annotations/rooms/{id})."""

    def setUp(self):
        call_command("seed_campus", stdout=StringIO())
        self.room = Room.objects.get(room_code="EA-110")

    def edit(self, room, **body):
        return self.client.patch(
            f"{API}/annotations/rooms/{room.id}/", body, content_type="application/json"
        )

    def test_editing_needs_an_admin(self):
        self.assertIn(self.edit(self.room, room_alias="X").status_code, (401, 403))

    def test_admin_edits_number_name_and_purpose(self):
        sign_in_as_admin(self.client)
        door = Node.objects.create(
            floor=self.room.floor,
            room=self.room,
            name="EA-110 door",
            node_type=Node.TYPE_ROOM,
            geometry=model_to_point(0, 1, 0),
        )
        response = self.edit(
            self.room,
            room_code=" EA-110X ",
            room_alias="CCS Dean's Office",
            description="  Enrollment advising and student concerns ",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.room.refresh_from_db()
        self.assertEqual(self.room.room_code, "EA-110X")
        self.assertEqual(self.room.room_alias, "CCS Dean's Office")
        self.assertEqual(self.room.description, "Enrollment advising and student concerns")
        door.refresh_from_db()
        self.assertEqual(door.name, "EA-110X door")
        detail = data(self.client.get(f"{API}/map/rooms/{self.room.id}/"))
        self.assertEqual(detail["description"], "Enrollment advising and student concerns")

    def test_alias_and_purpose_are_optional(self):
        sign_in_as_admin(self.client)
        response = self.edit(self.room, room_alias="  ", description="")
        self.assertEqual(response.status_code, 200, response.content)
        self.room.refresh_from_db()
        self.assertEqual(self.room.room_alias, "Room EA-110")
        self.assertIsNone(self.room.description)

    def test_an_unnamed_room_keeps_following_its_number(self):
        sign_in_as_admin(self.client)
        room = Room.objects.get(room_code="EA-305")
        self.assertEqual(room.room_alias, "Room EA-305")
        self.assertEqual(self.edit(room, room_code="EA-305A").status_code, 200)
        room.refresh_from_db()
        self.assertEqual(room.room_alias, "Room EA-305A")

    def test_room_number_must_be_unique_on_the_floor_and_not_blank(self):
        sign_in_as_admin(self.client)
        self.assertEqual(self.edit(self.room, room_code="EA-111").status_code, 400)
        self.assertEqual(self.edit(self.room, room_code="  ").status_code, 400)
        self.room.refresh_from_db()
        self.assertEqual(self.room.room_code, "EA-110")

    def test_seeding_again_keeps_edited_details(self):
        sign_in_as_admin(self.client)
        self.edit(self.room, room_alias="CCS Dean's Office", description="Advising")
        call_command("seed_campus", stdout=StringIO())
        self.room.refresh_from_db()
        self.assertEqual(self.room.room_alias, "CCS Dean's Office")
        self.assertEqual(self.room.description, "Advising")
