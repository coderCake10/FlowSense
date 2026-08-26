"""
apps/map/models.py

Owns: 
campus.areas, 
campus.floors, 
campus.rooms, 
campus.personnel,
campus.room_personnel, 
campus.entrances, 
campus.stairs, 
campus.elevators,
campus.outdoor_walkways, 
navigation.nodes, 
navigation.edges,
navigation.floor_transitions

The `navigation.*` tables are owned here (not in the `navigation` app) because
the Architecture notes explicitly assign "navigation nodes, edges" to the Map
Service, and the Map API's own endpoint table lists them under the `map`
Django app. The `navigation` app is a pathfinding *service* that reads/writes
these models rather than owning them.

Also referenced by: 
navigation (routing/A*), 
annotation (CRUD surface for all node/edge/room/entrance/stair/elevator/walkway data), 
hardware (Kiosk/Sensor.area, .floor, .map_node), 
assets (Asset.area), 
analytics(NavigationRequest.origin_node, NavigationDestination.destination_node,
dashboard counts), 
system (status/health summaries).
"""
from django.contrib.gis.db import models


class Area(models.Model):
    TYPE_CAMPUS = "campus"
    TYPE_BUILDING = "building"
    TYPE_OUTDOOR = "outdoor"
    TYPE_CONNECTOR = "connector"
    AREA_TYPE_CHOICES = [
        (TYPE_CAMPUS, "Campus"),
        (TYPE_BUILDING, "Building"),
        (TYPE_OUTDOOR, "Outdoor"),
        (TYPE_CONNECTOR, "Connector"),
    ]

    id = models.BigAutoField(primary_key=True)
    parent_area = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sub_areas",
        db_column="parent_area_id",
    )
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=150)
    description = models.TextField(null=True, blank=True)
    area_type = models.CharField(max_length=30, choices=AREA_TYPE_CHOICES)
    geometry = models.GeometryField(srid=3857, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"campus"."areas"'
        indexes = [
            models.Index(fields=["parent_area"], name="idx_areas_parent"),
            # GiST index on `geometry` is created automatically by GeoDjango
        ]

    def __str__(self):
        return f"{self.code} — {self.name}"


class Floor(models.Model):
    id = models.BigAutoField(primary_key=True)
    area = models.ForeignKey(
        Area, on_delete=models.CASCADE, related_name="floors", db_column="area_id"
    )
    glb_node_name = models.CharField(max_length=255, null=True, blank=True)
    floor_order = models.IntegerField()
    elevation = models.DecimalField(max_digits=16, decimal_places=4, null=True, blank=True)
    navigable = models.BooleanField(default=True)
    visible_in_kiosk = models.BooleanField(default=True)
    active = models.BooleanField(default=True)
    geometry = models.PolygonField(srid=3857, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"campus"."floors"'
        constraints = [
            models.UniqueConstraint(fields=["area", "floor_order"], name="uq_floor_order"),
        ]

    def __str__(self):
        return f"{self.area.code} — Floor {self.floor_order}"


class Room(models.Model):
    TYPE_ROOM = "room"
    TYPE_OFFICE = "office"
    TYPE_LABORATORY = "laboratory"
    TYPE_FACILITY = "facility"
    TYPE_SERVICE = "service"
    TYPE_RESTROOM = "restroom"
    TYPE_HALL = "hall"
    TYPE_OTHER = "other"
    ROOM_TYPE_CHOICES = [
        (TYPE_ROOM, "Room"),
        (TYPE_OFFICE, "Office"),
        (TYPE_LABORATORY, "Laboratory"),
        (TYPE_FACILITY, "Facility"),
        (TYPE_SERVICE, "Service"),
        (TYPE_RESTROOM, "Restroom"),
        (TYPE_HALL, "Hall"),
        (TYPE_OTHER, "Other"),
    ]

    id = models.BigAutoField(primary_key=True)
    floor = models.ForeignKey(
        Floor, on_delete=models.CASCADE, related_name="rooms", db_column="floor_id"
    )
    room_code = models.CharField(max_length=100)
    room_alias = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    room_type = models.CharField(max_length=50, choices=ROOM_TYPE_CHOICES, default=TYPE_ROOM)
    is_searchable = models.BooleanField(default=True)
    is_navigable = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    geometry = models.PolygonField(srid=3857, null=True, blank=True)
    image_path = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"campus"."rooms"'
        constraints = [
            models.UniqueConstraint(fields=["floor", "room_code"], name="uq_room_code_per_floor"),
        ]
        # NOTE: `idx_rooms_search` is a GIN index over
        # to_tsvector('simple', room_code || ' ' || room_alias || ' ' || description)
        # This is a functional index and must be added via a raw-SQL migration
        # (RunSQL) — it cannot be expressed as a plain Django Index.

    def __str__(self):
        return f"{self.room_code} ({self.room_alias})"


class Personnel(models.Model):
    id = models.BigAutoField(primary_key=True)
    full_name = models.CharField(max_length=255)
    email = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"campus"."personnel"'

    def __str__(self):
        return self.full_name


class RoomPersonnel(models.Model):
    """
    Composite PK (room_id, personnel_id) in the DB, no surrogate id column.
    Modeled here with a surrogate BigAutoField + UniqueConstraint since
    standard Django doesn't support multi-column primary keys pre-5.2.
    """

    id = models.BigAutoField(primary_key=True)
    room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name="room_personnel", db_column="room_id"
    )
    personnel = models.ForeignKey(
        Personnel,
        on_delete=models.CASCADE,
        related_name="room_personnel",
        db_column="personnel_id",
    )

    class Meta:
        db_table = '"campus"."room_personnel"'
        constraints = [
            models.UniqueConstraint(fields=["room", "personnel"], name="room_personnel_pk"),
        ]

    def __str__(self):
        return f"{self.personnel} @ {self.room}"


class Entrance(models.Model):
    id = models.BigAutoField(primary_key=True)
    area = models.ForeignKey(
        Area, on_delete=models.CASCADE, related_name="entrances", db_column="area_id"
    )
    name = models.CharField(max_length=150)
    entrance_type = models.CharField(max_length=50, null=True, blank=True)
    is_primary = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    geometry = models.PointField(srid=3857, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = '"campus"."entrances"'

    def __str__(self):
        return self.name


class Stair(models.Model):
    id = models.BigAutoField(primary_key=True)
    area = models.ForeignKey(
        Area, on_delete=models.CASCADE, related_name="stairs", db_column="area_id"
    )
    name = models.CharField(max_length=150, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    geometry = models.GeometryField(srid=3857, null=True, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = '"campus"."stairs"'

    def __str__(self):
        return self.name or f"Stair #{self.pk}"


class Elevator(models.Model):
    id = models.BigAutoField(primary_key=True)
    area = models.ForeignKey(
        Area, on_delete=models.CASCADE, related_name="elevators", db_column="area_id"
    )
    name = models.CharField(max_length=150, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    geometry = models.GeometryField(srid=3857, null=True, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = '"campus"."elevators"'

    def __str__(self):
        return self.name or f"Elevator #{self.pk}"


class OutdoorWalkway(models.Model):
    id = models.BigAutoField(primary_key=True)
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="outdoor_walkways",
        db_column="area_id",
    )
    name = models.CharField(max_length=150, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    navigable = models.BooleanField(default=True)
    active = models.BooleanField(default=True)
    geometry = models.LineStringField(srid=3857, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = '"campus"."outdoor_walkways"'

    def __str__(self):
        return self.name or f"Walkway #{self.pk}"


class Node(models.Model):
    TYPE_ROOM = "room"
    TYPE_AUXILIARY = "auxiliary"
    TYPE_KIOSK = "kiosk"
    TYPE_SENSOR = "sensor"
    TYPE_AREA_ENTRANCE = "area_entrance"
    NODE_TYPE_CHOICES = [
        (TYPE_ROOM, "Room"),
        (TYPE_AUXILIARY, "Auxiliary"),
        (TYPE_KIOSK, "Kiosk"),
        (TYPE_SENSOR, "Sensor"),
        (TYPE_AREA_ENTRANCE, "Area Entrance"),
    ]

    id = models.BigAutoField(primary_key=True)
    floor = models.ForeignKey(
        Floor, on_delete=models.CASCADE, related_name="nodes", db_column="floor_id"
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="nodes",
        db_column="room_id",
    )
    name = models.CharField(max_length=150)
    node_type = models.CharField(max_length=40, choices=NODE_TYPE_CHOICES)
    # PointZ(3857) — three-dimensional point
    geometry = models.PointField(srid=3857, dim=3)
    active = models.BooleanField(default=True)
    navigable = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"navigation"."nodes"'
        indexes = [
            models.Index(fields=["floor"], name="idx_navigation_nodes_floor"),
            models.Index(fields=["node_type"], name="idx_navigation_nodes_type"),
        ]

    def __str__(self):
        return f"{self.name} ({self.node_type})"


class Edge(models.Model):
    DIRECTION_BIDIRECTIONAL = "bidirectional"
    DIRECTION_FORWARD = "forward"
    DIRECTION_REVERSE = "reverse"
    DIRECTION_CHOICES = [
        (DIRECTION_BIDIRECTIONAL, "Bidirectional"),
        (DIRECTION_FORWARD, "Forward"),
        (DIRECTION_REVERSE, "Reverse"),
    ]

    id = models.BigAutoField(primary_key=True)
    from_node = models.ForeignKey(
        Node, on_delete=models.CASCADE, related_name="edges_from", db_column="from_node_id"
    )
    to_node = models.ForeignKey(
        Node, on_delete=models.CASCADE, related_name="edges_to", db_column="to_node_id"
    )
    direction = models.CharField(
        max_length=20, choices=DIRECTION_CHOICES, default=DIRECTION_BIDIRECTIONAL
    )
    # LineStringZ(3857)
    geometry = models.LineStringField(srid=3857, dim=3, null=True, blank=True)
    active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"navigation"."edges"'
        indexes = [
            models.Index(fields=["from_node"], name="idx_navigation_edges_from"),
            models.Index(fields=["to_node"], name="idx_navigation_edges_to"),
            models.Index(fields=["active"], name="idx_edges_active"),
        ]
        constraints = [
            models.CheckConstraint(
                check=~models.Q(from_node=models.F("to_node")),
                name="chk_edge_nodes_different",
            ),
        ]

    def __str__(self):
        return f"{self.from_node_id} -> {self.to_node_id} ({self.direction})"


class FloorTransition(models.Model):
    TYPE_STAIRS = "stairs"
    TYPE_ELEVATOR = "elevator"
    TYPE_ESCALATOR = "escalator"
    TYPE_OTHER = "other"
    TRANSITION_TYPE_CHOICES = [
        (TYPE_STAIRS, "Stairs"),
        (TYPE_ELEVATOR, "Elevator"),
        (TYPE_ESCALATOR, "Escalator"),
        (TYPE_OTHER, "Other"),
    ]

    id = models.BigAutoField(primary_key=True)
    transition_type = models.CharField(max_length=30, choices=TRANSITION_TYPE_CHOICES)
    from_node = models.ForeignKey(
        Node,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transitions_from",
        db_column="from_node_id",
    )
    to_node = models.ForeignKey(
        Node,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transitions_to",
        db_column="to_node_id",
    )
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"navigation"."floor_transitions"'

    def __str__(self):
        return f"{self.transition_type}: {self.from_node_id} -> {self.to_node_id}"