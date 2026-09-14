"""
apps/authentication/views/verify.py

Backs:
  POST /api/v1/auth/verify
"""
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication import services
from authentication.serializers import VerifyRequestSerializer, VerifyResponseSerializer
from common.permissions.admin import ADMIN_SESSION_COOKIE_NAME


class VerificationFailed(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_code = "invalid_challenge"
    default_detail = "Invalid or expired code."


class VerifyView(APIView):
    """Public — same reasoning as LoginView; this IS the login step itself."""

    permission_classes = [AllowAny]

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
        # secure=True matches the Security Architecture notes ("Secure
        # HTTP Cookies"); a local HTTP-only dev environment will need to
        # either run behind HTTPS (Nginx, per the deployment notes) or
        # override this — not relaxed here by default, since "insecure by
        # default for developer convenience" is the wrong default for an
        # admin session cookie.
        response.set_cookie(
            ADMIN_SESSION_COOKIE_NAME,
            result["raw_session_token"],
            httponly=True,
            secure=True,
            samesite="Lax",
            expires=result["session"].expires_at,
        )
        return response