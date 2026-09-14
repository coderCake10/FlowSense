"""
apps/search/serializers/__init__.py

Re-exports every Search API serializer so views can do:

    from search.serializers import SearchQuerySerializer, SearchResultSerializer, ...
"""
from search.serializers.query import SearchQuerySerializer, SearchSuggestionsQuerySerializer
from search.serializers.results import SearchResultSerializer, SearchSuggestionSerializer

__all__ = [
    "SearchQuerySerializer",
    "SearchSuggestionsQuerySerializer",
    "SearchResultSerializer",
    "SearchSuggestionSerializer",
]