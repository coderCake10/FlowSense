"""
apps/search/urls.py

Wires up the Search API. Included by config/urls.py, expected to be
mounted at /api/v1/search/.

Registered with an empty prefix ("") since both endpoints are actions on
one "search" resource rather than separate sub-resources:

  ''             -> SearchViewSet.list        (GET /api/v1/search)
  'suggestions/' -> SearchViewSet.suggestions  (GET /api/v1/search/suggestions)
"""
from rest_framework.routers import DefaultRouter

from search.views import SearchViewSet

router = DefaultRouter(trailing_slash=True)
router.register("", SearchViewSet, basename="search")

urlpatterns = router.urls