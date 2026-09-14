"""
apps/navigation/serializers/destinations.py

Backs:
  GET /api/v1/navigation/destinations/{id}

`analytics.navigation_destinations` is owned by the `analytics` app (see
README from the models task — it's schema-owned there since the whole
navigation-request/destination pair is analytics-domain data). This
serializer is the Navigation API's single-destination read view: which
node it points to, its position in the queue, and whether it's been
reached. Distinct from anything `analytics` itself might expose on its own
dashboard-oriented endpoints.
"""
from rest_framework import serializers

from analytics.models import NavigationDestination
from navigation.serializers.nodes import NavigationNodeSummarySerializer


class NavigationDestinationSerializer(serializers.ModelSerializer):
    node = NavigationNodeSummarySerializer(source="destination_node", read_only=True)

    class Meta:
        model = NavigationDestination
        fields = [
            "id",
            "navigation_request",
            "node",
            "destination_order",
            "reached_at",
        ]
        read_only_fields = fields