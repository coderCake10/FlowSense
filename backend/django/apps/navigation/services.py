"""
apps/navigation/services.py

The business logic explicitly kept out of the Navigation API serializers
(see apps/navigation/serializers/routes.py's NOTE comments): A* pathfinding
over the map.Node / map.Edge / map.FloorTransition graph, multi-destination
route assembly in the order the client requested, and the read/write side
of analytics.NavigationRequest / analytics.NavigationDestination.

Views call `generate_route()` for POST /navigation/routes and `get_route()`
for GET /navigation/routes/{id}. Nothing here is view- or serializer-aware —
these functions take/return plain Python objects (model instances, dicts)
so they can be unit-tested and reused (e.g. from a Celery task that
pre-warms the graph) without touching HTTP at all.
"""
import heapq
import math
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, List, Optional, Sequence, Tuple

from django.contrib.gis.geos import GEOSGeometry, LineString, Point
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from analytics.models import NavigationDestination, NavigationRequest
from fs_sessions.models import NavigationSession
from map.models import Edge, FloorTransition, Node

# --------------------------------------------------------------------------
# Errors
# --------------------------------------------------------------------------


class RouteNotFoundError(Exception):
    """
    Raised when no path exists between two nodes in the current graph.
    Carries `navigation_request_id` when raised from `generate_route()`,
    since that function persists a `status='failed'` request *before*
    re-raising, so the caller can still point the client at
    GET /navigation/routes/{id} for the failure record.
    """

    def __init__(self, message: str, navigation_request_id: Optional[int] = None):
        super().__init__(message)
        self.navigation_request_id = navigation_request_id


class NavigationSessionInvalidError(Exception):
    """Raised when a supplied navigation_session_id doesn't resolve to an open session."""


# --------------------------------------------------------------------------
# Tunable routing constants
# --------------------------------------------------------------------------

# Floor transitions have no distance geometry of their own (unlike Edge,
# which stores a walked LineStringZ) — they just connect a node on one
# floor to a node on another. We approximate their cost as the straight-
# line 3D distance between the two endpoint nodes, scaled by a per-type
# multiplier to reflect that stairs/elevators take longer to traverse than
# walking the same straight-line distance would. These are deliberately
# simple, tunable numbers, not measured constants — revisit if routes
# start favoring/avoiding transitions in ways that feel wrong in practice.
FLOOR_TRANSITION_WEIGHT_MULTIPLIERS = {
    FloorTransition.TYPE_STAIRS: 1.5,
    FloorTransition.TYPE_ELEVATOR: 2.0,
    FloorTransition.TYPE_ESCALATOR: 1.2,
    FloorTransition.TYPE_OTHER: 1.5,
}
_DEFAULT_TRANSITION_MULTIPLIER = 1.5

# How long a route's computed segment geometry is cached before
# GET /navigation/routes/{id} falls back to recomputing it. Segments only
# change if the underlying node/edge graph changes (an annotation edit), so
# this can be generous — it's a latency optimization, not a correctness
# requirement (see _recompute_segments()'s docstring for the correctness
# caveat around graph drift).
ROUTE_SEGMENT_CACHE_TTL_SECONDS = 60 * 60 * 24  # 24 hours
_ROUTE_SEGMENT_CACHE_KEY = "navigation:route_segments:{request_id}"


# --------------------------------------------------------------------------
# Graph construction
# --------------------------------------------------------------------------


@dataclass
class _GraphEdge:
    to_node_id: int
    weight: float
    geometry: Optional[LineString]  # None for a synthesized floor-transition hop


@dataclass
class _RoutingGraph:
    nodes: Dict[int, Node]
    adjacency: Dict[int, List[_GraphEdge]]


def _node_point(node: Node) -> Point:
    return node.geometry  # PointZ(3857), NOT NULL on the model


def _euclidean_distance(a: Point, b: Point) -> float:
    dx = a.x - b.x
    dy = a.y - b.y
    dz = (a.z or 0) - (b.z or 0)
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def _manhattan_distance(a: Point, b: Point) -> float:
    """
    The A* heuristic. Manhattan distance per the Architecture notes ("The
    heuristic chosen for A* algorithm will be Manhattan Distance").
    Deliberately ignores elevation (z) — floor changes are graph hops with
    their own explicit weight (FLOOR_TRANSITION_WEIGHT_MULTIPLIERS), not a
    smooth vertical distance, so folding z into the heuristic would distort
    it rather than help it stay admissible.
    """
    return abs(a.x - b.x) + abs(a.y - b.y)


def _reversed_linestring(geometry: Optional[LineString]) -> Optional[LineString]:
    if geometry is None:
        return None
    coords = list(geometry.coords)
    coords.reverse()
    return LineString(coords, srid=geometry.srid or 3857)


def _build_graph() -> _RoutingGraph:
    """
    Builds an adjacency list over every active, navigable, non-deleted node
    reachable via active edges and active floor transitions.

    The whole-campus graph is small enough for a class-project deployment
    to rebuild per request. For a larger deployment, this is the function
    to memoize — e.g. warm it in Redis via a Celery Beat task and
    invalidate it whenever the Annotation API writes a node/edge/
    transition — but that caching layer is NOT implemented here.
    """
    nodes_by_id: Dict[int, Node] = {
        n.id: n
        for n in Node.objects.filter(active=True, navigable=True, deleted_at__isnull=True)
    }
    adjacency: Dict[int, List[_GraphEdge]] = {}

    def add_edge(from_id: int, to_id: int, weight: float, geometry: Optional[LineString]):
        if from_id not in nodes_by_id or to_id not in nodes_by_id:
            return
        adjacency.setdefault(from_id, []).append(_GraphEdge(to_id, weight, geometry))

    edges = Edge.objects.filter(active=True, deleted_at__isnull=True).select_related(
        "from_node", "to_node"
    )
    for edge in edges:
        if edge.from_node_id not in nodes_by_id or edge.to_node_id not in nodes_by_id:
            continue
        weight = (
            edge.geometry.length
            if edge.geometry is not None
            else _euclidean_distance(
                _node_point(nodes_by_id[edge.from_node_id]),
                _node_point(nodes_by_id[edge.to_node_id]),
            )
        )
        if edge.direction in (Edge.DIRECTION_BIDIRECTIONAL, Edge.DIRECTION_FORWARD):
            add_edge(edge.from_node_id, edge.to_node_id, weight, edge.geometry)
        if edge.direction in (Edge.DIRECTION_BIDIRECTIONAL, Edge.DIRECTION_REVERSE):
            add_edge(edge.to_node_id, edge.from_node_id, weight, _reversed_linestring(edge.geometry))

    transitions = FloorTransition.objects.filter(
        active=True,
        deleted_at__isnull=True,
        from_node__isnull=False,
        to_node__isnull=False,
    ).select_related("from_node", "to_node")
    for transition in transitions:
        if (
            transition.from_node_id not in nodes_by_id
            or transition.to_node_id not in nodes_by_id
        ):
            continue
        multiplier = FLOOR_TRANSITION_WEIGHT_MULTIPLIERS.get(
            transition.transition_type, _DEFAULT_TRANSITION_MULTIPLIER
        )
        base_distance = _euclidean_distance(
            _node_point(nodes_by_id[transition.from_node_id]),
            _node_point(nodes_by_id[transition.to_node_id]),
        )
        weight = base_distance * multiplier
        # Treated as bidirectional — you can take the same stairs/elevator
        # in either direction. Floor transitions have no `direction` column
        # in the schema, unlike Edge.
        add_edge(transition.from_node_id, transition.to_node_id, weight, None)
        add_edge(transition.to_node_id, transition.from_node_id, weight, None)

    return _RoutingGraph(nodes=nodes_by_id, adjacency=adjacency)


# --------------------------------------------------------------------------
# A* search
# --------------------------------------------------------------------------


def _reconstruct_path(came_from: Dict[int, int], current_id: int) -> List[int]:
    path = [current_id]
    while current_id in came_from:
        current_id = came_from[current_id]
        path.append(current_id)
    path.reverse()
    return path


def _a_star(graph: _RoutingGraph, start_id: int, goal_id: int) -> List[int]:
    """
    Standard A* search with the Manhattan-distance heuristic. Returns the
    ordered list of node ids from `start_id` to `goal_id` inclusive.
    Raises RouteNotFoundError if `goal_id` is unreachable from `start_id`
    (or either id isn't in the routable graph at all — e.g. an inactive
    node).
    """
    if start_id not in graph.nodes or goal_id not in graph.nodes:
        raise RouteNotFoundError(f"Node {start_id} or {goal_id} is not in the routable graph.")

    if start_id == goal_id:
        return [start_id]

    goal_point = _node_point(graph.nodes[goal_id])

    open_heap: List[Tuple[float, int]] = [(0.0, start_id)]
    came_from: Dict[int, int] = {}
    g_score: Dict[int, float] = {start_id: 0.0}
    visited = set()

    while open_heap:
        _, current_id = heapq.heappop(open_heap)
        if current_id in visited:
            continue
        if current_id == goal_id:
            return _reconstruct_path(came_from, current_id)
        visited.add(current_id)

        for graph_edge in graph.adjacency.get(current_id, []):
            neighbor_id = graph_edge.to_node_id
            if neighbor_id in visited:
                continue
            tentative_g = g_score[current_id] + graph_edge.weight
            if tentative_g < g_score.get(neighbor_id, math.inf):
                came_from[neighbor_id] = current_id
                g_score[neighbor_id] = tentative_g
                h = _manhattan_distance(_node_point(graph.nodes[neighbor_id]), goal_point)
                heapq.heappush(open_heap, (tentative_g + h, neighbor_id))

    raise RouteNotFoundError(f"No path exists from node {start_id} to node {goal_id}.")


def _leg_geometry_and_distance(
    graph: _RoutingGraph, path_node_ids: List[int]
) -> Tuple[LineString, float]:
    """
    Walks consecutive nodes in `path_node_ids` and stitches together each
    hop's geometry — the real edge geometry when one exists, otherwise a
    straight line between the two node points (always the case for floor
    transitions, which have no geometry column) — into a single LineStringZ
    for the whole leg. Returns (geometry, total_distance).
    """
    coords: List[tuple] = []
    total_distance = 0.0

    for from_id, to_id in zip(path_node_ids, path_node_ids[1:]):
        graph_edge = next(
            (e for e in graph.adjacency.get(from_id, []) if e.to_node_id == to_id), None
        )
        if graph_edge is None:
            # Should be unreachable given how the path was built by _a_star,
            # but fail loudly rather than silently producing wrong geometry.
            raise RouteNotFoundError(f"Broken path segment between {from_id} and {to_id}.")

        total_distance += graph_edge.weight

        if graph_edge.geometry is not None:
            hop_coords = list(graph_edge.geometry.coords)
        else:
            hop_coords = [
                _node_point(graph.nodes[from_id]).coords,
                _node_point(graph.nodes[to_id]).coords,
            ]

        if coords and coords[-1] == hop_coords[0]:
            coords.extend(hop_coords[1:])
        else:
            coords.extend(hop_coords)

    geometry = LineString(coords, srid=3857)
    return geometry, total_distance


# --------------------------------------------------------------------------
# Segment caching (Redis, via Django's cache framework)
# --------------------------------------------------------------------------


def _cache_segments(request_id: int, segments: List[dict]) -> None:
    """
    Caches a route's computed segments so GET /navigation/routes/{id}
    doesn't have to re-run A* for a route that was just generated moments
    ago. Purely a latency optimization — see get_route()'s recompute
    fallback for what happens on a cache miss.
    """
    serializable = [
        {
            "sequence": s["sequence"],
            "from_node_id": s["from_node_id"],
            "to_node_id": s["to_node_id"],
            "geometry": s["geometry"].geojson,
            "distance": s["distance"],
        }
        for s in segments
    ]
    cache.set(
        _ROUTE_SEGMENT_CACHE_KEY.format(request_id=request_id),
        serializable,
        timeout=ROUTE_SEGMENT_CACHE_TTL_SECONDS,
    )


def _get_cached_segments(request_id: int) -> Optional[List[dict]]:
    cached = cache.get(_ROUTE_SEGMENT_CACHE_KEY.format(request_id=request_id))
    if cached is None:
        return None
    return [
        {
            "sequence": item["sequence"],
            "from_node_id": item["from_node_id"],
            "to_node_id": item["to_node_id"],
            "geometry": GEOSGeometry(item["geometry"]),
            "distance": item["distance"],
        }
        for item in cached
    ]


# --------------------------------------------------------------------------
# Navigation session resolution
# --------------------------------------------------------------------------

_OPEN_SESSION_STATUSES = (
    NavigationSession.STATUS_CREATED,
    NavigationSession.STATUS_ACTIVE,
    NavigationSession.STATUS_SCANNED,
)


def _resolve_navigation_session(navigation_session_id) -> Optional[NavigationSession]:
    """
    The Navigation API serializer only validates that
    `navigation_session_id` is a well-formed UUID (see
    NavigationRouteCreateSerializer) — actually checking the session
    exists and is still open is a business rule that lives here.
    """
    if navigation_session_id is None:
        return None
    try:
        session = NavigationSession.objects.get(id=navigation_session_id)
    except NavigationSession.DoesNotExist:
        raise NavigationSessionInvalidError(
            f"No navigation session found with id {navigation_session_id}."
        )
    if session.status not in _OPEN_SESSION_STATUSES:
        raise NavigationSessionInvalidError(
            f"Navigation session {navigation_session_id} is not open "
            f"(status={session.status})."
        )
    return session


# --------------------------------------------------------------------------
# Public entry points
# --------------------------------------------------------------------------


def generate_route(
    *,
    origin_node: Node,
    destination_nodes: Sequence[Node],
    navigation_session_id=None,
) -> dict:
    """
    POST /navigation/routes.

    Runs A* leg-by-leg across `origin_node -> destination_nodes[0] ->
    destination_nodes[1] -> ...`, IN THE ORDER GIVEN. This does not
    re-optimize destination order (no TSP solving) — the client controls
    queue order (per the Kiosk's Destination Queue UI), and preserving it
    is a deliberate choice, not an oversight.

    Always persists an analytics.NavigationRequest first (status=
    'requested'), then updates it to 'generated' or 'failed' once
    pathfinding finishes — so failed attempts are visible in
    Navigation Analytics, not silently dropped. On failure, re-raises
    RouteNotFoundError with `navigation_request_id` set so the view can
    still point the client at GET /navigation/routes/{id}.

    Returns a dict shaped for
    navigation.serializers.routes.NavigationRouteSerializer.
    """
    start_time = time.perf_counter()
    navigation_session = _resolve_navigation_session(navigation_session_id)

    with transaction.atomic():
        navigation_request = NavigationRequest.objects.create(
            navigation_session=navigation_session,
            origin_node=origin_node,
            destination_count=len(destination_nodes),
            status=NavigationRequest.STATUS_REQUESTED,
        )
        NavigationDestination.objects.bulk_create(
            [
                NavigationDestination(
                    navigation_request=navigation_request,
                    destination_node=node,
                    destination_order=index,
                )
                for index, node in enumerate(destination_nodes, start=1)
            ]
        )

    try:
        graph = _build_graph()
        leg_endpoints = [origin_node.id] + [d.id for d in destination_nodes]
        segments: List[dict] = []
        total_distance = 0.0

        for sequence, (from_id, to_id) in enumerate(
            zip(leg_endpoints, leg_endpoints[1:]), start=1
        ):
            path_node_ids = _a_star(graph, from_id, to_id)
            geometry, leg_distance = _leg_geometry_and_distance(graph, path_node_ids)
            segments.append(
                {
                    "sequence": sequence,
                    "from_node_id": from_id,
                    "to_node_id": to_id,
                    "geometry": geometry,
                    "distance": leg_distance,
                }
            )
            total_distance += leg_distance
    except RouteNotFoundError as exc:
        navigation_request.status = NavigationRequest.STATUS_FAILED
        navigation_request.route_generation_ms = int((time.perf_counter() - start_time) * 1000)
        navigation_request.completed_at = timezone.now()
        navigation_request.save(
            update_fields=["status", "route_generation_ms", "completed_at"]
        )
        raise RouteNotFoundError(str(exc), navigation_request_id=navigation_request.id) from exc

    navigation_request.status = NavigationRequest.STATUS_GENERATED
    navigation_request.route_distance = Decimal(str(round(total_distance, 4)))
    navigation_request.route_generation_ms = int((time.perf_counter() - start_time) * 1000)
    navigation_request.completed_at = timezone.now()
    navigation_request.save(
        update_fields=["status", "route_distance", "route_generation_ms", "completed_at"]
    )

    _cache_segments(navigation_request.id, segments)

    return _build_route_payload(navigation_request, segments)


def get_route(request_id: int) -> dict:
    """
    GET /navigation/routes/{id}.

    Fetches the persisted analytics.NavigationRequest + ordered
    destinations, and either serves cached segment geometry or recomputes
    it. Raises analytics.NavigationRequest.DoesNotExist if no such route
    exists — the view is expected to translate that into a 404.
    """
    navigation_request = NavigationRequest.objects.select_related(
        "origin_node", "navigation_session"
    ).get(id=request_id)

    if navigation_request.status == NavigationRequest.STATUS_FAILED:
        # Don't attempt to (re-)pathfind a request we already know failed —
        # just report it with no segments. If the graph has since changed
        # such that a path now exists, that's a new POST /navigation/routes
        # call, not a side effect of a GET.
        segments: List[dict] = []
    else:
        segments = _get_cached_segments(request_id)
        if segments is None:
            segments = _recompute_segments(navigation_request)
            _cache_segments(request_id, segments)

    return _build_route_payload(navigation_request, segments)


def _recompute_segments(navigation_request: NavigationRequest) -> List[dict]:
    """
    Re-derives segment geometry for an already-persisted route by walking
    the same origin -> destination-in-order sequence through the *current*
    graph.

    NOTE (known limitation): if the underlying node/edge graph has changed
    since the route was originally generated (an annotation edit
    added/removed an edge, disabled a node, etc.), the recomputed path —
    and therefore its geometry and distance — may differ from what was
    actually shown to the user at the time. The persisted `route_distance`
    on NavigationRequest is NOT overwritten here; only the transient
    `segments` in the response reflect the current graph. If exact
    historical reproducibility is ever required, segments need to be
    persisted at generation time (e.g. a dedicated table, or a
    non-expiring cache entry) instead of recomputed on demand.
    """
    graph = _build_graph()
    destinations = list(
        NavigationDestination.objects.filter(navigation_request=navigation_request)
        .select_related("destination_node")
        .order_by("destination_order")
    )
    leg_endpoints = [navigation_request.origin_node_id] + [
        d.destination_node_id for d in destinations
    ]

    segments: List[dict] = []
    for sequence, (from_id, to_id) in enumerate(zip(leg_endpoints, leg_endpoints[1:]), start=1):
        path_node_ids = _a_star(graph, from_id, to_id)
        geometry, leg_distance = _leg_geometry_and_distance(graph, path_node_ids)
        segments.append(
            {
                "sequence": sequence,
                "from_node_id": from_id,
                "to_node_id": to_id,
                "geometry": geometry,
                "distance": leg_distance,
            }
        )
    return segments


def _build_route_payload(navigation_request: NavigationRequest, segments: List[dict]) -> dict:
    """Shapes the data navigation.serializers.routes.NavigationRouteSerializer expects."""
    destinations = (
        NavigationDestination.objects.filter(navigation_request=navigation_request)
        .select_related("destination_node")
        .order_by("destination_order")
    )
    return {
        "id": navigation_request.id,
        "status": navigation_request.status,
        "navigation_session_id": navigation_request.navigation_session_id,
        "origin_node": navigation_request.origin_node,
        "destinations": destinations,
        "segments": segments,
        "route_distance": navigation_request.route_distance,
        "route_generation_ms": navigation_request.route_generation_ms,
        "destination_count": navigation_request.destination_count,
        "started_at": navigation_request.started_at,
        "completed_at": navigation_request.completed_at,
    }