"""Hardware API is admin-only and lives at /api/v1/hardware/devices (07 API)."""
from django.test import TestCase


class HardwareApiTests(TestCase):
    def test_device_registry_requires_an_admin(self):
        self.assertEqual(self.client.get("/api/v1/hardware/devices").status_code, 401)
