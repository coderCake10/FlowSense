'''
DevicePingCommandView
DeviceRestartCommandView
DeviceEnableCommandView
DeviceDisableCommandView
'''
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from hardware.models import Device
from hardware.serializers.commands import DeviceCommandResultSerializer
from hardware import services


class DevicePingCommandView(APIView):
    """
    POST /api/v1/hardware/devices/{id}/commands/ping
    Sends a remote command to test the responsiveness/connection of a device[cite: 1].
    """
    def post(self, request, pk):
        device = get_object_or_404(Device, device_id=pk)
        try:
            result = services.dispatch_command(device, 'ping')
            return Response(
                {"success": True, "data": DeviceCommandResultSerializer(result).data}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class DeviceRestartCommandView(APIView):
    """
    POST /api/v1/hardware/devices/{id}/commands/restart
    Sends a remote command attempting to reboot the device[cite: 1].
    """
    def post(self, request, pk):
        device = get_object_or_404(Device, device_id=pk)
        try:
            result = services.dispatch_command(device, 'restart')
            return Response(
                {"success": True, "data": DeviceCommandResultSerializer(result).data}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class DeviceEnableCommandView(APIView):
    """
    POST /api/v1/hardware/devices/{id}/commands/enable
    Administratively enables a previously disabled device[cite: 1].
    """
    def post(self, request, pk):
        device = get_object_or_404(Device, device_id=pk)
        try:
            result = services.dispatch_command(device, 'enable')
            return Response(
                {"success": True, "data": DeviceCommandResultSerializer(result).data}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class DeviceDisableCommandView(APIView):
    """
    POST /api/v1/hardware/devices/{id}/commands/disable
    Administratively disables an active device[cite: 1].
    """
    def post(self, request, pk):
        device = get_object_or_404(Device, device_id=pk)
        try:
            result = services.dispatch_command(device, 'disable')
            return Response(
                {"success": True, "data": DeviceCommandResultSerializer(result).data}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)