"""Serializers for the Alerts and Activity APIs."""
from rest_framework import serializers

from analytics.models import Alert, AuditEvent


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
