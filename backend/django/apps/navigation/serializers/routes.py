"""
apps/navigation/serializers/routes.py

Backs:
  POST /api/v1/navigation/routes
  GET  /api/v1/navigation/routes/{id}

A "route" spans several tables (analytics.navigation_requests,
analytics.navigation_destinations, the map.Node/map.Edge graph walked to
get between them) and includes data that isn't stored in Postgres at all —
the actual path geometry for each leg. Nothing in the schema persists a
computed route's line-by-line geometry; it has to be re-derived (or read
back from wherever the pathfinding service cached it — Redis is the
obvious candidate given the stack) at request time. Because of that, the
output serializer here is a plain `Serializer`, not a `ModelSerializer` —
same pattern as `map.serializers.context.MapContextSerializer` for an
endpoint whose payload is assembled from multiple sources rather than
mirroring one row.
"""
from rest_framework import serializers

from analytics.models import NavigationDestination
from common.serializers import GeoJSONField
from map.models import Node
from navigation.serializers.nodes import NavigationNodeSummarySerializer

_ROUTABLE_NODES = Node.objects.filter(active=True, navigable=True, deleted_at__isnull=True)


class NavigationRouteCreateSerializer(serializers.Serializer):
    """
    POST /navigation/routes request body.

    Validates *shape and existence* only: that the origin and every
    requested destination refer to real, active, navigable nodes, and that
    a destination isn't also the origin. It deliberately does nothing
    beyond that.

    NOTE (business logic) — belongs in a service function
    (e.g. `navigation.services.generate_route(...)`) that the view calls
    after `is_valid()`, NOT in this serializer:
      - A* pathfinding across map.Node / map.Edge / map.FloorTransition,
        using the Manhattan-distance heuristic (per the Architecture
        notes).
      - Deciding traversal order across multiple destinations — the client
        sends its preferred queue order; whether the service preserves
        that order as-is or re-optimizes the visiting sequence is a
        routing decision, not a validation one.
      - Computing route_distance / route_generation_ms and creating the
        analytics.NavigationRequest + analytics.NavigationDestination rows.
      - Associating the request with an existing
        fs_sessions.NavigationSession, if `navigation_session_id` was
        supplied — including validating that session is still open/active.
    """

    navigation_session_id = serializers.UUIDField(required=False, allow_null=True)
    origin_node_id = serializers.PrimaryKeyRelatedField(
        source="origin_node", queryset=_ROUTABLE_NODES
    )
    destination_node_ids = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=_ROUTABLE_NODES),
        allow_empty=False,
        min_length=1,
    )

    def validate(self, attrs):
        origin = attrs["origin_node"]
        destinations = attrs["destination_node_ids"]
        if origin in destinations:
            raise serializers.ValidationError(
                {"destination_node_ids": "A destination cannot be the same as the origin node."}
            )
        return attrs


class NavigationRouteSegmentSerializer(serializers.Serializer):
    """
    One traversed leg of a computed route (origin -> first destination,
    first -> second destination, etc). NOT model-backed — segment data is
    assembled by the pathfinding service from the edges it walked and
    handed to this serializer as a plain dict per segment. `sequence` is
    1-indexed and matches the order legs were walked in.
    """

    sequence = serializers.IntegerField()
    from_node_id = serializers.IntegerField()
    to_node_id = serializers.IntegerField()
    geometry = GeoJSONField()
    distance = serializers.FloatField()


class NavigationRouteDestinationSerializer(serializers.ModelSerializer):
    """
    A destination as it appears embedded inside a route payload — lighter
    than `navigation.serializers.destinations.NavigationDestinationSerializer`
    since the route response already carries the request id, so repeating
    it per-destination would be redundant.
    """

    node = NavigationNodeSummarySerializer(source="destination_node", read_only=True)

    class Meta:
        model = NavigationDestination
        fields = ["destination_order", "node", "reached_at"]
        read_only_fields = fields


class NavigationRouteSerializer(serializers.Serializer):
    """
    Output shape for both POST /navigation/routes (on success) and
    GET /navigation/routes/{id}.

    Not a ModelSerializer — see module docstring. The view/service is
    expected to hand this serializer an object/dict shaped like:

        {
            "id": <int>,                        # analytics.NavigationRequest.id
            "status": <str>,
            "navigation_session_id": <uuid | None>,
            "origin_node": <map.Node>,
            "destinations": <QuerySet[analytics.NavigationDestination]>,
            "segments": [<dict>, ...],           # see NavigationRouteSegmentSerializer
            "route_distance": <Decimal | None>,
            "route_generation_ms": <int | None>,
            "destination_count": <int>,
            "started_at": <datetime>,
            "completed_at": <datetime | None>,
        }

    NOTE (business logic): assembling this dict — including re-deriving or
    cache-fetching `segments` for a previously generated route on the GET
    path — lives entirely in the service layer. This serializer only knows
    how to shape it into JSON.
    """

    id = serializers.IntegerField(read_only=True)
    status = serializers.CharField(read_only=True)
    navigation_session_id = serializers.UUIDField(read_only=True, allow_null=True)
    origin_node = NavigationNodeSummarySerializer(read_only=True)
    destinations = NavigationRouteDestinationSerializer(many=True, read_only=True)
    segments = NavigationRouteSegmentSerializer(many=True, read_only=True)
    route_distance = serializers.DecimalField(
        max_digits=18, decimal_places=4, read_only=True, allow_null=True
    )
    route_generation_ms = serializers.IntegerField(read_only=True, allow_null=True)
    destination_count = serializers.IntegerField(read_only=True)
    started_at = serializers.DateTimeField(read_only=True)
    completed_at = serializers.DateTimeField(read_only=True, allow_null=True)