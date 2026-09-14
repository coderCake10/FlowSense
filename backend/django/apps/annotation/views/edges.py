"""
apps/annotation/views/edges.py

Backs:
  POST   /api/v1/annotations/edges
  GET    /api/v1/annotations/edges/{id}
  PATCH  /api/v1/annotations/edges/{id}
  DELETE /api/v1/annotations/edges/{id}

Same shape as NodeAnnotationViewSet plus PATCH. `create()` and `update()`
both swap to a fuller read serializer for the response — the write
serializers (EdgeAnnotationCreateSerializer,
EdgeAnnotationUpdateSerializer) are deliberately narrower than
EdgeAnnotationSerializer (no id/geometry/timestamps on the update
serializer, for instance), so returning `serializer.data` straight from
either would under-represent the resource in the response.
"""
from rest_framework import mixins, status
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from analytics.models import AuditEvent
from annotation import services
from annotation.serializers import (
    EdgeAnnotationCreateSerializer,
    EdgeAnnotationSerializer,
    EdgeAnnotationUpdateSerializer,
)
from common.permissions import IsAdminUser
from map.models import Edge


class EdgeAnnotationViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    permission_classes = [IsAdminUser]
    # PATCH only, no PUT — matches the API design, and a full PUT-replace
    # doesn't make sense against EdgeAnnotationUpdateSerializer's
    # deliberately narrow field set (no from_node/to_node/geometry).
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Edge.objects.filter(deleted_at__isnull=True)

    def get_serializer_class(self):
        if self.action == "create":
            return EdgeAnnotationCreateSerializer
        if self.action in ("update", "partial_update"):
            return EdgeAnnotationUpdateSerializer
        return EdgeAnnotationSerializer

    def create(self, request, *args, **kwargs):
        input_serializer = self.get_serializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        validated = input_serializer.validated_data

        edge = services.create_edge(
            from_node=validated["from_node"],
            to_node=validated["to_node"],
            direction=validated.get("direction", Edge.DIRECTION_BIDIRECTIONAL),
            geometry=validated.get("geometry"),
            metadata=validated.get("metadata"),
            active=validated.get("active", True),
            actor=request.admin_user,
        )

        output_serializer = EdgeAnnotationSerializer(edge)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        input_serializer = self.get_serializer(instance, data=request.data, partial=True)
        input_serializer.is_valid(raise_exception=True)
        edge = input_serializer.save()
        services.log_annotation_change(
            actor=request.admin_user, action=AuditEvent.ACTION_UPDATE, instance=edge
        )
        return Response(EdgeAnnotationSerializer(edge).data)

    partial_update = update

    def destroy(self, request, *args, **kwargs):
        edge = self.get_object()
        services.delete_edge(edge, actor=request.admin_user)
        return Response(status=status.HTTP_204_NO_CONTENT)