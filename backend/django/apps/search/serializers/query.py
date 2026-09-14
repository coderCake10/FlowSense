"""
apps/search/serializers/query.py

Input validation for both Search API endpoints. Both are read-only GET
endpoints whose input arrives as query parameters, not a request body —
these serializers exist so the view can validate `request.query_params`
the same way it would validate a POST body:

    params = SearchQuerySerializer(data=request.query_params)
    params.is_valid(raise_exception=True)

...rather than hand-rolling `request.query_params.get(...)` + manual type
coercion/bounds-checking directly in the view.

Neither serializer executes anything — no database query, no fuzzy
matching, no ranking. That's entirely the search service's job (see the
NOTE in results.py).
"""
from rest_framework import serializers


class SearchQuerySerializer(serializers.Serializer):
    """
    GET /api/v1/search query params.

    `q` requires at least 2 characters — this is a full search across
    rooms and personnel, not autocomplete, so it's worth guarding against
    single-character queries that would return a huge, useless result set.
    (Compare SearchSuggestionsQuerySerializer below, which allows a single
    character since that's exactly the autocomplete use case.)
    """

    RESULT_TYPE_CHOICES = ["all", "room", "personnel"]

    q = serializers.CharField(min_length=2, max_length=255, trim_whitespace=True)
    result_type = serializers.ChoiceField(
        choices=RESULT_TYPE_CHOICES, required=False, default="all"
    )
    # Optional scoping filters — e.g. "search only within this building" for
    # a kiosk that already knows which area it's mounted in.
    area_id = serializers.IntegerField(required=False, allow_null=True)
    floor_id = serializers.IntegerField(required=False, allow_null=True)
    limit = serializers.IntegerField(required=False, default=20, min_value=1, max_value=50)


class SearchSuggestionsQuerySerializer(serializers.Serializer):
    """GET /api/v1/search/suggestions query params — fired on every keystroke."""

    q = serializers.CharField(min_length=1, max_length=255, trim_whitespace=True)
    limit = serializers.IntegerField(required=False, default=10, min_value=1, max_value=25)