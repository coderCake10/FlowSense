"""
apps/authentication/urls.py

Wires up BOTH the Authentication API and the Users API — they're the same
Django app (per 00 API Design.md, both list "Django Application:
authentication") but sit at two different top-level path prefixes
(/api/v1/auth/... and /api/v1/users...). Unlike every other app's
urls.py so far (each mounted at a single prefix matching its own app
name), this one is expected to be included at the bare /api/v1/ root in
config/urls.py — NOT pre-prefixed with /api/v1/authentication/ — since
neither /auth nor /users starts with "authentication".

  auth/login/    -> LoginView          (POST)
  auth/verify/    -> VerifyView          (POST)
  auth/logout/     -> LogoutView          (POST)
  auth/me/          -> MeView              (GET)
  auth/session/      -> SessionStatusView   (GET)
  users/              -> AdminUserViewSet    (GET, POST)
  users/{id}/          -> AdminUserViewSet    (GET, PATCH, DELETE)
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from authentication.views import (
    AdminUserViewSet,
    LoginView,
    LogoutView,
    MeView,
    SessionStatusView,
    VerifyView,
)

router = DefaultRouter(trailing_slash=True)
router.register("users", AdminUserViewSet, basename="admin-user")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/verify/", VerifyView.as_view(), name="auth-verify"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("auth/session/", SessionStatusView.as_view(), name="auth-session"),
] + router.urls