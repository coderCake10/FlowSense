"""
Records admin actions in analytics.audit_events, the table behind the
Activity API (07 API Design: "who changed what (assets, settings,
annotations) and when") and the dashboard's Recent Activity panel.
"""
from analytics.models import AuditEvent


def record(request, event_type, action, entity=None, description="", metadata=None):
    """Write one audit row for the admin behind `request` (None for system actions).

    `entity` is the changed model instance; its lowercase class name and
    primary key become entity_type / entity_id. Non-integer primary keys
    (for example a setting's key) go into metadata instead, because
    entity_id is a BIGINT in the schema.
    """
    metadata = dict(metadata or {})
    entity_type = entity_id = None
    if entity is not None:
        entity_type = type(entity).__name__.lower()
        if isinstance(entity.pk, int):
            entity_id = entity.pk
        else:
            metadata.setdefault("entity_key", str(entity.pk))
    return AuditEvent.objects.create(
        admin_user=getattr(request, "admin_user", None) if request is not None else None,
        event_type=event_type,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        metadata=metadata,
    )
