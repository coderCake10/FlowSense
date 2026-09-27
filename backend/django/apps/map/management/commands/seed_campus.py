"""
Loads the EYA Building (campus area, floors 1-6, 97 rooms, first-floor exits)
from map/seed_data/eya.py, and the A Building (floors 1-4, its rooms, the
front entrance) from map/seed_data/a_building.py, into campus.* tables.

    python manage.py seed_campus

Safe to run repeatedly: rows are matched by their natural keys (area code,
floor order, room code per floor, entrance name) and updated in place.
Geometry, images, and personnel are left untouched so annotations made in
the admin are never overwritten.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from annotation.serializers.campus import floor_names
from map.models import Area, CampusLabel, Entrance, Floor, Room
from navigation.coordinates import model_to_point
from map.seed_data import a_building, eya


class Command(BaseCommand):
    help = "Seed the EYA and A Buildings' floors and rooms (idempotent)."

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
        seeded = [self.seed_building(eya, campus, tally), self.seed_building(a_building, campus, tally)]
        # The walkways between the buildings: one outdoor level.
        walkways, created = Area.objects.update_or_create(
            code=a_building.WALKWAYS["code"],
            defaults={"name": a_building.WALKWAYS["name"], "area_type": a_building.WALKWAYS["area_type"],
                      "parent_area": campus},
        )
        tally(created)
        _, created = Floor.objects.get_or_create(area=walkways, floor_order=1, defaults={"visible_in_kiosk": False})
        tally(created)
        # The campus view's names, once: after that they're edited in Map
        # Annotation (a label deleted there stays deleted).
        if not CampusLabel.objects.filter(area=campus).exists():
            for name, position in eya.CAMPUS_LABELS:
                CampusLabel.objects.create(area=campus, name=name, geometry=model_to_point(*position))
                tally(True)
        summary = "; ".join(
            f"{building.name}: {floors} floors, {Room.objects.filter(floor__area=building).count()} rooms"
            for building, floors in seeded
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Campus seeded: {counts['created']} created, {counts['updated']} already there ({summary})."
            )
        )

    def seed_building(self, data, campus, tally):
        building, created = Area.objects.update_or_create(
            code=data.BUILDING["code"],
            defaults={
                "name": data.BUILDING["name"],
                "area_type": data.BUILDING["area_type"],
                "parent_area": campus,
            },
        )
        tally(created)
        # Where it stands in the campus: set once, then moved in Map Annotation.
        if building.placement is None and getattr(data, "PLACEMENT", None):
            building.placement = {"position": list(data.PLACEMENT["position"]),
                                  "rotation_y": data.PLACEMENT["rotation_y"]}
            building.save(update_fields=["placement", "updated_at"])

        # Earlier seeds used "EA-101-A"-style codes; rename those rows in place
        # (keeping their annotations) unless the new code already exists.
        for old, new in getattr(data, "RENAMED_CODES", {}).items():
            legacy = Room.objects.filter(floor__area=building, room_code=old)
            if not Room.objects.filter(floor__area=building, room_code=new).exists():
                legacy.update(room_code=new)

        for order in data.FLOORS:
            glb_node_name, elevation = data.FLOOR_MODEL[order]
            floor, created = Floor.objects.update_or_create(
                area=building,
                floor_order=order,
                defaults={"glb_node_name": glb_node_name, "elevation": Decimal(elevation)},
            )
            tally(created)
            # Names the kiosk shows, unless edited in Map Annotation.
            if not floor.short_name or not floor.display_name:
                short, name = floor_names(order)
                floor.short_name = floor.short_name or short
                floor.display_name = floor.display_name or data.FLOORS.get(order, name)
                floor.save(update_fields=["short_name", "display_name", "updated_at"])
            for code, alias, room_type, label in data.ROOMS[order]:
                # Only adds missing rooms: names and descriptions edited in
                # Map Annotation are kept when the seed runs again.
                _, created = Room.objects.get_or_create(
                    floor=floor,
                    room_code=code,
                    defaults={
                        "room_alias": alias,
                        "room_type": room_type,
                        "description": label or data.UNNAMED_DESCRIPTION,
                        "is_searchable": True,
                    },
                )
                tally(created)

        for entrance in data.ENTRANCES:
            _, created = Entrance.objects.update_or_create(
                area=building,
                name=entrance["name"],
                defaults={"entrance_type": entrance["entrance_type"], "is_primary": entrance["is_primary"]},
            )
            tally(created)

        return building, len(data.FLOORS)
