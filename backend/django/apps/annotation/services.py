"""
apps/annotation/services.py

The business logic explicitly kept out of the Annotation API serializers
(see apps/annotation/serializers/*.py's NOTE comments): assembling the
aggregate 3D-editor scene, node/edge/floor-transition creation with their
auto-connection and geometry-synthesis behavior, cascading soft-deletes,
and logging every mutation to analytics.AuditEvent.

Views call these functions; they never build this logic themselves. Every
create/update/delete flow ends with a call to log_annotation_change() —
views should call it directly after a plain `serializer.save()` too (e.g.
for the Room/Entrance/Stair/Elevator/OutdoorWalkway/Edge/FloorTransition
PATCH endpoints, which have no bespoke service function below because
DRF's ModelSerializer.save() already does the field update correctly on
its own — the only thing missing after that is the audit entry).
"""
from typing import Optional

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import LineString
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from analytics.models import AuditEvent
from map.models import (
    Edge,
    Elevator,
    Entrance,
    Floor,
    FloorTransition,
    Node,
    OutdoorWalkway,
    Room,
    Stair,
)

# --------------------------------------------------------------------------
# Audit logging
# --------------------------------------------------------------------------

_ENTITY_TYPE_NAMES = {
    Node: "node",
    Edge: "edge",
    FloorTransition: "floor_transition",
    Room: "room",
    Entrance: "entrance",
    Stair: "stair",
    Elevator: "elevator",
    OutdoorWalkway: "outdoor_walkway",
}


def log_annotation_change(*, actor, action: str, instance) -> AuditEvent:
    """
    Records one analytics.AuditEvent for a create/update/delete performed
    through any Annotation API endpoint.

    Centralized here so there's exactly one place deciding how a model
    instance maps to an audit entry, instead of that mapping being
    duplicated across every view. `actor` is the authenticated
    authentication.AdminUser performing the change (from
    common.permissions.IsAdminUser's `request.admin_user`) — may be None
    if this is ever called from a non-request context (a management
    command, a migration-time backfill, etc.).
    """
    entity_type = _ENTITY_TYPE_NAMES.get(type(instance), type(instance).__name__.lower())
    return AuditEvent.objects.create(
        admin_user=actor,
        event_type=AuditEvent.TYPE_CONFIGURATION,
        entity_type=entity_type,
        entity_id=instance.pk,
        action=action,
        description=f"{action} {entity_type} #{instance.pk}",
    )


# --------------------------------------------------------------------------
# Aggregate scene (GET /annotations)
# --------------------------------------------------------------------------


def get_scene(*, area_id: Optional[int] = None, floor_id: Optional[int] = None) -> dict:
    """
    GET /annotations. Scopes every one of the seven querysets to the given
    area/floor. `campus.entrances`/`stairs`/`elevators`/`outdoor_walkways`
    only have an `area_id` column (no `floor_id`), so when `floor_id` is
    given, its area is resolved and used to scope those four instead —
    otherwise switching floors within the same building would make all of
    a building's entrances/stairs/elevators disappear from the editor,
    which isn't what "scope to this floor" should mean for building-level
    fixtures.

    Returns a dict shaped for
    annotation.serializers.scene.AnnotationSceneSerializer.
    """
    effective_area_id = area_id
    if floor_id is not None and effective_area_id is None:
        floor = Floor.objects.filter(id=floor_id).only("area_id").first()
        if floor is not None:
            effective_area_id = floor.area_id

    node_qs = Node.objects.filter(deleted_at__isnull=True)
    edge_qs = Edge.objects.filter(deleted_at__isnull=True)
    transition_qs = FloorTransition.objects.filter(deleted_at__isnull=True)
    entrance_qs = Entrance.objects.all()
    stair_qs = Stair.objects.all()
    elevator_qs = Elevator.objects.all()
    walkway_qs = OutdoorWalkway.objects.all()

    if floor_id is not None:
        node_qs = node_qs.filter(floor_id=floor_id)
        edge_qs = edge_qs.filter(Q(from_node__floor_id=floor_id) | Q(to_node__floor_id=floor_id))
        transition_qs = transition_qs.filter(
            Q(from_node__floor_id=floor_id) | Q(to_node__floor_id=floor_id)
        )
    elif effective_area_id is not None:
        node_qs = node_qs.filter(floor__area_id=effective_area_id)
        edge_qs = edge_qs.filter(
            Q(from_node__floor__area_id=effective_area_id)
            | Q(to_node__floor__area_id=effective_area_id)
        )
        transition_qs = transition_qs.filter(
            Q(from_node__floor__area_id=effective_area_id)
            | Q(to_node__floor__area_id=effective_area_id)
        )

    if effective_area_id is not None:
        entrance_qs = entrance_qs.filter(area_id=effective_area_id)
        stair_qs = stair_qs.filter(area_id=effective_area_id)
        elevator_qs = elevator_qs.filter(area_id=effective_area_id)
        walkway_qs = walkway_qs.filter(area_id=effective_area_id)

    return {
        "nodes": node_qs.select_related("floor", "room").order_by("name"),
        "edges": edge_qs.select_related("from_node", "to_node").order_by("id"),
        "floor_transitions": transition_qs.select_related("from_node", "to_node").order_by("id"),
        "entrances": entrance_qs.order_by("name"),
        "stairs": stair_qs.order_by("name"),
        "elevators": elevator_qs.order_by("name"),
        "outdoor_walkways": walkway_qs.order_by("name"),
    }


# --------------------------------------------------------------------------
# Node creation
# --------------------------------------------------------------------------


def create_node(
    *,
    floor,
    room=None,
    name: str,
    node_type: str,
    geometry,
    active: bool = True,
    navigable: bool = True,
    metadata: Optional[dict] = None,
    actor=None,
) -> Node:
    """
    POST /annotations/nodes.

    NOTE (known limitation, not implemented): per the Admin Map Annotation
    notes, a Room node is supposed to "automatically anchor to door
    objects in the object hierarchy found in the building's .glb" — i.e.
    the backend should resolve `geometry` itself from the parsed 3D asset,
    not trust whatever point the client sends.

    That's NOT implemented here, because the schema doesn't support it
    today: assets.asset_versions only stores aggregate counts
    (object_count, mesh_count, detected_floor_count, ...), not per-object
    transforms/positions for individual objects in the hierarchy. There's
    nowhere to query "where is the door for GLB node X" from. Real
    auto-anchoring needs either a new table (e.g. an
    assets.DetectedObject-style table keyed by asset_version + GLB node
    name, storing a parsed transform) or a runtime call into whatever
    parses the .glb (trimesh, per the Architecture notes). Until one of
    those exists, this function just persists the client-supplied
    `geometry` as-is for every node_type, including "room".

    For auxiliary nodes that should auto-connect to a neighbor on
    placement, call connect_auxiliary_node() (or the combined
    create_node_with_connection()) as a separate step — this function only
    creates the Node row.
    """
    if node_type == Node.TYPE_ROOM and room is None:
        # Redundant with NodeAnnotationCreateSerializer's own check, but
        # this function is a valid entry point outside the view too (a
        # future import/seed script, for instance), so it re-asserts the
        # invariant rather than trusting every caller to have validated it.
        raise ValueError("A room must be specified for node_type='room'.")

    with transaction.atomic():
        node = Node.objects.create(
            floor=floor,
            room=room,
            name=name,
            node_type=node_type,
            geometry=geometry,
            active=active,
            navigable=navigable,
            metadata=metadata or {},
        )
        log_annotation_change(actor=actor, action=AuditEvent.ACTION_CREATE, instance=node)
    return node


# --------------------------------------------------------------------------
# Auxiliary node auto-connection
# --------------------------------------------------------------------------

CONNECTION_MODE_NEAREST_NODE = "nearest_node"
CONNECTION_MODE_PLACE_ORDER = "place_order"
CONNECTION_MODE_NO_CONNECTION = "no_connection"


def create_node_with_connection(
    *,
    floor,
    room=None,
    name: str,
    node_type: str,
    geometry,
    active: bool = True,
    navigable: bool = True,
    metadata: Optional[dict] = None,
    connection_mode: str = CONNECTION_MODE_NO_CONNECTION,
    previous_node_id: Optional[int] = None,
    actor=None,
) -> Node:
    """
    Convenience wrapper combining create_node() and connect_auxiliary_node()
    into one call — what the POST /annotations/nodes view actually calls
    for the common "place an auxiliary node with auto-connect" flow.

    NOTE: NodeAnnotationCreateSerializer (see
    annotation/serializers/nodes.py) does NOT currently have
    `connection_mode`/`previous_node_id` input fields — those need to be
    added there before a view can actually collect them from the request.
    Flagging that gap rather than silently working around it; this
    function's signature is what that serializer should validate into.
    """
    node = create_node(
        floor=floor,
        room=room,
        name=name,
        node_type=node_type,
        geometry=geometry,
        active=active,
        navigable=navigable,
        metadata=metadata,
        actor=actor,
    )
    if node_type == Node.TYPE_AUXILIARY:
        connect_auxiliary_node(
            node,
            connection_mode=connection_mode,
            previous_node_id=previous_node_id,
            actor=actor,
        )
    return node


def connect_auxiliary_node(
    node: Node, *, connection_mode: str, previous_node_id: Optional[int] = None, actor=None
) -> Optional[Edge]:
    """
    Implements the Auxiliary Node Tool's three connection modes (per the
    Admin Map Annotation notes). Returns the created Edge, or None if no
    edge was created.

    - "no_connection": does nothing.
    - "place_order": connects to `previous_node_id` — the Admin notes are
      explicit that this state is lost on page reload ("the previous
      placement state of the node will be lost and reset as well"), which
      means it's tracked client-side (in the frontend's Zustand store),
      not the backend. The client is expected to pass the id of the
      last-placed node with each request; this function does not try to
      infer it from anything server-side.
    - "nearest_node": see _find_nearest_eligible_node()'s docstring for
      what "nearest" means here and why raycasting itself isn't
      reproduced server-side.
    """
    if connection_mode == CONNECTION_MODE_NO_CONNECTION:
        return None

    if connection_mode == CONNECTION_MODE_PLACE_ORDER:
        if previous_node_id is None:
            return None
        previous_node = Node.objects.filter(
            id=previous_node_id, deleted_at__isnull=True
        ).first()
        if previous_node is None:
            return None
        return _create_auto_edge(node, previous_node, actor=actor)

    if connection_mode == CONNECTION_MODE_NEAREST_NODE:
        candidate = _find_nearest_eligible_node(node)
        if candidate is None:
            return None
        return _create_auto_edge(node, candidate, actor=actor)

    raise ValueError(f"Unknown connection_mode: {connection_mode!r}")


def _find_nearest_eligible_node(node: Node, *, candidate_pool_size: int = 5) -> Optional[Node]:
    """
    "Nearest Node" connection mode.

    The Admin notes describe this as raycasting ("Uses raycasting to find
    the node at the closest proximity") — that's a screen-space rendering
    operation (which node a ray from the cursor first intersects,
    accounting for occlusion by geometry) that only makes sense client-side
    in the Three.js scene. It is NOT reproduced here.

    What this implements instead is the fallback the same notes describe:
    "if more than one nodes are at the same distance, uses a set of
    criteria to determine the best possible candidate." The notes don't
    say what that criteria actually is, so this makes an explicit,
    documented choice rather than an arbitrary one:
      1. Closest by planar (2D) PostGIS distance — ties broken by:
      2. Same floor as the new node, over a different floor.
      3. Another auxiliary node, over a room/kiosk/sensor/area_entrance
         endpoint — hallway-to-hallway connections are what keeps the
         graph navigable, so they're preferred when distance is a wash.
      4. Whichever candidate was created first (stable, deterministic).

    Revisit this ordering if it doesn't match what the frontend's
    raycasting actually tends to pick once that exists — this is a
    reasonable placeholder, not a validated design.
    """
    candidates = list(
        Node.objects.filter(active=True, navigable=True, deleted_at__isnull=True)
        .exclude(id=node.id)
        .annotate(distance=Distance("geometry", node.geometry))
        .order_by("distance")[:candidate_pool_size]
    )
    if not candidates:
        return None

    def sort_key(candidate: Node):
        same_floor = 0 if candidate.floor_id == node.floor_id else 1
        is_auxiliary = 0 if candidate.node_type == Node.TYPE_AUXILIARY else 1
        return (candidate.distance, same_floor, is_auxiliary, candidate.created_at)

    candidates.sort(key=sort_key)
    return candidates[0]


def _create_auto_edge(node_a: Node, node_b: Node, *, actor=None) -> Edge:
    """
    Auto-generated connections are always bidirectional — an auxiliary
    hallway connection has no inherent direction, unlike a manually-drawn
    Edge where the annotator might deliberately pick Forward/Reverse via
    the Edge Tool. Geometry is a straight line between the two node
    points (same fallback documented on EdgeAnnotationCreateSerializer).
    """
    return create_edge(
        from_node=node_a,
        to_node=node_b,
        direction=Edge.DIRECTION_BIDIRECTIONAL,
        actor=actor,
    )


# --------------------------------------------------------------------------
# Edge creation / deletion
# --------------------------------------------------------------------------


def _straight_line_between(node_a: Node, node_b: Node) -> LineString:
    return LineString(node_a.geometry.coords, node_b.geometry.coords, srid=3857)


def create_edge(
    *,
    from_node: Node,
    to_node: Node,
    direction: str = Edge.DIRECTION_BIDIRECTIONAL,
    geometry: Optional[LineString] = None,
    metadata: Optional[dict] = None,
    active: bool = True,
    actor=None,
) -> Edge:
    """
    POST /annotations/edges. Synthesizes a straight-line geometry between
    the two nodes if the client didn't supply one (see
    EdgeAnnotationCreateSerializer's NOTE).
    """
    with transaction.atomic():
        edge = Edge.objects.create(
            from_node=from_node,
            to_node=to_node,
            direction=direction,
            geometry=geometry or _straight_line_between(from_node, to_node),
            metadata=metadata or {},
            active=active,
        )
        log_annotation_change(actor=actor, action=AuditEvent.ACTION_CREATE, instance=edge)
    return edge


def delete_edge(edge: Edge, *, actor=None) -> None:
    """
    DELETE /annotations/edges/{id}. Soft delete (deleted_at), consistent
    with the project's "soft deletes over hard deletes" convention — see
    delete_node()'s docstring for why that matters for cascade behavior in
    general.
    """
    with transaction.atomic():
        edge.deleted_at = timezone.now()
        edge.active = False
        edge.save(update_fields=["deleted_at", "active", "updated_at"])
        log_annotation_change(actor=actor, action=AuditEvent.ACTION_DELETE, instance=edge)


# --------------------------------------------------------------------------
# Node deletion (with manual cascade)
# --------------------------------------------------------------------------


def delete_node(node: Node, *, actor=None) -> None:
    """
    DELETE /annotations/nodes/{id} — the API design says this "cascades to
    safely remove all edges connected to it."

    IMPORTANT: this project uses soft deletes everywhere (`deleted_at`
    columns), which means the database's own `on_delete=CASCADE`
    (Edge -> Node) and `on_delete=SET_NULL` (FloorTransition -> Node)
    foreign-key behavior NEVER FIRES here — those only trigger on an
    actual SQL DELETE, and a soft delete is just an UPDATE setting
    `deleted_at`. The Node row is never actually deleted, so Django/
    Postgres never runs the FK's on_delete handler. The "cascade" the
    endpoint promises has to be done by hand, in this function — without
    it, Edge and FloorTransition rows would silently keep pointing at a
    node the Admin believes is gone.

    Both connected Edges and any FloorTransition using this node as an
    endpoint are soft-deleted alongside the Node itself. This is broader
    than the endpoint description technically asks for (it only mentions
    edges) — a floor transition with a "deleted" endpoint is just as
    broken as an edge would be, and navigation/services.py's graph
    builder already filters out soft-deleted rows of both kinds, so
    leaving them active but orphaned would be inconsistent for no benefit.
    """
    now = timezone.now()
    with transaction.atomic():
        Edge.objects.filter(
            Q(from_node=node) | Q(to_node=node), deleted_at__isnull=True
        ).update(deleted_at=now, active=False, updated_at=now)

        FloorTransition.objects.filter(
            Q(from_node=node) | Q(to_node=node), deleted_at__isnull=True
        ).update(deleted_at=now, active=False, updated_at=now)

        node.deleted_at = now
        node.active = False
        node.save(update_fields=["deleted_at", "active", "updated_at"])

        log_annotation_change(actor=actor, action=AuditEvent.ACTION_DELETE, instance=node)


# --------------------------------------------------------------------------
# Floor transition creation / deletion
# --------------------------------------------------------------------------


def create_floor_transition(
    *,
    transition_type: str,
    from_node: Node,
    to_node: Node,
    active: bool = True,
    actor=None,
) -> FloorTransition:
    """POST /annotations/transitions."""
    with transaction.atomic():
        transition = FloorTransition.objects.create(
            transition_type=transition_type,
            from_node=from_node,
            to_node=to_node,
            active=active,
        )
        log_annotation_change(actor=actor, action=AuditEvent.ACTION_CREATE, instance=transition)
    return transition


def delete_floor_transition(transition: FloorTransition, *, actor=None) -> None:
    """DELETE /annotations/transitions/{id}. Soft delete, same as delete_edge()."""
    with transaction.atomic():
        transition.deleted_at = timezone.now()
        transition.active = False
        transition.save(update_fields=["deleted_at", "active", "updated_at"])
        log_annotation_change(actor=actor, action=AuditEvent.ACTION_DELETE, instance=transition)