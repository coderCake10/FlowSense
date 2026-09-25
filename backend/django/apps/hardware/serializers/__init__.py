"""
apps/hardware/serializers/__init__.py
"""
from .device import (
    DeviceDetailSerializer,
    DeviceListSerializer,
    DeviceRegisterSerializer,
    DeviceUpdateSerializer,
)
from .sensor import SensorObservationSerializer

__all__ = [
    "DeviceDetailSerializer",
    "DeviceListSerializer",
    "DeviceRegisterSerializer",
    "DeviceUpdateSerializer",
    "SensorObservationSerializer",
]
