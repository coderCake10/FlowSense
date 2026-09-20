'''
KioskListView
KioskDetailView
'''
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from hardware.models import Device
from hardware.serializers.device import DeviceListSerializer
from hardware.serializers.kiosk import KioskDetailSerializer
from hardware import services


class KioskListView(APIView):
    """
    GET /api/v1/hardware/kiosks
    Retrieves a list exclusively of all registered kiosk devices[cite: 1].
    """
    def get(self, request):
        # Applies standard filtering restricted to Kiosks
        kiosks = services.filter_device(device_type=Device.TYPE_KIOSK)
        serializer = DeviceListSerializer(kiosks, many=True)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


class KioskDetailView(APIView):
    """
    GET /api/v1/hardware/kiosks/{id}
    Retrieves hardware, software, and networking details for a specific kiosk[cite: 1].
    """
    def get(self, request, pk):
        device = get_object_or_404(Device, device_id=pk, device_type=Device.TYPE_KIOSK)
        
        # Assemble the cross-table join via the service layer
        detail_data = services.get_kiosk_details(device)
        serializer = KioskDetailSerializer(detail_data)
        
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)