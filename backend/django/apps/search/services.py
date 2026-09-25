"""
apps/search/services.py

The business logic explicitly kept out of the Search API serializers (see
apps/search/serializers/results.py's module docstring): running the actual
query against campus.rooms / campus.personnel, ranking and merging hits
across both types, autocomplete suggestions, and logging
analytics.search_events (owned by this app — see search/models.py) rows.

Views call `execute_search()` for GET /search and `get_suggestions()` for
GET /search/suggestions. Both take/return plain Python objects (querysets,
dicts) so they can be unit-tested without touching HTTP.
"""
import time
from typing import List, Optional

from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector, TrigramSimilarity
from django.db.models import F, Q
from django.db.models.functions import Greatest

from fs_sessions.models import KioskSession
from map.models import Personnel, Room
from map.services import with_room_node
from search.models import SearchEvent

# --------------------------------------------------------------------------
# Tunable matching constants
# --------------------------------------------------------------------------

# pg_trgm's own default similarity threshold is 0.3; a full search can
# afford to be a bit more permissive than that since results are ranked
# (not just filtered) and the client sees them ordered by relevance.
TRIGRAM_SIMILARITY_THRESHOLD = 0.2

# Suggestions are typed character-by-character against short, partial
# input, so this is intentionally looser than the full-search threshold —
# combined with an `istartswith` prefix match, so it rarely fires alone.
SUGGESTION_SIMILARITY_THRESHOLD = 0.15

# Full-text search uses the 'simple' text search config (no stemming/stop
# words) to match the `idx_rooms_search` GIN index defined in the schema
# (to_tsvector('simple', room_code || ' ' || room_alias || ' ' ||
# description) — see map/models.py's Room.Meta comment). Using a different
# config here would still work, just without the index's help.
_TEXT_SEARCH_CONFIG = "simple"


# --------------------------------------------------------------------------
# Room search
# --------------------------------------------------------------------------


def _search_rooms(
    query_text: str, *, area_id: Optional[int], floor_id: Optional[int], limit: int
) -> List[Room]:
    """
    Full-text rank (over room_code + room_alias + description) combined
    with per-field trigram similarity (for typo tolerance), taking
    whichever signal is strongest per row. Returns annotated Room
    instances — `rank`, `code_similarity`, `alias_similarity`, and `score`
    are extra attributes DRF never sees directly (see
    _infer_room_matched_field and execute_search, which read them before
    handing plain dicts to the serializer).
    """
    queryset = with_room_node(
        Room.objects.filter(deleted_at__isnull=True, is_searchable=True, is_active=True)
    )

    if area_id is not None:
        queryset = queryset.filter(floor__area_id=area_id)
    if floor_id is not None:
        queryset = queryset.filter(floor_id=floor_id)

    search_query = SearchQuery(query_text, config=_TEXT_SEARCH_CONFIG)
    vector = SearchVector("room_code", "room_alias", "description", config=_TEXT_SEARCH_CONFIG)

    queryset = (
        queryset.annotate(
            rank=SearchRank(vector, search_query),
            code_similarity=TrigramSimilarity("room_code", query_text),
            alias_similarity=TrigramSimilarity("room_alias", query_text),
        )
        .annotate(score=Greatest(F("rank"), F("code_similarity"), F("alias_similarity")))
        .filter(
            Q(rank__gt=0)
            | Q(code_similarity__gt=TRIGRAM_SIMILARITY_THRESHOLD)
            | Q(alias_similarity__gt=TRIGRAM_SIMILARITY_THRESHOLD)
        )
        .select_related("floor")
        .order_by("-score")[:limit]
    )

    return list(queryset)


def _infer_room_matched_field(room: Room) -> str:
    """
    Heuristic only. SearchRank blends multiple columns into a single score,
    so there's no single authoritative "matched on this field" answer from
    Postgres for a full-text hit. This picks whichever per-field trigram
    similarity was highest as the best guess, falling back to
    "description" when neither room_code nor room_alias scored
    meaningfully — implying the hit came from the free-text description
    column instead.
    """
    code_similarity = float(getattr(room, "code_similarity", 0) or 0)
    alias_similarity = float(getattr(room, "alias_similarity", 0) or 0)

    if code_similarity >= alias_similarity and code_similarity > TRIGRAM_SIMILARITY_THRESHOLD:
        return "room_code"
    if alias_similarity > TRIGRAM_SIMILARITY_THRESHOLD:
        return "room_alias"
    return "description"


def _room_suggestion_label(room: Room) -> str:
    """
    Matches the Kiosk sidebar's "alias, with code as subheading" pattern
    (see the Application Page Notes' "List of Locations" example) — e.g.
    "Guidance Counselling Center (EA-101)".
    """
    if room.room_alias and room.room_code:
        return f"{room.room_alias} ({room.room_code})"
    return room.room_alias or room.room_code


# --------------------------------------------------------------------------
# Personnel search
# --------------------------------------------------------------------------


def _search_personnel(query_text: str, *, limit: int) -> List[Personnel]:
    """
    campus.personnel has one searchable text column (full_name) and no
    full-text index in the schema, so this is trigram-similarity only — no
    SearchRank/SearchVector involved.
    """
    queryset = (
        Personnel.objects.filter(deleted_at__isnull=True, is_active=True)
        .annotate(similarity=TrigramSimilarity("full_name", query_text))
        .filter(similarity__gt=TRIGRAM_SIMILARITY_THRESHOLD)
        .order_by("-similarity")[:limit]
    )
    return list(queryset)


# --------------------------------------------------------------------------
# Search-event logging
# --------------------------------------------------------------------------


def _resolve_kiosk_session(kiosk_session_id) -> Optional[KioskSession]:
    """
    Best-effort resolution of the kiosk_session_id used to attribute a
    SearchEvent to a session, for analytics.

    Unlike navigation's session resolution (which raises on an invalid
    session, because a broken route genuinely can't proceed), this fails
    OPEN: an unknown, expired, or malformed kiosk_session_id just means the
    resulting SearchEvent isn't attributed to a session — it does NOT
    block the search itself. Losing analytics attribution is an acceptable
    trade-off for never letting the kiosk's core search function 400
    because of a session bookkeeping problem. The broad `except Exception`
    is deliberate here for exactly that reason (a malformed non-UUID
    string, for instance, can raise more than one exception type depending
    on the DB backend).
    """
    if not kiosk_session_id:
        return None
    try:
        return KioskSession.objects.get(id=kiosk_session_id)
    except Exception:
        return None


def _log_search_event(
    *,
    query_text: str,
    kiosk_session: Optional[KioskSession],
    result_count: int,
    search_latency_ms: int,
) -> SearchEvent:
    """
    Writes one search.SearchEvent row per full search request.

    NOTE: intentionally NOT called from get_suggestions() below — logging
    every keystroke of an autocomplete box would flood
    analytics.search_events without adding meaningful "did the user find
    what they wanted" signal; only committed /search calls are logged.

    `room` and `selected_result` are left at their model defaults (NULL /
    False) — there's no "user picked this result" endpoint in the Search
    API to populate them yet. If/when one exists, it should update this
    same row (matched by id, returned to the client) rather than create a
    second one.
    """
    return SearchEvent.objects.create(
        kiosk_session=kiosk_session,
        query_text=query_text,
        result_count=result_count,
        resolved=result_count > 0,
        search_latency_ms=search_latency_ms,
    )


# --------------------------------------------------------------------------
# Public entry points
# --------------------------------------------------------------------------


def execute_search(
    *,
    query_text: str,
    result_type: str = "all",
    area_id: Optional[int] = None,
    floor_id: Optional[int] = None,
    limit: int = 20,
    kiosk_session_id=None,
) -> dict:
    """
    GET /api/v1/search.

    Runs the room and/or personnel query (per `result_type`), merges both
    result sets into one list ranked by score, logs a SearchEvent, and
    returns a dict shaped for
    search.serializers.results.SearchResultSerializer(many=True):

        {"results": [<result dict>, ...], "result_count": <int>}

    Each `<result dict>` is:

        {
            "result_type": "room" | "personnel",
            "score": <float>,
            "matched_field": <str>,
            "object": <map.Room | map.Personnel>,
        }
    """
    start_time = time.perf_counter()

    room_hits: List[Room] = []
    personnel_hits: List[Personnel] = []

    if result_type in ("all", "room"):
        room_hits = _search_rooms(query_text, area_id=area_id, floor_id=floor_id, limit=limit)
    if result_type in ("all", "personnel"):
        # campus.personnel has no direct area/floor scoping (only an
        # indirect one via campus.room_personnel), so area_id/floor_id
        # simply don't apply to this branch.
        personnel_hits = _search_personnel(query_text, limit=limit)

    results = [
        {
            "result_type": "room",
            "score": float(room.score),
            "matched_field": _infer_room_matched_field(room),
            "object": room,
        }
        for room in room_hits
    ] + [
        {
            "result_type": "personnel",
            "score": float(person.similarity),
            "matched_field": "full_name",
            "object": person,
        }
        for person in personnel_hits
    ]

    # Room "score" (full-text rank blended with trigram similarity) and
    # Personnel "similarity" (trigram only) are not calibrated against each
    # other on any principled scale — this is a pragmatic merge, not a
    # statistically justified one. Revisit if room results start crowding
    # out obviously-better personnel matches or vice versa.
    results.sort(key=lambda item: item["score"], reverse=True)
    results = results[:limit]

    latency_ms = int((time.perf_counter() - start_time) * 1000)
    kiosk_session = _resolve_kiosk_session(kiosk_session_id)
    _log_search_event(
        query_text=query_text,
        kiosk_session=kiosk_session,
        result_count=len(results),
        search_latency_ms=latency_ms,
    )

    return {"results": results, "result_count": len(results)}


def get_suggestions(*, query_text: str, limit: int = 10) -> List[dict]:
    """
    GET /api/v1/search/suggestions.

    Cheaper and more typo-tolerant than execute_search(): prefix match
    (`istartswith`) OR trigram similarity, no full-text ranking, no
    SearchEvent logging (see _log_search_event's NOTE for why). Returns a
    list of dicts shaped for
    search.serializers.results.SearchSuggestionSerializer(many=True).
    """
    room_matches = (
        Room.objects.filter(deleted_at__isnull=True, is_searchable=True, is_active=True)
        .annotate(
            code_similarity=TrigramSimilarity("room_code", query_text),
            alias_similarity=TrigramSimilarity("room_alias", query_text),
        )
        .annotate(similarity=Greatest(F("code_similarity"), F("alias_similarity")))
        .filter(
            Q(room_code__istartswith=query_text)
            | Q(room_alias__istartswith=query_text)
            | Q(similarity__gt=SUGGESTION_SIMILARITY_THRESHOLD)
        )
        .order_by("-similarity")[:limit]
    )

    personnel_matches = (
        Personnel.objects.filter(deleted_at__isnull=True, is_active=True)
        .annotate(similarity=TrigramSimilarity("full_name", query_text))
        .filter(
            Q(full_name__istartswith=query_text)
            | Q(similarity__gt=SUGGESTION_SIMILARITY_THRESHOLD)
        )
        .order_by("-similarity")[:limit]
    )

    suggestions = [
        {
            "result_type": "room",
            "id": room.id,
            "label": _room_suggestion_label(room),
            "_similarity": float(room.similarity),
        }
        for room in room_matches
    ] + [
        {
            "result_type": "personnel",
            "id": person.id,
            "label": person.full_name,
            "_similarity": float(person.similarity),
        }
        for person in personnel_matches
    ]

    suggestions.sort(key=lambda item: item["_similarity"], reverse=True)
    for item in suggestions:
        item.pop("_similarity", None)

    return suggestions[:limit]