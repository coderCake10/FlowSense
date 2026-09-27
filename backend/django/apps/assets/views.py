"""
Assets API (07 API Design, "Assets API"): building model uploads, versions,
validation, processing status, activation and restore.

Admin only, except downloading the *active* version of an asset: the kiosk,
the attract screen and phones load the live building model from there.
"""
from pathlib import Path

from django.db.models import Prefetch
from django.http import FileResponse, Http404, HttpResponseNotModified
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from analytics import audit
from analytics.models import AuditEvent
from assets import glb, services
from assets.models import Asset, AssetVersion, ValidationRun
from assets.serializers import (
    AssetCreateSerializer,
    AssetSerializer,
    AssetUpdateSerializer,
    AssetVersionSerializer,
    ValidationCheckSerializer,
    ValidationRunDetailSerializer,
    ValidationRunSerializer,
    VersionUploadSerializer,
)
from common.pagination import StandardPagination
from common.permissions import IsAdminUser

VERSION = r"versions/(?P<version_id>\d+)"


def _conflict(error):
    return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)


def _latest_runs(versions):
    """version id → latest ValidationRun, with checks prefetched."""
    runs = {}
    for run in (
        ValidationRun.objects.filter(asset_version__in=list(versions))
        .select_related("asset_version")
        .prefetch_related("checks")
        .order_by("asset_version_id", "-created_at", "-id")
    ):
        runs.setdefault(run.asset_version_id, run)
    return runs


class AssetViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    GET    /assets                                          list
    POST   /assets                                          upload a new asset (multipart)
    GET    /assets/{id}                                     metadata, processing, validation
    PATCH  /assets/{id}                                     name, description, source, notes, area
    DELETE /assets/{id}                                     delete (soft)
    GET    /assets/{id}/versions                            version history
    POST   /assets/{id}/versions                            upload a new version (multipart)
    GET    /assets/{id}/versions/{vid}                      version details and model structure
    GET    /assets/{id}/versions/{vid}/download             the .glb file
    GET    /assets/{id}/validation                          latest validation of the latest version
    GET    /assets/{id}/versions/{vid}/validation           validation history of a version
    POST   /assets/{id}/versions/{vid}/validation           run validation again
    GET    /assets/{id}/versions/{vid}/validation/checks    checks of the latest run
    GET    /assets/{id}/processing                          processing state of the latest version
    POST   /assets/{id}/activate                            make a version active ({"version_id"}, default latest)
    POST   /assets/{id}/versions/{vid}/restore              make an earlier version active
    POST   /assets/{id}/deactivate                          take the live version offline (additive)
    """

    pagination_class = StandardPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action == "download":
            return [AllowAny()]  # checked in download(): only the active version is public
        return [IsAdminUser()]

    def get_queryset(self):
        queryset = (
            Asset.objects.filter(deleted_at__isnull=True)
            .select_related("area")
            .prefetch_related(Prefetch("versions", queryset=AssetVersion.objects.select_related("asset").order_by("-version")))
            .order_by("name", "id")
        )
        params = self.request.query_params
        if params.get("area_id"):
            queryset = queryset.filter(area_id=params["area_id"])
        if params.get("asset_type"):
            queryset = queryset.filter(asset_type=params["asset_type"])
        if params.get("search"):
            queryset = queryset.filter(name__icontains=params["search"])
        return queryset

    def get_serializer_class(self):
        return AssetSerializer

    def _asset_data(self, asset):
        runs = _latest_runs(asset.versions.all())
        return AssetSerializer(asset, context={"runs": runs}).data

    def _fresh(self, pk):
        return self.get_queryset().get(pk=pk)

    def _version(self, asset, version_id):
        version = AssetVersion.objects.select_related("asset__area").filter(asset=asset, pk=version_id).first()
        if version is None:
            raise Http404
        return version

    # Assets ------------------------------------------------------------------

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        versions = [v for asset in page for v in asset.versions.all()]
        runs = _latest_runs(versions)
        data = AssetSerializer(page, many=True, context={"runs": runs}).data
        return self.get_paginated_response(data)

    def retrieve(self, request, pk=None):
        return Response(self._asset_data(self.get_object()))

    def create(self, request):
        serializer = AssetCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        upload = data["file"]
        admin_id = request.admin_user.pk
        asset = Asset.objects.create(
            name=(data.get("name") or Path(upload.name).stem)[:255],
            description=data.get("description") or None,
            source=data.get("source") or None,
            notes=data.get("notes") or None,
            area=data.get("area"),
            asset_type=data["asset_type"],
            created_by=admin_id,
            updated_by=admin_id,
        )
        version = services.add_version(asset, upload, admin_id)
        audit.record(request, AuditEvent.TYPE_ASSET, AuditEvent.ACTION_UPLOAD, asset,
                     f"Uploaded {asset.name} ({version.filename})",
                     {"version": version.version, "size": version.file_size_bytes}, entity_type="asset")
        return Response(self._asset_data(self._fresh(asset.pk)), status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        asset = self.get_object()
        serializer = AssetUpdateSerializer(asset, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.admin_user.pk)
        audit.record(request, AuditEvent.TYPE_ASSET, AuditEvent.ACTION_UPDATE, asset,
                     f"Edited {asset.name}'s details",
                     {"fields": sorted(serializer.validated_data.keys())}, entity_type="asset")
        return Response(self._asset_data(self._fresh(asset.pk)))

    def destroy(self, request, pk=None):
        asset = self.get_object()
        asset.deleted_at = timezone.now()
        asset.active_version = None
        asset.updated_by = request.admin_user.pk
        asset.save(update_fields=["deleted_at", "active_version", "updated_by", "updated_at"])
        audit.record(request, AuditEvent.TYPE_ASSET, AuditEvent.ACTION_DELETE, asset,
                     f"Deleted {asset.name}", entity_type="asset")
        return Response(status=status.HTTP_204_NO_CONTENT)

    # Versions ----------------------------------------------------------------

    @action(detail=True, methods=["get", "post"])
    def versions(self, request, pk=None):
        asset = self.get_object()
        if request.method == "POST":
            serializer = VersionUploadSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            version = services.add_version(asset, serializer.validated_data["file"], request.admin_user.pk)
            audit.record(request, AuditEvent.TYPE_ASSET, AuditEvent.ACTION_REPLACE, version,
                         f"Uploaded {asset.name} v{version.version} ({version.filename})",
                         {"asset_id": asset.pk, "version": version.version}, entity_type="asset_version")
            version.refresh_from_db()
            return Response(AssetVersionSerializer(version, context={"runs": _latest_runs([version])}).data,
                            status=status.HTTP_201_CREATED)
        versions = list(asset.versions.all())
        return Response(AssetVersionSerializer(versions, many=True, context={"runs": _latest_runs(versions)}).data)

    @action(detail=True, methods=["get"], url_path=VERSION)
    def version_detail(self, request, pk=None, version_id=None):
        """Version details plus the model's structure (floors, exterior…),
        read from the file on request."""
        asset = self.get_object()
        version = self._version(asset, version_id)
        data = dict(AssetVersionSerializer(version, context={"runs": _latest_runs([version])}).data)
        try:
            report = services.inspect_version(version)
        except (OSError, glb.GlbError, KeyError, IndexError, TypeError, ValueError):
            data["structure"] = None
        else:
            structure = report.as_dict()
            structure["floor_changes"] = (
                services.floor_changes(asset.area, report) if asset.area_id and asset.asset_type == "building_model" else []
            )
            data["structure"] = structure
        return Response(data)

    @action(detail=True, methods=["get"], url_path=VERSION + "/download")
    def download(self, request, pk=None, version_id=None):
        asset = Asset.objects.filter(pk=pk, deleted_at__isnull=True).first()
        if asset is None:
            raise Http404
        version = self._version(asset, version_id)
        if asset.active_version_id != version.pk:
            IsAdminUser().has_permission(request, self)  # raises 401/403
        path = services.absolute_path(version)
        if not path.is_file():
            raise Http404
        if request.headers.get("If-None-Match") == f'"{version.checksum}"':
            return HttpResponseNotModified()
        response = FileResponse(open(path, "rb"), content_type="model/gltf-binary", filename=version.filename)
        response["ETag"] = f'"{version.checksum}"'
        response["Cache-Control"] = "no-cache"
        return response

    # Validation --------------------------------------------------------------

    @action(detail=True, methods=["get"])
    def validation(self, request, pk=None):
        """The latest validation of each version, newest version first; the
        first entry is the asset's current validation status."""
        asset = self.get_object()
        versions = list(asset.versions.all())
        runs = _latest_runs(versions)
        latest = [runs[v.pk] for v in versions if v.pk in runs]
        return Response(ValidationRunSerializer(latest, many=True).data)

    @action(detail=True, methods=["get", "post"], url_path=VERSION + "/validation")
    def version_validation(self, request, pk=None, version_id=None):
        asset = self.get_object()
        version = self._version(asset, version_id)
        if request.method == "POST":
            if version.processing_status != AssetVersion.STATUS_COMPLETED:
                return _conflict(services.AssetStateError("This version hasn't finished processing."))
            run = services.validate_version(version, request.admin_user.pk)
            audit.record(request, AuditEvent.TYPE_VALIDATION, AuditEvent.ACTION_VALIDATE, run,
                         f"Validated {asset.name} v{version.version}: {run.result}",
                         {"asset_id": asset.pk, "version": version.version, "summary": run.summary},
                         entity_type="asset_validation")
            run = ValidationRun.objects.select_related("asset_version").prefetch_related("checks").get(pk=run.pk)
            # 202 as in the contract; validation runs inline, so the result is final.
            return Response(ValidationRunDetailSerializer(run).data, status=status.HTTP_202_ACCEPTED)
        runs = (version.validation_runs.select_related("asset_version").prefetch_related("checks")
                .order_by("-created_at", "-id"))
        return Response(ValidationRunSerializer(runs, many=True).data)

    @action(detail=True, methods=["get"], url_path=VERSION + "/validation/checks")
    def validation_checks(self, request, pk=None, version_id=None):
        asset = self.get_object()
        version = self._version(asset, version_id)
        run = services.latest_run(version)
        checks = [] if run is None else run.checks.order_by("id")
        if run is not None:
            for field in ("category", "status"):
                if request.query_params.get(field):
                    checks = checks.filter(**{field: request.query_params[field]})
        return Response(ValidationCheckSerializer(checks, many=True).data)

    @action(detail=True, methods=["get"])
    def processing(self, request, pk=None):
        asset = self.get_object()
        latest = next(iter(asset.versions.all()), None)
        if latest is None:
            return Response(None)
        return Response({
            "asset_version_id": latest.pk,
            "version": latest.version,
            "processing_status": latest.processing_status,
            "processing_engine": latest.processing_engine,
            "processed_at": latest.processed_at,
            "complete": latest.processing_status in (AssetVersion.STATUS_COMPLETED, AssetVersion.STATUS_FAILED),
        })

    # Activation --------------------------------------------------------------

    def _activate(self, request, asset, version, restore=False):
        try:
            result = services.activate(version, request, restore=restore)
        except services.AssetStateError as error:
            return _conflict(error)
        data = self._asset_data(self._fresh(asset.pk))
        data.update(result)
        return Response(data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        asset = self.get_object()
        version_id = request.data.get("version_id") if hasattr(request.data, "get") else None
        version = (self._version(asset, version_id) if version_id
                   else next(iter(asset.versions.all()), None))
        if version is None:
            return _conflict(services.AssetStateError("This asset has no uploaded version."))
        return self._activate(request, asset, version)

    @action(detail=True, methods=["post"], url_path=VERSION + "/restore")
    def restore(self, request, pk=None, version_id=None):
        asset = self.get_object()
        version = self._version(asset, version_id)
        return self._activate(request, asset, version, restore=True)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        asset = self.get_object()
        try:
            services.deactivate(asset, request)
        except services.AssetStateError as error:
            return _conflict(error)
        return Response(self._asset_data(self._fresh(asset.pk)))
