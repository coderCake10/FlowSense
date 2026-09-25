"""Kiosk/QR session endpoints stay public under the admin-only default."""
from django.test import TestCase

from common.testing import error


class KioskSessionTests(TestCase):
    def test_create_without_kiosk_is_a_400_not_a_crash(self):
        response = self.client.post("/api/v1/sessions/kiosk", {}, content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(error(response)["code"], "VALIDATION_ERROR")
        self.assertIn("kiosk", error(response)["fields"])

    def test_session_endpoints_do_not_require_an_admin(self):
        response = self.client.post("/api/v1/sessions/kiosk", {"kiosk": 999}, content_type="application/json")
        self.assertNotIn(response.status_code, (401, 403))

    def test_cleanup_task_runs(self):
        from fs_sessions.tasks import cleanup_expired_sessions

        cleanup_expired_sessions()  # no sessions: must simply not fail
