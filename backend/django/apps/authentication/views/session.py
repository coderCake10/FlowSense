"""
apps/authentication/views/session.py

Backs:
  GET /api/v1/auth/session

No services.py function needed for this one — IsAdminUser has already
resolved and validated request.admin_session by the time this view runs
(an invalid/expired/revoked session never reaches here at all, since the
permission check rejects it with 401 first). A 200 response from this
endpoint IS the "your session is valid" answer; the body just echoes that
session's own details back.
"""
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.serializers import SessionStatusSerializer
from common.permissions import IsAdminUser


class SessionStatusView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, *args, **kwargs):
        serializer = SessionStatusSerializer(request.admin_session)
        return Response(serializer.data)