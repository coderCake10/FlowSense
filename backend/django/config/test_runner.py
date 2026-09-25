"""
Default `manage.py test` to every FlowSense app.

The apps live in apps/ (put on sys.path by settings) and apps/ is not a
package, so Django's default discovery from the project root finds no tests.
With no labels given, this runner tests each local app by name instead.
"""
from django.test.runner import DiscoverRunner

LOCAL_APPS = [
    "analytics",
    "annotation",
    "assets",
    "authentication",
    "common",
    "fs_sessions",
    "hardware",
    "map",
    "navigation",
    "search",
    "config",
]


class FlowSenseTestRunner(DiscoverRunner):
    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        # Run Celery tasks inline: tests need no broker and see task errors.
        # The app reads CELERY_* Django settings (namespace="CELERY"), which
        # take precedence over app.conf assignments, so set the setting.
        from django.conf import settings

        settings.CELERY_TASK_ALWAYS_EAGER = True
        settings.CELERY_TASK_EAGER_PROPAGATES = True

    def build_suite(self, test_labels=None, **kwargs):
        return super().build_suite(test_labels or LOCAL_APPS, **kwargs)
