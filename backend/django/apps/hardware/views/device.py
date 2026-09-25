"""
apps/hardware/views/device.py

Hardware API (07 API Design): /api/v1/hardware/devices, /kiosks, /sensors.
Admin only (the project's default permission).
"""
from datetime import timedelta

from django.db.models import Avg, Count, Max, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from analytics import audit
from analytics.models import AuditEvent
from common.pagination import StandardPagination
from hardware import services
from hardware.models import Device, Sensor
from hardware.serializers import (
    DeviceDetailSerializer,
    DeviceListSerializer,
    DeviceRegisterSerializer,
    DeviceUpdateSerializer,
    SensorObservationSerializer,
)

RELATED = (
    "sensor__area__parent_area", "sensor__floor__area", "sensor__map_node",
    "kiosk__area__parent_area", "kiosk__floor__area", "kiosk__map_node",
)


def _conflict(error):
    return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)


class _DeviceQueryMixin:
    """Registry filters: ?device_type=, ?status=, ?search= (name, device ID, or MAC)."""

    device_type = None
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = Device.objects.select_related(*RELATED).filter(deleted_at__isnull=True).order_by("name", "device_id")
        if self.device_type:
            queryset = queryset.filter(device_type=self.device_type).exclude(status=Device.STATUS_UNREGISTERED)
        params = self.request.query_params
        if params.get("device_type"):
            queryset = queryset.filter(device_type=params["device_type"].lower())
        wanted = params.get("status", "").lower()
        if wanted in (Device.STATUS_ONLINE, Device.STATUS_OFFLINE):
            # Online/offline is worked out from the last ping (services.effective_status).
            ids = [d.id for d in queryset.filter(status__in=services.ACTIVE_STATUSES)
                   if services.effective_status(d) == wanted]
            queryset = queryset.filter(id__in=ids)
        elif wanted:
            queryset = queryset.filter(status=wanted)
        if params.get("search"):
            term = params["search"]
            queryset = queryset.filter(
                Q(name__icontains=term) | Q(device_id__icontains=term) | Q(mac_address__icontains=term)
            )
        return queryset

    def get_serializer_class(self):
        return DeviceListSerializer if self.action == "list" else DeviceDetailSerializer


class DeviceViewSet(_DeviceQueryMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    GET    /hardware/devices                         registry table
    GET    /hardware/devices/{id}                    device details
    PATCH  /hardware/devices/{id}                    name, map node, zone, floor, sampling interval
    DELETE /hardware/devices/{id}                    decommission (soft delete)
    POST   /hardware/devices/{id}/register           register a discovered device
    POST   /hardware/devices/{id}/commands/{command} enable, disable, ping, restart
    """

    def partial_update(self, request, pk=None):
        device = self.get_object()
        serializer = DeviceUpdateSerializer(data=request.data, context={"device": device})
        serializer.is_valid(raise_exception=True)
        try:
            services.update_device(device, serializer.validated_data)
        except services.DeviceStateError as error:
            return _conflict(error)
        audit.record(request, AuditEvent.TYPE_ADMINISTRATIVE, AuditEvent.ACTION_UPDATE, device,
                     f"Updated device {device.name or device.device_id}",
                     {"fields": sorted(request.data.keys()) if hasattr(request.data, "keys") else []})
        return Response(DeviceDetailSerializer(self.get_queryset().get(pk=device.pk)).data)

    def destroy(self, request, pk=None):
        device = self.get_object()
        try:
            services.decommission_device(device)
        except services.DeviceStateError as error:
            return _conflict(error)
        audit.record(request, AuditEvent.TYPE_ADMINISTRATIVE, AuditEvent.ACTION_DELETE, device,
                     f"Decommissioned device {device.name or device.device_id}")
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def register(self, request, pk=None):
        device = self.get_object()
        serializer = DeviceRegisterSerializer(data=request.data, context={"device": device})
        serializer.is_valid(raise_exception=True)
        try:
            services.register_device(device, serializer.validated_data)
        except services.DeviceStateError as error:
            return _conflict(error)
        audit.record(request, AuditEvent.TYPE_ADMINISTRATIVE, AuditEvent.ACTION_CREATE, device,
                     f"Registered {device.device_type} {device.name}", {"device_id": device.device_id})
        return Response(DeviceDetailSerializer(self.get_queryset().get(pk=device.pk)).data)

    @action(detail=True, methods=["post"], url_path=r"commands/(?P<command>[a-z]+)")
    def command(self, request, pk=None, command=None):
        device = self.get_object()
        if command in ("enable", "disable"):
            try:
                services.set_enabled(device, command == "enable")
            except services.DeviceStateError as error:
                return _conflict(error)
            audit.record(request, AuditEvent.TYPE_ADMINISTRATIVE,
                         AuditEvent.ACTION_ACTIVATE if command == "enable" else AuditEvent.ACTION_DEACTIVATE,
                         device, f"{command.capitalize()}d device {device.name or device.device_id}")
            return Response(DeviceDetailSerializer(self.get_queryset().get(pk=device.pk)).data)
        if command in ("ping", "restart"):
            # Sending commands needs a command channel the device firmware
            # listens on; the IoT architecture doesn't define one yet.
            return Response(
                {"detail": f"The {command} command isn't available yet: the device firmware has no command channel."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )
        return Response({"detail": f"Unknown command '{command}'."}, status=status.HTTP_404_NOT_FOUND)


class KioskViewSet(_DeviceQueryMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """GET /hardware/kiosks and /hardware/kiosks/{id}: registered kiosks only."""

    device_type = Device.TYPE_KIOSK


class SensorViewSet(_DeviceQueryMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    GET /hardware/sensors, /hardware/sensors/{id}           registered sensors only
    GET /hardware/sensors/{id}/observations?from=&to=       raw readings, newest first
    GET /hardware/sensors/{id}/statistics?hours=24          reliability and usage
    """

    device_type = Device.TYPE_SENSOR

    @action(detail=True, methods=["get"])
    def observations(self, request, pk=None):
        sensor = self.get_object().sensor
        queryset = sensor.observations.order_by("-observed_at")
        for param, lookup in (("from", "observed_at__gte"), ("to", "observed_at__lte")):
            if request.query_params.get(param):
                moment = parse_datetime(request.query_params[param])
                if moment is None:
                    raise ValidationError({param: "Use an ISO 8601 date and time."})
                queryset = queryset.filter(**{lookup: moment})
        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        return paginator.get_paginated_response(SensorObservationSerializer(page, many=True).data)

    @action(detail=True, methods=["get"])
    def statistics(self, request, pk=None):
        device = self.get_object()
        sensor = device.sensor
        try:
            hours = int(request.query_params.get("hours", 24))
        except ValueError:
            raise ValidationError({"hours": "Must be a whole number."})
        if not 1 <= hours <= 24 * 90:
            raise ValidationError({"hours": "Must be between 1 and 2160."})
        period_end = timezone.now()
        period_start = period_end - timedelta(hours=hours)
        stats = sensor.observations.filter(observed_at__gte=period_start, observed_at__lte=period_end).aggregate(
            received=Count("id"),
            average_signal_count=Avg("signal_count"),
            peak_signal_count=Max("signal_count"),
            average_density=Avg("estimated_density"),
            peak_density=Max("estimated_density"),
        )
        expected = None
        reliability = None
        if sensor.sampling_interval_seconds:
            expected = int(hours * 3600 / sensor.sampling_interval_seconds)
            reliability = round(min(100.0, stats["received"] * 100.0 / expected), 1) if expected else None
        return Response({
            "period_start": period_start,
            "period_end": period_end,
            "observations_received": stats["received"],
            "observations_expected": expected,
            "transmission_reliability_percent": reliability,
            "average_signal_count": _round(stats["average_signal_count"]),
            "peak_signal_count": stats["peak_signal_count"],
            "average_density": _round(stats["average_density"]),
            "peak_density": _round(stats["peak_density"]),
            "last_transmission_at": sensor.last_transmission_at,
        })


def _round(value):
    return None if value is None else round(float(value), 3)
