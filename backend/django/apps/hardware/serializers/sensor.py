"""
apps/hardware/serializers/sensor.py

GET /hardware/sensors/{id}/observations and /statistics.
"""
from rest_framework import serializers

from hardware.models import SensorObservation


class SensorObservationSerializer(serializers.ModelSerializer):
    """One raw reading received from the sensor over MQTT."""

    class Meta:
        model = SensorObservation
        fields = ["id", "observed_at", "signal_count", "estimated_density", "battery_level", "signal_strength", "created_at"]
        read_only_fields = fields
