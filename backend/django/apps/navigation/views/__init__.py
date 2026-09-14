"""
apps/navigation/views/__init__.py

Re-exports every Navigation API view so urls.py can do:

    from navigation.views import NavigationNodeViewSet, NavigationRouteCreateView, ...
"""
from navigation.views.destinations import NavigationDestinationViewSet
from navigation.views.nodes import NavigationNodeViewSet
from navigation.views.routes import NavigationRouteCreateView, NavigationRouteDetailView

__all__ = [
    "NavigationNodeViewSet",
    "NavigationDestinationViewSet",
    "NavigationRouteCreateView",
    "NavigationRouteDetailView",
]