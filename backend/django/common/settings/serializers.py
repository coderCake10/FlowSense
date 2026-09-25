"""Settings API serializers (07 API Design: Settings API, common/settings)."""
from rest_framework import serializers

from common.models import Semester, Setting


def _validate_alert_clear_time(value):
    seconds = value.get("seconds") if isinstance(value, dict) else None
    if not isinstance(seconds, int) or isinstance(seconds, bool) or not 60 <= seconds <= 7 * 24 * 3600:
        raise serializers.ValidationError('Use {"seconds": N} with N between 60 and 604800 (7 days).')
    return {"seconds": seconds}


def _validate_maintenance_mode(value):
    enabled = value.get("enabled") if isinstance(value, dict) else None
    if not isinstance(enabled, bool):
        raise serializers.ValidationError('Use {"enabled": true} or {"enabled": false}.')
    return {"enabled": enabled}


# Keys administrators may change, and how each value is validated.
EDITABLE_SETTINGS = {
    "informational_alert_clear_time": _validate_alert_clear_time,
    "maintenance_mode": _validate_maintenance_mode,
}


class SettingSerializer(serializers.ModelSerializer):
    updated_by = serializers.SerializerMethodField()
    editable = serializers.SerializerMethodField()

    class Meta:
        model = Setting
        fields = ["key", "value", "description", "editable", "updated_at", "updated_by"]

    def get_updated_by(self, obj):
        user = obj.updated_by
        return {"id": user.id, "full_name": user.full_name} if user else None

    def get_editable(self, obj):
        return obj.key in EDITABLE_SETTINGS


class SettingUpdateSerializer(serializers.Serializer):
    value = serializers.JSONField()

    def validate_value(self, value):
        key = self.context["key"]
        validator = EDITABLE_SETTINGS.get(key)
        if validator is None:
            raise serializers.ValidationError(f"The setting '{key}' can't be changed.")
        return validator(value)


class SemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = ["id", "academic_year", "name", "start_date", "end_date", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, data):
        start = data.get("start_date", getattr(self.instance, "start_date", None))
        end = data.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and start > end:
            raise serializers.ValidationError({"end_date": "The end date can't be before the start date."})
        return data
