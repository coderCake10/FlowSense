"""
Assets business logic: storing uploaded building models, reading them
(assets.glb), validating them against FlowSense's expectations, and making a
version the active model for its building.

The active version of a building's model is what the kiosk, the attract
screen and Map Annotation load (see map.serializers.areas: `model`).
"""
from __future__ import annotations

import hashlib
import re
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from analytics import audit
from analytics.models import AuditEvent
from assets import glb
from assets.models import Asset, AssetVersion, ValidationCheck, ValidationRun
from map.models import Floor

ENGINE = "FlowSense GLB inspector 1.0"
LARGE_FILE_BYTES = 100 * 1024 * 1024
MAX_TRIANGLES = 3_000_000
MAX_DIMENSION_M = 1000
MIN_DIMENSION_M = 2
ELEVATION_TOLERANCE_M = Decimal("0.05")


class AssetStateError(Exception):
    """An action that isn't allowed in the asset's current state (HTTP 409)."""


# Storage ---------------------------------------------------------------------

def _safe_filename(name: str) -> str:
    stem = Path(name).name
    stem = re.sub(r"[^A-Za-z0-9._ -]+", "_", stem).strip(" .") or "model.glb"
    return stem[:200]


def absolute_path(version: AssetVersion) -> Path:
    return Path(settings.MEDIA_ROOT) / version.storage_path


def store_file(asset: Asset, version_number: int, uploaded) -> tuple[str, int, str]:
    """Writes the upload under MEDIA_ROOT/assets/<asset>/v<n>/ and returns
    (relative path, size in bytes, SHA-256)."""
    relative = Path("assets") / str(asset.pk) / f"v{version_number}" / _safe_filename(uploaded.name)
    target = Path(settings.MEDIA_ROOT) / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    digest, size = hashlib.sha256(), 0
    with open(target, "wb") as out:
        for chunk in uploaded.chunks():
            digest.update(chunk)
            size += len(chunk)
            out.write(chunk)
    return relative.as_posix(), size, digest.hexdigest()


def add_version(asset: Asset, uploaded, admin_user_id=None) -> AssetVersion:
    """Stores a new version of `asset` and queues its processing."""
    from assets.tasks import process_asset_version

    with transaction.atomic():
        locked = Asset.objects.select_for_update().get(pk=asset.pk)
        number = (locked.versions.order_by("-version").values_list("version", flat=True).first() or 0) + 1
        path, size, checksum = store_file(locked, number, uploaded)
        version = AssetVersion.objects.create(
            asset=locked,
            version=number,
            filename=_safe_filename(uploaded.name),
            storage_path=path,
            file_format="glb",
            file_size_bytes=size,
            checksum=checksum,
            uploaded_by=admin_user_id,
        )
        locked.updated_by = admin_user_id
        locked.save(update_fields=["updated_by", "updated_at"])
        transaction.on_commit(lambda: process_asset_version.delay(version.pk))
    return version


# Processing ------------------------------------------------------------------

def inspect_version(version: AssetVersion) -> glb.GlbReport:
    with open(absolute_path(version), "rb") as handle:
        return glb.inspect(handle)


def process_version(version: AssetVersion) -> glb.GlbReport | None:
    """Reads the model and records its statistics. Returns None on failure."""
    version.processing_status = AssetVersion.STATUS_PROCESSING
    version.save(update_fields=["processing_status"])
    try:
        report = inspect_version(version)
    except (OSError, glb.GlbError, KeyError, IndexError, TypeError, ValueError):
        version.processing_status = AssetVersion.STATUS_FAILED
        version.processing_engine = ENGINE
        version.processed_at = timezone.now()
        version.save(update_fields=["processing_status", "processing_engine", "processed_at"])
        return None
    dims = report.dimensions or (None, None, None)
    version.object_count = report.object_count
    version.mesh_count = report.mesh_count
    version.material_count = report.material_count
    version.texture_count = report.texture_count
    version.vertices_count = report.vertices_count
    version.triangles_count = report.triangles_count
    version.detected_floor_count = len(report.floors)
    version.potential_floor_count = len(report.potential_floors)
    version.dimension_x, version.dimension_y, version.dimension_z = (
        None if d is None else Decimal(str(round(d, 4))) for d in dims
    )
    version.coordinate_unit = "metre"
    version.processing_engine = ENGINE
    version.processing_status = AssetVersion.STATUS_COMPLETED
    version.processed_at = timezone.now()
    version.save()
    return report


# Validation ------------------------------------------------------------------

def _checks_for(version: AssetVersion, report: glb.GlbReport | None, error: str | None):
    """Yields (category, name, status, message)."""
    C = ValidationCheck
    ok, warn, err = C.STATUS_PASSED, C.STATUS_WARNING, C.STATUS_ERROR
    if report is None:
        yield C.CATEGORY_FILE_AND_FORMAT, "GLB container", err, error or "The file couldn't be read as a glTF 2.0 binary (.glb)."
        return

    yield C.CATEGORY_FILE_AND_FORMAT, "GLB container", ok, "Valid glTF binary."
    yield (C.CATEGORY_FILE_AND_FORMAT, "glTF version", ok if report.gltf_version.startswith("2") else err,
           f"glTF {report.gltf_version or 'unknown'}.")
    size = version.file_size_bytes or 0
    yield (C.CATEGORY_FILE_AND_FORMAT, "File size", warn if size > LARGE_FILE_BYTES else ok,
           f"{size / 1_048_576:.1f} MB" + (" is large for a kiosk; compress textures or geometry." if size > LARGE_FILE_BYTES else "."))
    yield (C.CATEGORY_FILE_AND_FORMAT, "Draco compression", ok if report.draco else warn,
           "Geometry is Draco-compressed." if report.draco
           else "Geometry isn't Draco-compressed; the kiosk loads it more slowly (see docs/setup/building-models.md).")

    yield (C.CATEGORY_MODEL_AND_GEOMETRY, "Contains meshes", ok if report.mesh_count else err,
           f"{report.mesh_count} mesh objects." if report.mesh_count else "The model has no meshes.")
    if report.dimensions is None:
        yield C.CATEGORY_MODEL_AND_GEOMETRY, "Dimensions", err, "The model's size can't be measured."
    else:
        x, y, z = report.dimensions
        largest = max(report.dimensions)
        status = ok
        note = f"{x:.1f} × {y:.1f} × {z:.1f} m (W × H × D)."
        if largest > MAX_DIMENSION_M or largest < MIN_DIMENSION_M:
            status = warn
            note += " That's an unusual size for a building; glTF is in metres, so check the export's unit scale."
        yield C.CATEGORY_MODEL_AND_GEOMETRY, "Dimensions", status, note
    yield (C.CATEGORY_MODEL_AND_GEOMETRY, "Triangle count", warn if report.triangles_count > MAX_TRIANGLES else ok,
           f"{report.triangles_count:,} triangles" + (" may render slowly on the kiosk." if report.triangles_count > MAX_TRIANGLES else "."))

    building = version.asset.asset_type == "building_model"
    if not building:
        yield (C.CATEGORY_HIERARCHY_AND_FLOOR_STRUCTURE, "Floor groups", ok,
               "Not a building model; floors aren't required.")
    elif not report.floors:
        yield (C.CATEGORY_HIERARCHY_AND_FLOOR_STRUCTURE, "Floor groups", err,
               "No floor groups found. Name each floor's group FLOOR_1, FLOOR_2, … (docs/setup/building-models.md).")
    else:
        orders = [f.order for f in report.floors]
        yield (C.CATEGORY_HIERARCHY_AND_FLOOR_STRUCTURE, "Floor groups", ok,
               f"{len(orders)} floors: " + ", ".join(f.node for f in report.floors) + ".")
        consecutive = orders == list(range(1, len(orders) + 1))
        yield (C.CATEGORY_HIERARCHY_AND_FLOOR_STRUCTURE, "Floor numbering", ok if consecutive else warn,
               "Numbered 1 to %d without gaps." % len(orders) if consecutive
               else "Floors should be numbered from 1 without gaps; found " + ", ".join(map(str, orders)) + ".")
        rising = all(
            a.elevation is None or b.elevation is None or b.elevation > a.elevation
            for a, b in zip(report.floors, report.floors[1:])
        )
        yield (C.CATEGORY_HIERARCHY_AND_FLOOR_STRUCTURE, "Floor order by height", ok if rising else warn,
               "Each floor is higher than the one below." if rising
               else "A floor isn't higher than the floor below it; check the group names.")
    if building:
        yield (C.CATEGORY_HIERARCHY_AND_FLOOR_STRUCTURE, "Exterior", ok if report.exterior_nodes else warn,
               "Exterior objects: " + ", ".join(sorted(set(report.exterior_nodes))) + "." if report.exterior_nodes
               else "No EXTERIOR or ROOF object, so the kiosk can't lift the outside away to show a floor.")

    area = version.asset.area
    if not building:
        yield (C.CATEGORY_FLOORS_AND_SPATIAL_CONFIGURATION, "Configured floors", ok,
               "Not a building model.")
    elif area is None:
        yield (C.CATEGORY_FLOORS_AND_SPATIAL_CONFIGURATION, "Building", warn,
               "The asset isn't linked to a building, so its floors can't be compared with FlowSense's.")
    else:
        configured = list(Floor.objects.filter(area=area, deleted_at__isnull=True).order_by("floor_order"))
        detected = {f.node: f for f in report.floors}
        by_order = {f.order: f for f in report.floors}
        missing = [f for f in configured if f.glb_node_name and f.glb_node_name not in detected and f.floor_order not in by_order]
        yield (C.CATEGORY_FLOORS_AND_SPATIAL_CONFIGURATION, "Configured floors in the model", err if missing else ok,
               f"All {len(configured)} of {area.name}'s floors are in the model." if not missing
               else "Missing from the model: " + ", ".join(f.glb_node_name for f in missing) + ".")
        extra = [f.node for f in report.floors if f.order not in {c.floor_order for c in configured}]
        yield (C.CATEGORY_FLOORS_AND_SPATIAL_CONFIGURATION, "Model floors configured", warn if extra else ok,
               "Every floor in the model is configured." if not extra
               else "Not configured in FlowSense yet (no rooms or routes): " + ", ".join(extra) + ".")
        changes = floor_changes(area, report)
        yield (C.CATEGORY_FLOORS_AND_SPATIAL_CONFIGURATION, "Floor heights", ok,
               "Heights match FlowSense's floors." if not changes
               else f"Activating will update {len(changes)} floor(s) to the model's heights.")

    unsupported = sorted(set(report.extensions_required) - glb.SUPPORTED_EXTENSIONS)
    yield (C.CATEGORY_FLOWSENSE_COMPATIBILITY, "Required extensions", err if unsupported else ok,
           "Uses only extensions the kiosk supports." if not unsupported
           else "The kiosk can't load required extensions: " + ", ".join(unsupported) + ".")
    yield (C.CATEGORY_FLOWSENSE_COMPATIBILITY, "Y-up, metres", ok,
           "glTF models are Y-up in metres, matching FlowSense's coordinates.")


@transaction.atomic
def validate_version(version: AssetVersion, admin_user_id=None) -> ValidationRun:
    error = None
    try:
        report = inspect_version(version)
    except (OSError, glb.GlbError, KeyError, IndexError, TypeError, ValueError) as exc:
        report, error = None, str(exc) if isinstance(exc, glb.GlbError) else None
    checks = list(_checks_for(version, report, error))
    errors = sum(1 for c in checks if c[2] == ValidationCheck.STATUS_ERROR)
    warnings = sum(1 for c in checks if c[2] == ValidationCheck.STATUS_WARNING)
    passed = len(checks) - errors - warnings
    result = (ValidationRun.RESULT_FAILED if errors
              else ValidationRun.RESULT_WARNING if warnings else ValidationRun.RESULT_PASSED)
    run = ValidationRun.objects.create(
        asset_version=version,
        validated_by=admin_user_id,
        result=result,
        summary=f"{passed} passed, {warnings} warning{'s' if warnings != 1 else ''}, {errors} error{'s' if errors != 1 else ''}",
    )
    ValidationCheck.objects.bulk_create(
        ValidationCheck(validation_run=run, category=cat, check_name=name, status=status, message=message)
        for cat, name, status, message in checks
    )
    return run


def latest_run(version: AssetVersion) -> ValidationRun | None:
    return version.validation_runs.order_by("-created_at", "-id").first()


# Activation ------------------------------------------------------------------

def floor_changes(area, report: glb.GlbReport) -> list[dict]:
    """How activating this model would change the area's configured floors."""
    changes = []
    for floor in Floor.objects.filter(area=area, deleted_at__isnull=True).order_by("floor_order"):
        match = next((f for f in report.floors if f.order == floor.floor_order), None)
        if match is None:
            continue
        new_elevation = None if match.elevation is None else Decimal(str(round(match.elevation, 4)))
        change = {}
        if floor.glb_node_name != match.node:
            change["glb_node_name"] = [floor.glb_node_name, match.node]
        if new_elevation is not None and (
            floor.elevation is None or abs(floor.elevation - new_elevation) > ELEVATION_TOLERANCE_M
        ):
            change["elevation"] = [None if floor.elevation is None else float(floor.elevation), float(new_elevation)]
        if change:
            changes.append({"floor_id": floor.pk, "floor_order": floor.floor_order, **change})
    return changes


def check_can_activate(version: AssetVersion):
    if version.asset.deleted_at is not None:
        raise AssetStateError("This asset was deleted.")
    if version.processing_status != AssetVersion.STATUS_COMPLETED:
        raise AssetStateError("This version hasn't finished processing.")
    run = latest_run(version)
    if run is None:
        raise AssetStateError("Validate this version before activating it.")
    if run.result == ValidationRun.RESULT_FAILED:
        raise AssetStateError("This version failed validation. Fix the errors and upload a new version.")


@transaction.atomic
def activate(version: AssetVersion, request=None, restore=False) -> dict:
    """Makes `version` its asset's active version, deactivates any other
    active model for the same building, and applies the model's floor names
    and heights to that building's floors."""
    check_can_activate(version)
    asset = Asset.objects.select_for_update().get(pk=version.asset_id)
    admin_id = getattr(getattr(request, "admin_user", None), "pk", None)

    replaced = []
    if asset.area_id is not None:
        others = Asset.objects.select_for_update().filter(
            area_id=asset.area_id, asset_type=asset.asset_type, deleted_at__isnull=True,
            active_version__isnull=False,
        ).exclude(pk=asset.pk)
        for other in others:
            other.active_version = None
            other.updated_by = admin_id
            other.save(update_fields=["active_version", "updated_by", "updated_at"])
            replaced.append(other.pk)
            audit.record(request, AuditEvent.TYPE_ASSET, AuditEvent.ACTION_DEACTIVATE, other,
                         f"Deactivated {other.name}: {asset.name} is now {asset.area.name}'s model",
                         entity_type="asset")

    asset.active_version = version
    asset.updated_by = admin_id
    asset.save(update_fields=["active_version", "updated_by", "updated_at"])

    changes = []
    if asset.area_id is not None and asset.asset_type == "building_model":
        report = inspect_version(version)
        changes = floor_changes(asset.area, report)
        for change in changes:
            floor = Floor.objects.get(pk=change["floor_id"])
            if "glb_node_name" in change:
                floor.glb_node_name = change["glb_node_name"][1]
            if "elevation" in change:
                floor.elevation = Decimal(str(change["elevation"][1]))
            floor.save(update_fields=["glb_node_name", "elevation", "updated_at"])
        if changes:
            audit.record(request, AuditEvent.TYPE_CONFIGURATION, AuditEvent.ACTION_UPDATE, asset.area,
                         f"Updated {len(changes)} floor(s) of {asset.area.name} from {version.filename}",
                         {"changes": changes})

    audit.record(
        request, AuditEvent.TYPE_ASSET,
        AuditEvent.ACTION_RESTORE if restore else AuditEvent.ACTION_ACTIVATE,
        version,
        f"{'Restored' if restore else 'Activated'} {asset.name} v{version.version} ({version.filename})",
        {"asset_id": asset.pk, "version": version.version},
        entity_type="asset_version",
    )
    return {"floors_updated": changes, "deactivated_assets": replaced}


@transaction.atomic
def deactivate(asset: Asset, request=None) -> AssetVersion:
    """Takes `asset`'s live version offline: the kiosk, attract screen and
    phones go back to the model bundled with the app. Its versions stay, so
    it can be activated again (additive to the API design)."""
    asset = Asset.objects.select_for_update().get(pk=asset.pk)
    version = asset.active_version
    if version is None:
        raise AssetStateError("This asset isn't live.")
    asset.active_version = None
    asset.updated_by = getattr(getattr(request, "admin_user", None), "pk", None)
    asset.save(update_fields=["active_version", "updated_by", "updated_at"])
    audit.record(
        request, AuditEvent.TYPE_ASSET, AuditEvent.ACTION_DEACTIVATE, asset,
        f"Took {asset.name} v{version.version} offline: the kiosk uses its bundled model",
        {"asset_id": asset.pk, "version": version.version}, entity_type="asset",
    )
    return version


def taken_offline(asset: Asset) -> bool:
    """True when the asset's last change of live state was going offline
    (Take offline, or another model replacing it): seed_assets then leaves
    it offline."""
    from django.db.models import Q

    last = (
        AuditEvent.objects.filter(
            Q(entity_type="asset", entity_id=asset.pk, action=AuditEvent.ACTION_DEACTIVATE)
            | Q(entity_type="asset_version", metadata__asset_id=asset.pk,
                action__in=[AuditEvent.ACTION_ACTIVATE, AuditEvent.ACTION_RESTORE])
        )
        .order_by("-created_at", "-id")
        .first()
    )
    return last is not None and last.action == AuditEvent.ACTION_DEACTIVATE


def active_models_by_area() -> dict[int, AssetVersion]:
    """area id → its live model version (one query): a building's model, or
    the campus's area model (the kiosk's campus view)."""
    models = {}
    for asset in (
        Asset.objects.filter(asset_type__in=("building_model", "area_model"), deleted_at__isnull=True,
                             active_version__isnull=False, area__isnull=False)
        .select_related("active_version")
        .order_by("-updated_at")
    ):
        models.setdefault(asset.area_id, asset.active_version)
    return models


def register_file(path, *, name, area=None, asset_type="building_model", source="Imported from disk"):
    """Adds the .glb at `path` as a version of the asset called `name`
    (created if missing), unless one of its versions already has the same
    file. Processing and validation run as for an upload. Returns
    (asset, version, created_new_version)."""
    from django.core.files import File
    from assets.tasks import process_asset_version

    checksum = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    asset = Asset.objects.filter(name=name, deleted_at__isnull=True).first()
    if asset is None:
        asset = Asset.objects.create(name=name, area=area, asset_type=asset_type, source=source)
    elif area is not None and asset.area_id != area.pk and asset.active_version_id is None:
        # Registered before its building existed (the A Building until step
        # 13), or linked to another building by hand (the A model under EYA,
        # where EYA's floors fail its validation). Not while it's live: that
        # would change which building shows it.
        asset.area = area
        asset.save(update_fields=["area", "updated_at"])
        latest = asset.versions.order_by("-version").first()
        if latest is not None and latest.processing_status == AssetVersion.STATUS_COMPLETED:
            validate_version(latest)  # checked again against its building's floors
    same = asset.versions.filter(checksum=checksum).order_by("-version").first()
    if same is not None:
        return asset, same, False
    with open(path, "rb") as handle:
        version = add_version(asset, File(handle, name=Path(path).name))
    version.refresh_from_db()
    if version.processing_status == AssetVersion.STATUS_PENDING:
        # Outside a request on_commit may not have run yet.
        process_asset_version(version.pk)
        version.refresh_from_db()
    return asset, version, True
