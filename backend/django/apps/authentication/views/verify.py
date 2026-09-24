"""
apps/authentication/views/verify.py

Backs:
  POST /api/v1/auth/verify
"""
from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication import services
from authentication.serializers import VerifyRequestSerializer, VerifyResponseSerializer
from common.permissions.admin import ADMIN_SESSION_COOKIE_NAME
from common.throttling import VerifyEmailThrottle, VerifyIpThrottle


class VerificationFailed(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_code = "invalid_challenge"
    default_detail = "Invalid or expired code."


class VerifyView(APIView):
    """Public — same reasoning as LoginView; this IS the login step itself."""

    permission_classes = [AllowAny]
    throttle_classes = [VerifyIpThrottle, VerifyEmailThrottle]

    def post(self, request, *args, **kwargs):
        input_serializer = VerifyRequestSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        validated = input_serializer.validated_data

        request_meta = {
            "ip_address": request.META.get("REMOTE_ADDR"),
            "user_agent": request.META.get("HTTP_USER_AGENT", ""),
        }

        try:
            result = services.verify_challenge(
                email=validated["email"], token=validated["token"], request_meta=request_meta
            )
        except services.InvalidChallengeError as exc:
            raise VerificationFailed(str(exc))

        output_serializer = VerifyResponseSerializer(
            {
                "admin": result["admin_user"],
                "session_expires_at": result["session"].expires_at,
            }
        )
        response = Response(output_serializer.data)

        # The raw session token exists only here and in services.py's
        # return value — never in the response body (see
        # VerifyResponseSerializer's own NOTE) and never persisted
        # anywhere except as its hash (operations.admin_sessions.session_token_hash).
        #
        # Secure by default, matching the Security Architecture notes
        # ("Secure HTTP Cookies"). ADMIN_SESSION_COOKIE_SECURE=False is only
        # for plain-HTTP local/LAN setups: browsers drop Secure cookies
        # set over HTTP (other than on localhost).
        response.set_cookie(
            ADMIN_SESSION_COOKIE_NAME,
            result["raw_session_token"],
            httponly=True,
            secure=settings.ADMIN_SESSION_COOKIE_SECURE,
            samesite="Lax",
            expires=result["session"].expires_at,
        )
        return response