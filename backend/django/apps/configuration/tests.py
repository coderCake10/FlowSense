"""operations.settings and operations.semesters (DB-1, DB-2)."""
import datetime

from django.db import IntegrityError
from django.test import TestCase

from configuration.models import Semester, Setting


class ConfigurationTableTests(TestCase):
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
