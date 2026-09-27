"""
apps/analytics/views.py

Alerts API   /api/v1/alerts, /alerts/{id}, /alerts/{id}/acknowledge, /alerts/{id}/clear
Activity API /api/v1/activity, /activity/{id}
Analytics    /api/v1/analytics/dashboard, /navigation, /search, /kiosks, /sensors,
             /spatial, /system, /activity, /qr, /qr/events (?range=, see ranges.py)
Reports      /api/v1/analytics/reports, /analytics/reports/{id} (see reports.py)
All admin only (the project's default permission).
"""
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics import audit, dashboard, metrics, reports
from analytics.models import Alert, AuditEvent, QrEvent, Report
from analytics.ranges import parse_range
from analytics.serializers import (
    AlertSerializer,
    AuditEventSerializer,
    ReportDetailSerializer,
    ReportRequestSerializer,
    ReportSerializer,
)
from common.pagination import StandardPagination


def _date_filter(queryset, params, field):
    for param, lookup in (("from", f"{field}__gte"), ("to", f"{field}__lte")):
        if params.get(param):
            moment = parse_datetime(params[param])
            if moment is None:
                raise ValidationError({param: "Use an ISO 8601 date and time."})
            queryset = queryset.filter(**{lookup: moment})
    return queryset


class AlertViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """?state=active (default: active and acknowledged) | acknowledged | cleared | all; ?severity="""

    serializer_class = AlertSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = Alert.objects.select_related("acknowledged_by").order_by("-created_at")
        if self.action != "list":
            return queryset
        params = self.request.query_params
        state = params.get("state", "open")
        if state == "open":
            queryset = queryset.filter(cleared_at__isnull=True)
        elif state == "active":
            queryset = queryset.filter(cleared_at__isnull=True, acknowledged_at__isnull=True)
        elif state == "acknowledged":
            queryset = queryset.filter(cleared_at__isnull=True, acknowledged_at__isnull=False)
        elif state == "cleared":
            queryset = queryset.filter(cleared_at__isnull=False)
        elif state != "all":
            raise ValidationError({"state": "Use open, active, acknowledged, cleared, or all."})
        if params.get("severity"):
            queryset = queryset.filter(severity=params["severity"])
        return _date_filter(queryset, params, "created_at")

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        if alert.cleared_at:
            return Response({"detail": "The alert is already cleared."}, status=status.HTTP_409_CONFLICT)
        if not alert.acknowledged_at:
            alert.acknowledged_at = timezone.now()
            alert.acknowledged_by = request.admin_user
            alert.save(update_fields=["acknowledged_at", "acknowledged_by"])
        return Response(AlertSerializer(alert).data)

    @action(detail=True, methods=["post"])
    def clear(self, request, pk=None):
        alert = self.get_object()
        if not alert.cleared_at:
            alert.cleared_at = timezone.now()
            if not alert.acknowledged_at:
                alert.acknowledged_at = alert.cleared_at
                alert.acknowledged_by = request.admin_user
            alert.save(update_fields=["cleared_at", "acknowledged_at", "acknowledged_by"])
            audit.record(request, AuditEvent.TYPE_ADMINISTRATIVE, AuditEvent.ACTION_UPDATE, alert,
                         f"Cleared alert: {alert.title}")
        return Response(AlertSerializer(alert).data)


class ActivityViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Audit trail, newest first. ?event_type=, ?action=, ?admin_user=, ?entity_type=, ?from=, ?to=
    event_type, action and entity_type accept a comma-separated list."""

    serializer_class = AuditEventSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = AuditEvent.objects.select_related("admin_user").order_by("-created_at")
        params = self.request.query_params
        for param in ("event_type", "action", "entity_type"):
            if params.get(param):
                queryset = queryset.filter(**{f"{param}__in": params[param].split(",")})
        if params.get("admin_user"):
            queryset = queryset.filter(admin_user_id=params["admin_user"])
        return _date_filter(queryset, params, "created_at")


class DashboardView(APIView):
    """GET /api/v1/analytics/dashboard: everything the Admin Dashboard landing page shows."""

    def get(self, request):
        return Response(dashboard.build())


class _RangeView(APIView):
    """GET with ?range= (AnalyticsDateRangeParam); `metric` computes the body."""

    metric = None

    def get(self, request):
        return Response(self.compute(parse_range(request.query_params), request.query_params))

    def compute(self, date_range, params):
        return type(self).metric(date_range)


def _place(params):
    """?area_id= (building) and ?floor_id= filters (OpenAPI AreaIdFilter, FloorIdFilter)."""
    return {"area_id": params.get("area_id") or None, "floor_id": params.get("floor_id") or None}


class NavigationAnalyticsView(_RangeView):
    def compute(self, date_range, params):
        return metrics.navigation(date_range, **_place(params))


class SearchAnalyticsView(_RangeView):
    metric = metrics.search


class KioskAnalyticsView(_RangeView):
    def compute(self, date_range, params):
        return metrics.kiosks(date_range, kiosk_id=params.get("kiosk_id"))


class SensorAnalyticsView(_RangeView):
    def compute(self, date_range, params):
        return metrics.sensors(date_range, **_place(params))


class SpatialAnalyticsView(_RangeView):
    def compute(self, date_range, params):
        return metrics.spatial(date_range, **_place(params))


class SystemAnalyticsView(_RangeView):
    metric = metrics.system


class ActivityAnalyticsView(_RangeView):
    metric = metrics.activity


class QrAnalyticsView(_RangeView):
    metric = metrics.qr


class QrEventListView(APIView):
    """GET /analytics/qr/events: individual QR handoff events, newest first (paginated)."""

    def get(self, request):
        date_range = parse_range(request.query_params)
        events = QrEvent.objects.filter(
            created_at__gte=date_range.start, created_at__lte=date_range.end
        ).order_by("-created_at")
        paginator = StandardPagination()
        page = paginator.paginate_queryset(events, request, view=self)
        return paginator.get_paginated_response([
            {"id": e.id, "navigation_session_id": e.navigation_session_id, "event_type": e.event_type,
             "created_at": e.created_at}
            for e in page
        ])


class ReportViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    GET  /analytics/reports                    generated reports, newest first
    POST /analytics/reports                    generate one (Celery); poll GET /{id} until completed
    GET  /analytics/reports/{id}               the report with its snapshot (for the printable page)
    GET  /analytics/reports/{id}?download=csv  the snapshot as a ZIP of CSV files
    """

    pagination_class = StandardPagination
    queryset = Report.objects.select_related("generated_by").order_by("-created_at", "-id")

    def get_serializer_class(self):
        return ReportSerializer if self.action == "list" else ReportDetailSerializer

    def create(self, request):
        from analytics.tasks import generate_report

        body = ReportRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        values = body.validated_data
        period = parse_range({k: v for k, v in request.data.items() if k in (
            "range", "start_date", "end_date", "semester_id")} | {"range": values["range"]})
        report = Report.objects.create(
            title=values.get("title") or f"FlowSense analytics, {reports.period_label(period.start, period.end)}",
            sections=values["sections"],
            period_start=period.start,
            period_end=period.end,
            filters={"range": period.key},
            format=values["format"],
            generated_by=request.admin_user,
        )
        audit.record(request, AuditEvent.TYPE_ADMINISTRATIVE, AuditEvent.ACTION_CREATE, report,
                     f"Generated report #{report.pk}: {report.title}",
                     {"sections": report.sections, "format": report.format})
        transaction.on_commit(lambda: generate_report.delay(report.pk))
        report.refresh_from_db()
        return Response(ReportSerializer(report).data, status=status.HTTP_202_ACCEPTED)

    def retrieve(self, request, pk=None):
        report = self.get_object()
        if request.query_params.get("download") == "csv":
            if report.status != Report.STATUS_COMPLETED:
                return Response({"detail": "This report isn't ready yet."}, status=status.HTTP_409_CONFLICT)
            response = HttpResponse(reports.csv_zip(report), content_type="application/zip")
            response["Content-Disposition"] = f'attachment; filename="flowsense-report-{report.pk}.zip"'
            return response
        return Response(ReportDetailSerializer(report).data)
