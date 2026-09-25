from rest_framework.routers import SimpleRouter

from analytics.views import ActivityViewSet

router = SimpleRouter()
router.register("", ActivityViewSet, basename="activity")
urlpatterns = router.urls
