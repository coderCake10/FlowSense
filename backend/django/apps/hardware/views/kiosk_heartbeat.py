"""
POST /api/v1/hardware/kiosks/heartbeat

Approved addition to the API design (QA-62): lets a kiosk announce itself
and report that it's online, so it appears on the Hardware page like an
ESP32 discovered over MQTT. Public, like the kiosk session endpoints, and
rate limited per IP.

Not yet authenticated per device: the OpenAPI contract's KioskDeviceToken
(device credential exchange) is still open as QA-28. Until then anyone on
the network can send a heartbeat for a kiosk ID; an unknown ID only ever
creates an *unregistered* entry that an admin must approve.
"""
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.throttling import KioskHeartbeatThrottle
from hardware import services
from hardware.models import Device


class KioskHeartbeatSerializer(serializers.Serializer):
    device_id = serializers.RegexField(r"^kiosk-[a-z0-9-]{8,64}$")
    display_resolution = serializers.CharField(max_length=50, required=False)
    orientation = serializers.ChoiceField(choices=["landscape", "portrait"], required=False)
    touchscreen_connected = serializers.BooleanField(required=False)
    frontend_version = serializers.CharField(max_length=50, required=False)
    os_version = serializers.CharField(max_length=100, required=False)
    application_started_at = serializers.DateTimeField(required=False)


def _client_ip(request):
    # Behind the Nginx reverse proxy the first X-Forwarded-For entry is the kiosk.
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip = forwarded.split(",")[0].strip() or request.META.get("REMOTE_ADDR")
    return ip or None


class KioskHeartbeatView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [KioskHeartbeatThrottle]

    def post(self, request):
        serializer = KioskHeartbeatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        info = dict(serializer.validated_data)
        device_id = info.pop("device_id")
        try:
            device = services.kiosk_heartbeat(device_id, info, ip_address=_client_ip(request))
        except services.DeviceStateError as error:
            return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)
        effective = services.effective_status(device)
        return Response({
            "id": device.id,
            "device_id": device.device_id,
            "name": device.name,
            "status": effective,
            # Visitor sessions are recorded only for a registered, enabled kiosk.
            "records_sessions": effective in (Device.STATUS_ONLINE, Device.STATUS_OFFLINE),
            "heartbeat_interval_seconds": services.DEFAULT_SAMPLING_INTERVAL_SECONDS,
            # Where this kiosk's routes start (null until the map has one).
            "map_node_id": services.kiosk_origin_node_id(device),
        })
