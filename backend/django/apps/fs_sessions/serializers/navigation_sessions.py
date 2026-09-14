"""
apps/fs_sessions/serializers/navigation_sessions.py

Backs both the Navigation Sessions API and the QR Sessions API. Both
sections of 00 API Design.md list `operations.navigation_sessions` as
their table and substantially overlap in what they do — both have
create/complete/cancel; the QR Sessions API additionally has "scan"; the
Navigation Sessions API additionally has pause/resume/reach-destination.
Rather than building two parallel serializer sets for what's structurally
the same resource viewed from two framing angles (Kiosk-side checklist vs.
mobile-handoff QR flow), this file has ONE read serializer
(NavigationSessionSerializer) used by both GET /sessions/navigation/{id}
and GET /sessions/{id}, and ONE create serializer used by both
POST /sessions/navigation and POST /sessions.

`operations.navigation_sessions` itself carries no route/checklist data —
that lives on analytics.NavigationRequest/NavigationDestination (owned by
the `analytics` app), linked back via NavigationRequest.navigation_session.
So, like map's MapContextSerializer and navigation's
NavigationRouteSerializer, the read serializer here is a plain Serializer
over an assembled dict, not a ModelSerializer over
fs_sessions.NavigationSession alone.

Pause/resume/complete/cancel/scan need no request serializer at all —
they're bodyless status-transition actions; the response is just
NavigationSessionSerializer showing the session's new state.
"""
from rest_framework import serializers

from analytics.models import NavigationRequest
from navigation.serializers.nodes import NavigationNodeSummarySerializer
from navigation.serializers.routes import NavigationRouteDestinationSerializer


class NavigationSessionCreateSerializer(serializers.Serializer):
    """
    POST /sessions/navigation and POST /sessions — treated as the same
    creation operation; see module docstring.

    Wraps an ALREADY-COMPUTED route (an analytics.NavigationRequest from a
    prior POST /navigation/routes call) in a session — this deliberately
    does NOT accept origin/destination nodes itself and recompute a route.
    Route computation is the `navigation` app's job
    (navigation.services.generate_route); this app's job is session
    lifecycle (QR code issuance, scan tracking, pause/resume/checklist
    status) layered on top of a route that already exists. The
    `queryset` below gets "exists" and "is actually in a usable state"
    validation for free from PrimaryKeyRelatedField.

    NOTE (business logic) — lives in a service, NOT here:
      - Generating session_token_hash (and the raw token the QR code
        actually encodes) — same pattern as
        authentication.services._create_admin_session, and for the same
        reason the raw value is never in this serializer or
        NavigationSessionSerializer's output.
      - Checking the referenced NavigationRequest isn't already attached
        to another live session — that requires querying a DIFFERENT
        resource (NavigationSession) than the one being validated here,
        which is a cross-resource business rule, not field validation.
      - Setting expires_at (how long the QR/session stays valid before
        the Kiosk gives up and returns to the Attract Screen).
    """

    navigation_request_id = serializers.PrimaryKeyRelatedField(
        source="navigation_request",
        queryset=NavigationRequest.objects.filter(status=NavigationRequest.STATUS_GENERATED),
    )
    kiosk_session_id = serializers.UUIDField(required=False, allow_null=True)


class NavigationSessionSerializer(serializers.Serializer):
    """
    GET /sessions/navigation/{id} and GET /sessions/{id} — same payload
    either way (see module docstring). The view/service is expected to
    hand this serializer an object/dict shaped like:

        {
            "id": <uuid>,
            "status": <str>,
            "kiosk_session_id": <uuid | None>,
            "expires_at": <datetime>,
            "created_at": <datetime>,
            "scanned_at": <datetime | None>,
            "completed_at": <datetime | None>,
            "origin_node": <map.Node | None>,
            "route_distance": <Decimal | None>,
            "destinations": <QuerySet[analytics.NavigationDestination]>,
        }

    Does NOT include session_token_hash or the QR code's raw value
    anywhere — same reasoning as
    authentication.serializers.SessionStatusSerializer excluding
    session_token_hash. If a client needs the literal QR code image/
    payload, that's a distinct concern (most likely rendered client-side
    from a short-lived public value returned once at creation, not part
    of this general-purpose status read).
    """

    id = serializers.UUIDField(read_only=True)
    status = serializers.CharField(read_only=True)
    kiosk_session_id = serializers.UUIDField(read_only=True, allow_null=True)
    expires_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    scanned_at = serializers.DateTimeField(read_only=True, allow_null=True)
    completed_at = serializers.DateTimeField(read_only=True, allow_null=True)
    origin_node = NavigationNodeSummarySerializer(read_only=True, allow_null=True)
    route_distance = serializers.DecimalField(
        max_digits=18, decimal_places=4, read_only=True, allow_null=True
    )
    destinations = NavigationRouteDestinationSerializer(many=True, read_only=True)


class DestinationReachSerializer(serializers.Serializer):
    """
    POST /sessions/{id}/destinations/{destination_id}/reach.

    `detection_method` captures how the checklist item was marked
    reached — per the Mobile Handoff notes, this can be either an
    automatic BLE-proximity detection or the user manually confirming (a
    confirmation modal appears either way: "states that the location was
    detected and asks the user to proceed or to cancel"). Optional,
    defaulting to "manual" — a bare API call with no extra context is,
    definitionally, not an automatic BLE trigger telling us otherwise.

    NOTE (business logic) — lives in a service, NOT here: actually
    setting NavigationDestination.reached_at, validating the destination
    belongs to this session's NavigationRequest, and deciding whether
    reaching every destination should auto-transition the session to
    'completed'.
    """

    DETECTION_METHOD_CHOICES = ["manual", "ble"]

    detection_method = serializers.ChoiceField(
        choices=DETECTION_METHOD_CHOICES, required=False, default="manual"
    )