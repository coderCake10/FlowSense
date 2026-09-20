"""
apps/fs_sessions/urls.py

Wires up every Session API route (Kiosk, Navigation, and QR).
Included by config/urls.py, expected to be mounted at /api/v1/sessions/.

Since session management relies on specific state transitions rather than 
standard RESTful CRUD operations, this app relies on explicit APIViews mapped 
via path() rather than a DefaultRouter.
"""

from django.urls import path
from fs_sessions.views import (
    # Kiosk Views
    KioskSessionCreateView,
    KioskSessionDetailView,
    KioskSessionHeartbeatView,
    KioskSessionEndView,
    
    # Navigation Views (Kiosk-side)
    NavigationSessionCreateView,
    NavigationSessionDetailView,
    NavigationSessionPauseView,
    NavigationSessionResumeView,
    NavigationSessionCompleteView,
    NavigationSessionCancelView,
    NavigationDestinationReachView,
    
    # QR Handoff Views (Mobile-side)
    QRSessionCreateView,
    QRSessionDetailView,
    QRSessionScanView,
    QRSessionCompleteView,
    QRSessionCancelView,
)

urlpatterns = [
    # =========================================================================
    # 1. KIOSK SESSIONS
    # Paths: /api/v1/sessions/kiosk/...
    # =========================================================================
    path('kiosk/', KioskSessionCreateView.as_view(), name='kiosk-session-create'),
    path('kiosk/<uuid:pk>/', KioskSessionDetailView.as_view(), name='kiosk-session-detail'),
    path('kiosk/<uuid:pk>/heartbeat/', KioskSessionHeartbeatView.as_view(), name='kiosk-session-heartbeat'),
    path('kiosk/<uuid:pk>/end/', KioskSessionEndView.as_view(), name='kiosk-session-end'),

    # =========================================================================
    # 2. NAVIGATION SESSIONS (Kiosk-side routing)
    # Paths: /api/v1/sessions/navigation/...
    # =========================================================================
    path('navigation/', NavigationSessionCreateView.as_view(), name='nav-session-create'),
    path('navigation/<uuid:pk>/', NavigationSessionDetailView.as_view(), name='nav-session-detail'),
    path('navigation/<uuid:pk>/pause/', NavigationSessionPauseView.as_view(), name='nav-session-pause'),
    path('navigation/<uuid:pk>/resume/', NavigationSessionResumeView.as_view(), name='nav-session-resume'),
    path('navigation/<uuid:pk>/complete/', NavigationSessionCompleteView.as_view(), name='nav-session-complete'),
    path('navigation/<uuid:pk>/cancel/', NavigationSessionCancelView.as_view(), name='nav-session-cancel'),

    # =========================================================================
    # 3. DESTINATION CHECKLIST
    # Paths: /api/v1/sessions/{id}/destinations/{destination_id}/reach
    # =========================================================================
    path('<uuid:pk>/destinations/<int:destination_id>/reach/', NavigationDestinationReachView.as_view(), name='nav-destination-reach'),

    # =========================================================================
    # 4. QR SESSIONS (Mobile-side handoff)
    # Paths: /api/v1/sessions/...
    # =========================================================================
    path('', QRSessionCreateView.as_view(), name='qr-session-create'),
    path('<uuid:pk>/', QRSessionDetailView.as_view(), name='qr-session-detail'),
    path('<uuid:pk>/scan/', QRSessionScanView.as_view(), name='qr-session-scan'),
    path('<uuid:pk>/complete/', QRSessionCompleteView.as_view(), name='qr-session-complete'),
    path('<uuid:pk>/cancel/', QRSessionCancelView.as_view(), name='qr-session-cancel'),
]