"""
Reads a binary glTF (.glb) building model without loading its geometry:
counts, dimensions, and the floor groups FlowSense can use.

Only the JSON chunk is parsed. Sizes come from each POSITION accessor's
min/max, which glTF 2.0 requires, so Draco-compressed models work too.
glTF units are metres and Y is up.
"""
from __future__ import annotations

import json
import math
import re
import struct
from dataclasses import dataclass, field

GLB_MAGIC = b"glTF"
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942
DRACO = "KHR_draco_mesh_compression"
# Extensions three.js's GLTFLoader (used by the kiosk) understands.
SUPPORTED_EXTENSIONS = {
    DRACO,
    "KHR_materials_unlit",
    "KHR_materials_emissive_strength",
    "KHR_materials_transmission",
    "KHR_materials_ior",
    "KHR_materials_specular",
    "KHR_materials_volume",
    "KHR_materials_clearcoat",
    "KHR_materials_sheen",
    "KHR_texture_transform",
    "KHR_mesh_quantization",
    "KHR_lights_punctual",
    "EXT_meshopt_compression",
    "EXT_texture_webp",
}

# FLOOR_1, Floor 2, LEVEL_03, L4, 5F … (the kiosk's convention is FLOOR_n).
FLOOR_NAME = re.compile(r"^(?:floor|flr|level|lvl|l)[\s_-]*0*(\d{1,3})$|^0*(\d{1,3})\s*f$", re.I)
EXTERIOR_NAMES = {"exterior", "roof", "shell", "facade"}


class GlbError(ValueError):
    """The file isn't a readable glTF 2.0 binary."""


@dataclass
class DetectedFloor:
    node: str
    order: int
    reason: str
    confidence: str  # high / medium
    elevation: float | None  # lowest point of the group, metres
    top: float | None  # highest point of the group, metres

    def as_dict(self):
        return {
            "node": self.node,
            "order": self.order,
            "reason": self.reason,
            "confidence": self.confidence,
            "elevation": None if self.elevation is None else round(self.elevation, 3),
            "top": None if self.top is None else round(self.top, 3),
        }


@dataclass
class GlbReport:
    gltf_version: str
    generator: str
    object_count: int
    mesh_count: int
    material_count: int
    texture_count: int
    vertices_count: int
    triangles_count: int
    dimensions: tuple[float, float, float] | None
    extensions_used: list[str]
    extensions_required: list[str]
    draco: bool
    floors: list[DetectedFloor] = field(default_factory=list)
    potential_floors: list[DetectedFloor] = field(default_factory=list)
    exterior_nodes: list[str] = field(default_factory=list)
    duplicate_names: list[str] = field(default_factory=list)
    top_level_nodes: list[str] = field(default_factory=list)

    def as_dict(self):
        return {
            "gltf_version": self.gltf_version,
            "generator": self.generator,
            "object_count": self.object_count,
            "mesh_count": self.mesh_count,
            "material_count": self.material_count,
            "texture_count": self.texture_count,
            "vertices_count": self.vertices_count,
            "triangles_count": self.triangles_count,
            "dimensions": None if self.dimensions is None else [round(d, 3) for d in self.dimensions],
            "extensions_used": self.extensions_used,
            "extensions_required": self.extensions_required,
            "draco": self.draco,
            "floors": [f.as_dict() for f in self.floors],
            "potential_floors": [f.as_dict() for f in self.potential_floors],
            "exterior_nodes": self.exterior_nodes,
            "duplicate_names": self.duplicate_names,
            "top_level_nodes": self.top_level_nodes,
        }


def read_json_chunk(fileobj) -> dict:
    header = fileobj.read(12)
    if len(header) < 12 or header[:4] != GLB_MAGIC:
        raise GlbError("This isn't a .glb file (the glTF header is missing).")
    version, length = struct.unpack("<II", header[4:12])
    if version != 2:
        raise GlbError(f"glTF version {version} isn't supported; export glTF 2.0.")
    chunk = fileobj.read(8)
    if len(chunk) < 8:
        raise GlbError("The file ends before its JSON chunk.")
    chunk_length, chunk_type = struct.unpack("<II", chunk)
    if chunk_type != CHUNK_JSON:
        raise GlbError("The first chunk isn't JSON.")
    data = fileobj.read(chunk_length)
    if len(data) < chunk_length:
        raise GlbError("The file is truncated.")
    try:
        return json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GlbError("The model's JSON chunk can't be read.") from exc


# 4×4 column-major matrices, as glTF stores them.
IDENTITY = [1.0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 1.0]


def _mul(a, b):
    out = [0.0] * 16
    for col in range(4):
        for row in range(4):
            out[col * 4 + row] = sum(a[k * 4 + row] * b[col * 4 + k] for k in range(4))
    return out


def _local_matrix(node):
    if "matrix" in node:
        return [float(v) for v in node["matrix"]]
    tx, ty, tz = node.get("translation", [0, 0, 0])
    qx, qy, qz, qw = node.get("rotation", [0, 0, 0, 1])
    sx, sy, sz = node.get("scale", [1, 1, 1])
    r = [
        1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy + qz * qw), 2 * (qx * qz - qy * qw),
        2 * (qx * qy - qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz + qx * qw),
        2 * (qx * qz + qy * qw), 2 * (qy * qz - qx * qw), 1 - 2 * (qx * qx + qy * qy),
    ]
    return [
        r[0] * sx, r[1] * sx, r[2] * sx, 0,
        r[3] * sy, r[4] * sy, r[5] * sy, 0,
        r[6] * sz, r[7] * sz, r[8] * sz, 0,
        tx, ty, tz, 1,
    ]


def _apply(m, p):
    x, y, z = p
    return (
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
    )


class _Box:
    def __init__(self):
        self.min = [math.inf] * 3
        self.max = [-math.inf] * 3

    def add(self, p):
        for i in range(3):
            self.min[i] = min(self.min[i], p[i])
            self.max[i] = max(self.max[i], p[i])

    def merge(self, other):
        if other.empty:
            return
        self.add(other.min)
        self.add(other.max)

    @property
    def empty(self):
        return self.min[0] == math.inf


def _floor_match(name):
    match = FLOOR_NAME.match(name.strip())
    if match:
        return int(match.group(1) or match.group(2))
    return None


def inspect(fileobj) -> GlbReport:
    gltf = read_json_chunk(fileobj)
    nodes = gltf.get("nodes", [])
    meshes = gltf.get("meshes", [])
    accessors = gltf.get("accessors", [])

    def mesh_box(mesh_index, matrix):
        box = _Box()
        for prim in meshes[mesh_index].get("primitives", []):
            acc = accessors[prim["attributes"]["POSITION"]] if "POSITION" in prim.get("attributes", {}) else None
            if not acc or "min" not in acc or "max" not in acc:
                continue
            lo, hi = acc["min"], acc["max"]
            for cx in (lo[0], hi[0]):
                for cy in (lo[1], hi[1]):
                    for cz in (lo[2], hi[2]):
                        box.add(_apply(matrix, (cx, cy, cz)))
        return box

    vertices = triangles = mesh_nodes = 0
    boxes: dict[int, _Box] = {}

    def walk(index, parent_matrix, seen):
        nonlocal vertices, triangles, mesh_nodes
        if index in seen:  # malformed cycles
            return _Box()
        seen = seen | {index}
        node = nodes[index]
        matrix = _mul(parent_matrix, _local_matrix(node))
        box = _Box()
        if "mesh" in node:
            mesh_nodes += 1
            box.merge(mesh_box(node["mesh"], matrix))
            for prim in meshes[node["mesh"]].get("primitives", []):
                position = prim.get("attributes", {}).get("POSITION")
                count = accessors[position]["count"] if position is not None else 0
                vertices += count
                if prim.get("mode", 4) == 4:
                    indices = prim.get("indices")
                    triangles += (accessors[indices]["count"] if indices is not None else count) // 3
        for child in node.get("children", []):
            box.merge(walk(child, matrix, seen))
        boxes[index] = box
        return box

    scene_index = gltf.get("scene", 0)
    scenes = gltf.get("scenes", [])
    roots = scenes[scene_index].get("nodes", []) if scenes else list(range(len(nodes)))
    total = _Box()
    for root in roots:
        total.merge(walk(root, IDENTITY, frozenset()))

    names = [n.get("name", "") for n in nodes]
    seen_names, duplicates = set(), set()
    for name in names:
        if name and name in seen_names:
            duplicates.add(name)
        seen_names.add(name)

    # A floor is a group named FLOOR_n. Blender exports often also carry a
    # slab mesh with the same name; its top is the walking surface, which is
    # the elevation the kiosk uses. Without a slab, the group's lowest point.
    by_name: dict[str, dict] = {}
    for index, node in enumerate(nodes):
        name = node.get("name", "")
        order = _floor_match(name)
        box = boxes.get(index)
        if order is None or box is None or box.empty:
            continue
        entry = by_name.setdefault(name, {"order": order, "group": None, "slab": None})
        if node.get("children"):
            entry["group"] = box
        elif "mesh" in node:
            entry["slab"] = box
    floors = []
    for name, entry in by_name.items():
        group = entry["group"] or entry["slab"]
        if entry["slab"] is not None and entry["group"] is not None:
            elevation, reason = entry["slab"].max[1], f"Floor group {name} with a slab of the same name"
        else:
            elevation, reason = group.min[1], f"Name matches the floor pattern ({name})"
        floors.append(DetectedFloor(name, entry["order"], reason, "high", elevation, group.max[1]))
    floors.sort(key=lambda f: f.order)

    detected_bases = {f.node for f in floors}
    potential = []
    for index, node in enumerate(nodes):
        name = node.get("name", "")
        base = re.sub(r"\.\d+$", "", name)  # Blender's FLOOR_3.001 copies
        box = boxes.get(index)
        if (
            base in detected_bases
            or _floor_match(name) is not None
            or "floor" not in name.lower()
            or not node.get("children")
            or box is None
            or box.empty
        ):
            continue
        potential.append(DetectedFloor(name, 0, "Group name contains “floor”", "medium", box.min[1], box.max[1]))

    used = sorted(gltf.get("extensionsUsed", []))
    return GlbReport(
        gltf_version=str(gltf.get("asset", {}).get("version", "")),
        generator=str(gltf.get("asset", {}).get("generator", "")),
        object_count=len(nodes),
        mesh_count=mesh_nodes,
        material_count=len(gltf.get("materials", [])),
        texture_count=len(gltf.get("textures", [])),
        vertices_count=vertices,
        triangles_count=triangles,
        dimensions=None if total.empty else tuple(total.max[i] - total.min[i] for i in range(3)),
        extensions_used=used,
        extensions_required=sorted(gltf.get("extensionsRequired", [])),
        draco=DRACO in used,
        floors=floors,
        potential_floors=potential,
        exterior_nodes=[n for n in names if n.strip().lower() in EXTERIOR_NAMES],
        duplicate_names=sorted(duplicates),
        top_level_nodes=[names[i] for i in roots if i < len(names)],
    )
