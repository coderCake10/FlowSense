'''
DeviceListView
DeviceDetailView
DeviceRegisterView

apps/hardware/views/device.py

Replaces the generic DeviceViewSet with explicit APIViews to cleanly handle 
the specialized FlowSense hardware lifecycle endpoints.
'''

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError

from hardware.models import Device
from hardware.serializers.device import (
    DeviceListSerializer, 
    DeviceRegisterSerializer,
    DeviceUpdateSerializer
)
from hardware.serializers.kiosk import KioskDetailSerializer
from hardware.serializers.sensor import SensorDetailSerializer
from hardware import services


class DeviceListView(APIView):
    """
    GET /api/v1/hardware/devices
    Retrieves a filtered list of all hardware devices in the registry[cite: 17].
    """
    def get(self, request):
        device_type = request.query_params.get('device_type')
        status_param = request.query_params.get('status')
        location = request.query_params.get('location')
        
        devices = services.filter_device(
            device_type=device_type, 
            status=status_param, 
            location=location
        )
        serializer = DeviceListSerializer(devices, many=True)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


class DeviceDetailView(APIView):
    """
    Handles retrieval, metadata updates, and decommissioning for a specific device[cite: 17].
    """
    def get(self, request, pk):
        """
        GET /api/v1/hardware/devices/{id}
        Retrieves specific identity, assignment, and connection details for a device[cite: 17].
        Dynamically returns either Kiosk or Sensor details based on device_type.
        """
        device = get_object_or_404(Device, device_id=pk)
        
        if device.device_type == Device.TYPE_KIOSK:
            detail_data = services.get_kiosk_details(device)
            serializer = KioskDetailSerializer(detail_data)
        else:
            detail_data = services.get_sensor_details(device)
            serializer = SensorDetailSerializer(detail_data)
            
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        """
        PATCH /api/v1/hardware/devices/{id}
        Modifies device metadata such as Device Name, mapped Node, or Zone[cite: 17].
        """
        device = get_object_or_404(Device, device_id=pk)
        serializer = DeviceUpdateSerializer(device, data=request.data, partial=True)
        
        if serializer.is_valid():
            try:
                updated_device = services.update_metadata(device, serializer.validated_data)
                return Response(
                    {"success": True, "data": DeviceListSerializer(updated_device).data}, 
                    status=status.HTTP_200_OK
                )
            except ValidationError as e:
                return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
                
        return Response({"success": False, "error": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        """
        DELETE /api/v1/hardware/devices/{id}
        Soft-deletes or decommissions a piece of hardware from active operations[cite: 17].
        """
        device = get_object_or_404(Device, device_id=pk)
        try:
            device = services.decommission_device(device)
            return Response(
                {"success": True, "message": f"Device {device.device_id} successfully decommissioned."}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class DeviceRegisterView(APIView):
    """
    POST /api/v1/hardware/devices/{id}/register
    Officially registers an internally discovered device to be managed by the system[cite: 17].
    """
    def post(self, request, pk):
        device = get_object_or_404(Device, device_id=pk)
        
        # Prevent re-registering
        if device.status != Device.STATUS_UNREGISTERED:
            return Response(
                {"success": False, "error": "Device is already registered or decommissioned."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Pass the device instance into the context for custom validation logic[cite: 1]
        serializer = DeviceRegisterSerializer(data=request.data, context={'device': device})
        
        if serializer.is_valid():
            try:
                # Hand the clean data over to the pure Python service[cite: 1]
                updated_device = services.register_device(device, serializer.validated_data)
                return Response(
                    {"success": True, "data": DeviceListSerializer(updated_device).data}, 
                    status=status.HTTP_200_OK
                )
            except ValidationError as e:
                return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
                
        return Response(
            {"success": False, "error": serializer.errors}, 
            status=status.HTTP_400_BAD_REQUEST
        )