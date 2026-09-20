"""
apps/fs_sessions/views/__init__.py

Exports all views for the fs_sessions app, providing a clean import interface
for the urls.py routing configuration.
"""

from .kiosk import (
    KioskSessionCreateView,
    KioskSessionDetailView,
    KioskSessionHeartbeatView,
    KioskSessionEndView,
)

from .navigation import (
    NavigationSessionCreateView,
    NavigationSessionDetailView,
    NavigationSessionPauseView,
    NavigationSessionResumeView,
    NavigationSessionCompleteView,
    NavigationSessionCancelView,
    NavigationDestinationReachView,
)

from .qr import (
    QRSessionCreateView,
    QRSessionDetailView,
    QRSessionScanView,
    QRSessionCompleteView,
    QRSessionCancelView,
)

__all__ = [
    "KioskSessionCreateView",
    "KioskSessionDetailView",
    "KioskSessionHeartbeatView",
    "KioskSessionEndView",
    "NavigationSessionCreateView",
    "NavigationSessionDetailView",
    "NavigationSessionPauseView",
    "NavigationSessionResumeView",
    "NavigationSessionCompleteView",
    "NavigationSessionCancelView",
    "NavigationDestinationReachView",
    "QRSessionCreateView",
    "QRSessionDetailView",
    "QRSessionScanView",
    "QRSessionCompleteView",
    "QRSessionCancelView",
]