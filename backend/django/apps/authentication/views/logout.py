"""
apps/authentication/views/logout.py

Backs:
  POST /api/v1/auth/logout
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication import services
from common.permissions import IsAdminUser
from common.permissions.admin import ADMIN_SESSION_COOKIE_NAME


class LogoutView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, *args, **kwargs):
        # request.admin_session was already resolved and validated by
        # IsAdminUser for this request — see services.logout()'s own
        # docstring on why that means there's nothing left for this view
        # to look up.
        services.logout(request.admin_session)

        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(ADMIN_SESSION_COOKIE_NAME)
        return response