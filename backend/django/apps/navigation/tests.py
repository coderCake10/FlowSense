"""
Kiosk routing (step 8a): the EYA starter graph, room nodes in Map/Search
results, the kiosk's origin node in its heartbeat, and a route through the
Navigation API in model coordinates.
"""
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from analytics.models import NavigationRequest
from common.testing import API, data
from hardware.models import Device
from map.models import Edge, Node
from navigation.coordinates import model_to_point, point_to_model
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
        call_command("seed_eya_routes", stdout=StringIO())
        self.assertEqual(Node.objects.count(), 9)
        self.assertEqual(Edge.objects.count(), 8)
        self.assertEqual(Node.objects.filter(node_type=Node.TYPE_KIOSK).count(), 1)

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
            for room in data(self.client.get(f"{API}/map/rooms?page_size=100"))
        }
        placed = Node.objects.get(room__room_code="EA-110")
        self.assertEqual(rooms["EA-110"]["node_id"], placed.id)
        self.assertIsNone(rooms["EA-305"]["node_id"])

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
        assigned = Node.objects.get(metadata__key="east-lobby")
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
        # Stored (x, -z, y): the route starts at the kiosk's model position.
        self.assertEqual(coordinates[0], [0.0, -28.5, 1.02])
        self.assertEqual(coordinates[-1], [5.65, 11.85, 1.02])
        # The kiosk's hand-placed EA-110 route: 4.5 + 40.35 + 1.15 = 46 m.
        self.assertAlmostEqual(float(route["route_distance"]), 46.0, places=2)
        self.assertEqual(NavigationRequest.objects.count(), 1)


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
