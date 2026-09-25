"""
System API (07 API Design, common/system).

GET /api/v1/system/status  overall state
GET /api/v1/system/health  per-component checks
Both are public in the OpenAPI contract (kiosks read them too).
"""
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.system import health


class SystemStatusView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        result = health.check()
        return Response({"status": result["status"], "checked_at": result["checked_at"]})


class SystemHealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(health.check())
