"""Database conformance (DB-3 to DB-5) and the EYA seed."""
import re
from io import StringIO
from pathlib import Path
from unittest import skipUnless

from django.core.management import call_command
from django.db import IntegrityError, connection, transaction
from django.test import TestCase

from map.models import Area, Entrance, Floor, Room

# FlowSense/frontend/... relative to FlowSense/backend/django/apps/map/tests.py.
# Absent inside the backend container (it mounts only backend/django).
FRONTEND_EYA = Path(__file__).resolve().parents[4] / "frontend/client/src/data/eyaNavigation.ts"


class SpecDatabaseObjectsTests(TestCase):
    def query(self, sql, params=()):
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()

    def test_all_24_spec_check_constraints_exist(self):
        # The spec's 24, plus analytics.reports' 3 (added in step 11, QA-65).
        added = ("chk_reports_status", "chk_reports_format", "chk_reports_period")
        (count,) = self.query(
            "SELECT count(*) FROM pg_constraint WHERE contype = 'c' AND conname LIKE 'chk_%%' "
            "AND conname NOT IN %s", [added]
        )[0]
        self.assertEqual(count, 24)
        (extra,) = self.query("SELECT count(*) FROM pg_constraint WHERE conname IN %s", [added])[0]
        self.assertEqual(extra, 3)

    def test_database_rejects_values_outside_the_spec(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Area.objects.create(code="X", name="X", area_type="spaceship")

    def test_rooms_search_gin_index_exists(self):
        rows = self.query("SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_rooms_search'")
        self.assertEqual(len(rows), 1)
        self.assertIn("gin", rows[0][0].lower())

    def test_asset_audit_history_view_is_queryable(self):
        from assets.models import AssetAuditHistory

        self.assertEqual(list(AssetAuditHistory.objects.all()), [])


class SeedCampusTests(TestCase):
    def seed(self):
        out = StringIO()
        call_command("seed_campus", stdout=out)
        return out.getvalue()

    def test_seeds_the_eya_building(self):
        # AUF, EYA (1 + 6 floors + 97 rooms + 2 exits), A (1 + 4 + 48 + 1),
        # the walkways (area and its level), 3 campus labels.
        self.assertIn("166 created", self.seed())
        eya = Area.objects.get(code="EYA")
        self.assertEqual(eya.parent_area.code, "AUF")
        self.assertEqual(Floor.objects.filter(area=eya).count(), 6)
        self.assertEqual(Room.objects.filter(floor__area=eya).count(), 97)
        self.assertEqual(Entrance.objects.filter(area=eya).count(), 2)
        per_floor = {f.floor_order: f.rooms.count() for f in Floor.objects.filter(area=eya)}
        self.assertEqual(per_floor, {1: 15, 2: 17, 3: 17, 4: 18, 5: 17, 6: 13})

    def test_seeds_the_a_building_and_the_walkways(self):
        self.seed()
        a = Area.objects.get(code="A")
        self.assertEqual(a.parent_area.code, "AUF")
        per_floor = {f.floor_order: f.rooms.count() for f in Floor.objects.filter(area=a)}
        self.assertEqual(per_floor, {1: 10, 2: 14, 3: 16, 4: 8})
        self.assertEqual(Room.objects.get(room_code="A-203").room_alias, "University Registrar and Admissions")
        self.assertEqual(Room.objects.get(room_code="A-107").room_alias, "Room A-107")
        walkways = Area.objects.get(code="AUF-WALKWAYS")
        self.assertEqual((walkways.area_type, walkways.floors.count()), ("outdoor", 1))

    def test_keeps_the_documents_labels(self):
        self.seed()
        room = Room.objects.get(room_code="EA-110")
        self.assertEqual(room.room_alias, "Office of the Dean, College of Computer Studies")
        self.assertEqual(room.description, "110 - Office of the Dean (CCS)")
        self.assertEqual(room.floor.floor_order, 1)

    def test_is_idempotent_and_preserves_annotations(self):
        self.seed()
        Room.objects.filter(room_code="EA-613").update(image_path="/media/rooms/613.jpg")
        self.assertIn("0 created, 163 already there", self.seed())
        self.assertEqual(Room.objects.count(), 145)
        self.assertEqual(Room.objects.get(room_code="EA-613").image_path, "/media/rooms/613.jpg")

    def test_lettered_rooms_keep_their_letter(self):
        self.seed()
        codes = set(Room.objects.values_list("room_code", flat=True))
        self.assertTrue({"EA-101A", "EA-101B", "EA-210A", "EA-210B"} <= codes)
        self.assertFalse(any(code.endswith(("-A", "-B")) for code in codes))

    def test_renames_codes_from_earlier_seeds_in_place(self):
        self.seed()
        room = Room.objects.get(room_code="EA-101A")
        Room.objects.filter(pk=room.pk).update(room_code="EA-101-A", image_path="/media/rooms/101a.jpg")
        self.seed()
        self.assertEqual(Room.objects.filter(floor__area__code="EYA").count(), 97)
        renamed = Room.objects.get(pk=room.pk)
        self.assertEqual(renamed.room_code, "EA-101A")
        self.assertEqual(renamed.image_path, "/media/rooms/101a.jpg")

    def test_unnamed_rooms_are_described_as_lecture_or_lab_rooms(self):
        self.seed()
        room = Room.objects.get(room_code="EA-401")
        self.assertEqual(room.room_alias, "Room EA-401")
        self.assertEqual(room.description, "Lecture or laboratory room")

    @skipUnless(FRONTEND_EYA.exists(), "frontend source not available (backend-only checkout/container)")
    def test_every_kiosk_destination_code_exists_in_the_seed(self):
        """The kiosk's hand-built EYA routes must point at real rooms."""
        self.seed()
        codes = re.findall(r'code:\s*"([^"]+)"', FRONTEND_EYA.read_text())
        self.assertTrue(codes, f"no destination codes found in {FRONTEND_EYA}")
        missing = [code for code in codes if not Room.objects.filter(room_code=code).exists()]
        self.assertEqual(missing, [])

    def test_seeded_rooms_are_searchable(self):
        self.seed()
        response = self.client.get("/api/v1/search?q=EA-110")
        self.assertEqual(response.status_code, 200)
        self.assertIn("EA-110", response.content.decode())


class CampusEditingTests(TestCase):
    """Step 14: buildings placed on the campus, labels, floors, rooms, and
    adding a building from the admin panel."""

    def setUp(self):
        from common.testing import sign_in_as_admin

        call_command("seed_campus", stdout=StringIO())
        call_command("seed_eya_routes", stdout=StringIO())
        call_command("seed_a_routes", stdout=StringIO())
        sign_in_as_admin(self.client)

    def api(self, method, path, body=None):
        from common.testing import API

        call = getattr(self.client, method)
        if body is None:
            return call(f"{API}{path}")
        return call(f"{API}{path}", body, content_type="application/json")

    def test_seed_places_a_and_names_floors_and_labels(self):
        from common.testing import data

        areas = {a["code"]: a for a in data(self.api("get", "/map/areas"))}
        self.assertEqual(areas["A"]["placement"], {"position": [-189.35, 3.2, 133.44], "rotation_y": 1.5708})
        self.assertIsNone(areas["EYA"]["placement"])
        floors = data(self.api("get", f"/map/areas/{areas['A']['id']}/floors"))
        self.assertEqual([(f["short_name"], f["display_name"]) for f in floors][:2],
                         [("1F", "First floor"), ("2F", "Second floor")])
        labels = [label["name"] for label in data(self.api("get", "/annotations/labels"))]
        self.assertIn("Overpass", labels)

    def test_moving_a_building_moves_its_points_and_keeps_routes(self):
        from common.testing import data
        from map.models import Node
        from map.placement import to_model
        from navigation import services
        from navigation.coordinates import point_to_model

        a = Area.objects.get(code="A")
        entrance = Node.objects.get(metadata__key="entrance", metadata__seed="a-network")
        local = to_model(a.placement, point_to_model(entrance.geometry))
        moved = {"position": [-180.0, 3.2, 140.0], "rotation_y": 1.6}
        response = self.api("patch", f"/map/areas/{a.pk}", {"placement": moved})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(data(response)["placement"], moved)
        entrance.refresh_from_db()
        # The same spot on the model.
        for got, want in zip(to_model(moved, point_to_model(entrance.geometry)), local):
            self.assertAlmostEqual(got, want, places=2)
        # Still routed from the EYA kiosk.
        graph = services._build_graph()
        kiosk = Node.objects.get(node_type=Node.TYPE_KIOSK)
        door = Node.objects.get(room__room_code="A-305", deleted_at__isnull=True)
        self.assertTrue(services._a_star(graph, kiosk.id, door.id))
        self.assertEqual(self.api("patch", f"/map/areas/{a.pk}", {"placement": {"position": [1, 2]}}).status_code, 400)

    def test_labels_are_edited_by_admins_and_read_by_anyone(self):
        from common.testing import data

        body = {"name": "Chapel", "geometry": {"type": "Point", "coordinates": [-30.0, -50.0, 2.0]}}
        created = data(self.api("post", "/annotations/labels/", body))
        self.assertEqual(created["name"], "Chapel")
        self.api("patch", f"/annotations/labels/{created['id']}/", {"name": "AUF Chapel"})
        self.client.cookies.clear()
        names = [label["name"] for label in data(self.api("get", "/annotations/labels"))]
        self.assertIn("AUF Chapel", names)
        self.assertEqual(self.api("post", "/annotations/labels/", body).status_code, 401)

    def test_add_a_building_with_floors_and_rooms(self):
        from common.testing import data

        response = self.api("post", "/annotations/buildings/", {"code": "b", "name": "B Building", "floors": 3})
        self.assertEqual(response.status_code, 201, response.content)
        building = Area.objects.get(code="B")
        self.assertEqual(building.parent_area.code, "AUF")
        floors = list(Floor.objects.filter(area=building).order_by("floor_order"))
        self.assertEqual([(f.glb_node_name, f.short_name, f.display_name) for f in floors][2],
                         ("FLOOR_3", "3F", "Third floor"))
        self.assertEqual(self.api("post", "/annotations/buildings/", {"code": "B", "name": "x", "floors": 1}).status_code, 400)

        # Floors: rename, add, remove an empty one.
        self.api("patch", f"/annotations/floors/{floors[0].pk}/", {"display_name": "Ground floor", "short_name": "G"})
        floors[0].refresh_from_db()
        self.assertEqual((floors[0].short_name, floors[0].display_name), ("G", "Ground floor"))
        added = self.api("post", "/annotations/floors/", {"area": building.pk, "floor_order": 4})
        self.assertEqual(data(added)["glb_node_name"], "FLOOR_4")
        self.assertEqual(self.api("post", "/annotations/floors/", {"area": building.pk, "floor_order": 4}).status_code, 400)

        # Rooms: add (searchable), then remove.
        room = self.api("post", "/annotations/rooms/new/", {"floor": floors[1].pk, "room_code": "B-201", "room_alias": ""})
        self.assertEqual(room.status_code, 201, room.content)
        self.assertEqual(data(room)["room_alias"], "Room B-201")
        self.assertEqual(self.api("post", "/annotations/rooms/new/", {"floor": floors[1].pk, "room_code": "B-201"}).status_code, 400)
        self.assertEqual(self.api("delete", f"/annotations/floors/{floors[1].pk}/").status_code, 409)
        self.assertEqual(self.client.delete(f"/api/v1/annotations/rooms/{data(room)['id']}/remove/").status_code, 200)
        self.assertEqual(self.api("delete", f"/annotations/floors/{floors[1].pk}/").status_code, 200)

    def test_the_walkways_scene_shows_the_points_walks_can_join(self):
        from common.testing import data

        walkways = Area.objects.get(code="AUF-WALKWAYS")
        nodes = data(self.api("get", f"/annotations?area_id={walkways.pk}"))["nodes"]
        types = {node["node_type"] for node in nodes}
        names = {node["name"] for node in nodes}
        # Its own points, the EYA front doors it joins, the kiosk and A's entrance.
        self.assertIn("Overpass (north end)", names)
        self.assertIn("EYA front doors", names)
        self.assertTrue({"kiosk", "area_entrance"} <= types)
