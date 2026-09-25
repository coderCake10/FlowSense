"""operations.settings and operations.semesters (DB-1, DB-2)."""
import datetime

from django.db import IntegrityError
from django.test import TestCase

from common.models import Semester, Setting


class OperationsSettingsTableTests(TestCase):
    def test_default_setting_is_seeded(self):
        setting = Setting.objects.get(key="informational_alert_clear_time")
        self.assertEqual(setting.value, {"seconds": 3600})

    def test_semester_end_cannot_precede_start(self):
        with self.assertRaises(IntegrityError):
            Semester.objects.create(
                academic_year="2026-2027",
                name="First Semester",
                start_date=datetime.date(2026, 12, 1),
                end_date=datetime.date(2026, 8, 1),
            )

    def test_valid_semester_saves(self):
        Semester.objects.create(
            academic_year="2026-2027",
            name="First Semester",
            start_date=datetime.date(2026, 8, 1),
            end_date=datetime.date(2026, 12, 15),
        )
        self.assertEqual(Semester.objects.count(), 1)



from django.core.cache import cache

from analytics.models import AuditEvent
from common.testing import API, data, error, meta, sign_in_as_admin


class SettingsApiTests(TestCase):
    def setUp(self):
        self.admin = sign_in_as_admin(self.client)

    def test_requires_an_admin(self):
        self.client.cookies.clear()
        self.assertEqual(self.client.get(f"{API}/settings").status_code, 401)

    def test_lists_seeded_settings(self):
        keys = [s["key"] for s in data(self.client.get(f"{API}/settings"))]
        self.assertIn("informational_alert_clear_time", keys)
        self.assertIn("maintenance_mode", keys)

    def test_update_is_validated_saved_and_audited(self):
        url = f"{API}/settings/informational_alert_clear_time"
        bad = self.client.patch(url, {"value": {"seconds": 5}}, content_type="application/json")
        self.assertEqual(bad.status_code, 400)
        ok = self.client.patch(url, {"value": {"seconds": 1800}}, content_type="application/json")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(data(ok)["value"], {"seconds": 1800})
        self.assertEqual(data(ok)["updated_by"]["id"], self.admin.id)
        event = AuditEvent.objects.get(event_type="configuration")
        self.assertEqual(event.metadata["entity_key"], "informational_alert_clear_time")
        self.assertEqual(event.admin_user, self.admin)

    def test_unknown_setting_is_404_in_the_error_envelope(self):
        response = self.client.get(f"{API}/settings/nope")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(error(response)["code"], "NOT_FOUND")

    def test_semester_crud_and_date_rule(self):
        url = f"{API}/settings/semesters"
        body = {"academic_year": "2026-2027", "name": "First Semester",
                "start_date": "2026-08-10", "end_date": "2026-12-18"}
        created = self.client.post(url, body, content_type="application/json")
        self.assertEqual(created.status_code, 201)
        semester_id = data(created)["id"]
        backwards = self.client.patch(f"{url}/{semester_id}", {"end_date": "2026-01-01"},
                                      content_type="application/json")
        self.assertEqual(backwards.status_code, 400)
        self.assertEqual(len(data(self.client.get(url))), 1)
        self.assertEqual(self.client.delete(f"{url}/{semester_id}").status_code, 200)
        self.assertEqual(Semester.objects.count(), 0)
        self.assertEqual(AuditEvent.objects.filter(entity_type="semester").count(), 2)


class SystemApiTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_status_is_public_and_operational_with_nothing_deployed(self):
        response = self.client.get(f"{API}/system/status")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data(response)["status"], "operational")
        self.assertNotIn("components", data(response))

    def test_maintenance_mode_wins(self):
        Setting.objects.filter(key="maintenance_mode").update(value={"enabled": True})
        self.assertEqual(data(self.client.get(f"{API}/system/status"))["status"], "maintenance")

    def test_health_is_public_and_lists_components(self):
        components = data(self.client.get(f"{API}/system/health"))["components"]
        self.assertEqual(components["database"]["state"], "ok")
        self.assertEqual({"database", "redis", "celery", "kiosks", "sensors"}, set(components))

    def test_status_rules(self):
        from common.system.health import overall_status
        ok, down = {"state": "ok"}, {"state": "down"}
        self.assertEqual(overall_status({"database": ok, "sensors": {"state": "degraded"}}, False), "degraded")
        # All sensors offline: analytics suffer, the kiosk still works.
        self.assertEqual(overall_status({"database": ok, "kiosks": ok, "sensors": down}, False), "degraded")
        self.assertEqual(overall_status({"database": ok, "redis": down, "kiosks": ok}, False), "degraded")
        # Every kiosk offline, or no database: critical.
        self.assertEqual(overall_status({"database": ok, "kiosks": down}, False), "critical")
        self.assertEqual(overall_status({"database": down}, False), "critical")


class GeoJSONFieldTests(TestCase):
    """GeoJSON input is in the column's SRID (3857, metres), not WGS84."""

    def test_coordinates_are_kept_as_given(self):
        from common.serializers.fields import GeoJSONField

        geom = GeoJSONField().to_internal_value(
            {"type": "Point", "coordinates": [5.15, 11.85, 1.02]}
        )
        self.assertEqual(geom.srid, 3857)
        self.assertEqual(geom.coords, (5.15, 11.85, 1.02))

    def test_an_explicit_crs_is_respected(self):
        from common.serializers.fields import GeoJSONField

        geom = GeoJSONField().to_internal_value(
            {
                "type": "Point",
                "coordinates": [120.59, 15.14],
                "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
            }
        )
        self.assertEqual(geom.srid, 4326)
