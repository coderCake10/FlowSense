"""
apps/navigation/views/routes.py

Backs:
  POST /api/v1/navigation/routes
  GET  /api/v1/navigation/routes/{id}

Plain APIViews rather than a ViewSet, on purpose: neither endpoint maps
onto a plain queryset/model-instance lookup.

  - POST kicks off A* pathfinding (navigation.services.generate_route) and
    returns an assembled payload spanning three tables plus computed
    geometry that isn't stored anywhere.
  - GET reads a route back and may need to recompute its segment geometry
    on a cache miss (navigation.services.get_route).

Routing either of those through a ModelViewSet's create()/retrieve() would
mean overriding both methods completely anyway, at which point the mixin
buys nothing — same reasoning as `map.views.context.MapContextView` for
GET /map/context. Split into two APIViews (rather than one class handling
both verbs) because they sit at different URL shapes: a collection
endpoint for POST, a detail endpoint for GET, matching how 00 API
Design.md lists them as two separate rows.
"""
from analytics.models import NavigationRequest
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from navigation import services
from navigation.serializers import NavigationRouteCreateSerializer, NavigationRouteSerializer


class RouteGenerationFailed(APIException):
    """
    Raised when A* finds no path between the requested nodes. 422 rather
    than 404/400 — the request was well-formed and every node exists, the
    graph just doesn't connect them.

    NOTE: if common/exceptions ends up defining a shared error-code
    convention for the API's error envelope, this (and
    NavigationSessionInvalid below) should move there instead of living ad
    hoc in this view module.
    """

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = "route_not_found"
    default_detail = "No path could be found between the requested nodes."


class NavigationSessionInvalid(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "invalid_navigation_session"
    default_detail = "The supplied navigation session is invalid or no longer open."


class NavigationRouteCreateView(APIView):
    """POST /api/v1/navigation/routes"""

    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        input_serializer = NavigationRouteCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        validated = input_serializer.validated_data

        # All pathfinding, persistence, and failure-status bookkeeping
        # happens inside generate_route() — this view only translates its
        # outcomes into HTTP responses.
        try:
            route_payload = services.generate_route(
                origin_node=validated["origin_node"],
                destination_nodes=validated["destination_node_ids"],
                navigation_session_id=validated.get("navigation_session_id"),
                optimize_order=validated.get("optimize_order", False),
            )
        except services.NavigationSessionInvalidError as exc:
            raise NavigationSessionInvalid(str(exc))
        except services.RouteNotFoundError as exc:
            raise RouteGenerationFailed(
                {"message": str(exc), "navigation_request_id": exc.navigation_request_id}
            )

        output_serializer = NavigationRouteSerializer(route_payload)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


class NavigationRouteDetailView(APIView):
    """GET /api/v1/navigation/routes/{id}"""

    permission_classes = [AllowAny]

    def get(self, request, pk, *args, **kwargs):
        try:
            route_id = int(pk)
        except (TypeError, ValueError):
            raise NotFound("Invalid route id.")

        try:
            route_payload = services.get_route(route_id)
        except NavigationRequest.DoesNotExist:
            raise NotFound("No route found with that id.")

        serializer = NavigationRouteSerializer(route_payload)
        return Response(serializer.data)