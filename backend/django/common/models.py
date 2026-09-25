"""
common/models.py

Owns: operations.settings, operations.semesters
(architecture-notes-main/06 Database/01 Final Database Schema.md).

The API design places the Settings API under "common/settings" and the System
API under "common/system", so the tables live in `common` with those APIs.
"""
from django.db import models
from django.db.models import F, Q

from authentication.models import AdminUser


class Setting(models.Model):
    """operations.settings: global key/value configuration (JSONB values)."""

    key = models.CharField(max_length=100, primary_key=True)
    value = models.JSONField()
    description = models.TextField(null=True, blank=True)
    updated_by = models.ForeignKey(
        AdminUser,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_column="updated_by",
        related_name="+",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = '"operations"."settings"'

    def __str__(self):
        return self.key


class Semester(models.Model):
    """operations.semesters: academic terms, used to group analytics."""

    academic_year = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = '"operations"."semesters"'
        ordering = ["-start_date"]
        constraints = [
            models.CheckConstraint(
                condition=Q(start_date__lte=F("end_date")), name="chk_semesters_date_range"
            ),
        ]

    def __str__(self):
        return f"{self.academic_year} {self.name}"
