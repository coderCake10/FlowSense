"""
apps/navigation/models.py

Owns: nothing.

The Navigation API's endpoint table lists navigation.nodes, navigation.edges,
navigation.floor_transitions, campus.areas/floors/rooms,
operations.navigation_sessions, and analytics.navigation_requests/destinations
— but every one of those tables is owned by another app (map, sessions,
analytics respectively; see README). This app is a pure computation/routing
service: it runs A* (Manhattan-distance heuristic per the architecture notes)
over `map.Node` / `map.Edge` / `map.FloorTransition`, and reads/writes
`analytics.NavigationRequest`, `analytics.NavigationDestination`, and
`sessions.NavigationSession` through their owning apps' models.

Typical services.py in this app would do:

    from map.models import Node, Edge, FloorTransition
    from analytics.models import NavigationRequest, NavigationDestination
    from sessions.models import NavigationSession

No models.py content is needed here.
"""

from django.db import models

# Create your models here.
