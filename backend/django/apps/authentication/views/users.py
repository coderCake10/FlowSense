"""
apps/authentication/views/users.py

Backs the Users API:
  GET    /api/v1/users
  POST   /api/v1/users
  GET    /api/v1/users/{id}
  PATCH  /api/v1/users/{id}
  DELETE /api/v1/users/{id}

Textbook CRUD-on-a-resource, unlike every Authentication API endpoint in
this app (see login.py's docstring for that contrast) — AdminUser
instances ARE identified by a URL id, so a ViewSet is the right tool.

Admin-only, and specifically SUPER-admin-only: IsSuperAdminUser, not the
plain IsAdminUser used everywhere else in this app. Per the Admin User
Management notes, User Management is "only accessible by super admins."
"""
from rest_framework import mixins, status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from authentication import services
from authentication.models import AdminUser
from authentication.serializers import (
    AdminUserCreateSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
)
from common.permissions import IsSuperAdminUser
from common.pagination import StandardPagination


class SelfLockoutConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "self_lockout"
    default_detail = "This action would lock you out of your own account."


class LastSuperAdminConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "last_super_admin"
    default_detail = "This action would remove the last remaining super admin."


class AdminUserViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    pagination_class = StandardPagination
    # PATCH only, no PUT — matches the API design (and
    # AdminUserUpdateSerializer's field set, which is already the full
    # editable surface; a PUT-style full replace wouldn't mean anything
    # different).
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    permission_classes = [IsSuperAdminUser]

    def get_queryset(self):
        return AdminUser.objects.filter(deleted_at__isnull=True).order_by("full_name")

    def get_serializer_class(self):
        if self.action == "create":
            return AdminUserCreateSerializer
        if self.action in ("update", "partial_update"):
            return AdminUserUpdateSerializer
        return AdminUserSerializer

    def create(self, request, *args, **kwargs):
        input_serializer = self.get_serializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        admin_user = services.create_admin_user(
            validated_data=input_serializer.validated_data, actor=request.admin_user
        )

        output_serializer = AdminUserSerializer(admin_user)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        input_serializer = self.get_serializer(instance, data=request.data, partial=True)
        input_serializer.is_valid(raise_exception=True)

        try:
            admin_user = services.update_admin_user(
                instance,
                validated_data=input_serializer.validated_data,
                actor=request.admin_user,
            )
        except services.SelfLockoutError as exc:
            raise SelfLockoutConflict(str(exc))
        except services.LastSuperAdminError as exc:
            raise LastSuperAdminConflict(str(exc))

        output_serializer = AdminUserSerializer(admin_user)
        return Response(output_serializer.data)

    partial_update = update

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            services.delete_admin_user(instance, actor=request.admin_user)
        except services.SelfLockoutError as exc:
            raise SelfLockoutConflict(str(exc))
        except services.LastSuperAdminError as exc:
            raise LastSuperAdminConflict(str(exc))
        return Response(status=status.HTTP_204_NO_CONTENT)