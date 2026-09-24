"""
assets.asset_audit_history view from the schema (06 Database). The
AssetAuditHistory model is unmanaged (managed = False), so no earlier
migration created the view and any query on it failed with "relation does
not exist".
"""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("assets", "0002_spec_check_constraints"),
        ("analytics", "0001_initial"),  # analytics.audit_events
    ]
    operations = [
        migrations.RunSQL(
            sql="""
                CREATE OR REPLACE VIEW assets.asset_audit_history AS
                SELECT
                    ae.id,
                    ae.created_at,
                    ae.admin_user_id,
                    ae.action,
                    ae.description,
                    ae.metadata
                FROM analytics.audit_events ae
                WHERE ae.entity_type IN ('asset', 'asset_version', 'asset_validation');
            """,
            reverse_sql="DROP VIEW IF EXISTS assets.asset_audit_history;",
        ),
    ]
