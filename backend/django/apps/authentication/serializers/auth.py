"""
apps/authentication/serializers/auth.py

Backs:
  POST /api/v1/auth/login
  POST /api/v1/auth/verify
  GET  /api/v1/auth/session

POST /auth/logout needs no serializer at all — it takes no request body
(the session to invalidate is identified by the cookie itself) and
returns a bare 204. GET /auth/me needs no serializer of its own either;
its response is exactly AdminUserSerializer (see users.py) — "the
profile, role, and identity of the currently logged-in administrator" is
the same shape as looking up any admin by id.

Nothing here touches operations.auth_challenges directly. Challenge
generation and verification — creating a token, hashing it, checking
expiry/consumption, resolving which admin it belongs to — is entirely
service logic (see each serializer's NOTE below), and no endpoint returns
raw AuthChallenge rows to a client.
"""
from rest_framework import serializers

from authentication.serializers.users import AdminUserSerializer


class LoginRequestSerializer(serializers.Serializer):
    """
    POST /auth/login body.

    NOTE (business logic) — lives in a service (e.g.
    authentication.services.initiate_login(email)), NOT here:
      - Whether to reveal that a given email doesn't correspond to an
        admin. A plain "email not found" validation error here would let
        an attacker enumerate valid admin addresses — this is a genuine
        security trade-off the service layer has to make deliberately
        (e.g. always returning a generic "if an account exists, a code
        has been sent" response regardless of whether one does), not
        something to default into via a naive serializer validator.
      - Generating the OTP/login-link token, hashing it, setting
        expires_at, and creating the operations.auth_challenges row.
      - Actually sending the email (a Celery task, given the stack).
    """

    email = serializers.EmailField()


class LoginResponseSerializer(serializers.Serializer):
    """
    POST /auth/login response — deliberately minimal and identical
    whether or not `email` actually matched an admin (see
    LoginRequestSerializer's NOTE on enumeration).
    """

    message = serializers.CharField(read_only=True)
    challenge_type = serializers.CharField(read_only=True, required=False)


class VerifyRequestSerializer(serializers.Serializer):
    """
    POST /auth/verify body.

    `token` covers both challenge_types (operations.auth_challenges
    supports 'otp' and 'login_link') — an OTP code and a login-link token
    are both just "the secret string proving this request came from
    whoever received the email," so one field does for both. `email` is
    required regardless of which type it turns out to be: a short numeric
    OTP isn't unique on its own across every outstanding challenge, and
    requiring email either way keeps this serializer from needing to
    guess which challenge_type it's looking at before validating.

    NOTE (business logic) — lives in a service, NOT here:
      - Hashing `token` and looking up a matching, unexpired, unconsumed
        AuthChallenge for `email`.
      - Marking that challenge consumed (`consumed_at`) — single-use only.
      - Creating the operations.admin_sessions row and setting the
        AdminSessionCookie (HttpOnly, Secure) on the response. The raw
        session token is NEVER represented anywhere in this serializer or
        in VerifyResponseSerializer below — it exists only in the
        Set-Cookie header the view sets, never in a JSON body.
    """

    email = serializers.EmailField()
    token = serializers.CharField(max_length=255, trim_whitespace=True)


class VerifyResponseSerializer(serializers.Serializer):
    """
    POST /auth/verify response body. Confirms who the client now is and
    when the new session expires — nothing about the session's token or
    hash appears here (see VerifyRequestSerializer's NOTE); the client
    already has the session via the Set-Cookie header.
    """

    admin = AdminUserSerializer(read_only=True)
    session_expires_at = serializers.DateTimeField(read_only=True)


class SessionStatusSerializer(serializers.Serializer):
    """
    GET /auth/session response.

    Deliberately excludes session_token_hash, ip_address, and user_agent —
    this endpoint tells the caller's own client whether ITS session is
    still good, not a general admin_sessions read endpoint. There's no
    reason to hand back the hash of the very cookie the client is holding,
    or the IP/user-agent it already knows about itself.
    """

    is_active = serializers.BooleanField(read_only=True)
    expires_at = serializers.DateTimeField(read_only=True)
    last_activity_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)