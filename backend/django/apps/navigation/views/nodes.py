"""
apps/navigation/views/nodes.py

Backs:
  GET /api/v1/navigation/nodes/{id}

Straightforward, ORM-backed detail lookup over map.Node — a normal ViewSet
fits fine here, unlike the route endpoints (see views/routes.py for why
those are plain APIViews instead).
"""
from rest_framework import mixins
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import GenericViewSet

from map.models import Node
from navigation.serializers import NavigationNodeSerializer


class NavigationNodeViewSet(mixins.RetrieveModelMixin, GenericViewSet):
    """
    Retrieve-only — there's no GET /navigation/nodes list endpoint in the
    API design (nodes are only looked up individually here; browsing the
    full node graph happens through the Annotation API's map editor).
    """

    serializer_class = NavigationNodeSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # Deliberately not filtering on active/navigable here — this is a
        # detail lookup for rendering/debugging a specific node, not part
        # of the routing graph itself (services.py applies those filters
        # separately when it builds the pathfinding graph).
        return Node.objects.filter(deleted_at__isnull=True)