'''
SensorListView
SensorDetailView
SensorObservationsView
SensorStatisticsView
'''
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime

from hardware.models import Device, SensorObservation
from hardware.serializers.device import DeviceListSerializer
from hardware.serializers.sensor import (
    SensorDetailSerializer, 
    SensorObservationSerializer, 
    SensorStatisticsSerializer
)
from hardware import services


class SensorListView(APIView):
    """
    GET /api/v1/hardware/sensors
    Retrieves a list exclusively of all registered ESP32 sensor devices[cite: 1].
    """
    def get(self, request):
        sensors = services.filter_device(device_type=Device.TYPE_SENSOR)
        serializer = DeviceListSerializer(sensors, many=True)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


class SensorDetailView(APIView):
    """
    GET /api/v1/hardware/sensors/{id}
    Retrieves detailed status, firmware, and sampling interval details for an ESP32 sensor[cite: 1].
    """
    def get(self, request, pk):
        device = get_object_or_404(Device, device_id=pk, device_type=Device.TYPE_SENSOR)
        
        detail_data = services.get_sensor_details(device)
        serializer = SensorDetailSerializer(detail_data)
        
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


class SensorObservationsView(APIView):
    """
    GET /api/v1/hardware/sensors/{id}/observations
    Retrieves raw signal counts and BLE observations received from a sensor via MQTT[cite: 1].
    """
    def get(self, request, pk):
        device = get_object_or_404(Device, device_id=pk, device_type=Device.TYPE_SENSOR)
        
        # Fetch the most recent 100 observations to prevent massive payload sizes
        observations = SensorObservation.objects.filter(
            sensor__device=device
        ).select_related('sensor').order_by('-observed_at')[:100]
        
        serializer = SensorObservationSerializer(observations, many=True)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


class SensorStatisticsView(APIView):
    """
    GET /api/v1/hardware/sensors/{id}/statistics
    Retrieves aggregated transmission reliability and usage statistics for a specific sensor[cite: 1].
    Accepts optional 'start_time' and 'end_time' query parameters.
    """
    def get(self, request, pk):
        device = get_object_or_404(Device, device_id=pk, device_type=Device.TYPE_SENSOR)
        
        start_time = request.query_params.get('start_time')
        end_time = request.query_params.get('end_time')
        
        parsed_start = parse_datetime(start_time) if start_time else None
        parsed_end = parse_datetime(end_time) if end_time else None

        stats_data = services.aggregate_statistics(
            sensor_id=device.device_id, 
            start_time=parsed_start, 
            end_time=parsed_end
        )
        
        serializer = SensorStatisticsSerializer(stats_data)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)