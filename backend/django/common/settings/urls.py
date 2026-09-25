from django.urls import path

from common.settings.views import SemesterViewSet, SettingDetailView, SettingListView

semester_list = SemesterViewSet.as_view({"get": "list", "post": "create"})
semester_detail = SemesterViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"})

urlpatterns = [
    path("", SettingListView.as_view(), name="settings"),
    # Before <key>, so "semesters" isn't read as a setting key.
    path("semesters/", semester_list, name="semesters"),
    path("semesters/<int:pk>/", semester_detail, name="semester"),
    path("<str:key>/", SettingDetailView.as_view(), name="setting"),
]
