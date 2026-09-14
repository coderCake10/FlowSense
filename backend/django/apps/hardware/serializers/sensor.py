'''
SensorDetailSerializer
SensorObservationSerializer
SensorStatisticsSerializer
'''
from rest_framework import serializers

from hardware.models import Sensor, SensorObservation

from device import DeviceDetailSerializer

class SensorDetailSerializer(DeviceDetailSerializer):
    """
    Inherits from DeviceDetailSerializer, contains information specific to the Sensor

    Includes:
    Identity - MAC Address
    Connection - Last Data Transmission, MQTT Status
    Sensor Block - Status, Sampling Interval, Current Signal Count, Last Reading, Data Transmission Interval
    Firmware - Firmware Version
    """
    last_transmission = serializers.DateTimeField()
    mqtt_status = serializers.CharField(max_length=30, allow_null=True)
    sensor_enabled = serializers.BooleanField(default=True)
    sampling_interval = serializers.IntegerField()
    #fw = firmware
    firmware_version = serializers.CharField(max_length=100, allow_null=True)
    #current_signal_count = serializers.SerializerMethodField()
    #last_reading
    #transmission_interval
    

class SensorObservationSerializer(serializers.ModelSerializer):
    pass

class SensorStatisticsSerializer(serializers.ModelSerializer):
    pass