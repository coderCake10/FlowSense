'''
DeviceListView
DeviceDetailView
DeviceRegisterView
'''
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from hardware.models import Device
from hardware.serializers.device import DeviceListSerializer, DeviceRegisterSerializer
from hardware import services

class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.select_related('kiosk__area', 'kiosk__floor', 'sensor__area', 'sensor__floor').all()
    
    def get_serializer_class(self):
        # Dynamically switch serializers based on the admin action
        if self.action == 'register':
            return DeviceRegisterSerializer
        return DeviceListSerializer

    # Maps to POST /api/hardware/devices/{id}/register
    @action(detail=True, methods=['post'])
    def register(self, request, pk=None):
        device = self.get_object()
        
        # Prevent re-registering
        if device.status != 'unregistered':
            return Response(
                {"success": False, "error": "Device is already registered or decommissioned."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Pass the device instance into the context for your custom validation logic
        serializer = self.get_serializer(data=request.data, context={'device': device})
        
        if serializer.is_valid():
            # Hand the clean data over to your pure Python service
            updated_device = services.register_device(device, serializer.validated_data)
            return Response(
                {"success": True, "data": DeviceListSerializer(updated_device).data}, 
                status=status.HTTP_200_OK
            )
            
        return Response(
            {"success": False, "error": serializer.errors}, 
            status=status.HTTP_400_BAD_REQUEST
        )