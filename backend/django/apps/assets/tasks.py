from celery import shared_task

from analytics import audit
from analytics.models import AuditEvent
from assets import services
from assets.models import AssetVersion


@shared_task(name="assets.process_asset_version")
def process_asset_version(version_id: int) -> str:
    """Reads an uploaded model, records its statistics, then validates it."""
    version = AssetVersion.objects.select_related("asset__area").filter(pk=version_id).first()
    if version is None:
        return "missing"
    services.process_version(version)
    run = services.validate_version(version, version.uploaded_by)
    # Recorded as a system action, like the Activity tab's other automatic rows.
    audit.record(None, AuditEvent.TYPE_VALIDATION, AuditEvent.ACTION_VALIDATE, run,
                 f"Validated {version.asset.name} v{version.version}: {run.result}",
                 {"asset_id": version.asset_id, "version": version.version, "summary": run.summary},
                 entity_type="asset_validation")
    return version.processing_status
