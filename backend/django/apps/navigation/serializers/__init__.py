"""
apps/navigation/serializers/__init__.py

Re-exports every Navigation API serializer so views can do:

    from navigation.serializers import NavigationRouteCreateSerializer, ...

The `navigation` app owns no models of its own (see apps/navigation/models.py
and services.py) — every serializer here reads from models owned by `map`
(Node) and `analytics` (NavigationRequest, NavigationDestination).
"""
from navigation.serializers.destinations import NavigationDestinationSerializer
from navigation.serializers.nodes import NavigationNodeSerializer, NavigationNodeSummarySerializer
from navigation.serializers.routes import (
    NavigationRouteCreateSerializer,
    NavigationRouteDestinationSerializer,
    NavigationRouteSegmentSerializer,
    NavigationRouteSerializer,
)

__all__ = [
    "NavigationNodeSerializer",
    "NavigationNodeSummarySerializer",
    "NavigationDestinationSerializer",
    "NavigationRouteCreateSerializer",
    "NavigationRouteSerializer",
    "NavigationRouteDestinationSerializer",
    "NavigationRouteSegmentSerializer",
]