"""
python manage.py seed_assets [--models-dir DIR]

Puts the building models committed with the app into Asset Management, so
they can be inspected, replaced and restored there like uploads:

  EYA.glb     "EYA Building model"            EYA Building   live
  CAMPUS.glb  "Campus (low-fidelity area)"    AUF campus     live (the kiosk's campus view)
  A.glb       "A Building model"              A Building     live

Safe to re-run, e.g. after pulling a newer committed model: an identical file
is skipped, a changed one becomes the next version. A committed model is made
live when nothing is live yet, or when the live version also came from the
app (not from an admin's upload), so an admin's choice is never overridden.
A model an admin took offline (or replaced with another asset) stays offline.
"""
import os
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from assets import services
from assets.models import Asset
from map.models import Area

SOURCE = "Committed with the app (frontend/client/public/models)"
MODELS = [
    # file, asset name, area code, type, make live
    ("EYA.glb", "EYA Building model", "EYA", "building_model", True),
    ("CAMPUS.glb", "Campus (low-fidelity area)", "AUF", "area_model", True),
    ("A.glb", "A Building model", "A", "building_model", True),
]


def default_models_dir():
    # Docker mounts the committed models at /models (docker-compose.yml);
    # without Docker they're in the frontend next to this backend.
    for candidate in (os.getenv("FLOWSENSE_MODELS_PATH"), "/models",
                      Path(settings.BASE_DIR).parent.parent / "frontend" / "client" / "public" / "models"):
        if candidate and Path(candidate).is_dir():
            return Path(candidate)
    return None


class Command(BaseCommand):
    help = "Register the committed building models in Asset Management."

    def add_arguments(self, parser):
        parser.add_argument("--models-dir", help="Folder with EYA.glb, CAMPUS.glb, A.glb")

    def handle(self, *args, **options):
        folder = Path(options["models_dir"]) if options["models_dir"] else default_models_dir()
        if folder is None or not folder.is_dir():
            raise CommandError("Models folder not found; pass --models-dir.")
        for filename, name, area_code, asset_type, live in MODELS:
            path = folder / filename
            if not path.is_file():
                self.stdout.write(self.style.WARNING(f"{filename}: not found in {folder}; skipped"))
                continue
            area = None
            if area_code:
                area = Area.objects.filter(code=area_code, deleted_at__isnull=True).first()
                if area is None:
                    raise CommandError(f"No area {area_code}: run seed_campus first.")
            before = Asset.objects.filter(name=name, deleted_at__isnull=True).values_list("area_id", flat=True).first()
            asset, version, created = services.register_file(
                path, name=name, area=area, asset_type=asset_type, source=SOURCE)
            # Moved from another building: going offline there doesn't count.
            relinked = before is not None and before != asset.area_id
            run = services.latest_run(version)
            state = f"v{version.version} {'added' if created else 'already there'}, validation {run.result if run else 'not run'}"
            if relinked:
                state = f"moved to {asset.area.name}, " + state
            current = asset.active_version
            from_app = current is None or current.uploaded_by is None
            if live and current is None and not relinked and services.taken_offline(asset):
                state += ", kept offline (taken offline in Asset Management)"
            elif live and current != version and from_app:
                try:
                    services.activate(version)
                    state += ", now live"
                except services.AssetStateError as error:
                    state += f", not made live: {error}"
            elif live and current == version:
                state += ", live"
            elif live:
                state += f", kept v{current.version} live (chosen by an admin)"
            self.stdout.write(f"{name}: {state}")
