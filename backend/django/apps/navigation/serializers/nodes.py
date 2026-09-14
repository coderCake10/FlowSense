"""
apps/navigation/serializers/nodes.py

Backs:
  GET /api/v1/navigation/nodes/{id}

`navigation.nodes` is owned by the `map` app's models (see
map/models.py — the table lives there because the Architecture notes
assign node/edge ownership to the Map Service). The `navigation` app owns
no tables of its own; it's a pathfinding *service* that reads/writes
`map.Node`, `map.Edge`, `map.FloorTransition` plus the session/analytics
models. This file defines the Navigation API's own view of Node — the
shape a routing/rendering client needs — separately from anything the
`map` app might expose, since the Map API itself has no direct node
endpoint (nodes are only reachable here and through the Annotation API).
"""
from rest_framework import serializers

from common.serializers import GeoJSONField
from map.models import Node


class NavigationNodeSummarySerializer(serializers.ModelSerializer):
    """
    Compact node representation, embedded inside route and destination
    payloads (routes.py, destinations.py) — just enough to place and label
    a waypoint marker on the 3D map. Deliberately excludes `metadata`,
    `active`, `navigable`, and timestamps, which the full detail serializer
    below carries.
    """

    geometry = GeoJSONField(read_only=True)

    class Meta:
        model = Node
        fields = [
            "id", 
            "name", 
            "node_type", 
            "floor", 
            "room", 
            "geometry"
        ]
        read_only_fields = fields


class NavigationNodeSerializer(serializers.ModelSerializer):
    """Full representation for GET /navigation/nodes/{id}."""

    geometry = GeoJSONField(read_only=True)

    class Meta:
        model = Node
        fields = [
            "id",
            "floor",
            "room",
            "name",
            "node_type",
            "geometry",
            "active",
            "navigable",
            "metadata",
        ]
        read_only_fields = fields