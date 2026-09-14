"""
apps/fs_sessions/serializers/__init__.py

Re-exports every fs_sessions serializer (Navigation Sessions API + QR
Sessions API + Kiosk Sessions API — all three share
"Django Application: sessions" in 00 API Design.md; the app itself is
named `fs_sessions` in this codebase to avoid clashing with Django's own
built-in sessions framework) so views can do:

    from fs_sessions.serializers import NavigationSessionSerializer, KioskSessionSerializer, ...
"""
from fs_sessions.serializers.kiosk_sessions import (
    KioskSessionCreateSerializer,
    KioskSessionEndSerializer,
    KioskSessionSerializer,
)
from fs_sessions.serializers.navigation_sessions import (
    DestinationReachSerializer,
    NavigationSessionCreateSerializer,
    NavigationSessionSerializer,
)

__all__ = [
    "NavigationSessionCreateSerializer",
    "NavigationSessionSerializer",
    "DestinationReachSerializer",
    "KioskSessionCreateSerializer",
    "KioskSessionSerializer",
    "KioskSessionEndSerializer",
]