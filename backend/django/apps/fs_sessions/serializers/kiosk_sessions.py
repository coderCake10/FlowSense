"""
apps/fs_sessions/serializers/kiosk_sessions.py

Backs the Kiosk Sessions API:
  POST /sessions/kiosk
  GET  /sessions/kiosk/{id}
  POST /sessions/kiosk/{id}/heartbeat   (no serializer needed — bodyless)
  POST /sessions/kiosk/{id}/end
"""
from rest_framework import serializers

from fs_sessions.models import KioskSession


class KioskSessionCreateSerializer(serializers.ModelSerializer):
    """
    POST /sessions/kiosk — fired when a user starts interacting with the
    kiosk (leaving the Attract Screen). `kiosk` identifies which physical
    kiosk this is, so one backend can serve every kiosk on campus without
    their sessions being confused for each other.
    """

    class Meta:
        model = KioskSession
        fields = ["kiosk"]
        # The model FK is nullable (SET NULL keeps history when a kiosk is
        # removed), but a new session must name its kiosk.
        extra_kwargs = {"kiosk": {"required": True, "allow_null": False}}


class KioskSessionSerializer(serializers.ModelSerializer):
    """GET /sessions/kiosk/{id}, and the response shape for create/heartbeat/end."""

    class Meta:
        model = KioskSession
        fields = ["id", "kiosk", "started_at", "ended_at", "last_activity_at", "end_reason"]
        read_only_fields = fields


class KioskSessionEndSerializer(serializers.Serializer):
    """
    POST /sessions/kiosk/{id}/end.

    `end_reason` is optional and defaults to 'manual_exit' — per the
    Kiosk Interactive 3D Map notes (the Destination Queue modal's exit
    button, or the Navigate flow completing), the most common trigger for
    an explicit /end call is the user deliberately leaving. 'idle_timeout'
    is what the Kiosk frontend should send instead when IT detects the
    idle condition itself and calls this endpoint — not something this
    serializer tries to infer on the caller's behalf.
    """

    end_reason = serializers.ChoiceField(
        choices=[choice for choice, _ in KioskSession.END_REASON_CHOICES],
        required=False,
        default=KioskSession.END_MANUAL_EXIT,
    )