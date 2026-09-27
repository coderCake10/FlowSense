"""Serializers for the Alerts and Activity APIs."""
from rest_framework import serializers

from analytics.models import Alert, AuditEvent, Report


def _admin_ref(user):
    return {"id": user.id, "full_name": user.full_name, "email": user.email} if user else None


class AlertSerializer(serializers.ModelSerializer):
    state = serializers.SerializerMethodField()
    acknowledged_by = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = ["id", "severity", "alert_type", "title", "message", "entity_type", "entity_id", "state",
                  "created_at", "acknowledged_at", "acknowledged_by", "cleared_at"]

    def get_state(self, obj):
        if obj.cleared_at:
            return "cleared"
        return "acknowledged" if obj.acknowledged_at else "active"

    def get_acknowledged_by(self, obj):
        return _admin_ref(obj.acknowledged_by)


class AuditEventSerializer(serializers.ModelSerializer):
    admin_user = serializers.SerializerMethodField()

    class Meta:
        model = AuditEvent
        fields = ["id", "event_type", "action", "entity_type", "entity_id", "description", "metadata",
                  "admin_user", "created_at"]

    def get_admin_user(self, obj):
        return _admin_ref(obj.admin_user)


class ReportSerializer(serializers.ModelSerializer):
    """A report without its snapshot (the list)."""

    generated_by = serializers.SerializerMethodField()
    section_titles = serializers.SerializerMethodField()
    period_label = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = ["id", "title", "sections", "section_titles", "period_start", "period_end", "period_label",
                  "filters", "format",
                  "status", "error", "format_version", "generated_by", "created_at", "completed_at"]

    def get_generated_by(self, obj):
        return _admin_ref(obj.generated_by)

    def get_period_label(self, obj):
        from analytics.reports import period_label

        return period_label(obj.period_start, obj.period_end)

    def get_section_titles(self, obj):
        from analytics.reports import SECTIONS

        return [SECTIONS[s][0] for s in obj.sections if s in SECTIONS]


class ReportDetailSerializer(ReportSerializer):
    """A report with its snapshot (`data`), for the printable page."""

    class Meta(ReportSerializer.Meta):
        fields = ReportSerializer.Meta.fields + ["data"]


class ReportRequestSerializer(serializers.Serializer):
    """POST /analytics/reports: the period (the page's two date boxes, or any
    ?range= preset), the sections to include, and the format."""

    range = serializers.CharField(required=False, default="custom")
    start_date = serializers.CharField(required=False)
    end_date = serializers.CharField(required=False)
    semester_id = serializers.IntegerField(required=False)
    sections = serializers.ListField(child=serializers.CharField(), allow_empty=False)
    format = serializers.ChoiceField(choices=["pdf", "csv"], default="pdf")
    title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    schedule = serializers.JSONField(required=False)

    def validate_schedule(self, value):
        if value:
            raise serializers.ValidationError("Scheduled reports aren't available yet.")
        return value

    def validate_sections(self, value):
        from analytics.reports import SECTIONS

        unknown = [s for s in value if s not in SECTIONS]
        if unknown:
            raise serializers.ValidationError(f"Unknown sections: {', '.join(unknown)}. Use {', '.join(SECTIONS)}.")
        return list(dict.fromkeys(value))
