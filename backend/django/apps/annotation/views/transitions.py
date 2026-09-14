"""
apps/annotation/views/transitions.py

Backs:
  POST   /api/v1/annotations/transitions
  PATCH  /api/v1/annotations/transitions/{id}
  DELETE /api/v1/annotations/transitions/{id}

No `retrieve` — the API design has no standalone
GET /annotations/transitions/{id} (transitions are read back as part of
the aggregate scene payload instead — see AnnotationSceneView). DRF's
router correctly omits the detail-level GET route since `retrieve` isn't
defined here.
"""
from rest_framework import mixins, status
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from analytics.models import AuditEvent
from annotation import services
from annotation.serializers import (
    FloorTransitionAnnotationSerializer,
    FloorTransitionCreateSerializer,
    FloorTransitionUpdateSerializer,
)
from common.permissions import IsAdminUser
from map.models import FloorTransition


class FloorTransitionAnnotationViewSet(
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    permission_classes = [IsAdminUser]
    http_method_names = ["post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return FloorTransition.objects.filter(deleted_at__isnull=True)

    def get_serializer_class(self):
        if self.action == "create":
            return FloorTransitionCreateSerializer
        if self.action in ("update", "partial_update"):
            return FloorTransitionUpdateSerializer
        return FloorTransitionAnnotationSerializer

    def create(self, request, *args, **kwargs):
        input_serializer = self.get_serializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        validated = input_serializer.validated_data

        transition = services.create_floor_transition(
            transition_type=validated["transition_type"],
            from_node=validated["from_node"],
            to_node=validated["to_node"],
            active=validated.get("active", True),
            actor=request.admin_user,
        )

        output_serializer = FloorTransitionAnnotationSerializer(transition)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        input_serializer = self.get_serializer(instance, data=request.data, partial=True)
        input_serializer.is_valid(raise_exception=True)
        transition = input_serializer.save()
        services.log_annotation_change(
            actor=request.admin_user, action=AuditEvent.ACTION_UPDATE, instance=transition
        )
        return Response(FloorTransitionAnnotationSerializer(transition).data)

    partial_update = update

    def destroy(self, request, *args, **kwargs):
        transition = self.get_object()
        services.delete_floor_transition(transition, actor=request.admin_user)
        return Response(status=status.HTTP_204_NO_CONTENT)