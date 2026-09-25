"""
Settings API (07 API Design, common/settings). Admin only.

GET   /api/v1/settings                   all settings
GET   /api/v1/settings/{key}             one setting
PATCH /api/v1/settings/{key}             {"value": ...}
GET   /api/v1/settings/semesters         semester registry
POST  /api/v1/settings/semesters
GET   /api/v1/settings/semesters/{id}
PATCH /api/v1/settings/semesters/{id}
DELETE /api/v1/settings/semesters/{id}
"""
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics import audit
from analytics.models import AuditEvent
from common.models import Semester, Setting
from common.settings.serializers import SemesterSerializer, SettingSerializer, SettingUpdateSerializer


class SettingListView(APIView):
    def get(self, request):
        settings_qs = Setting.objects.select_related("updated_by").order_by("key")
        return Response(SettingSerializer(settings_qs, many=True).data)


class SettingDetailView(APIView):
    def get(self, request, key):
        return Response(SettingSerializer(get_object_or_404(Setting, key=key)).data)

    def patch(self, request, key):
        setting = get_object_or_404(Setting, key=key)
        serializer = SettingUpdateSerializer(data=request.data, context={"key": key})
        serializer.is_valid(raise_exception=True)
        previous = setting.value
        setting.value = serializer.validated_data["value"]
        setting.updated_by = request.admin_user
        setting.save()
        audit.record(request, AuditEvent.TYPE_CONFIGURATION, AuditEvent.ACTION_UPDATE, setting,
                     f"Changed setting {key}", {"previous": previous, "value": setting.value})
        return Response(SettingSerializer(setting).data)


class SemesterViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin,
                      mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def perform_create(self, serializer):
        semester = serializer.save()
        audit.record(self.request, AuditEvent.TYPE_CONFIGURATION, AuditEvent.ACTION_CREATE, semester,
                     f"Added semester {semester}")

    def perform_update(self, serializer):
        semester = serializer.save()
        audit.record(self.request, AuditEvent.TYPE_CONFIGURATION, AuditEvent.ACTION_UPDATE, semester,
                     f"Changed semester {semester}")

    def perform_destroy(self, instance):
        audit.record(self.request, AuditEvent.TYPE_CONFIGURATION, AuditEvent.ACTION_DELETE, instance,
                     f"Deleted semester {instance}")
        instance.delete()
