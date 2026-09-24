"""Seed row from the schema (06 Database): informational alert auto-clear time."""
from django.db import migrations

DEFAULTS = [
    (
        "informational_alert_clear_time",
        {"seconds": 3600},
        "How long informational alerts remain before being automatically cleared.",
    ),
]


def seed(apps, schema_editor):
    Setting = apps.get_model("configuration", "Setting")
    for key, value, description in DEFAULTS:
        # Never overwrite a value an administrator has changed.
        Setting.objects.get_or_create(key=key, defaults={"value": value, "description": description})


def unseed(apps, schema_editor):
    Setting = apps.get_model("configuration", "Setting")
    Setting.objects.filter(key__in=[key for key, _, _ in DEFAULTS]).delete()


class Migration(migrations.Migration):
    dependencies = [("configuration", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
