"""
apps/annotation/views/nodes.py

Backs:
  POST   /api/v1/annotations/nodes      (see NOTE in serializers/nodes.py
                                          on the doc's /{id} typo on this row)
  GET    /api/v1/annotations/nodes/{id}
  DELETE /api/v1/annotations/nodes/{id}

A ViewSet fits here even without a `list` action — create + retrieve +
destroy on one resource is exactly what CreateModelMixin/
RetrieveModelMixin/DestroyModelMixin are for. No update/partial_update:
there's no PATCH for nodes in the API design (node edits happen through
type-specific endpoints instead — PATCH /annotations/rooms/{id}, hardware
assignment through the Hardware API, etc). DRF's router correctly omits
the collection-level GET and the detail-level PATCH routes on its own
since neither `list` nor `update` exists on this class.

`create()` and the create branch of `get_serializer_class()` deliberately
don't go through CreateModelMixin's default flow: the input shape
(NodeAnnotationCreateSerializer) and the output shape
(NodeAnnotationDetailSerializer, with its polymorphic `context` block) are
different serializers on purpose, and the actual row is created by
annotation.services.create_node_with_connection() rather than the
serializer's own .save().
"""
from rest_framework import mixins, status
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from annotation import services
from annotation.serializers import NodeAnnotationCreateSerializer, NodeAnnotationDetailSerializer
from common.permissions import IsAdminUser
from map.models import Node


class NodeAnnotationViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    permission_classes = [IsAdminUser]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return Node.objects.filter(deleted_at__isnull=True)

    def get_serializer_class(self):
        if self.action == "create":
            return NodeAnnotationCreateSerializer
        return NodeAnnotationDetailSerializer

    def create(self, request, *args, **kwargs):
        input_serializer = self.get_serializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        validated = input_serializer.validated_data

        # Auxiliary Node Tool connection modes (Nearest Node / Place Order /
        # No Connection); services.connect_auxiliary_node() applies them.
        node = services.create_node_with_connection(
            floor=validated["floor"],
            room=validated.get("room"),
            name=validated["name"],
            node_type=validated["node_type"],
            geometry=validated["geometry"],
            active=validated.get("active", True),
            navigable=validated.get("navigable", True),
            metadata=validated.get("metadata"),
            connection_mode=validated.get("connection_mode", "no_connection"),
            previous_node_id=validated.get("previous_node_id"),
            actor=request.admin_user,
        )

        output_serializer = NodeAnnotationDetailSerializer(node)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        node = self.get_object()
        services.delete_node(node, actor=request.admin_user)
        return Response(status=status.HTTP_204_NO_CONTENT)