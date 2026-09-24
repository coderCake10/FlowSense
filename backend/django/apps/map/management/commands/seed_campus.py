"""
Loads the EYA Building (campus area, floors 1-6, 92 rooms, first-floor exits)
from map/seed_data/eya.py into campus.* tables.

    python manage.py seed_campus

Safe to run repeatedly: rows are matched by their natural keys (area code,
floor order, room code per floor, entrance name) and updated in place.
Geometry, images, and personnel are left untouched so annotations made in
the admin are never overwritten.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from map.models import Area, Entrance, Floor, Room
from map.seed_data import eya


class Command(BaseCommand):
    help = "Seed the EYA Building's floors and rooms (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        counts = {"created": 0, "updated": 0}

        def tally(created):
            counts["created" if created else "updated"] += 1

        campus, created = Area.objects.update_or_create(
            code=eya.CAMPUS["code"],
            defaults={"name": eya.CAMPUS["name"], "area_type": eya.CAMPUS["area_type"]},
        )
        tally(created)
        building, created = Area.objects.update_or_create(
            code=eya.BUILDING["code"],
            defaults={
                "name": eya.BUILDING["name"],
                "area_type": eya.BUILDING["area_type"],
                "parent_area": campus,
            },
        )
        tally(created)

        # Earlier seeds used "EA-101-A"-style codes; rename those rows in place
        # (keeping their annotations) unless the new code already exists.
        for old, new in eya.RENAMED_CODES.items():
            legacy = Room.objects.filter(floor__area=building, room_code=old)
            if not Room.objects.filter(floor__area=building, room_code=new).exists():
                legacy.update(room_code=new)

        for order in eya.FLOORS:
            floor, created = Floor.objects.update_or_create(area=building, floor_order=order, defaults={})
            tally(created)
            for code, alias, room_type, label in eya.ROOMS[order]:
                _, created = Room.objects.update_or_create(
                    floor=floor,
                    room_code=code,
                    defaults={
                        "room_alias": alias,
                        "room_type": room_type,
                        "description": label or eya.UNNAMED_DESCRIPTION,
                        "is_searchable": True,
                    },
                )
                tally(created)

        for entrance in eya.ENTRANCES:
            _, created = Entrance.objects.update_or_create(
                area=building,
                name=entrance["name"],
                defaults={"entrance_type": entrance["entrance_type"], "is_primary": entrance["is_primary"]},
            )
            tally(created)

        rooms = Room.objects.filter(floor__area=building).count()
        self.stdout.write(
            self.style.SUCCESS(
                f"EYA Building seeded: {counts['created']} created, {counts['updated']} updated "
                f"({len(eya.FLOORS)} floors, {rooms} rooms)."
            )
        )
