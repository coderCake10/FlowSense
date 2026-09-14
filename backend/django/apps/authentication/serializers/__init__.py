"""
apps/authentication/serializers/__init__.py

Re-exports every Authentication + Users API serializer so views can do:

    from authentication.serializers import LoginRequestSerializer, AdminUserSerializer, ...
"""
from authentication.serializers.auth import (
    LoginRequestSerializer,
    LoginResponseSerializer,
    SessionStatusSerializer,
    VerifyRequestSerializer,
    VerifyResponseSerializer,
)
from authentication.serializers.users import (
    AdminUserCreateSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
)

__all__ = [
    "LoginRequestSerializer",
    "LoginResponseSerializer",
    "VerifyRequestSerializer",
    "VerifyResponseSerializer",
    "SessionStatusSerializer",
    "AdminUserSerializer",
    "AdminUserCreateSerializer",
    "AdminUserUpdateSerializer",
]