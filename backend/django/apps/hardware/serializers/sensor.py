'''
SensorDetailSerializer
SensorObservationSerializer
SensorStatisticsSerializer
'''
"""
apps/hardware/serializers/sensor.py
"""
from rest_framework import serializers
from .device import DeviceDetailSerializer
from hardware.models import SensorObservation

class SensorDetailSerializer(DeviceDetailSerializer):
    """
    Inherits from DeviceDetailSerializer, appending environmental metrics, 
    BLE traffic observations, and configuration fields for ESP32 sensors[cite: 10, 12].
    """
    sensor_enabled = serializers.BooleanField()
    sampling_interval_seconds = serializers.IntegerField(allow_null=True)
    battery_level = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    signal_strength = serializers.IntegerField(allow_null=True)
    mqtt_status = serializers.CharField(max_length=30, allow_null=True)
    fw_version = serializers.CharField(source='firmware_version', max_length=100, allow_null=True)
    
    current_signal_count = serializers.SerializerMethodField()
    last_reading_density = serializers.SerializerMethodField()
    last_data_transmission = serializers.DateTimeField(source='last_transmission_at', allow_null=True)

    def get_current_signal_count(self, obj):
        """
        Retrieves the signal_count from the most recent SensorObservation[cite: 10, 12].
        """
        if hasattr(obj, 'sensor') and obj.sensor:
            latest_observation = obj.sensor.observations.order_by('-observed_at').first()
            return latest_observation.signal_count if latest_observation else None
        return None

    def get_last_reading_density(self, obj):
        """
        Retrieves the estimated_density from the most recent SensorObservation[cite: 10, 12].
        """
        if hasattr(obj, 'sensor') and obj.sensor:
            latest_observation = obj.sensor.observations.order_by('-observed_at').first()
            return latest_observation.estimated_density if latest_observation else None
        return None


class SensorObservationSerializer(serializers.ModelSerializer):
    """
    Serializes raw environmental readings and crowd density observations 
    published by the ESP32 via MQTT[cite: 15, 16].
    """
    class Meta:
        model = SensorObservation
        fields = [
            'id',
            'sensor',
            'observed_at',
            'estimated_density',
            'signal_count',
            'battery_level',
            'signal_strength',
            'created_at'
        ]
        read_only_fields = fields


class SensorStatisticsSerializer(serializers.Serializer):
    """
    Serializes aggregated transmission reliability and usage statistics 
    for a specific sensor over a given period[cite: 15, 16].
    
    Note: Since the SensorStatistic model technically resides in the analytics 
    app[cite: 3], this uses a standard Serializer to format the aggregated 
    query results for the /api/v1/hardware/sensors/{id}/statistics endpoint[cite: 15].
    """
    period_start = serializers.DateTimeField(read_only=True)
    period_end = serializers.DateTimeField(read_only=True)
    average_density = serializers.DecimalField(max_digits=8, decimal_places=3, read_only=True)
    peak_density = serializers.DecimalField(max_digits=8, decimal_places=3, read_only=True)
    average_signal_count = serializers.DecimalField(max_digits=8, decimal_places=3, read_only=True)
    peak_signal_count = serializers.IntegerField(read_only=True)