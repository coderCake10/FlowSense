"""
Creates a FlowSense administrator from the command line.

Admin sign-in is passwordless and POST /api/v1/users needs a super-admin
session, so the very first administrator has to be created here:

    python manage.py create_admin --email head@auf.edu.ph --name "Juan dela Cruz" --role "super admin"

Uses the Users API serializer and service, so the same validation, audit
event, and welcome email apply.
"""
from django.core.management.base import BaseCommand, CommandError

from authentication import services
from authentication.models import AdminUser
from authentication.serializers import AdminUserCreateSerializer


class Command(BaseCommand):
    help = "Create an administrator account (use --role 'super admin' for the first one)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--name", required=True, help="Full name")
        parser.add_argument(
            "--role",
            default=AdminUser.ROLE_ADMIN,
            choices=[choice for choice, _ in AdminUser.ROLE_CHOICES],
        )

    def handle(self, *args, **options):
        serializer = AdminUserCreateSerializer(
            data={
                "email": options["email"].strip().lower(),
                "full_name": options["name"],
                "role": options["role"],
            }
        )
        if not serializer.is_valid():
            raise CommandError(f"Invalid administrator: {serializer.errors}")
        admin = services.create_admin_user(validated_data=serializer.validated_data)
        self.stdout.write(
            self.style.SUCCESS(f"Created {admin.get_role_display()} {admin.email} (id {admin.id}).")
        )
