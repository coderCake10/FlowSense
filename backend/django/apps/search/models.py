"""
apps/search/models.py

Owns: 
analytics.search_events

Kept in the `search` app (rather than `analytics`, despite the schema-
qualified name) because the Search Service is the functional owner of search
logging per the Architecture notes ("Search Service ... Handles: ... Failed
search logging"). The Analytics API reads the same table for dashboards.

Also referenced by: 
analytics (dashboard's failed-search / success-rate widgets)
"""
from django.db import models

from map.models import Room
from fs_sessions.models import KioskSession


class SearchEvent(models.Model):
    id = models.BigAutoField(primary_key=True)
    kiosk_session = models.ForeignKey(
        KioskSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="search_events",
        db_column="kiosk_session_id",
    )
    query_text = models.TextField()
    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="search_events",
        db_column="room_id",
    )
    result_count = models.IntegerField(default=0)
    resolved = models.BooleanField()
    selected_result = models.BooleanField(default=False)
    search_latency_ms = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = '"analytics"."search_events"'
        indexes = [
            models.Index(fields=["-created_at"], name="idx_search_events_created"),
            models.Index(fields=["resolved"], name="idx_search_events_resolved"),
        ]

    def __str__(self):
        return f'"{self.query_text}" (resolved={self.resolved})'