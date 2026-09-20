"""
apps/hardware/views/__init__.py

Exports all hardware views to provide a clean import interface for urls.py.
"""

from .device import DeviceViewSet
from .kiosk import KioskListView, KioskDetailView
from .sensor import (
    SensorListView, 
    SensorDetailView, 
    SensorObservationsView, 
    SensorStatisticsView
)
from .commands import (
    DevicePingCommandView,
    DeviceRestartCommandView,
    DeviceEnableCommandView,
    DeviceDisableCommandView
)

__all__ = [
    "DeviceViewSet",
    "KioskListView",
    "KioskDetailView",
    "SensorListView",
    "SensorDetailView",
    "SensorObservationsView",
    "SensorStatisticsView",
    "DevicePingCommandView",
    "DeviceRestartCommandView",
    "DeviceEnableCommandView",
    "DeviceDisableCommandView",
]