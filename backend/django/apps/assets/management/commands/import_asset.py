"""
python manage.py import_asset <file.glb> [--area EYA] [--name "..."] [--type building_model] [--activate]

Registers a building model from disk through the same path as an upload in
Asset Management: stored, processed, validated, and optionally activated.
If an asset with the same name already exists, the file becomes its next
version, unless one of its versions already has the identical file.
"""
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from assets import services
from assets.serializers import ASSET_TYPES
from map.models import Area


class Command(BaseCommand):
    help = "Register a .glb building model as an asset (and optionally activate it)."

    def add_arguments(self, parser):
        parser.add_argument("path")
        parser.add_argument("--area", help="Area code the model belongs to, e.g. EYA")
        parser.add_argument("--name", help="Asset name (default: the file name)")
        parser.add_argument("--type", default="building_model", choices=ASSET_TYPES)
        parser.add_argument("--source", default="Imported from disk")
        parser.add_argument("--activate", action="store_true", help="Activate it if validation passes")

    def handle(self, *args, **options):
        path = Path(options["path"])
        if not path.is_file() or path.suffix.lower() != ".glb":
            raise CommandError(f"{path} isn't a .glb file.")
        area = None
        if options["area"]:
            area = Area.objects.filter(code=options["area"], deleted_at__isnull=True).first()
            if area is None:
                raise CommandError(f"No area with code {options['area']} (run seed_campus first?).")
        name = options["name"] or path.stem
        asset, version, created = services.register_file(
            path, name=name, area=area, asset_type=options["type"], source=options["source"])
        if not created:
            self.stdout.write(f"{name} v{version.version} already has this file.")
        run = services.latest_run(version)
        self.stdout.write(
            f"{name} v{version.version}: processing {version.processing_status}, "
            f"validation {run.result if run else 'not run'} ({run.summary if run else ''})"
        )
        if options["activate"]:
            try:
                result = services.activate(version)
            except services.AssetStateError as error:
                raise CommandError(f"Not activated: {error}")
            self.stdout.write(self.style.SUCCESS(
                f"Activated. Floors updated: {len(result['floors_updated'])}."
            ))
