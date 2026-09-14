"""
apps/search/views.py

Backs:
  GET /api/v1/search
  GET /api/v1/search/suggestions

Both endpoints are pure queries with no create/retrieve/update/delete
story, but unlike navigation's route endpoints (see
navigation/views/routes.py), they DO share a common resource shape: both
return a *list* of items for a given `q`, just at different levels of
detail/speed. That's exactly what a ViewSet's `list()` action plus one
sibling `@action` is for, so a single SearchViewSet handles both instead
of two standalone APIViews. (Contrast with
NavigationRouteCreateView/NavigationRouteDetailView, which needed APIView
because POST and GET-by-id are genuinely different URL shapes — not two
flavors of "list".)

All actual query execution, ranking, and SearchEvent logging lives in
search.services — this view only validates query params, calls the
service, and shapes the response.
"""
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from search import services
from search.serializers import (
    SearchQuerySerializer,
    SearchResultSerializer,
    SearchSuggestionSerializer,
    SearchSuggestionsQuerySerializer,
)

# NOTE: how a kiosk identifies its own session (to attribute search
# analytics to it — see services._resolve_kiosk_session) isn't pinned down
# anywhere else yet; the Kiosk Sessions API doesn't specify whether the
# session id travels as a cookie, a header, or a query param. Reading it
# from a header here is an assumption, not a settled contract — revisit
# once the fs_sessions/hardware kiosk-session wiring exists, and move this
# constant to common/constants if it turns out to be shared elsewhere.
KIOSK_SESSION_HEADER = "X-Kiosk-Session-Id"


class SearchViewSet(GenericViewSet):
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        if self.action == "suggestions":
            return SearchSuggestionSerializer
        return SearchResultSerializer

    def list(self, request, *args, **kwargs):
        """GET /api/v1/search"""
        query_params = SearchQuerySerializer(data=request.query_params)
        query_params.is_valid(raise_exception=True)
        validated = query_params.validated_data

        result_payload = services.execute_search(
            query_text=validated["q"],
            result_type=validated["result_type"],
            area_id=validated.get("area_id"),
            floor_id=validated.get("floor_id"),
            limit=validated["limit"],
            kiosk_session_id=request.headers.get(KIOSK_SESSION_HEADER),
        )

        serializer = SearchResultSerializer(result_payload["results"], many=True)
        return Response(
            {
                "result_count": result_payload["result_count"],
                "results": serializer.data,
            }
        )

    @action(detail=False, methods=["get"], url_path="suggestions")
    def suggestions(self, request, *args, **kwargs):
        """GET /api/v1/search/suggestions"""
        query_params = SearchSuggestionsQuerySerializer(data=request.query_params)
        query_params.is_valid(raise_exception=True)
        validated = query_params.validated_data

        suggestion_payload = services.get_suggestions(
            query_text=validated["q"], limit=validated["limit"]
        )

        serializer = SearchSuggestionSerializer(suggestion_payload, many=True)
        return Response(serializer.data)