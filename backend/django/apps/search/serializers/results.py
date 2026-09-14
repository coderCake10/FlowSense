"""
apps/search/serializers/results.py

Backs:
  GET /api/v1/search              -> SearchResultSerializer (many)
  GET /api/v1/search/suggestions  -> SearchSuggestionSerializer (many)

Both endpoints return a mix of two record types (Room and Personnel) in one
ranked list, so both serializers are polymorphic: they render whichever
kind of hit they're handed rather than assuming one shape.

NOTE (business logic — lives in search/services.py, not here, and that
module doesn't exist yet):
  - Actually running the query: PostgreSQL full-text search
    (to_tsvector/plainto_tsquery over campus.rooms — see the
    idx_rooms_search GIN index noted in map/models.py) and/or pg_trgm
    fuzzy/similarity matching over room codes, aliases, and personnel
    names.
  - Ranking/scoring results and deciding `matched_field` (which column the
    hit actually matched on).
  - Merging and deduplicating room vs. personnel hits into one ordered
    list, and applying `area_id`/`floor_id` scoping filters.
  - Logging an analytics.SearchEvent row per query (query_text,
    result_count, resolved, search_latency_ms) — a side effect the search
    service performs, not something either serializer does or knows about.
  - Prefix/typeahead-specific matching logic for the suggestions endpoint
    (which is intentionally cheaper/faster than the full search above).

These serializers only know how to shape whatever the service hands them.
"""
from rest_framework import serializers

from map.serializers import PersonnelSerializer, RoomListSerializer


class SearchResultSerializer(serializers.Serializer):
    """
    One row of GET /api/v1/search results.

    Expects each item passed in to be a plain dict shaped like:

        {
            "result_type": "room" | "personnel",
            "score": <float>,             # relevance/similarity score
            "matched_field": <str>,       # e.g. "room_alias", "full_name"
            "object": <map.Room | map.Personnel>,
        }

    Renders a "room" or "personnel" key depending on `result_type` — never
    both, and never a null placeholder for the one that doesn't apply.
    """

    result_type = serializers.CharField(read_only=True)
    score = serializers.FloatField(read_only=True)
    matched_field = serializers.CharField(read_only=True)

    def to_representation(self, instance):
        result_type = instance["result_type"]
        data = {
            "result_type": result_type,
            "score": instance["score"],
            "matched_field": instance["matched_field"],
        }

        if result_type == "room":
            data["room"] = RoomListSerializer(instance["object"]).data
        elif result_type == "personnel":
            data["personnel"] = PersonnelSerializer(instance["object"]).data
        else:
            raise ValueError(f"Unknown search result_type: {result_type!r}")

        return data


class SearchSuggestionSerializer(serializers.Serializer):
    """
    One row of GET /api/v1/search/suggestions — a lightweight autocomplete
    entry, not a full room/personnel record (that's what GET /search and
    the Map API's own detail endpoints are for). Deliberately flat: just
    enough for a dropdown row and a way to resolve the pick afterward.

    Expects each item to be a plain dict shaped like:

        {
            "result_type": "room" | "personnel",
            "id": <int>,      # the underlying Room or Personnel id
            "label": <str>,   # display text, e.g. "Guidance Counselling Center (EA-101)"
        }
    """

    result_type = serializers.ChoiceField(choices=["room", "personnel"], read_only=True)
    id = serializers.IntegerField(read_only=True)
    label = serializers.CharField(read_only=True)