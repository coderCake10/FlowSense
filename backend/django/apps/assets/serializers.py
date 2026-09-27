"""
Assets API serializers. Shapes only: the latest validation run of each
version is looked up by the view and passed in `context["runs"]`
(version id → ValidationRun), following common.serializers' rule that
serializers don't query.
"""
from django.conf import settings
from rest_framework import serializers

from assets.glb import GLB_MAGIC
from assets.models import Asset, AssetVersion, ValidationCheck, ValidationRun
from map.models import Area

ASSET_TYPES = ["building_model", "area_model"]


def _counts(run):
    checks = list(run.checks.all())
    return {
        "passed": sum(c.status == ValidationCheck.STATUS_PASSED for c in checks),
        "warnings": sum(c.status == ValidationCheck.STATUS_WARNING for c in checks),
        "errors": sum(c.status == ValidationCheck.STATUS_ERROR for c in checks),
    }


class ValidationCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValidationCheck
        fields = ["id", "validation_run_id", "category", "check_name", "status", "message", "created_at"]


class ValidationRunSerializer(serializers.ModelSerializer):
    counts = serializers.SerializerMethodField()
    version = serializers.IntegerField(source="asset_version.version", read_only=True)
    asset_version_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ValidationRun
        fields = ["id", "asset_version_id", "version", "result", "summary", "counts", "validated_by", "created_at"]

    def get_counts(self, run):
        return _counts(run)


class ValidationRunDetailSerializer(ValidationRunSerializer):
    checks = ValidationCheckSerializer(many=True, read_only=True)

    class Meta(ValidationRunSerializer.Meta):
        fields = ValidationRunSerializer.Meta.fields + ["checks"]


class AssetVersionSerializer(serializers.ModelSerializer):
    asset_id = serializers.IntegerField(read_only=True)
    dimension_x = serializers.FloatField(read_only=True)
    dimension_y = serializers.FloatField(read_only=True)
    dimension_z = serializers.FloatField(read_only=True)
    is_active = serializers.SerializerMethodField()
    validation = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = AssetVersion
        fields = [
            "id", "asset_id", "version", "filename", "file_format", "file_size_bytes", "checksum",
            "processing_status", "processing_engine", "processed_at",
            "object_count", "mesh_count", "material_count", "texture_count",
            "vertices_count", "triangles_count", "detected_floor_count", "potential_floor_count",
            "dimension_x", "dimension_y", "dimension_z", "coordinate_unit", "uploaded_by", "created_at",
            "is_active", "validation", "download_url",
        ]

    def get_is_active(self, version):
        return version.asset.active_version_id == version.pk

    def get_validation(self, version):
        run = self.context.get("runs", {}).get(version.pk)
        return None if run is None else ValidationRunSerializer(run).data

    def get_download_url(self, version):
        return download_path(version)


def download_path(version):
    return f"/api/v1/assets/{version.asset_id}/versions/{version.pk}/download"


class AreaRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Area
        fields = ["id", "code", "name"]


class AssetSerializer(serializers.ModelSerializer):
    """The contract's Asset fields (area_id, active_version_id, …) plus, for
    the page, the area's code and name and the active and latest versions."""

    area = AreaRefSerializer(read_only=True)
    active_version = serializers.SerializerMethodField()
    latest_version = serializers.SerializerMethodField()
    version_count = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = [
            "id", "area_id", "name", "description", "source", "notes", "asset_type", "area",
            "active_version_id", "active_version", "latest_version", "version_count",
            "created_by", "updated_by", "created_at", "updated_at",
        ]

    def _versions(self, asset):
        # Prefetched by the view, newest first.
        return list(asset.versions.all())

    def _version(self, version):
        return None if version is None else AssetVersionSerializer(version, context=self.context).data

    def get_active_version(self, asset):
        return self._version(next((v for v in self._versions(asset) if v.pk == asset.active_version_id), None))

    def get_latest_version(self, asset):
        versions = self._versions(asset)
        return self._version(versions[0] if versions else None)

    def get_version_count(self, asset):
        return len(self._versions(asset))


def validate_glb_upload(file):
    if not file.name.lower().endswith(".glb"):
        raise serializers.ValidationError("Upload a .glb file (binary glTF 2.0).")
    if file.size > settings.ASSET_MAX_UPLOAD_BYTES:
        limit = settings.ASSET_MAX_UPLOAD_BYTES // (1024 * 1024)
        raise serializers.ValidationError(f"The file is larger than {limit} MB.")
    head = file.read(4)
    file.seek(0)
    if head != GLB_MAGIC:
        raise serializers.ValidationError("This isn't a .glb file (the glTF header is missing).")
    return file


class _AreaField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        return Area.objects.filter(deleted_at__isnull=True)


class AssetCreateSerializer(serializers.Serializer):
    file = serializers.FileField(validators=[validate_glb_upload])
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    source = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    area_id = _AreaField(required=False, allow_null=True, source="area")
    asset_type = serializers.ChoiceField(choices=ASSET_TYPES, default="building_model")


class AssetUpdateSerializer(serializers.ModelSerializer):
    area_id = _AreaField(required=False, allow_null=True, source="area")

    class Meta:
        model = Asset
        fields = ["name", "description", "source", "notes", "area_id"]
        extra_kwargs = {"name": {"required": False}}


class VersionUploadSerializer(serializers.Serializer):
    file = serializers.FileField(validators=[validate_glb_upload])
