"""
Authentication API: passwordless sign-in end to end (QA-19, QA-20, QA-21),
the first-admin command, and permission defaults.
"""
import re
from io import StringIO
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.core.cache import cache
from django.core.management import CommandError, call_command
from unittest import mock

from django.test import TestCase
from rest_framework.throttling import SimpleRateThrottle

from authentication.models import AdminUser
from common.permissions.admin import ADMIN_SESSION_COOKIE_NAME

API = "/api/v1"


def make_admin(email="admin@auf.edu.ph", role=AdminUser.ROLE_SUPER_ADMIN):
    return AdminUser.objects.create(email=email, full_name="Ada Admin", role=role)


class AuthTestCase(TestCase):
    def setUp(self):
        cache.clear()  # throttle counters

    def request_code(self, email):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(f"{API}/auth/login", {"email": email}, content_type="application/json")

    def sign_in(self, email="admin@auf.edu.ph"):
        self.request_code(email)
        code = re.search(r"login code is: (\d{6})", mail.outbox[-1].body).group(1)
        return self.client.post(
            f"{API}/auth/verify", {"email": email, "token": code}, content_type="application/json"
        )


class PasswordlessSignInTests(AuthTestCase):
    def test_login_emails_a_six_digit_code_and_a_working_link(self):
        make_admin()
        response = self.request_code("admin@auf.edu.ph")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        body = mail.outbox[0].body
        self.assertEqual(mail.outbox[0].to, ["admin@auf.edu.ph"])
        self.assertRegex(body, r"login code is: \d{6}")
        link = re.search(r"(http\S+/auth\?\S+)", body).group(1)
        params = parse_qs(urlparse(link).query)
        self.assertEqual(params["email"], ["admin@auf.edu.ph"])
        # The link token verifies on its own (QA-19).
        verify = self.client.post(
            f"{API}/auth/verify",
            {"email": params["email"][0], "token": params["token"][0]},
            content_type="application/json",
        )
        self.assertEqual(verify.status_code, 200)

    def test_unknown_email_gets_the_same_response_and_no_email(self):
        make_admin()
        known = self.request_code("admin@auf.edu.ph")
        unknown = self.request_code("nobody@auf.edu.ph")
        self.assertEqual(known.status_code, unknown.status_code)
        self.assertEqual(known.json(), unknown.json())
        self.assertEqual(len(mail.outbox), 1)  # only the real admin was emailed

    def test_full_session_lifecycle(self):
        make_admin()
        verify = self.sign_in()
        self.assertEqual(verify.status_code, 200)
        self.assertIn(ADMIN_SESSION_COOKIE_NAME, verify.cookies)
        self.assertTrue(verify.cookies[ADMIN_SESSION_COOKIE_NAME]["httponly"])
        self.assertNotIn("token", str(verify.json()))  # raw token never in the body

        self.assertEqual(self.client.get(f"{API}/auth/session").status_code, 200)
        me = self.client.get(f"{API}/auth/me")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["email"], "admin@auf.edu.ph")

        self.assertEqual(self.client.post(f"{API}/auth/logout").status_code, 204)
        self.assertEqual(self.client.get(f"{API}/auth/me").status_code, 401)

    def test_wrong_code_is_rejected(self):
        make_admin()
        self.request_code("admin@auf.edu.ph")
        response = self.client.post(
            f"{API}/auth/verify", {"email": "admin@auf.edu.ph", "token": "000000"}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 401)

    def test_code_is_single_use(self):
        make_admin()
        self.request_code("admin@auf.edu.ph")
        code = re.search(r"login code is: (\d{6})", mail.outbox[-1].body).group(1)
        payload = {"email": "admin@auf.edu.ph", "token": code}
        self.assertEqual(self.client.post(f"{API}/auth/verify", payload, content_type="application/json").status_code, 200)
        self.assertEqual(self.client.post(f"{API}/auth/verify", payload, content_type="application/json").status_code, 401)

    def test_disabled_admin_cannot_use_an_existing_session(self):
        admin = make_admin()
        self.sign_in()
        AdminUser.objects.filter(pk=admin.pk).update(is_active=False)
        self.assertEqual(self.client.get(f"{API}/auth/me").status_code, 403)


# DRF copies DEFAULT_THROTTLE_RATES onto the class at import time, so
# override_settings can't change them; patch the class attribute instead.
@mock.patch.object(
    SimpleRateThrottle,
    "THROTTLE_RATES",
    {"auth_login": "3/min", "auth_verify": "100/min", "auth_verify_email": "4/hour"},
)
class ThrottleTests(AuthTestCase):
    """QA-20: sign-in is rate limited per IP and per target email."""

    def test_login_is_limited_per_ip(self):
        codes = [self.request_code(f"user{i}@auf.edu.ph").status_code for i in range(4)]
        self.assertEqual(codes, [200, 200, 200, 429])

    def test_verify_is_limited_per_email_across_ips(self):
        make_admin()
        payload = {"email": "admin@auf.edu.ph", "token": "123456"}
        statuses = [
            self.client.post(
                f"{API}/auth/verify", payload, content_type="application/json", REMOTE_ADDR=f"10.0.0.{i}"
            ).status_code
            for i in range(5)
        ]
        self.assertEqual(statuses, [401, 401, 401, 401, 429])


class UsersApiTests(AuthTestCase):
    def test_users_requires_a_super_admin(self):
        self.assertEqual(self.client.get(f"{API}/users").status_code, 401)
        make_admin(role=AdminUser.ROLE_ADMIN)
        self.sign_in()
        self.assertEqual(self.client.get(f"{API}/users").status_code, 403)

    def test_super_admin_creates_an_admin_who_gets_a_welcome_email(self):
        make_admin()
        self.sign_in()
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                f"{API}/users",
                {"email": "staff@auf.edu.ph", "full_name": "Sam Staff", "role": "admin"},
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(mail.outbox[0].to, ["staff@auf.edu.ph"])
        self.assertIn("/auth", mail.outbox[0].body)


class CreateAdminCommandTests(TestCase):
    def test_creates_the_first_super_admin(self):
        out = StringIO()
        with self.captureOnCommitCallbacks(execute=True):
            call_command("create_admin", email=" Head@AUF.edu.ph ", name="Head Admin", role="super admin", stdout=out)
        admin = AdminUser.objects.get()
        self.assertEqual(admin.email, "head@auf.edu.ph")
        self.assertEqual(admin.role, AdminUser.ROLE_SUPER_ADMIN)
        self.assertIn("Created", out.getvalue())

    def test_rejects_a_duplicate_email(self):
        make_admin()
        with self.assertRaises(CommandError):
            call_command("create_admin", email="admin@auf.edu.ph", name="Again", stdout=StringIO())
