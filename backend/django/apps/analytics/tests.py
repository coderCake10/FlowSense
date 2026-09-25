"""Alerts API, Activity API, alert housekeeping, and the dashboard summary."""
from datetime import timedelta

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from analytics import alerts as alert_service
from analytics.dashboard import density_level
from analytics.models import Alert, AuditEvent
from common.models import Semester, Setting
from common.testing import API, data, error, meta, sign_in_as_admin
from fs_sessions.models import KioskSession
from search.models import SearchEvent


class AlertsApiTests(TestCase):
    def setUp(self):
        self.admin = sign_in_as_admin(self.client)
        self.alert = alert_service.raise_alert("warning", "Device offline", "Sensor-3 stopped reporting.",
                                               entity_type="device", entity_id=3)

    def test_requires_an_admin(self):
        self.client.cookies.clear()
        self.assertEqual(self.client.get(f"{API}/alerts").status_code, 401)

    def test_acknowledge_then_clear(self):
        response = self.client.get(f"{API}/alerts")
        self.assertEqual(meta(response)["total_count"], 1)
        self.assertEqual(data(response)[0]["state"], "active")
        acked = data(self.client.post(f"{API}/alerts/{self.alert.id}/acknowledge"))
        self.assertEqual(acked["state"], "acknowledged")
        self.assertEqual(acked["acknowledged_by"]["id"], self.admin.id)
        cleared = data(self.client.post(f"{API}/alerts/{self.alert.id}/clear"))
        self.assertEqual(cleared["state"], "cleared")
        self.assertEqual(meta(self.client.get(f"{API}/alerts"))["total_count"], 0)
        self.assertEqual(meta(self.client.get(f"{API}/alerts?state=cleared"))["total_count"], 1)
        self.assertEqual(self.client.post(f"{API}/alerts/{self.alert.id}/acknowledge").status_code, 409)
        self.assertTrue(AuditEvent.objects.filter(entity_type="alert", entity_id=self.alert.id).exists())

    def test_raising_the_same_alert_twice_keeps_one(self):
        alert_service.raise_alert("warning", "Device offline", "again", entity_type="device", entity_id=3)
        self.assertEqual(Alert.objects.count(), 1)

    def test_bad_state_filter_is_400(self):
        self.assertEqual(self.client.get(f"{API}/alerts?state=bogus").status_code, 400)


class InformationalAlertClearTests(TestCase):
    def test_uses_the_admin_setting(self):
        Setting.objects.filter(key="informational_alert_clear_time").update(value={"seconds": 600})
        old = alert_service.raise_alert("informational", "Old", "x")
        fresh = alert_service.raise_alert("informational", "Fresh", "x")
        warning = alert_service.raise_alert("warning", "Old warning", "x")
        Alert.objects.filter(pk__in=[old.pk, warning.pk]).update(created_at=timezone.now() - timedelta(minutes=11))
        self.assertEqual(alert_service.clear_expired_informational_alerts(), 1)
        self.assertEqual(set(Alert.objects.filter(cleared_at__isnull=True).values_list("title", flat=True)),
                         {"Fresh", "Old warning"})


class ActivityApiTests(TestCase):
    def setUp(self):
        self.admin = sign_in_as_admin(self.client)

    def test_lists_audit_events_newest_first_with_filters(self):
        self.client.patch(f"{API}/settings/maintenance_mode", {"value": {"enabled": True}},
                          content_type="application/json")
        AuditEvent.objects.create(event_type="asset", action="upload", description="Uploaded EYA model")
        response = self.client.get(f"{API}/activity")
        self.assertEqual(meta(response), {"page": 1, "page_size": 25, "total_count": 2, "total_pages": 1})
        page = data(response)
        self.assertEqual(page[0]["event_type"], "asset")
        self.assertEqual(page[1]["admin_user"]["email"], self.admin.email)
        only_config = data(self.client.get(f"{API}/activity?event_type=configuration"))
        self.assertEqual(len(only_config), 1)
        detail = data(self.client.get(f"{API}/activity/{only_config[0]['id']}"))
        self.assertEqual(detail["metadata"]["value"], {"enabled": True})


class DashboardApiTests(TestCase):
    def setUp(self):
        cache.clear()
        call_command("seed_campus", stdout=open("/dev/null", "w"))
        sign_in_as_admin(self.client)

    def test_shape_and_todays_counts(self):
        now = timezone.now()
        session = KioskSession.objects.create()
        KioskSession.objects.filter(pk=session.pk).update(started_at=now - timedelta(minutes=4), ended_at=now)
        SearchEvent.objects.create(query_text="Registrar", result_count=1, resolved=True)
        SearchEvent.objects.create(query_text="guidanse", result_count=0, resolved=False)
        SearchEvent.objects.create(query_text="Guidanse", result_count=0, resolved=False)
        body = data(self.client.get(f"{API}/analytics/dashboard"))
        self.assertEqual(body["system"]["status"], "operational")
        self.assertEqual(body["today"]["kiosk_sessions"], 1)
        self.assertEqual(body["today"]["successful_searches"], 1)
        self.assertEqual(body["today"]["failed_searches"], 2)
        self.assertEqual(body["today"]["average_session_seconds"], 240)
        self.assertEqual(len(body["kiosk_activity"]), 7)
        self.assertEqual(body["kiosk_activity"][-1]["sessions"], 1)
        self.assertEqual(body["failed_searches"], [{"query": "guidanse", "count": 2}])
        self.assertEqual(body["summary"]["buildings"], 1)
        self.assertEqual(body["summary"]["floors"], 6)
        self.assertEqual(body["summary"]["rooms"], 92)
        for key in ("crowd_density", "top_destinations", "alerts", "recent_activity"):
            self.assertIn(key, body)

    def test_requires_an_admin(self):
        self.client.cookies.clear()
        self.assertEqual(self.client.get(f"{API}/analytics/dashboard").status_code, 401)

    def test_density_levels(self):
        self.assertEqual([density_level(v) for v in (None, 0.1, 0.5, 0.9)], [None, "low", "moderate", "high"])


from decimal import Decimal

from django.contrib.gis.geos import Point

from analytics.models import NavigationDestination, NavigationRequest, QrEvent
from analytics.ranges import parse_range
from fs_sessions.models import NavigationSession
from hardware.models import Device, Kiosk, Sensor, SensorObservation
from map.models import Floor, Node, Room


class DateRangeTests(TestCase):
    def test_presets_custom_and_errors(self):
        from rest_framework.exceptions import ValidationError

        self.assertEqual(len(parse_range({}).days), 7)
        self.assertEqual(len(parse_range({"range": "today"}).days), 1)
        self.assertEqual(len(parse_range({"range": "last_30_days"}).days), 30)
        custom = parse_range({"range": "custom", "start_date": "2026-08-10", "end_date": "2026-08-12"})
        self.assertEqual([str(d) for d in custom.days], ["2026-08-10", "2026-08-11", "2026-08-12"])
        for bad in ({"range": "yesterday"}, {"range": "custom"}, {"range": "semester", "semester_id": "999"},
                    {"range": "custom", "start_date": "2026-08-12", "end_date": "2026-08-10"}):
            with self.assertRaises(ValidationError):
                parse_range(bad)

    def test_semester_range(self):
        semester = Semester.objects.create(academic_year="2026-2027", name="First Semester",
                                           start_date="2026-08-10", end_date="2026-12-18")
        r = parse_range({"range": "semester", "semester_id": str(semester.id)})
        self.assertEqual((r.days[0].isoformat(), r.days[-1].isoformat()), ("2026-08-10", "2026-12-18"))


class AnalyticsApiTests(TestCase):
    """Known data in, exact numbers out, for each Analytics API section."""

    def setUp(self):
        cache.clear()
        call_command("seed_campus", stdout=open("/dev/null", "w"))
        sign_in_as_admin(self.client)
        now = timezone.now()
        self.now = now
        floor = Floor.objects.get(area__code="EYA", floor_order=1)
        room = Room.objects.filter(floor=floor).first()
        self.origin = Node.objects.create(floor=floor, name="Lobby kiosk", node_type=Node.TYPE_KIOSK, geometry=Point(0, 0, 0, srid=3857))
        self.registrar = Node.objects.create(floor=floor, room=room, name="Registrar", node_type=Node.TYPE_ROOM, geometry=Point(10, 0, 0, srid=3857))
        self.library = Node.objects.create(floor=floor, name="Library", node_type=Node.TYPE_ROOM, geometry=Point(20, 0, 0, srid=3857))

        # A registered kiosk, registered 10 hours ago, offline for 1 hour of that.
        self.kiosk = Device.objects.create(device_id="kiosk-aaaabbbbcccc", device_type="kiosk", name="Lobby Kiosk",
                                           status="online", enabled=True, last_ping_at=now,
                                           registered_at=now - timedelta(hours=10))
        Kiosk.objects.create(device=self.kiosk)
        Alert.objects.create(severity="critical", alert_type="critical", title="Device offline", message="x",
                             entity_type="device", entity_id=self.kiosk.id,
                             cleared_at=now - timedelta(hours=2))
        Alert.objects.filter(entity_id=self.kiosk.id).update(created_at=now - timedelta(hours=3))

        # Two kiosk sessions today (2 and 4 minutes).
        for minutes in (2, 4):
            s = KioskSession.objects.create(kiosk_id=self.kiosk.id)
            KioskSession.objects.filter(pk=s.pk).update(started_at=now - timedelta(minutes=30), ended_at=now - timedelta(minutes=30 - minutes))
        self.session = KioskSession.objects.first()

        # Searches: 3 successful, 2 failed ("guidanse" twice).
        for query, ok, latency in (("registrar", True, 80), ("library", True, 100), ("dean", True, 120),
                                   ("guidanse", False, 60), ("Guidanse ", False, 40)):
            SearchEvent.objects.create(kiosk_session=self.session, query_text=query, result_count=int(ok),
                                       resolved=ok, search_latency_ms=latency)

        # Navigation: one single-destination route (100 m), one queue of two (300 m), one failure.
        def request(stops, distance, status, ms):
            req = NavigationRequest.objects.create(origin_node=self.origin, route_distance=distance, status=status,
                                                   destination_count=len(stops), route_generation_ms=ms)
            for order, node in enumerate(stops, start=1):
                NavigationDestination.objects.create(navigation_request=req, destination_node=node, destination_order=order)
        request([self.registrar], Decimal("100"), "generated", 50)
        request([self.registrar, self.library], Decimal("300"), "completed", 150)
        request([self.library], None, "failed", None)

        # QR: two generated, one scanned 8 seconds later.
        nav = NavigationSession.objects.create(kiosk_session=self.session, session_token_hash="h1",
                                               expires_at=now + timedelta(minutes=15))
        NavigationSession.objects.filter(pk=nav.pk).update(created_at=now - timedelta(seconds=8), scanned_at=now)
        QrEvent.objects.create(navigation_session=nav, event_type="generated")
        QrEvent.objects.create(navigation_session=nav, event_type="scanned")
        QrEvent.objects.create(event_type="generated")

        # A sensor registered 1 hour ago sampling every 60 s: 30 readings of 0.2 and 0.8.
        self.sensor = Device.objects.create(device_id="esp32-analytics-01", device_type="sensor", name="Lobby Sensor",
                                            status="online", enabled=True, last_ping_at=now,
                                            registered_at=now - timedelta(hours=1))
        sensor = Sensor.objects.create(device=self.sensor, sampling_interval_seconds=60, area=floor.area, floor=floor)
        for i in range(30):
            SensorObservation.objects.create(sensor=sensor, observed_at=now - timedelta(minutes=i),
                                             estimated_density=Decimal("0.2") if i % 2 else Decimal("0.8"),
                                             signal_count=10 if i % 2 else 40)

    def get(self, path, **params):
        # A fixed 24-hour window ending a minute from now, so the results don't depend on the time of day.
        if not params:
            params = {"range": "custom", "start_date": (self.now - timedelta(days=1)).isoformat(),
                      "end_date": (self.now + timedelta(minutes=1)).isoformat()}
        response = self.client.get(f"{API}/analytics/{path}", params)
        self.assertEqual(response.status_code, 200, response.content)
        return data(response)

    def test_search(self):
        body = self.get("search")
        self.assertEqual(body["totals"], {"total": 5, "successful": 3, "failed": 2, "success_rate": 60.0})
        self.assertEqual(body["failed_queries"][0]["query"], "guidanse")
        self.assertEqual(body["failed_queries"][0]["failures"], 2)
        self.assertEqual(body["latency_ms"]["average"], 80.0)
        self.assertEqual(sum(day["successful"] for day in body["trend"]), 3)

    def test_navigation_queues_and_routes(self):
        body = self.get("navigation")
        self.assertEqual(body["top_destinations"][0]["name"], "Library")  # 2 requests, same as Registrar; name order
        self.assertEqual({d["name"]: d["requests"] for d in body["top_destinations"]}, {"Library": 2, "Registrar": 2})
        queues = body["queues"]
        self.assertEqual(queues["navigation_requests"], 3)
        self.assertEqual(queues["queue_usage"], 1)
        self.assertEqual(queues["multi_destination_percent"], 33.3)
        self.assertEqual(queues["route_generation_success_percent"], 66.7)
        self.assertEqual(queues["common_sequences"], [{"sequence": ["Registrar", "Library"], "count": 1}])
        self.assertEqual(body["routes"]["average_length_m"], {"all": 200.0, "single_destination": 100.0, "multi_destination": 300.0})
        self.assertIsNone(body["routes"]["average_turns"])
        self.assertIn("route_turns", body["not_collected"])

    def test_kiosk_usage_and_availability(self):
        body = self.get("kiosks")
        self.assertEqual(body["sessions"], {"total": 2, "average_seconds": 180})
        self.assertEqual(sum(h["searches"] for h in body["usage_by_hour"]), 5)
        self.assertEqual(len(body["usage_by_hour"]), 24)
        availability = body["availability"][0]
        self.assertEqual(availability["name"], "Lobby Kiosk")
        # Registered 10 hours ago, offline for 1 of them.
        self.assertEqual(availability["availability_percent"], 90.0)

    def test_qr(self):
        body = self.get("qr")
        self.assertEqual(body["totals"], {"generated": 2, "scanned": 1, "scan_rate": 50.0})
        self.assertEqual(body["handoff_seconds"]["average"], 8.0)
        self.assertEqual(body["by_kiosk"][0]["name"], "Lobby Kiosk")
        self.assertEqual(body["by_kiosk"][0]["scanned"], 1)
        events = self.client.get(f"{API}/analytics/qr/events", {
            "range": "custom", "start_date": (self.now - timedelta(days=1)).isoformat(),
            "end_date": (self.now + timedelta(minutes=1)).isoformat(), "page_size": 2})
        self.assertEqual(meta(events)["total_count"], 3)
        self.assertEqual(len(data(events)), 2)

    def test_sensors_and_spatial(self):
        body = self.get("sensors")
        row = body["sensors"][0]
        self.assertEqual((row["received"], row["expected"]), (30, 60))
        self.assertEqual(row["reliability_percent"], 50.0)
        self.assertEqual(row["average_density"], 0.5)
        spatial = self.get("spatial")
        busiest = spatial["busiest_locations"][0]
        self.assertEqual((busiest["average_level"], busiest["peak_level"]), ("moderate", "high"))
        self.assertEqual(busiest["location"], "EYA Building · 1F")
        self.assertIsNone(spatial["least_recommended_segments"])

    def test_system_and_activity(self):
        body = self.get("system")
        self.assertEqual(body["latency_ms"]["pathfinding"]["average"], 100.0)
        self.assertIsNone(body["latency_ms"]["search_to_render"])
        self.assertIn("api_success_rate", body["not_collected"])
        days = self.get("activity")["days"]
        self.assertIn(len(days), (2, 3))  # the window touches two local dates (three in the minute before midnight)
        totals = {key: sum(day[key] for day in days) for key in ("kiosk_sessions", "searches", "navigation_requests", "queues")}
        self.assertEqual(totals, {"kiosk_sessions": 2, "searches": 5, "navigation_requests": 3, "queues": 1})

    def test_building_and_floor_filters(self):
        eya = Floor.objects.get(area__code="EYA", floor_order=1)
        second = Floor.objects.get(area__code="EYA", floor_order=2)
        window = {"range": "custom", "start_date": (self.now - timedelta(days=1)).isoformat(),
                  "end_date": (self.now + timedelta(minutes=1)).isoformat()}
        self.assertEqual(len(self.get("sensors", **window, area_id=eya.area_id)["sensors"]), 1)
        self.assertEqual(self.get("sensors", **window, floor_id=second.id)["sensors"], [])
        self.assertEqual(self.get("navigation", **window, floor_id=eya.id)["queues"]["navigation_requests"], 3)
        self.assertEqual(self.get("navigation", **window, floor_id=second.id)["queues"]["navigation_requests"], 0)

    def test_bad_range_is_a_validation_error(self):
        response = self.client.get(f"{API}/analytics/search", {"range": "fortnight"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(error(response)["code"], "VALIDATION_ERROR")

    def test_admin_only(self):
        self.client.cookies.clear()
        self.assertEqual(self.client.get(f"{API}/analytics/search").status_code, 401)


class TrendAlertTests(TestCase):
    def test_high_failed_search_rate_and_increased_usage(self):
        now = timezone.now()
        for i in range(20):
            SearchEvent.objects.create(query_text="x", result_count=0 if i < 4 else 1, resolved=i >= 4)
        for i in range(30):
            s = KioskSession.objects.create()
        old = []
        for i in range(10):
            s = KioskSession.objects.create()
            old.append(s.pk)
        KioskSession.objects.filter(pk__in=old).update(started_at=now - timedelta(days=10))
        raised = alert_service.evaluate_trends(now)
        self.assertEqual(set(raised), {"High failed-search rate", "Increased kiosk usage"})
        self.assertEqual(Alert.objects.get(title="High failed-search rate").severity, "warning")
        self.assertEqual(Alert.objects.get(title="Increased kiosk usage").severity, "informational")
        # Nothing to report with too few searches.
        SearchEvent.objects.all().delete()
        Alert.objects.all().delete()
        self.assertNotIn("High failed-search rate", alert_service.evaluate_trends(now))
