import io
import json
import shutil
import struct
import tempfile
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from analytics.models import AuditEvent
from assets import glb, services
from assets.models import Asset, AssetAuditHistory
from common.testing import API, data, error, sign_in_as_admin
from map.models import Area, Floor


def build_glb(floors=((1, 0.0, 0.9), (2, 3.5, 4.4)), exterior=True, draco=True, required=None):
    """A minimal glTF binary: per floor a FLOOR_n group holding a same-named
    slab mesh (top at `top`), plus an optional EXTERIOR mesh. Accessors carry
    only min/max, which is all the inspector reads."""
    nodes, meshes, accessors, root_children = [], [], [], []

    def box_mesh(lo, hi):
        accessors.append({"componentType": 5126, "count": 24, "type": "VEC3", "min": lo, "max": hi})
        accessors.append({"componentType": 5123, "count": 36, "type": "SCALAR"})
        meshes.append({"primitives": [{"attributes": {"POSITION": len(accessors) - 2}, "indices": len(accessors) - 1}]})
        return len(meshes) - 1

    for order, bottom, top in floors:
        slab = len(nodes)
        nodes.append({"name": f"FLOOR_{order}", "mesh": box_mesh([0, bottom, 0], [20, top, 40])})
        walls = len(nodes)
        nodes.append({"name": f"WALLS_{order}", "mesh": box_mesh([0, top, 0], [20, top + 3, 40])})
        nodes.append({"name": f"FLOOR_{order}", "children": [slab, walls]})
        root_children.append(len(nodes) - 1)
    if exterior:
        nodes.append({"name": "EXTERIOR", "mesh": box_mesh([0, 0, 0], [20, 8, 40])})
        root_children.append(len(nodes) - 1)
    nodes.append({"name": "BUILDING", "children": root_children})
    gltf = {
        "asset": {"version": "2.0", "generator": "test"},
        "scene": 0,
        "scenes": [{"nodes": [len(nodes) - 1]}],
        "nodes": nodes,
        "meshes": meshes,
        "accessors": accessors,
        "materials": [{"name": "concrete"}],
    }
    if draco:
        gltf["extensionsUsed"] = [glb.DRACO]
    if required:
        gltf["extensionsRequired"] = required
        gltf["extensionsUsed"] = sorted(set(gltf.get("extensionsUsed", [])) | set(required))
    body = json.dumps(gltf).encode()
    body += b" " * (-len(body) % 4)
    chunk = struct.pack("<II", len(body), glb.CHUNK_JSON) + body
    return glb.GLB_MAGIC + struct.pack("<II", 2, 12 + len(chunk)) + chunk


def upload(name="model.glb", content=None):
    return SimpleUploadedFile(name, content if content is not None else build_glb(), content_type="model/gltf-binary")


class InspectorTests(TestCase):
    def test_floors_use_the_slab_top_as_elevation(self):
        report = glb.inspect(io.BytesIO(build_glb()))
        self.assertEqual([f.node for f in report.floors], ["FLOOR_1", "FLOOR_2"])
        self.assertAlmostEqual(report.floors[0].elevation, 0.9)
        self.assertAlmostEqual(report.floors[1].elevation, 4.4)
        self.assertEqual(report.exterior_nodes, ["EXTERIOR"])
        self.assertTrue(report.draco)
        self.assertEqual(report.triangles_count, 12 * 5)
        self.assertEqual([round(d, 3) for d in report.dimensions], [20, 8, 40])

    def test_rejects_a_file_that_is_not_glb(self):
        with self.assertRaises(glb.GlbError):
            glb.inspect(io.BytesIO(b"hello world, not a model"))


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class AssetApiTests(TestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media)
        self.override.enable()
        self.admin = sign_in_as_admin(self.client)
        self.area = Area.objects.create(code="EYA", name="EYA Building", area_type="building")
        self.floor1 = Floor.objects.create(area=self.area, floor_order=1, glb_node_name="FLOOR_1", elevation=Decimal("0.9"))
        self.floor2 = Floor.objects.create(area=self.area, floor_order=2, glb_node_name=None, elevation=None)

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media, ignore_errors=True)

    def create(self, **fields):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"{API}/assets", {"file": upload(), "area_id": self.area.pk, **fields})
        self.assertEqual(response.status_code, 201, response.content)
        # Processing runs once the upload commits; read the asset back after it.
        return data(self.client.get(f"{API}/assets/{data(response)['id']}"))

    def new_version(self, asset_id, content=None):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"{API}/assets/{asset_id}/versions", {"file": upload(content=content)})
        self.assertEqual(response.status_code, 201, response.content)
        return data(self.client.get(f"{API}/assets/{asset_id}/versions/{data(response)['id']}"))

    def test_upload_is_stored_processed_and_validated(self):
        asset = self.create(name="EYA model")
        version = asset["latest_version"]
        self.assertEqual(asset["name"], "EYA model")
        self.assertEqual(version["version"], 1)
        self.assertEqual(version["processing_status"], "completed")
        self.assertEqual(version["detected_floor_count"], 2)
        self.assertEqual(version["validation"]["result"], "passed")
        self.assertIsNone(asset["active_version"])

    def test_upload_rejects_non_glb_files(self):
        response = self.client.post(f"{API}/assets", {"file": upload("notes.glb", b"not a model")})
        self.assertEqual(response.status_code, 400)
        self.assertIn("glTF header", error(response)["message"])
        response = self.client.post(f"{API}/assets", {"file": upload("model.obj")})
        self.assertEqual(response.status_code, 400)

    def test_admin_only(self):
        self.client.cookies.clear()
        self.assertEqual(self.client.get(f"{API}/assets").status_code, 401)

    def test_activation_applies_floors_and_publishes_the_model(self):
        asset = self.create()
        version_id = asset["latest_version"]["id"]
        download = f"{API}/assets/{asset['id']}/versions/{version_id}/download"
        self.client.cookies.clear()
        self.assertEqual(self.client.get(download).status_code, 401)  # not active yet
        sign_in_as_admin(self.client)

        response = self.client.post(f"{API}/assets/{asset['id']}/activate")
        body = data(response)
        self.assertEqual(body["active_version_id"], version_id)
        self.assertEqual([c["floor_order"] for c in body["floors_updated"]], [2])
        self.floor2.refresh_from_db()
        self.assertEqual(self.floor2.glb_node_name, "FLOOR_2")
        self.assertEqual(self.floor2.elevation, Decimal("4.4000"))

        self.client.cookies.clear()
        area = next(a for a in data(self.client.get(f"{API}/map/areas")) if a["code"] == "EYA")
        self.assertEqual(area["model"]["url"], download)
        response = self.client.get(download)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b"".join(response.streaming_content), build_glb())

    def test_a_failed_version_cannot_be_activated(self):
        asset = self.create()
        version = self.new_version(asset["id"], build_glb(floors=((2, 3.5, 4.4),)))  # FLOOR_1 missing
        self.assertEqual(version["version"], 2)
        self.assertEqual(version["validation"]["result"], "failed")
        response = self.client.post(f"{API}/assets/{asset['id']}/activate", {"version_id": version["id"]},
                                    content_type="application/json")
        self.assertEqual(response.status_code, 409)

    def test_warnings_do_not_block_activation(self):
        asset = self.create()
        version = self.new_version(asset["id"], build_glb(draco=False, exterior=False))
        self.assertEqual(version["validation"]["result"], "warning")
        checks = data(self.client.get(f"{API}/assets/{asset['id']}/versions/{version['id']}/validation/checks"))
        self.assertEqual({c["check_name"] for c in checks if c["status"] == "warning"}, {"Draco compression", "Exterior"})
        self.assertEqual(self.client.post(f"{API}/assets/{asset['id']}/activate").status_code, 200)

    def test_unsupported_required_extension_is_an_error(self):
        asset = self.create()
        version = self.new_version(asset["id"], build_glb(required=["EXT_unknown"]))
        self.assertEqual(version["validation"]["result"], "failed")

    def test_restore_and_one_active_model_per_building(self):
        first = self.create(name="Old model")
        self.client.post(f"{API}/assets/{first['id']}/activate")
        second = self.create(name="New model")
        body = data(self.client.post(f"{API}/assets/{second['id']}/activate"))
        self.assertEqual(body["deactivated_assets"], [first["id"]])
        self.assertIsNone(Asset.objects.get(pk=first["id"]).active_version_id)

        v2 = self.new_version(second["id"])
        self.client.post(f"{API}/assets/{second['id']}/activate", {"version_id": v2["id"]}, content_type="application/json")
        v1 = second["latest_version"]["id"]
        body = data(self.client.post(f"{API}/assets/{second['id']}/versions/{v1}/restore"))
        self.assertEqual(body["active_version"]["id"], v1)
        history = data(self.client.get(f"{API}/assets/{second['id']}/versions"))
        self.assertEqual([v["version"] for v in history], [2, 1])

    def test_take_offline_returns_the_kiosk_to_its_bundled_model(self):
        asset = self.create()
        version_id = asset["latest_version"]["id"]
        self.client.post(f"{API}/assets/{asset['id']}/activate")
        body = data(self.client.post(f"{API}/assets/{asset['id']}/deactivate"))
        self.assertIsNone(body["active_version"])
        self.assertEqual(AssetAuditHistory.objects.order_by("-id").first().action, AuditEvent.ACTION_DEACTIVATE)
        self.assertEqual(self.client.post(f"{API}/assets/{asset['id']}/deactivate").status_code, 409)

        self.client.cookies.clear()
        area = next(a for a in data(self.client.get(f"{API}/map/areas")) if a["code"] == "EYA")
        self.assertIsNone(area["model"])
        download = f"{API}/assets/{asset['id']}/versions/{version_id}/download"
        self.assertEqual(self.client.get(download).status_code, 401)
        # It can go live again.
        sign_in_as_admin(self.client)
        self.assertEqual(self.client.post(f"{API}/assets/{asset['id']}/activate").status_code, 200)

    def test_metadata_edit_delete_and_audit(self):
        asset = self.create()
        response = self.client.patch(f"{API}/assets/{asset['id']}", {"notes": "Final export"}, content_type="application/json")
        self.assertEqual(data(response)["notes"], "Final export")
        self.client.post(f"{API}/assets/{asset['id']}/activate")
        self.assertEqual(self.client.delete(f"{API}/assets/{asset['id']}").status_code, 200)  # the envelope renderer turns 204 into 200 {success, data: null}
        self.assertEqual(self.client.get(f"{API}/assets/{asset['id']}").status_code, 404)
        area = next(a for a in data(self.client.get(f"{API}/map/areas")) if a["code"] == "EYA")
        self.assertIsNone(area["model"])
        actions = list(AssetAuditHistory.objects.order_by("id").values_list("action", flat=True))
        self.assertEqual(actions, [AuditEvent.ACTION_UPLOAD, AuditEvent.ACTION_VALIDATE, AuditEvent.ACTION_UPDATE,
                                   AuditEvent.ACTION_ACTIVATE, AuditEvent.ACTION_DELETE])
        # The Activity API filters several entity types at once.
        response = self.client.get(f"{API}/activity?entity_type=asset,asset_validation")
        self.assertEqual(len(data(response)), 4)

    def test_version_detail_reports_structure_and_processing(self):
        asset = self.create()
        version_id = asset["latest_version"]["id"]
        detail = data(self.client.get(f"{API}/assets/{asset['id']}/versions/{version_id}"))
        self.assertEqual([f["node"] for f in detail["structure"]["floors"]], ["FLOOR_1", "FLOOR_2"])
        self.assertEqual([c["floor_order"] for c in detail["structure"]["floor_changes"]], [2])
        processing = data(self.client.get(f"{API}/assets/{asset['id']}/processing"))
        self.assertTrue(processing["complete"])
        response = self.client.post(f"{API}/assets/{asset['id']}/versions/{version_id}/validation")
        self.assertEqual(response.status_code, 202)
        self.assertEqual(data(response)["result"], "passed")
        self.assertEqual(data(self.client.get(f"{API}/assets/{asset['id']}/validation"))[0]["result"], "passed")
        errors = data(self.client.get(f"{API}/assets/{asset['id']}/versions/{version_id}/validation/checks?status=error"))
        self.assertEqual(errors, [])
        self.assertEqual(len(data(self.client.get(f"{API}/assets/{asset['id']}/versions/{version_id}/validation"))), 2)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class SeedAssetsTests(TestCase):
    """seed_assets: the committed models in Asset Management."""

    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.models = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media)
        self.override.enable()
        self.eya = Area.objects.create(code="EYA", name="EYA Building", area_type="building")
        Floor.objects.create(area=self.eya, floor_order=1, glb_node_name="FLOOR_1", elevation=Decimal("0.9"))
        Area.objects.create(code="AUF", name="AUF Campus", area_type="campus")
        self.a = Area.objects.create(code="A", name="A Building", area_type="building")
        Floor.objects.create(area=self.a, floor_order=1, glb_node_name="FLOOR_1", elevation=Decimal("0"))
        self.write("EYA.glb", build_glb())
        self.write("CAMPUS.glb", build_glb(floors=((1, 0.0, 0.2),)))
        self.write("A.glb", build_glb(floors=((1, 0.0, 1.0),)))

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media, ignore_errors=True)
        shutil.rmtree(self.models, ignore_errors=True)

    def write(self, name, content):
        with open(f"{self.models}/{name}", "wb") as handle:
            handle.write(content)

    def seed(self):
        out = io.StringIO()
        with self.captureOnCommitCallbacks(execute=True):
            call_command("seed_assets", models_dir=self.models, stdout=out)
        return out.getvalue()

    def test_registers_the_models_and_makes_the_area_models_live(self):
        output = self.seed()
        eya = Asset.objects.get(name="EYA Building model")
        campus = Asset.objects.get(name="Campus (low-fidelity area)")
        a = Asset.objects.get(name="A Building model")
        self.assertEqual((eya.asset_type, eya.area.code), ("building_model", "EYA"))
        self.assertEqual((campus.asset_type, campus.area.code), ("area_model", "AUF"))
        self.assertEqual(a.area.code, "A")
        self.assertEqual(eya.active_version.version, 1)
        self.assertEqual(campus.active_version.version, 1)
        self.assertEqual(a.active_version.version, 1)
        self.assertIn("now live", output)

        # The kiosk's campus view reads the campus model from /map/areas.
        areas = {a["code"]: a for a in data(self.client.get(f"{API}/map/areas"))}
        self.assertEqual(areas["AUF"]["model"]["filename"], "CAMPUS.glb")
        self.assertEqual(areas["EYA"]["model"]["filename"], "EYA.glb")

        # Re-running with the same files adds nothing.
        self.seed()
        self.assertEqual(eya.versions.count(), 1)
        self.assertEqual(Asset.objects.count(), 3)

    def test_a_model_registered_before_its_building_gets_it(self):
        a = Asset.objects.create(name="A Building model", asset_type="building_model")
        self.seed()
        a.refresh_from_db()
        self.assertEqual((a.area.code, a.active_version.version), ("A", 1))

    def test_a_model_linked_to_the_wrong_building_is_moved_to_its_own(self):
        self.seed()
        a = Asset.objects.get(name="A Building model")
        sign_in_as_admin(self.client)
        self.client.post(f"{API}/assets/{a.pk}/deactivate")
        a.refresh_from_db()
        a.area = self.eya  # linked to EYA by hand
        a.save()
        self.client.cookies.clear()
        output = self.seed()
        a.refresh_from_db()
        self.assertEqual(a.area.code, "A")
        self.assertIn("A Building model: moved to A Building", output)
        # Checked again against A's floors, and live: going offline under EYA
        # (its model replacing this one) doesn't count.
        self.assertEqual(a.active_version.version, 1)
        self.assertEqual(services.latest_run(a.active_version).result, "passed")

    def test_a_model_taken_offline_stays_offline(self):
        self.seed()
        eya = Asset.objects.get(name="EYA Building model")
        sign_in_as_admin(self.client)
        self.client.post(f"{API}/assets/{eya.pk}/deactivate")
        self.write("EYA.glb", build_glb(floors=((1, 0.0, 0.9), (2, 3.5, 4.4), (3, 7.0, 7.9))))
        output = self.seed()
        eya.refresh_from_db()
        self.assertIsNone(eya.active_version)
        self.assertEqual(eya.versions.count(), 2)
        self.assertIn("kept offline", output)

    def test_a_changed_file_becomes_the_next_version(self):
        self.seed()
        self.write("EYA.glb", build_glb(floors=((1, 0.0, 0.9), (2, 3.5, 4.4), (3, 7.0, 7.9))))
        self.seed()
        eya = Asset.objects.get(name="EYA Building model")
        self.assertEqual(eya.versions.count(), 2)
        self.assertEqual(eya.active_version.version, 2)

    def test_an_admins_live_version_is_kept(self):
        self.seed()
        eya = Asset.objects.get(name="EYA Building model")
        sign_in_as_admin(self.client)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"{API}/assets/{eya.pk}/versions",
                                        {"file": upload(content=build_glb(floors=((1, 0.0, 0.95),)))})
        uploaded = data(response)["id"]
        self.client.post(f"{API}/assets/{eya.pk}/activate", {"version_id": uploaded},
                         content_type="application/json")

        self.write("EYA.glb", build_glb(floors=((1, 0.0, 0.9), (2, 3.5, 4.4), (3, 7.0, 7.9))))
        output = self.seed()
        eya.refresh_from_db()
        self.assertEqual(eya.versions.count(), 3)
        self.assertEqual(eya.active_version_id, uploaded)
        self.assertIn("chosen by an admin", output)
