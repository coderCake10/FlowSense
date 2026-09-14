"""
apps/authentication/views/__init__.py

Re-exports every Authentication + Users API view so urls.py can do:

    from authentication.views import LoginView, AdminUserViewSet, ...
"""
from authentication.views.login import LoginView
from authentication.views.logout import LogoutView
from authentication.views.me import MeView
from authentication.views.session import SessionStatusView
from authentication.views.users import AdminUserViewSet
from authentication.views.verify import VerifyView

__all__ = [
    "LoginView",
    "VerifyView",
    "LogoutView",
    "MeView",
    "SessionStatusView",
    "AdminUserViewSet",
]