from django.urls import path

from common.system.views import SystemHealthView, SystemStatusView

urlpatterns = [
    path("status/", SystemStatusView.as_view(), name="system-status"),
    path("health/", SystemHealthView.as_view(), name="system-health"),
]
