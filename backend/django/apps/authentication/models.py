"""
apps/authentication/models.py

Owns: 
operations.admin_users, 
operations.auth_challenges, 
operations.admin_sessions

Also referenced by: 
assets (created_by/updated_by are plain BigIntegerFields, not FKs — see README), 
analytics (Alert.acknowledged_by, AuditEvent.admin_user),
settings (Setting.updated_by)
"""
import uuid

from django.db import models


class AdminUser(models.Model):
    ROLE_ADMIN = "admin"
    ROLE_SUPER_ADMIN = "super admin"
    ROLE_CHOICES = [
        (ROLE_ADMIN, "Admin"),
        (ROLE_SUPER_ADMIN, "Super Admin"),
    ]

    id = models.BigAutoField(primary_key=True)
    email = models.CharField(max_length=255, unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default=ROLE_ADMIN)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"operations"."admin_users"'
        verbose_name = "Admin User"
        verbose_name_plural = "Admin Users"

    def __str__(self):
        return f"{self.full_name} <{self.email}>"


class AuthChallenge(models.Model):
    CHALLENGE_OTP = "otp"
    CHALLENGE_LOGIN_LINK = "login_link"
    CHALLENGE_TYPE_CHOICES = [
        (CHALLENGE_OTP, "OTP"),
        (CHALLENGE_LOGIN_LINK, "Login Link"),
    ]

    id = models.BigAutoField(primary_key=True)
    admin_user = models.ForeignKey(
        AdminUser,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="auth_challenges",
        db_column="admin_user_id",
    )
    challenge_type = models.CharField(max_length=20, choices=CHALLENGE_TYPE_CHOICES)
    token_hash = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = '"operations"."auth_challenges"'
        indexes = [
            models.Index(fields=["expires_at"], name="idx_auth_challenges_expires"),
        ]

    def __str__(self):
        return f"{self.challenge_type} challenge for {self.admin_user_id}"


class AdminSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admin_user = models.ForeignKey(
        AdminUser,
        on_delete=models.CASCADE,
        related_name="admin_sessions",
        db_column="admin_user_id",
    )
    session_token_hash = models.CharField(max_length=255, unique=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = '"operations"."admin_sessions"'
        indexes = [
            models.Index(fields=["admin_user"], name="idx_admin_sessions_user"),
            models.Index(fields=["session_token_hash"], name="idx_admin_sessions_token"),
        ]

    def __str__(self):
        return f"Session for {self.admin_user_id} (active={self.is_active})"