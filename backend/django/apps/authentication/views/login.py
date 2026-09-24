"""
apps/authentication/views/login.py

Backs:
  POST /api/v1/auth/login

Plain APIView: this isn't CRUD on a resource identified by a URL id — it's
a single stateless action, so a ViewSet would add routing machinery this
endpoint has no use for. The same reasoning applies to every other
Authentication API endpoint (verify, logout, me, session): none of them
operate on a resource identified by a URL path parameter — all five
operate on "the current caller," identified implicitly via the request
body (email) or the session cookie, not a `{pk}` in the path. Contrast
with the Users API (users.py), which IS textbook id-based CRUD and IS a
ViewSet.
"""
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication import services
from common.throttling import LoginIpThrottle
from authentication.serializers import LoginRequestSerializer, LoginResponseSerializer


class LoginView(APIView):
    """Public — this is how an admin BEGINS authenticating, so it can't require it."""

    permission_classes = [AllowAny]
    throttle_classes = [LoginIpThrottle]

    def post(self, request, *args, **kwargs):
        input_serializer = LoginRequestSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        services.initiate_login(input_serializer.validated_data["email"])

        # Same generic response regardless of whether the email matched a
        # real admin — see LoginRequestSerializer's and
        # services.initiate_login()'s own NOTEs on why (anti-enumeration).
        output_serializer = LoginResponseSerializer(
            {"message": "If an account exists for that email, a code has been sent."}
        )
        return Response(output_serializer.data)