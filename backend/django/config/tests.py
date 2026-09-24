"""Platform wiring: API layout (07 API design), security defaults, Celery schedule."""
from django.conf import settings
from django.test import TestCase

from config.celery import app as celery_app


class ApiLayoutTests(TestCase):
    """Every area is under /api/v1 and works with or without a trailing slash."""

    PUBLIC = ["/api/v1/map/areas", "/api/v1/map/context", "/api/v1/search?q=dean", "/api/v1/search/suggestions?q=de"]
    ADMIN_ONLY = [
        "/api/v1/auth/me",
        "/api/v1/auth/session",
        "/api/v1/users",
        "/api/v1/annotations",
        "/api/v1/hardware/devices",
    ]

    def test_public_endpoints_answer_without_a_session(self):
        for url in self.PUBLIC:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_admin_endpoints_return_401_with_a_non_basic_challenge(self):
        for url in self.ADMIN_ONLY:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 401)
                # Not "Basic": that would make browsers show a password prompt.
                self.assertTrue(response["WWW-Authenticate"].startswith("AdminSession"))

    def test_trailing_slash_is_optional_and_never_redirects(self):
        for url in ["/api/v1/map/areas", "/api/v1/map/areas/"]:
            self.assertEqual(self.client.get(url).status_code, 200)
        response = self.client.post("/api/v1/auth/login", {"email": "x@auf.edu.ph"}, content_type="application/json")
        self.assertEqual(response.status_code, 200)  # POST without slash reaches the view

    def test_old_unversioned_prefixes_are_gone(self):
        for url in ["/api/map/areas/", "/api/annotation/", "/api/hardware/device/"]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 404)


class SettingsTests(TestCase):
    def test_rest_framework_is_admin_only_by_default(self):
        self.assertEqual(
            settings.REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"], ["common.permissions.IsAdminUser"]
        )

    def test_every_beat_task_is_registered(self):
        celery_app.loader.import_default_modules()
        for name, entry in settings.CELERY_BEAT_SCHEDULE.items():
            with self.subTest(entry=name):
                self.assertIn(entry["task"], celery_app.tasks)


class CheckConstraintDriftTests(TestCase):
    """Each chk_* constraint must allow exactly its field's choices (common/db.py)."""

    def test_constraints_match_choices(self):
        from django.apps import apps

        checked = 0
        for model in apps.get_models():
            for constraint in model._meta.constraints:
                if not constraint.name.startswith("chk_") or constraint.name in (
                    "chk_edge_nodes_different",
                    "chk_semesters_date_range",
                ):
                    continue
                lookup, values = next(
                    child for child in constraint.condition.children if child[0].endswith("__in")
                )
                field = model._meta.get_field(lookup.removesuffix("__in"))
                with self.subTest(constraint=constraint.name):
                    self.assertEqual(sorted(values), sorted(value for value, _ in field.choices))
                checked += 1
        self.assertEqual(checked, 22)
