"""
Kiosk routing (step 8a, network from step 12): the EYA navigation network
generated from the model, room nodes in Map/Search results, the kiosk's
origin node in its heartbeat, and routes through the Navigation API in model
coordinates.
"""
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from analytics.models import NavigationRequest
from common.testing import API, data
from hardware.models import Device
from map.models import Edge, Floor, FloorTransition, Node, Room
from navigation import services
from navigation.coordinates import model_to_point, point_to_model
from navigation.management.commands.seed_eya_routes import load_network
from search.models import SearchEvent


class CoordinateTests(TestCase):
    def test_model_coordinates_round_trip(self):
        point = model_to_point(5.15, 1.02, -11.85)
        self.assertEqual((point.x, point.y, point.z), (5.15, 11.85, 1.02))
        self.assertEqual(point_to_model(point), (5.15, 1.02, -11.85))


class KioskRoutingTests(TestCase):
    def setUp(self):
        call_command("seed_campus", stdout=StringIO())
        call_command("seed_eya_routes", stdout=StringIO())

    def test_seed_is_repeatable(self):
        network = load_network()
        call_command("seed_eya_routes", stdout=StringIO())
        live = Node.objects.filter(deleted_at__isnull=True)
        self.assertEqual(live.count(), sum(len(f["nodes"]) for f in network["floors"]))
        self.assertEqual(
            Edge.objects.filter(deleted_at__isnull=True).count(),
            sum(len(f["edges"]) for f in network["floors"]),
        )
        self.assertEqual(FloorTransition.objects.filter(deleted_at__isnull=True).count(), 15)
        self.assertEqual(live.filter(node_type=Node.TYPE_KIOSK).count(), 1)
        self.assertEqual(Node.objects.filter(deleted_at__isnull=False).count(), 0)

    def test_every_room_has_a_route_from_the_kiosk(self):
        graph = services._build_graph()
        kiosk = Node.objects.get(node_type=Node.TYPE_KIOSK)
        rooms = Room.objects.filter(floor__area__code="EYA")
        self.assertEqual(rooms.count(), 97)
        for room in rooms:
            door = Node.objects.get(room=room, deleted_at__isnull=True)
            path = services._a_star(graph, kiosk.id, door.id)
            floors = {graph.nodes[node_id].floor_id for node_id in path}
            # A route leaves the first floor only by the stairs or the lift.
            self.assertEqual(len(floors) > 1, room.floor.floor_order > 1, room.room_code)

    def test_replaces_the_starter_routes_and_keeps_their_kiosk(self):
        Node.objects.all().delete()
        first = Floor.objects.get(area__code="EYA", floor_order=1)
        kiosk = Node.objects.create(
            floor=first, name="EYA lobby kiosk", node_type=Node.TYPE_KIOSK,
            geometry=model_to_point(0, 1.02, 28.5), metadata={"seed": "eya-demo", "key": "kiosk"},
        )
        junction = Node.objects.create(
            floor=first, name="Corridor west-lobby", node_type=Node.TYPE_AUXILIARY,
            geometry=model_to_point(-4.6, 1.02, 28.5), metadata={"seed": "eya-demo", "key": "west-lobby"},
        )
        Edge.objects.create(from_node=kiosk, to_node=junction, metadata={"seed": "eya-demo"})
        out = StringIO()
        call_command("seed_eya_routes", stdout=out)
        kiosk.refresh_from_db()
        junction.refresh_from_db()
        self.assertEqual(kiosk.metadata["seed"], "eya-network")
        self.assertIsNone(kiosk.deleted_at)
        self.assertIsNotNone(junction.deleted_at)
        self.assertFalse(Edge.objects.filter(from_node=junction, deleted_at__isnull=True).exists())
        self.assertIn("1 old points removed", out.getvalue())

    def test_a_renumbered_room_is_reported_not_fatal(self):
        Room.objects.filter(room_code="EA-305").update(room_code="EA-399")
        out = StringIO()
        call_command("seed_eya_routes", stdout=out)
        self.assertIn("No room numbered EA-305", out.getvalue())
        self.assertEqual(Node.objects.get(metadata__key="3F-EA-305", deleted_at__isnull=True).room, None)

    def test_keeps_doors_placed_in_map_annotation(self):
        room = Room.objects.get(room_code="EA-305")
        Node.objects.filter(room=room).delete()
        manual = Node.objects.create(
            floor=room.floor, room=room, name="EA-305 door", node_type=Node.TYPE_ROOM,
            geometry=model_to_point(-5.6, 8.09, 10),
        )
        out = StringIO()
        call_command("seed_eya_routes", stdout=out)
        self.assertEqual(list(Node.objects.filter(room=room, deleted_at__isnull=True)), [manual])
        self.assertIn("Kept the doors placed in Map Annotation for: EA-305", out.getvalue())

    def test_seed_links_floors_to_the_model(self):
        floors = self.client.get(f"{API}/map/areas").json()["data"]
        eya = next(area for area in floors if area["code"] == "EYA")
        listed = data(self.client.get(f"{API}/map/areas/{eya['id']}/floors"))
        self.assertEqual(
            [(f["floor_order"], f["glb_node_name"]) for f in listed][:2],
            [(1, "FLOOR_1"), (2, "FLOOR_2")],
        )

    def test_rooms_carry_their_node(self):
        rooms = {
            room["room_code"]: room
            for room in data(self.client.get(f"{API}/map/rooms?area_id={Floor.objects.get(area__code='EYA', floor_order=1).area_id}&page_size=100"))
        }
        placed = Node.objects.get(room__room_code="EA-110")
        self.assertEqual(rooms["EA-110"]["node_id"], placed.id)
        self.assertTrue(all(room["node_id"] for room in rooms.values()))
        unplaced = Room.objects.create(
            floor=placed.floor, room_code="EA-199", room_alias="New room", room_type="room"
        )
        rooms = {room["room_code"]: room for room in data(self.client.get(f"{API}/map/rooms?page_size=100"))}
        self.assertIsNone(rooms[unplaced.room_code]["node_id"])

    def test_search_results_carry_their_node_and_are_logged(self):
        results = data(
            self.client.get(f"{API}/search", {"q": "EA-110", "result_type": "room"})
        )["results"]
        top = results[0]["room"]
        self.assertEqual(top["room_code"], "EA-110")
        self.assertEqual(top["node_id"], Node.objects.get(room__room_code="EA-110").id)
        self.assertEqual(SearchEvent.objects.filter(query_text="EA-110").count(), 1)

    def heartbeat(self, device_id="kiosk-routing0001"):
        return data(
            self.client.post(
                f"{API}/hardware/kiosks/heartbeat",
                {"device_id": device_id},
                content_type="application/json",
            )
        )

    def test_heartbeat_names_the_only_kiosk_node(self):
        kiosk_node = Node.objects.get(node_type=Node.TYPE_KIOSK)
        self.assertEqual(self.heartbeat()["map_node_id"], kiosk_node.id)

    def test_heartbeat_prefers_the_assigned_node(self):
        self.heartbeat()
        device = Device.objects.get(device_id="kiosk-routing0001")
        assigned = Node.objects.get(metadata__key="1F-front-stairs")
        device.kiosk.map_node = assigned
        device.kiosk.save()
        self.assertEqual(self.heartbeat()["map_node_id"], assigned.id)

    def test_heartbeat_gives_no_node_when_ambiguous(self):
        kiosk_node = Node.objects.get(node_type=Node.TYPE_KIOSK)
        Node.objects.create(
            floor=kiosk_node.floor,
            name="Second kiosk",
            node_type=Node.TYPE_KIOSK,
            geometry=model_to_point(1, 1.02, 20),
        )
        self.assertIsNone(self.heartbeat()["map_node_id"])

    def test_kiosk_gets_a_route_to_a_searched_room(self):
        origin = self.heartbeat()["map_node_id"]
        destination = Node.objects.get(room__room_code="EA-110").id
        response = self.client.post(
            f"{API}/navigation/routes",
            {"origin_node_id": origin, "destination_node_ids": [destination]},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        route = data(response)
        coordinates = route["segments"][0]["geometry"]["coordinates"]
        # Stored (x, -z, y): from the kiosk's model position to EA-110's door.
        kiosk = Node.objects.get(pk=origin).geometry
        door = Node.objects.get(pk=destination).geometry
        self.assertEqual(coordinates[0], [kiosk.x, kiosk.y, kiosk.z])
        self.assertEqual(coordinates[-1], [door.x, door.y, door.z])
        self.assertAlmostEqual(kiosk.y, -28.5)
        # Along the corridor: longer than a straight line, not a detour.
        straight = ((door.x - kiosk.x) ** 2 + (door.y - kiosk.y) ** 2) ** 0.5
        self.assertTrue(straight < float(route["route_distance"]) < straight * 1.3)
        self.assertEqual(NavigationRequest.objects.count(), 1)

    def test_an_elevator_out_of_service_sends_the_route_up_the_stairs(self):
        origin = self.heartbeat()["map_node_id"]
        destination = Node.objects.get(room__room_code="EA-517").id

        def route():
            response = self.client.post(
                f"{API}/navigation/routes",
                {"origin_node_id": origin, "destination_node_ids": [destination]},
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 201)
            return data(response)

        self.assertEqual(route()["notices"], [])
        FloorTransition.objects.filter(transition_type="elevator").update(active=False)
        body = route()
        rides = {c["transition_type"] for c in body["segments"][0]["floor_changes"]}
        self.assertEqual(rides, {"stairs"})
        self.assertEqual(body["notices"], ["The elevator is out of service."])
        # A one-floor route doesn't need the notice.
        same_floor = self.client.post(
            f"{API}/navigation/routes",
            {"origin_node_id": origin,
             "destination_node_ids": [Node.objects.get(room__room_code="EA-110").id]},
            content_type="application/json",
        )
        self.assertEqual(data(same_floor)["notices"], [])
        # Loading the network again keeps it out of service.
        call_command("seed_eya_routes", stdout=StringIO())
        self.assertEqual(route()["notices"], ["The elevator is out of service."])
        FloorTransition.objects.filter(transition_type="elevator").update(active=True)
        self.assertEqual(route()["notices"], [])

    def test_a_route_to_an_upper_floor_changes_floor_once(self):
        origin = self.heartbeat()["map_node_id"]
        destination = Node.objects.get(room__room_code="EA-517").id
        response = self.client.post(
            f"{API}/navigation/routes",
            {"origin_node_id": origin, "destination_node_ids": [destination]},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        coordinates = data(response)["segments"][0]["geometry"]["coordinates"]
        heights = [round(c[2], 1) for c in coordinates]
        # First floor, up (the lift or stairs pass the floors between), fifth.
        self.assertEqual(heights[0], 1.0)
        self.assertEqual(heights[-1], 15.2)
        self.assertEqual(heights, sorted(heights))
        # One ride, however many floors it passes: "Take the elevator to 5F".
        [change] = data(response)["segments"][0]["floor_changes"]
        self.assertIn(change["transition_type"], ("elevator", "stairs"))
        self.assertEqual((change["from_floor_order"], change["to_floor_order"]), (1, 5))
        # The phone reads the saved route: the ride is still there.
        saved = data(self.client.get(f"{API}/navigation/routes/{data(response)['id']}"))
        self.assertEqual(saved["segments"][0]["floor_changes"], [change])


    def queue_route(self, codes, **extra):
        origin = self.heartbeat()["map_node_id"]
        ids = [Node.objects.get(room__room_code=code).id for code in codes]
        response = self.client.post(
            f"{API}/navigation/routes",
            {"origin_node_id": origin, "destination_node_ids": ids, **extra},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        route = data(response)
        by_node = {node.id: node.room.room_code for node in Node.objects.filter(id__in=ids)}
        visited = sorted(route["destinations"], key=lambda d: d["destination_order"])
        return [by_node[d["node"]["id"]] for d in visited], route

    def test_queue_keeps_the_visitors_order_by_default(self):
        order, _ = self.queue_route(["EA-110", "EA-101A", "EA-111"])
        self.assertEqual(order, ["EA-110", "EA-101A", "EA-111"])

    def test_queue_can_be_put_in_the_shortest_walking_order(self):
        kept, kept_route = self.queue_route(["EA-110", "EA-101A", "EA-111"])
        order, route = self.queue_route(
            ["EA-110", "EA-101A", "EA-111"], optimize_order=True
        )
        # West wing first (EA-101A is by the kiosk), then down the east
        # corridor: EA-111 before EA-110, which is further along it.
        self.assertEqual(order, ["EA-101A", "EA-111", "EA-110"])
        self.assertLess(float(route["route_distance"]), float(kept_route["route_distance"]))
        self.assertEqual(len(route["segments"]), 3)

    def test_long_queues_use_the_heuristic_and_agree(self):
        from navigation import services

        original = services.EXACT_ORDER_LIMIT
        services.EXACT_ORDER_LIMIT = 1
        try:
            order, _ = self.queue_route(
                ["EA-110", "EA-101A", "EA-111"], optimize_order=True
            )
        finally:
            services.EXACT_ORDER_LIMIT = original
        self.assertEqual(order, ["EA-101A", "EA-111", "EA-110"])


class BuildingToBuildingTests(TestCase):
    """Step 13: the A Building's network and the walk to it from the EYA kiosk."""

    def setUp(self):
        call_command("seed_campus", stdout=StringIO())
        call_command("seed_eya_routes", stdout=StringIO())
        call_command("seed_a_routes", stdout=StringIO())

    def test_seed_is_repeatable(self):
        count = lambda model: model.objects.filter(deleted_at__isnull=True).count()
        before = (count(Node), count(Edge), count(FloorTransition))
        out = StringIO()
        call_command("seed_a_routes", stdout=out)
        self.assertEqual((count(Node), count(Edge), count(FloorTransition)), before)
        self.assertEqual(Node.objects.filter(deleted_at__isnull=False).count(), 0)
        self.assertIn("46 rooms routable", out.getvalue())
        self.assertIn("walk from the EYA kiosk", out.getvalue())

    def test_places_the_model_in_the_campus(self):
        from navigation.management.commands.seed_a_routes import place

        # The front gate's opening (A model) is on the highway's south side.
        x, y, z = place((59.8, 0.1, 1.5))
        self.assertAlmostEqual(x, -187.85, places=2)
        self.assertAlmostEqual(y, 3.3, places=2)
        self.assertAlmostEqual(z, 73.64, places=2)

    def test_every_a_room_is_routed_from_the_eya_kiosk_over_the_overpass(self):
        graph = services._build_graph()
        kiosk = Node.objects.get(node_type=Node.TYPE_KIOSK)
        overpass = Node.objects.get(metadata__key="overpass-south")
        doors = Node.objects.filter(room__floor__area__code="A", deleted_at__isnull=True)
        self.assertEqual(doors.count(), 46)
        for door in doors:
            path = services._a_star(graph, kiosk.id, door.id)
            self.assertIn(overpass.id, path, door.room.room_code)
            areas = [graph.nodes[i].floor.area.code for i in path]
            self.assertEqual((areas[0], areas[-1]), ("EYA", "A"))
            # EYA, then outdoors, then A: no going back and forth.
            runs = [a for i, a in enumerate(areas) if i == 0 or areas[i - 1] != a]
            self.assertEqual(runs, ["EYA", "AUF-WALKWAYS", "A"], door.room.room_code)

    def test_route_says_where_each_point_is(self):
        kiosk = Node.objects.get(node_type=Node.TYPE_KIOSK)
        door = Node.objects.get(room__room_code="A-305", deleted_at__isnull=True)
        response = self.client.post(
            f"{API}/navigation/routes",
            {"origin_node_id": kiosk.id, "destination_node_ids": [door.id]},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        segment = data(response)["segments"][0]
        stops = segment["stops"]
        self.assertEqual(len(stops), len(segment["geometry"]["coordinates"]))
        self.assertEqual((stops[0]["area_code"], stops[-1]["area_code"], stops[-1]["floor_order"]), ("EYA", "A", 3))
        self.assertEqual(
            [(c["transition_type"], c["from_floor_order"], c["to_floor_order"]) for c in segment["floor_changes"]],
            [("stairs", 1, 3)],
        )
        # The same from GET (cached, and recomputed).
        route_id = data(response)["id"]
        self.assertEqual(data(self.client.get(f"{API}/navigation/routes/{route_id}"))["segments"][0]["stops"], stops)

    def test_stairs_out_of_service_in_a_are_announced(self):
        kiosk = Node.objects.get(node_type=Node.TYPE_KIOSK)
        door = Node.objects.get(room__room_code="A-305", deleted_at__isnull=True)
        FloorTransition.objects.filter(from_node__name__startswith="Front right stairs").update(active=False)
        body = data(self.client.post(
            f"{API}/navigation/routes",
            {"origin_node_id": kiosk.id, "destination_node_ids": [door.id]},
            content_type="application/json",
        ))
        self.assertEqual(body["notices"], ["The front right stairs are out of service."])
        names = {stop["node_id"] for stop in body["segments"][0]["stops"]}
        self.assertFalse(Node.objects.filter(pk__in=names, name__startswith="Front right stairs (2F)").exists())

