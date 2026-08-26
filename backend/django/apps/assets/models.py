"""
apps/assets/models.py

Owns: 
assets.assets, 
assets.asset_versions, 
assets.validation_runs,
assets.validation_checks

Also referenced by: 
analytics (Activity API surfaces asset/version/validation events by joining through analytics.AuditEvent.entity_type == 'asset' etc.),
system (asset/version counts for status page)
"""
from django.db import models

from map.models import Area


class Asset(models.Model):
    id = models.BigAutoField(primary_key=True)
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assets",
        db_column="area_id",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    source = models.CharField(max_length=255, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    asset_type = models.CharField(max_length=50, default="building_model")
    active_version = models.ForeignKey(
        "AssetVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="active_for_assets",
        db_column="active_version_id",
    )
    # No REFERENCES clause in the SQL schema for these two columns — kept as
    # plain BigIntegerFields rather than FKs to operations.admin_users to stay
    # faithful to the schema as written.
    created_by = models.BigIntegerField(null=True, blank=True)
    updated_by = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"assets"."assets"'

    def __str__(self):
        return self.name


class AssetVersion(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    PROCESSING_STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]

    id = models.BigAutoField(primary_key=True)
    asset = models.ForeignKey(
        Asset, on_delete=models.CASCADE, related_name="versions", db_column="asset_id"
    )
    version = models.IntegerField()
    filename = models.CharField(max_length=255)
    storage_path = models.TextField()
    file_format = models.CharField(max_length=20)
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    checksum = models.CharField(max_length=128, null=True, blank=True)
    processing_status = models.CharField(
        max_length=30, choices=PROCESSING_STATUS_CHOICES, default=STATUS_PENDING
    )
    object_count = models.IntegerField(null=True, blank=True)
    mesh_count = models.IntegerField(null=True, blank=True)
    material_count = models.IntegerField(null=True, blank=True)
    texture_count = models.IntegerField(null=True, blank=True)
    detected_floor_count = models.IntegerField(null=True, blank=True)
    potential_floor_count = models.IntegerField(null=True, blank=True)
    vertices_count = models.BigIntegerField(null=True, blank=True)
    triangles_count = models.BigIntegerField(null=True, blank=True)
    dimension_x = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    dimension_y = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    dimension_z = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    coordinate_unit = models.CharField(max_length=50, null=True, blank=True)
    processing_engine = models.CharField(max_length=100, null=True, blank=True)
    # No REFERENCES clause in SQL — see Asset.created_by note above.
    uploaded_by = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"assets"."asset_versions"'
        constraints = [
            models.UniqueConstraint(fields=["asset", "version"], name="asset_versions_asset_version_uq"),
        ]

    def __str__(self):
        return f"{self.asset.name} v{self.version}"


class ValidationRun(models.Model):
    RESULT_PASSED = "passed"
    RESULT_WARNING = "warning"
    RESULT_FAILED = "failed"
    RESULT_CHOICES = [
        (RESULT_PASSED, "Passed"),
        (RESULT_WARNING, "Warning"),
        (RESULT_FAILED, "Failed"),
    ]

    id = models.BigAutoField(primary_key=True)
    asset_version = models.ForeignKey(
        AssetVersion,
        on_delete=models.CASCADE,
        related_name="validation_runs",
        db_column="asset_version_id",
    )
    # No REFERENCES clause in SQL — see Asset.created_by note above.
    validated_by = models.BigIntegerField(null=True, blank=True)
    result = models.CharField(max_length=20, choices=RESULT_CHOICES)
    summary = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = '"assets"."validation_runs"'

    def __str__(self):
        return f"Validation run #{self.pk} ({self.result})"


class ValidationCheck(models.Model):
    CATEGORY_FILE_AND_FORMAT = "file_and_format"
    CATEGORY_MODEL_AND_GEOMETRY = "model_and_geometry"
    CATEGORY_HIERARCHY_AND_FLOOR_STRUCTURE = "hierarchy_and_floor_structure"
    CATEGORY_FLOORS_AND_SPATIAL_CONFIGURATION = "floors_and_spatial_configuration"
    CATEGORY_FLOWSENSE_COMPATIBILITY = "flowsense_compatibility"
    CATEGORY_CHOICES = [
        (CATEGORY_FILE_AND_FORMAT, "File & Format"),
        (CATEGORY_MODEL_AND_GEOMETRY, "Model & Geometry"),
        (CATEGORY_HIERARCHY_AND_FLOOR_STRUCTURE, "Hierarchy & Floor Structure"),
        (CATEGORY_FLOORS_AND_SPATIAL_CONFIGURATION, "Floors & Spatial Configuration"),
        (CATEGORY_FLOWSENSE_COMPATIBILITY, "FlowSense Compatibility"),
    ]

    STATUS_PASSED = "passed"
    STATUS_WARNING = "warning"
    STATUS_ERROR = "error"
    STATUS_CHOICES = [
        (STATUS_PASSED, "Passed"),
        (STATUS_WARNING, "Warning"),
        (STATUS_ERROR, "Error"),
    ]

    id = models.BigAutoField(primary_key=True)
    validation_run = models.ForeignKey(
        ValidationRun, on_delete=models.CASCADE, related_name="checks", db_column="validation_run_id"
    )
    category = models.CharField(max_length=60, choices=CATEGORY_CHOICES)
    check_name = models.CharField(max_length=150)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    message = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = '"assets"."validation_checks"'

    def __str__(self):
        return f"{self.check_name} ({self.status})"


class AssetAuditHistory(models.Model):
    """
    Read-only mapping of the `assets.asset_audit_history` VIEW (a filtered
    projection of analytics.audit_events for entity_type IN
    ('asset', 'asset_version', 'asset_validation')). Unmanaged — Django will
    never try to create/alter/drop this as a table.
    """

    id = models.BigIntegerField(primary_key=True)
    created_at = models.DateTimeField()
    admin_user_id = models.BigIntegerField(null=True, blank=True)
    action = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    metadata = models.JSONField(default=dict)

    class Meta:
        db_table = '"assets"."asset_audit_history"'
        managed = False

    def __str__(self):
        return f"Audit #{self.id}"