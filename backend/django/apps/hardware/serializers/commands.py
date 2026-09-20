'''
DeviceCommandResultSerializer
'''
from rest_framework import serializers

class DeviceCommandResultSerializer(serializers.Serializer):
    """
    Standardizes the API response structure for remote hardware commands 
    (Ping, Restart, Enable/Disable) sent from the Admin Dashboard[cite: 10].
    """
    success = serializers.BooleanField()
    message = serializers.CharField()
    command = serializers.CharField()
    device_id = serializers.CharField(max_length=150)
    timestamp = serializers.DateTimeField(read_only=True)