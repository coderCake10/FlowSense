"""
apps/navigation/views/destinations.py

Backs:
  GET /api/v1/navigation/destinations/{id}

Straightforward, ORM-backed detail lookup over
analytics.NavigationDestination — another normal ViewSet, same reasoning as
NavigationNodeViewSet.
"""
from rest_framework import mixins
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import GenericViewSet

from analytics.models import NavigationDestination
from navigation.serializers import NavigationDestinationSerializer


class NavigationDestinationViewSet(mixins.RetrieveModelMixin, GenericViewSet):
    """Retrieve-only — no GET /navigation/destinations list endpoint exists."""

    serializer_class = NavigationDestinationSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return NavigationDestination.objects.select_related(
            "destination_node", "navigation_request"
        )