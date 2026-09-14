"""
apps/authentication/views/me.py

Backs:
  GET /api/v1/auth/me
"""
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.serializers import AdminUserSerializer
from common.permissions import IsAdminUser


class MeView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, *args, **kwargs):
        serializer = AdminUserSerializer(request.admin_user)
        return Response(serializer.data)