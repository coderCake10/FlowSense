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
        (count,) = self.query("SELECT count(*) FROM pg_constraint WHERE contype = 'c' AND conname LIKE 'chk_%%'")[0]
        self.assertEqual(count, 24)

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
        self.assertIn("102 created", self.seed())
        eya = Area.objects.get(code="EYA")
        self.assertEqual(eya.parent_area.code, "AUF")
        self.assertEqual(Floor.objects.filter(area=eya).count(), 6)
        self.assertEqual(Room.objects.filter(floor__area=eya).count(), 92)
        self.assertEqual(Entrance.objects.filter(area=eya).count(), 2)
        per_floor = {f.floor_order: f.rooms.count() for f in Floor.objects.filter(area=eya)}
        self.assertEqual(per_floor, {1: 15, 2: 16, 3: 16, 4: 18, 5: 14, 6: 13})

    def test_keeps_the_documents_labels(self):
        self.seed()
        room = Room.objects.get(room_code="EA-110")
        self.assertEqual(room.room_alias, "Office of the Dean, College of Computer Studies")
        self.assertEqual(room.description, "110 - Office of the Dean (CCS)")
        self.assertEqual(room.floor.floor_order, 1)

    def test_is_idempotent_and_preserves_annotations(self):
        self.seed()
        Room.objects.filter(room_code="EA-613").update(image_path="/media/rooms/613.jpg")
        self.assertIn("0 created, 102 already there", self.seed())
        self.assertEqual(Room.objects.count(), 92)
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
        self.assertEqual(Room.objects.count(), 92)
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
