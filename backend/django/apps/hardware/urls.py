from django.urls import path
from rest_framework.routers import DefaultRouter

from hardware.views import DeviceViewSet, KioskViewSet, SensorViewSet
from hardware.views.kiosk_heartbeat import KioskHeartbeatView

router = DefaultRouter()
router.register("devices", DeviceViewSet, basename="device")
router.register("kiosks", KioskViewSet, basename="kiosk")
router.register("sensors", SensorViewSet, basename="sensor")

urlpatterns = [
    # Before the router, so "heartbeat" isn't read as a kiosk ID.
    path("kiosks/heartbeat/", KioskHeartbeatView.as_view(), name="kiosk-heartbeat"),
    *router.urls,
]
