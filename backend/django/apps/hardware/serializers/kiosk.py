'''
KioskDetailSerializer
'''
from rest_framework import serializers

from hardware.models import Kiosk

from .device import DeviceDetailSerializer

class KioskDetailSerializer(DeviceDetailSerializer):
    """
    Inherits from DeviceDetailSerializer, contains information specific to the Kiosk

    Includes:
    Identity - Serial Number
    Connection - Network Status
    Hardware Block - Display Resolution, Touchscreen, Touchscreen Status, Orientation, Hardware Status
    Software Block - FlowSense Version, Frontend Version, Last Application Restart, Application Status
    Firmware - OS Version, Firmware Version
    """
    DEVICE_ORIENTATION = [
        'landscape',
        'portrait'
    ]
    serial_number = serializers.CharField()

    display_resolution = serializers.CharField(max_length=50, allow_null=True)
    #ts = touchscreen
    ts_connected = serializers.BooleanField()
    ts_status = serializers.CharField(max_length=50, allow_null=True)
    orientation = serializers.ChoiceField(choices=DEVICE_ORIENTATION, default='landscape')
    hardware_status = serializers.CharField(max_length=50, allow_null=True)
    #fs = flowsense
    fs_version = serializers.CharField(max_length=50, allow_null=True)
    #fe = frontend
    fe_version = serializers.CharField(max_length=50, allow_null=True)
    last_app_restart = serializers.DateTimeField()
    app_status = serializers.CharField(max_length=50, allow_null=True)
    os_version = serializers.CharField(max_length=100, allow_null=True)
    #fw = firmware
    fw_version = serializers.CharField(max_length=100, allow_null=True)
