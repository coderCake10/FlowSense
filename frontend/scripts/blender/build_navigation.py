"""Generate a building's navigation network from the team's .blend.

Every room sign in the model (a text object reading "EA-###" in the EYA
Building, "A-###" in the A Building) marks a door.
For each floor, this script:

1. rasterises the walkable floor: the `FLOOR_n` slab (the public corridors
   and lobby), minus anything standing between knee and head height (walls,
   columns, doors, turnstiles, stairs, bins) and the lift's footprint;
2. finds the corners people walk around (obstacle corners, kept a little
   clear of them) and joins every pair that can see each other in a clear
   straight line;
3. keeps the shortest walks from where the kiosk's routes arrive on the
   floor (the kiosk or the building's entrance, or the lift or stairs) to
   every door, stairs and lift: routes run
   straight across halls and bend only at corners, the way people walk, with
   the fewest lines to edit in Map Annotation.

Stair cores and the lift are linked floor to floor. A room with several
doors keeps the one nearest the start. The result is a JSON file in the
building model's coordinates (glTF: metres, Y up), which
`manage.py seed_eya_routes` (EYA) or `manage.py seed_a_routes` (A) loads. Run
it with Blender (4.2 or later):

    blender -b "CAPSTONE EYA2.blend" --python build_navigation.py -- \\
        --out ../../../backend/django/apps/map/seed_data/eya_navigation.json
    blender -b "A BUILDING4.blend" --python build_navigation.py -- --building a \\
        --out ../../../backend/django/apps/map/seed_data/a_navigation.json

Add `--preview DIR` to also write a PNG per floor (the walkable area, the
network, the doors), for checking the result.
"""

import argparse
import heapq
import json
import math
import re
import sys
from collections import defaultdict

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

CELL = 0.2  # raster resolution, metres
KNEE, HEAD = 0.15, 1.85  # obstacles between these heights above the slab block walking
SOLID_TOP_M = 8.0  # ... and standing inside a closed box whose top is this close does too
CLEARANCE_M = 0.35  # routes keep at least this far from walls and columns
NEAR_POINT_M = 0.8  # ... except this close to a door, the kiosk, stairs or lift
CORNER_MERGE_M = 0.6  # corner points closer than this are one point
NODE_HEIGHT = 0.1  # nodes sit this far above the slab (as the kiosk's does)
DOOR_OUT_M = 0.6  # a door's point is this far out from the door, into the corridor
SIGN_OUT_M = 0.8  # ... or from its sign, when no door is near the sign
DOOR_NEAR_M = 2.0
DOOR_REACH_M = 5.0  # a door point off the walkable floor moves at most this far
POCKET_M2 = 25.0  # walkable areas smaller than this are pockets, not corridors
# The lift's doors face +Y (the corridor side of the turnstiles on the first
# floor: the door frame and floor-number panel are on that face).
LIFT_DOOR_SIDE = 1
LIFT_OUT_M = 0.8

# What differs between the buildings' models.
#   slab: each floor's walking-surface object; top: its height is the top of
#     its box ("box") or the height most of it is at ("mode": slabs with
#     raised parts); signs: a sign's floor is the FLOOR_n collection it is in
#     ("collection") or the floor below its height ("height");
#   solids: cells inside closed boxes (walls, rooms) are blocked too;
#   start: where routes into the building begin (glTF coordinates), the root
#     of every floor's walks; only: objects outside this collection (old
#     copies kept in the .blend) are ignored.
PROFILES = {
    "eya": {
        "floors": range(1, 7),
        "slab": {order: f"FLOOR_{order}" for order in range(1, 7)},
        "top": "box",
        "signs": "collection",
        "solids": False,
        "code": re.compile(r"^\s*(?:EA)?\s*-?\s*(\d{3}[AB]?)\s*$", re.I),
        "prefix": "EA-",
        # The kiosk in the kiosk model's coordinates (client/src/data/eyaNavigation.ts).
        "start": {"kind": "kiosk", "key": "kiosk", "name": "EYA lobby kiosk", "floor": 1,
                  "position": (0.0, 1.02, 28.5)},
        "stairs": ("Front stairs", "Back stairs"),
        "only": None,
    },
    "a": {
        "floors": range(1, 5),
        "slab": {1: "GROUND FLOOR_1", 2: "2", 3: "FLOORS_3", 4: "FLOORS_4"},
        "top": "mode",
        "signs": "height",
        # Its walls and room boxes are closed shells standing on one ground
        # slab: cells inside them are blocked.
        "solids": True,
        "code": re.compile(r"^\s*A\s*-?\s*(\d{3}[AB]?)\s*$", re.I),
        "prefix": "A-",
        # Inside the front gate's opening (FRONT ENTRANCE, between its two
        # halves), where the walk from the EYA Building arrives.
        "start": {"kind": "entrance", "key": "entrance", "name": "A Building front entrance", "floor": 1,
                  "position": (59.8, 0.1, 1.5)},
        # Seen from the front gate (the model's +X side), looking in.
        "stairs": lambda box: ("Back stairs" if box[0] + box[2] < 0 else
                               "Front left stairs" if box[1] + box[3] < 0 else "Front right stairs"),
        "only": "A BUILDING",
    },
}
PROFILE = PROFILES["eya"]
FLOORS = PROFILE["floors"]


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(prog="build_navigation.py")
    parser.add_argument("--out", required=True, help="Output .json path")
    parser.add_argument("--preview", help="Folder for one PNG per floor")
    parser.add_argument("--building", choices=sorted(PROFILES), default="eya")
    return parser.parse_args(argv)


def in_building(obj):
    only = PROFILE["only"]
    return only is None or obj.name in bpy.data.collections[only].all_objects


def to_model(x, y, z):
    """Blender (Z up) -> glTF model coordinates (Y up)."""
    return [round(x, 3), round(z, 3), round(-y, 3)]


def world_box(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return (
        Vector([min(c[i] for c in corners) for i in range(3)]),
        Vector([max(c[i] for c in corners) for i in range(3)]),
    )


def centre(obj):
    lo, hi = world_box(obj)
    return (lo + hi) / 2


def slab_height(slab, lo, hi):
    """The height most of the slab's top is at (metres)."""
    tree = bvh([slab])
    heights = defaultdict(list)
    for x in np.arange(lo.x, hi.x, 1.0):
        for y in np.arange(lo.y, hi.y, 1.0):
            hit = tree.ray_cast(Vector((x, y, hi.z + 1)), Vector((0, 0, -1)), hi.z - lo.z + 2)[0]
            if hit is not None:
                heights[round(hit.z, 1)].append(hit.z)
    common = max(heights.values(), key=len)
    return float(np.median(common))


def bvh(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    verts, polys = [], []
    for obj in objects:
        if obj.type not in {"MESH", "FONT", "CURVE"}:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        base = len(verts)
        verts += [obj.matrix_world @ v.co for v in mesh.vertices]
        polys += [[base + i for i in p.vertices] for p in mesh.polygons]
        evaluated.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys) if polys else None


# ---------------------------------------------------------------- the model


class Floor:
    def __init__(self, order):
        self.order = order
        self.collection = bpy.data.collections[f"FLOOR_{order}"]
        self.slab = bpy.data.objects[PROFILE["slab"][order]]
        lo, hi = world_box(self.slab)
        self.top = hi.z if PROFILE["top"] == "box" else slab_height(self.slab, lo, hi)
        self.x0, self.y0 = lo.x, lo.y
        self.width = int(math.ceil((hi.x - lo.x) / CELL))
        self.height = int(math.ceil((hi.y - lo.y) / CELL))

    def xy(self, row, col):
        return self.x0 + col * CELL, self.y0 + row * CELL

    def cell(self, x, y):
        return int(round((y - self.y0) / CELL)), int(round((x - self.x0) / CELL))

    def rasterise(self):
        slab = bvh([self.slab])
        obstacles = bvh([o for o in self.collection.all_objects if o is not self.slab])
        walk = np.zeros((self.height, self.width), dtype=bool)
        down, up = Vector((0, 0, -1)), Vector((0, 0, 1))
        for row in range(self.height):
            for col in range(self.width):
                x, y = self.xy(row, col)
                hit = slab.ray_cast(Vector((x, y, self.top + 0.5)), down, 1.0)[0]
                if hit is None or abs(hit.z - self.top) > 0.15:
                    continue
                if obstacles is not None:
                    start = Vector((x, y, self.top + KNEE))
                    if obstacles.ray_cast(start, up, HEAD - KNEE)[0] is not None:
                        continue
                    if PROFILE["solids"]:
                        # Inside a wall or room box: the first face above
                        # is its top, seen from inside (facing up).
                        hit, normal, _, _ = obstacles.ray_cast(start, up, SOLID_TOP_M)
                        if hit is not None and normal.z > 0:
                            continue
                walk[row, col] = True
        # The lift is hollow in the model (no top to its car), so the ray
        # above misses it; its footprint is blocked outright.
        for obj in self.collection.all_objects:
            if obj.type == "MESH" and obj.name.upper().startswith("ELEVATOR"):
                lo, hi = world_box(obj)
                r0, c0 = self.cell(lo.x, lo.y)
                r1, c1 = self.cell(hi.x, hi.y)
                walk[max(0, r0 - 1):r1 + 2, max(0, c0 - 1):c1 + 2] = False
        self.walk = walk
        self.clearance = clearance(walk)
        # The floor's connected walkable areas, without the small pockets
        # left inside walls and stair cores (A Building).
        self.main = large_areas(walk & (self.clearance >= CELL / 2)) if PROFILE["solids"] else walk

    def in_main(self, x, y):
        row, col = self.cell(x, y)
        return 0 <= row < self.height and 0 <= col < self.width and self.main[row, col]

    def walkable(self, x, y):
        row, col = self.cell(x, y)
        return 0 <= row < self.height and 0 <= col < self.width and self.walk[row, col]

    def near_walkable(self, x, y, reach):
        """The nearest walkable spot with room to walk, within `reach` metres."""
        spot = self.nearest_walkable(x, y, self.main & (self.clearance >= CLEARANCE_M))
        return spot if spot is not None and math.dist(spot, (x, y)) <= reach else None

    def nearest_walkable(self, x, y, within=None):
        rows, cols = np.nonzero(self.walk if within is None else self.walk & within)
        if len(rows) == 0:
            return None
        xs, ys = self.x0 + cols * CELL, self.y0 + rows * CELL
        i = int(np.argmin((xs - x) ** 2 + (ys - y) ** 2))
        return float(xs[i]), float(ys[i])


def room_signs(floors):
    """(code, floor, door point x, y) for every room-code text object."""
    doors = {
        order: [o for o in bpy.data.collections[f"FLOOR_{order}"].all_objects
                if o.type == "MESH" and "DOOR" in o.name.upper()]
        for order in FLOORS
    }
    # Old copies the team keeps in the .blend.
    backup = bpy.data.collections["BACKUP"].all_objects if "BACKUP" in bpy.data.collections else []
    candidates = []
    for obj in bpy.data.objects:
        if obj.type != "FONT" or obj.name in backup:
            continue
        match = PROFILE["code"].match(obj.data.body.replace("\n", " "))
        if not match:
            continue
        sign = centre(obj)
        if PROFILE["signs"] == "collection":
            order = next((i for i in FLOORS if obj.name in bpy.data.collections[f"FLOOR_{i}"].all_objects), None)
        else:
            order = max((i for i in FLOORS if floors[i].top <= sign.z), default=None)
        if order is None:
            continue
        normal = (obj.matrix_world.to_3x3() @ Vector((0, 0, 1)))
        normal.z = 0
        normal.normalize()
        near = min(doors[order], key=lambda d: (centre(d) - sign).length, default=None)
        gap = (centre(near) - sign).length if near is not None else math.inf
        candidates.append((gap, PROFILE["prefix"] + match.group(1).upper(), order, sign, normal, near))
    # A door goes to the sign nearest it; another room's sign beside the same
    # door (two codes on one wall) uses its own point instead.
    found, claimed = [], {}
    for gap, code, order, sign, normal, near in sorted(candidates, key=lambda c: c[0]):
        points = []
        if gap <= DOOR_NEAR_M and claimed.setdefault(near.name, code) == code:
            door = centre(near)
            points.append((door.x + normal.x * DOOR_OUT_M, door.y + normal.y * DOOR_OUT_M))
        points.append((sign.x + normal.x * SIGN_OUT_M, sign.y + normal.y * SIGN_OUT_M))
        found.append({"code": code, "floor": order, "points": points})
    return found


def cores():
    """Stair cores (grouped by footprint) and the elevator, as XY boxes."""
    boxes = []
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.name.upper().startswith("STAIRS") and in_building(obj):
            lo, hi = world_box(obj)
            for box in boxes:
                if lo.x < box[2] and hi.x > box[0] and lo.y < box[3] and hi.y > box[1]:
                    box[:] = [min(box[0], lo.x), min(box[1], lo.y), max(box[2], hi.x), max(box[3], hi.y)]
                    break
            else:
                boxes.append([lo.x, lo.y, hi.x, hi.y])
    # The front stairs are the pair nearer the lobby (lower model Y).
    boxes.sort(key=lambda b: b[1])
    print("[navigation] stair cores:", [[round(v, 1) for v in box] for box in boxes])
    names = PROFILE["stairs"]
    if callable(names):
        stairs = [{"name": names(box), "box": box} for box in boxes]
    else:
        stairs = [{"name": name, "box": box} for name, box in zip(names, boxes)]
    lift = [world_box(o) for o in bpy.data.objects
            if o.type == "MESH" and o.name.upper().startswith("ELEVATOR") and in_building(o)]
    if not lift:
        return stairs, None
    elevator = {"name": "Elevator", "box": [
        min(lo.x for lo, _ in lift), min(lo.y for lo, _ in lift),
        max(hi.x for _, hi in lift), max(hi.y for _, hi in lift)]}
    return stairs, elevator


# ---------------------------------------------------------------- walking lines


def large_areas(mask):
    """The 4-connected regions of `mask` of at least POCKET_M2."""
    labels = np.zeros(mask.shape, dtype=np.int32)
    keep, label = [], 0
    h, w = mask.shape
    for r0, c0 in zip(*np.nonzero(mask)):
        if labels[r0, c0]:
            continue
        label += 1
        labels[r0, c0] = label
        stack, size = [(r0, c0)], 0
        while stack:
            r, c = stack.pop()
            size += 1
            for a, b in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                if 0 <= a < h and 0 <= b < w and mask[a, b] and not labels[a, b]:
                    labels[a, b] = label
                    stack.append((a, b))
        if size * CELL * CELL >= POCKET_M2:
            keep.append(label)
    return np.isin(labels, keep)


def clearance(walk):
    """Distance (metres) from each cell to the nearest blocked cell."""
    h, w = walk.shape
    big = 1e9
    d = np.where(walk, big, 0.0)
    diag = math.sqrt(2)
    for r in range(h):  # forward pass
        row = d[r]
        for c in range(w):
            if row[c] == 0:
                continue
            best = row[c]
            if c > 0:
                best = min(best, row[c - 1] + 1)
            if r > 0:
                up = d[r - 1]
                best = min(best, up[c] + 1)
                if c > 0:
                    best = min(best, up[c - 1] + diag)
                if c < w - 1:
                    best = min(best, up[c + 1] + diag)
            row[c] = best
    for r in range(h - 1, -1, -1):  # backward pass
        row = d[r]
        for c in range(w - 1, -1, -1):
            if row[c] == 0:
                continue
            best = row[c]
            if c < w - 1:
                best = min(best, row[c + 1] + 1)
            if r < h - 1:
                down = d[r + 1]
                best = min(best, down[c] + 1)
                if c < w - 1:
                    best = min(best, down[c + 1] + diag)
                if c > 0:
                    best = min(best, down[c - 1] + diag)
            row[c] = best
    # Cells at the raster's edge border unknown space: treat it as blocked.
    rows = np.minimum(np.arange(h) + 1, h - np.arange(h))[:, None]
    cols = np.minimum(np.arange(w) + 1, w - np.arange(w))[None, :]
    return np.minimum(d, np.minimum(rows, cols)) * CELL


def corner_points(floor):
    """Convex corners of the space that keeps CLEARANCE_M from obstacles:
    where a taut walk bends. Neighbouring corners are merged."""
    ok = floor.clearance >= CLEARANCE_M
    pad = np.pad(ok, 1)
    centre_ok = pad[1:-1, 1:-1]
    found = np.zeros_like(ok)
    for dr, dc in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
        diag = pad[1 + dr:pad.shape[0] - 1 + dr, 1 + dc:pad.shape[1] - 1 + dc]
        side_r = pad[1 + dr:pad.shape[0] - 1 + dr, 1:-1]
        side_c = pad[1:-1, 1 + dc:pad.shape[1] - 1 + dc]
        found |= centre_ok & ~diag & side_r & side_c
    points = []
    for row, col in zip(*np.nonzero(found)):
        xy = floor.xy(row, col)
        if all(math.dist(xy, p) >= CORNER_MERGE_M for p in points):
            points.append(xy)
    return points


def sight_lines(floor, points, relaxed):
    """Pairs (i, j, length) of points joined by a clear straight line. Near a
    point in `relaxed` (doors, kiosk, stairs, lift) less clearance is needed,
    since those sit close to walls."""
    pts = np.array(points, dtype=float)
    n = len(pts)
    lines = []
    for i in range(n - 1):
        others = pts[i + 1:]
        delta = others - pts[i]
        length = np.hypot(delta[:, 0], delta[:, 1])
        steps = np.maximum(1, np.ceil(length / (CELL / 2))).astype(int)
        top = int(steps.max())
        t = np.linspace(0, 1, top + 1)[None, :]
        t = np.minimum(t * (top / steps[:, None]), 1.0)
        xs = pts[i, 0] + delta[:, 0:1] * t
        ys = pts[i, 1] + delta[:, 1:2] * t
        rows = np.clip(np.round((ys - floor.y0) / CELL).astype(int), 0, floor.height - 1)
        cols = np.clip(np.round((xs - floor.x0) / CELL).astype(int), 0, floor.width - 1)
        clear = floor.clearance[rows, cols]
        from_i = t * length[:, None]
        from_j = (1 - t) * length[:, None]
        need = np.full(clear.shape, CLEARANCE_M)
        if i in relaxed:
            need = np.where(from_i <= NEAR_POINT_M, CELL / 2, need)
        rel = np.array([j in relaxed for j in range(i + 1, n)])[:, None]
        need = np.where(rel & (from_j <= NEAR_POINT_M), CELL / 2, need)
        ok = (clear >= need - 1e-6).all(axis=1)
        for k in np.nonzero(ok)[0]:
            lines.append((i, i + 1 + int(k), float(length[k])))
    return lines


def shortest(adj, start):
    dist, prev = {start: 0.0}, {}
    heap = [(0.0, start)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:
            continue
        for v, w in adj[u]:
            if d + w < dist.get(v, math.inf):
                dist[v], prev[v] = d + w, u
                heapq.heappush(heap, (d + w, v))
    return dist, prev


def grid_distance(floor, start):
    """Walking distance over the raster (8-neighbour) from `start`: the
    yardstick the routes are checked against."""
    ok = floor.clearance >= CELL / 2
    r0, c0 = floor.cell(*start)
    dist = np.full(ok.shape, np.inf)
    dist[r0, c0] = 0.0
    heap = [(0.0, r0, c0)]
    steps = [(dr, dc, math.hypot(dr, dc) * CELL) for dr in (-1, 0, 1) for dc in (-1, 0, 1) if dr or dc]
    while heap:
        d, r, c = heapq.heappop(heap)
        if d > dist[r, c]:
            continue
        for dr, dc, w in steps:
            a, b = r + dr, c + dc
            if 0 <= a < floor.height and 0 <= b < floor.width and ok[a, b] and d + w < dist[a, b]:
                dist[a, b] = d + w
                heapq.heappush(heap, (d + w, a, b))
    return dist


# ---------------------------------------------------------------- build


def main():
    global PROFILE, FLOORS
    args = parse_args()
    PROFILE = PROFILES[args.building]
    FLOORS = PROFILE["floors"]
    KIOSK = PROFILE["start"]
    floors = {order: Floor(order) for order in FLOORS}
    for floor in floors.values():
        floor.rasterise()
        print(f"[navigation] floor {floor.order}: {int(floor.walk.sum())} walkable cells")
    signs = room_signs(floors)
    stairs, elevator = cores()
    problems = []

    def core_point(floor, core):
        """Where people step onto the stairs, or wait for the lift."""
        box = core["box"]
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        if core is elevator:
            y = box[3] + LIFT_OUT_M if LIFT_DOOR_SIDE > 0 else box[1] - LIFT_OUT_M
            return floor.nearest_walkable(cx, y)
        rows = (np.arange(floor.height) * CELL + floor.y0)[:, None]
        cols = (np.arange(floor.width) * CELL + floor.x0)[None, :]
        inside = (cols >= box[0]) & (cols <= box[2]) & (rows >= box[1]) & (rows <= box[3])
        if PROFILE["solids"]:
            # The foot of the stairs, on the corridor beside the core.
            return floor.nearest_walkable(cx, cy, floor.main & (floor.clearance >= CLEARANCE_M))
        return floor.nearest_walkable(cx, cy, inside) or floor.nearest_walkable(cx, cy)

    # Per floor: points (corners, then anchors) and the sight lines between them.
    plans = {}
    for order, floor in floors.items():
        points = corner_points(floor)
        anchors = {}

        def add_anchor(xy, record):
            anchors[len(points)] = record
            points.append(xy)

        for core in stairs + ([elevator] if elevator else []):
            xy = core_point(floor, core)
            kind = "elevator" if core is elevator else "stairs"
            if xy is None:
                problems.append(f"floor {order}: {core['name']} has no walkable side")
            else:
                add_anchor(xy, {"kind": kind, "name": core["name"]})
        if order == KIOSK["floor"]:
            x, _, z = KIOSK["position"]
            add_anchor((x, -z), {"kind": "kiosk", "name": KIOSK["name"]})
            print(f"[navigation] {KIOSK['name']}: walkable {floor.walkable(x, -z)}")
        for sign in signs:
            if sign["floor"] != order:
                continue
            xy = next((p for p in sign["points"] if floor.walkable(*p) and floor.in_main(*p)), None)
            if xy is None:
                # A door just past the slab's edge (A Building: landings by
                # the stairs): the nearest walkable spot, if it's close.
                xy = floor.near_walkable(*sign["points"][-1], DOOR_REACH_M)
                if xy is not None:
                    print(f"[navigation] floor {order}: {sign['code']} door moved onto the walkable floor")
            if xy is None:
                problems.append(f"floor {order}: {sign['code']} door not on the walkable floor")
            else:
                add_anchor(xy, {"kind": "door", "code": sign["code"]})
        adj = defaultdict(list)
        for i, j, length in sight_lines(floor, points, set(anchors)):
            adj[i].append((j, length))
            adj[j].append((i, length))
        plans[order] = {"points": points, "anchors": anchors, "adj": adj}
        print(f"[navigation] floor {order}: {len(points)} points, "
              f"{sum(len(v) for v in adj.values()) // 2} sight lines")

    def anchors_of(kind):
        return {(o, i): rec for o, plan in plans.items() for i, rec in plan["anchors"].items()
                if rec["kind"] == kind}

    links = []
    for kind in ("stairs", "elevator"):
        named = defaultdict(dict)
        for (order, i), rec in anchors_of(kind).items():
            named[rec["name"]][order] = i
        for per_floor in named.values():
            for order in FLOORS:
                if order in per_floor and order + 1 in per_floor:
                    links.append({"type": kind, "from": (order, per_floor[order]),
                                  "to": (order + 1, per_floor[order + 1])})

    def whole_building():
        """Every floor's sight lines plus the floor links, weighted like the
        Navigation API (navigation/services.py: stairs 1.5x, lift 2x the climb)."""
        adj = defaultdict(list)
        for order, plan in plans.items():
            for i, near in plan["adj"].items():
                adj[(order, i)] += [((order, j), w) for j, w in near]
        for link in links:
            climb = abs(floors[link["to"][0]].top - floors[link["from"][0]].top)
            weight = climb * (1.5 if link["type"] == "stairs" else 2.0)
            adj[link["from"]].append((link["to"], weight))
            adj[link["to"]].append((link["from"], weight))
        return adj

    # One door per room: the nearest to the kiosk.
    kiosk = next(iter(anchors_of("kiosk")))
    dist, _ = shortest(whole_building(), kiosk)
    doors = anchors_of("door")
    best = {}
    for key, rec in doors.items():
        if key in dist and (rec["code"] not in best or dist[key] < dist[best[rec["code"]]]):
            best[rec["code"]] = key
    for key, rec in doors.items():
        if best.get(rec["code"]) != key:
            del plans[key[0]]["anchors"][key[1]]
    problems += [f"{code}: no route from the kiosk"
                 for code in sorted({rec["code"] for rec in doors.values()} - set(best))]

    # Per floor, keep the shortest walks from where the kiosk's routes arrive
    # (the kiosk itself, or the lift or stairs they come up) to every door,
    # stairs and lift: a tree, the fewest lines that give every room its best
    # route, and every stairs and lift stays reachable on its own floor.
    dist, prev = shortest(whole_building(), kiosk)
    graphs = {}
    for order, plan in plans.items():
        arrivals = [i for i in plan["anchors"] if (order, i) in prev and prev[(order, i)][0] != order]
        root = kiosk[1] if order == kiosk[0] else min(arrivals, key=lambda i: dist[(order, i)], default=None)
        graph = {"nodes": set(plan["anchors"]), "edges": set()}
        graphs[order] = graph
        if root is None:
            problems.append(f"floor {order}: not reached from the kiosk")
            continue
        _, back = shortest(plan["adj"], root)
        for target in plan["anchors"]:
            node = target
            if node != root and node not in back:
                problems.append(f"floor {order}: {plan['anchors'][node].get('code') or plan['anchors'][node]['name']} "
                                "can't be walked to on its floor")
            while node in back:
                graph["edges"].add((min(node, back[node]), max(node, back[node])))
                graph["nodes"] |= {node, back[node]}
                node = back[node]

    # Check: routes from the kiosk against walking the raster itself.
    first = floors[KIOSK["floor"]]
    grid = grid_distance(first, plans[KIOSK["floor"]]["points"][kiosk[1]])
    dist, _ = shortest({i: [(j, math.dist(plans[1]["points"][i], plans[1]["points"][j]))
                            for j in graphs[1]["nodes"] if (min(i, j), max(i, j)) in graphs[1]["edges"]]
                        for i in graphs[1]["nodes"]}, kiosk[1])
    ratios = []
    for i, rec in plans[KIOSK["floor"]]["anchors"].items():
        if rec["kind"] == "door" and i in dist:
            r, c = first.cell(*plans[1]["points"][i])
            if np.isfinite(grid[r, c]) and grid[r, c] > 0:
                ratios.append((dist[i] / grid[r, c], rec["code"]))
    if ratios:
        worst = max(ratios)
        print(f"[navigation] first floor: routes are at most {worst[0]:.2f}x the raster walk ({worst[1]})")

    # Stable keys: floor, then position along the building (south to north).
    out_floors, key_of = [], {}
    for order, floor in floors.items():
        plan, graph = plans[order], graphs[order]
        pts = plan["points"]
        nodes = []
        ordered = sorted(graph["nodes"], key=lambda n: (round(pts[n][1], 1), round(pts[n][0], 1)))
        for n, i in enumerate(ordered, start=1):
            rec = plan["anchors"].get(i, {"kind": "corridor"})
            if rec["kind"] == "door":
                key, name = f"{order}F-{rec['code']}", f"{rec['code']} door"
            elif rec["kind"] == "corridor":
                key, name = f"{order}F-c{n:03d}", f"{order}F corridor {n}"
            elif rec["kind"] == "kiosk":
                key, name = KIOSK["key"], rec["name"]
            else:
                key = f"{order}F-{rec['name'].lower().replace(' ', '-')}"
                name = f"{rec['name']} ({order}F)"
            key_of[(order, i)] = key
            x, y = pts[i]
            nodes.append({
                "key": key,
                "name": name,
                "type": {"door": "room", "kiosk": KIOSK["kind"] if KIOSK["kind"] == "kiosk" else "area_entrance"}.get(
                    rec["kind"], "auxiliary"),
                **({"room": rec["code"]} if rec["kind"] == "door" else {}),
                **({"role": rec["kind"]} if rec["kind"] in ("stairs", "elevator") else {}),
                "position": to_model(x, y, floor.top + NODE_HEIGHT),
            })
        edges = sorted(sorted([key_of[(order, a)], key_of[(order, b)]]) for a, b in graph["edges"])
        out_floors.append({"floor": order, "nodes": nodes, "edges": edges})
    transitions = [
        {"type": link["type"], "from": key_of[link["from"]], "to": key_of[link["to"]]}
        for link in links if link["from"] in key_of and link["to"] in key_of
    ]
    result = {
        "source": bpy.path.basename(bpy.data.filepath),
        "generated_by": "frontend/scripts/blender/build_navigation.py",
        "coordinates": "kiosk model (glTF): metres, Y up",
        "floors": out_floors,
        "transitions": transitions,
        "problems": problems,
    }
    with open(args.out, "w") as handle:
        json.dump(result, handle, indent=1)
    total_nodes = sum(len(f["nodes"]) for f in out_floors)
    total_edges = sum(len(f["edges"]) for f in out_floors)
    print(f"[navigation] {total_nodes} nodes, {total_edges} edges, {len(transitions)} floor links, "
          f"{len(best)} rooms; wrote {args.out}")
    for problem in problems:
        print(f"[navigation] problem: {problem}")
    if args.preview:
        preview(args.preview, floors, plans, graphs)


def preview(folder, floors, plans, graphs):
    import os
    os.makedirs(folder, exist_ok=True)
    scale = 4
    for order, floor in floors.items():
        plan, graph = plans[order], graphs[order]
        pts = plan["points"]
        image = bpy.data.images.new(f"nav{order}", floor.width * scale, floor.height * scale)
        px = np.ones((floor.height * scale, floor.width * scale, 4), dtype=np.float32)
        walk = np.kron(floor.walk, np.ones((scale, scale), dtype=bool))
        px[walk] = (0.78, 0.86, 0.80, 1)

        def dot(x, y, colour, radius):
            r, c = (y - floor.y0) / CELL * scale, (x - floor.x0) / CELL * scale
            r0, r1 = int(max(0, r - radius)), int(min(px.shape[0], r + radius + 1))
            c0, c1 = int(max(0, c - radius)), int(min(px.shape[1], c + radius + 1))
            px[r0:r1, c0:c1] = colour

        for a, b in graph["edges"]:
            (ax, ay), (bx, by) = pts[a], pts[b]
            steps = max(1, int(math.dist((ax, ay), (bx, by)) / (CELL / 4)))
            for t in range(steps + 1):
                dot(ax + (bx - ax) * t / steps, ay + (by - ay) * t / steps, (0.09, 0.21, 0.36, 1), 1)
        for node in graph["nodes"]:
            x, y = pts[node]
            rec = plan["anchors"].get(node)
            colour = {"door": (0.85, 0.2, 0.2, 1), "stairs": (0.9, 0.6, 0.1, 1),
                      "elevator": (0.5, 0.2, 0.8, 1), "kiosk": (0.1, 0.5, 0.9, 1)}.get(
                rec["kind"] if rec else None, (0.09, 0.21, 0.36, 1))
            dot(x, y, colour, 5 if rec else 2)
        image.pixels.foreach_set(px.ravel())
        image.filepath_raw = f"{folder}/floor{order}.png"
        image.file_format = "PNG"
        image.save()


main()
