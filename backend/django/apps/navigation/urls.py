"""
apps/navigation/urls.py

Wires up every Navigation API route. Included by config/urls.py, expected
to be mounted at /api/v1/navigation/.

  routes/                -> NavigationRouteCreateView (POST only)
  routes/{id}/            -> NavigationRouteDetailView (GET only)
  nodes/{id}/              -> NavigationNodeViewSet (retrieve only)
  destinations/{id}/       -> NavigationDestinationViewSet (retrieve only)

`routes/` and `routes/{id}/` aren't router routes on purpose — see
views/routes.py for why those two endpoints are plain APIViews instead of
a ViewSet. `nodes` and `destinations` ARE registered on the router since
they're ordinary retrieve-only ViewSets.
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from navigation.views import (
    NavigationDestinationViewSet,
    NavigationNodeViewSet,
    NavigationRouteCreateView,
    NavigationRouteDetailView,
)

router = DefaultRouter(trailing_slash=True)
router.register("nodes", NavigationNodeViewSet, basename="navigation-node")
router.register("destinations", NavigationDestinationViewSet, basename="navigation-destination")

urlpatterns = [
    path("routes/", NavigationRouteCreateView.as_view(), name="navigation-route-create"),
    path("routes/<int:pk>/", NavigationRouteDetailView.as_view(), name="navigation-route-detail"),
] + router.urls