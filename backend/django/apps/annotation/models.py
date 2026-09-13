"""
apps/annotation/models.py

Owns: nothing.

The Annotation API is a CRUD surface over spatial data that already belongs
to the `map` app (Node, Edge, FloorTransition, Room, Entrance, Stair,
Elevator, OutdoorWalkway, Area, Floor) plus write access to
`analytics.AuditEvent` (every annotation mutation should log one, per the
Security Architecture notes: "Auditability — Log important
administrative/security events").

Typical views.py/services.py in this app would do:

    from map.models import Node, Edge, FloorTransition, Room, Entrance, Stair, Elevator, OutdoorWalkway
    from analytics.models import AuditEvent

No models.py content is needed here.
"""
from django.db import models

# Create your models here.
