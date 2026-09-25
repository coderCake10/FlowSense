"""Maintenance mode flag behind the Maintenance system status (Admin Dashboard spec)."""
from django.db import migrations


def seed(apps, schema_editor):
    Setting = apps.get_model("common", "Setting")
    Setting.objects.get_or_create(
        key="maintenance_mode",
        defaults={
            "value": {"enabled": False},
            "description": "When enabled, the system status is Maintenance and the system isn't available for use.",
        },
    )


def unseed(apps, schema_editor):
    apps.get_model("common", "Setting").objects.filter(key="maintenance_mode").delete()


class Migration(migrations.Migration):
    dependencies = [("common", "0002_seed_default_settings")]
    operations = [migrations.RunPython(seed, unseed)]
