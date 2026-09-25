from django.urls import path

from analytics import views

urlpatterns = [
    path("dashboard/", views.DashboardView.as_view(), name="analytics-dashboard"),
    path("navigation/", views.NavigationAnalyticsView.as_view(), name="analytics-navigation"),
    path("search/", views.SearchAnalyticsView.as_view(), name="analytics-search"),
    path("kiosks/", views.KioskAnalyticsView.as_view(), name="analytics-kiosks"),
    path("sensors/", views.SensorAnalyticsView.as_view(), name="analytics-sensors"),
    path("spatial/", views.SpatialAnalyticsView.as_view(), name="analytics-spatial"),
    path("system/", views.SystemAnalyticsView.as_view(), name="analytics-system"),
    path("activity/", views.ActivityAnalyticsView.as_view(), name="analytics-activity"),
    path("qr/", views.QrAnalyticsView.as_view(), name="analytics-qr"),
    path("qr/events/", views.QrEventListView.as_view(), name="analytics-qr-events"),
]
