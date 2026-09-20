"""
apps/hardware/urls.py

Wires up every Hardware API route. Included by config/urls.py, expected to be
mounted at /api/v1/hardware/ (or /api/hardware/ depending on your current setup).

Because this app utilizes specialized state transitions, validations, and remote 
command dispatches rather than simple CRUD operations, we route explicit APIViews 
using path() instead of a DefaultRouter.
"""

from django.urls import path
from hardware.views import (
    # Device Registry Views
    DeviceListView,
    DeviceDetailView,
    DeviceRegisterView,
    
    # Remote Command Views
    DevicePingCommandView,
    DeviceRestartCommandView,
    DeviceEnableCommandView,
    DeviceDisableCommandView,
    
    # Kiosk-Specific Views
    KioskListView,
    KioskDetailView,
    
    # Sensor-Specific Views
    SensorListView,
    SensorDetailView,
    SensorObservationsView,
    SensorStatisticsView,
)

urlpatterns = [
    # =========================================================================
    # 1. DEVICES (Base Registry)
    # Paths: /api/v1/hardware/devices/...
    # =========================================================================
    path('devices/', DeviceListView.as_view(), name='device-list'),
    path('devices/<str:pk>/', DeviceDetailView.as_view(), name='device-detail'),
    path('devices/<str:pk>/register/', DeviceRegisterView.as_view(), name='device-register'),

    # =========================================================================
    # 2. REMOTE COMMANDS
    # Paths: /api/v1/hardware/devices/{id}/commands/...
    # =========================================================================
    path('devices/<str:pk>/commands/ping/', DevicePingCommandView.as_view(), name='device-command-ping'),
    path('devices/<str:pk>/commands/restart/', DeviceRestartCommandView.as_view(), name='device-command-restart'),
    path('devices/<str:pk>/commands/enable/', DeviceEnableCommandView.as_view(), name='device-command-enable'),
    path('devices/<str:pk>/commands/disable/', DeviceDisableCommandView.as_view(), name='device-command-disable'),

    # =========================================================================
    # 3. KIOSKS
    # Paths: /api/v1/hardware/kiosks/...
    # =========================================================================
    path('kiosks/', KioskListView.as_view(), name='kiosk-list'),
    path('kiosks/<str:pk>/', KioskDetailView.as_view(), name='kiosk-detail'),

    # =========================================================================
    # 4. SENSORS
    # Paths: /api/v1/hardware/sensors/...
    # =========================================================================
    path('sensors/', SensorListView.as_view(), name='sensor-list'),
    path('sensors/<str:pk>/', SensorDetailView.as_view(), name='sensor-detail'),
    path('sensors/<str:pk>/observations/', SensorObservationsView.as_view(), name='sensor-observations'),
    path('sensors/<str:pk>/statistics/', SensorStatisticsView.as_view(), name='sensor-statistics'),
]