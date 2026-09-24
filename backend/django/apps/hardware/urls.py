from django.urls import path, include
from rest_framework.routers import DefaultRouter
from hardware.views import DeviceViewSet

router = DefaultRouter()
router.register("devices", DeviceViewSet, basename="device")

urlpatterns = router.urls