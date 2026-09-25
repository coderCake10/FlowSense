"""Build the kiosk's low-detail campus model from the team's area export.

The area file (LFA_AUF.obj, a TopoExport OBJ in metres, Z up, x east,
y north) covers a large part of Angeles City. This script keeps only a
rectangular tile around the EYA Building and the A Building, leaves out the two
blocks that stand in for them (the detailed models replace those), adds a
simple overpass across MacArthur Highway, gives everything plain colours, and
moves it into the EYA model's coordinates so it lines up with the kiosk's
existing map and navigation points. Run it with Blender (4.2 or later):

    blender -b --python build_campus_model.py -- \\
        --obj LFA_AUF.obj --out ../../client/public/models/CAMPUS.glb

Placement (see docs/setup/building-models.md): each detailed model was fitted
onto its block in the area file by rotation about the vertical axis and a
horizontal offset. The same numbers place the A Building in the kiosk.
"""

import argparse
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

# Area-file blocks replaced by the detailed models.
EYA_BLOCK = "TPX_Buildings_mesh1893"
A_BLOCK = "TPX_Buildings_mesh2312"

# Model (Blender XY) -> area XY: rotate by `deg` about Z, then add `t`.
# `ground` is the area file's height at the building (metres).
EYA_FIT = {"deg": 297.25, "t": (516.94, 362.96), "ground": 87.4}
A_FIT = {"deg": 27.25, "t": (362.9, 494.76), "ground": 90.6}

# The tile kept around the two buildings, in EYA model coordinates
# (Blender X and Y, metres): a rectangle aligned with the EYA Building.
TILE_X = (-240.0, 32.0)
TILE_Y = (-218.0, 55.0)

# Overpass over MacArthur Highway at Diego Silang St, in area coordinates:
# from the Professional School's west end to the medical center's side
# (estimated from the team's satellite view). Width, deck and rail heights
# in metres.
OVERPASS = {
    "from": (447.0, 418.0),
    "to": (402.3, 395.5),
    "width": 3.5,
    "deck": (5.0, 5.4),
    "rail": 1.1,
}

def srgb(hex_colour):
    """#rrggbb as Blender's linear colour, so the model shows that colour."""
    def channel(c):
        c = int(c, 16) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    h = hex_colour.lstrip("#")
    return (channel(h[0:2]), channel(h[2:4]), channel(h[4:6]), 1.0)


COLOURS = {
    "AREA_BUILDINGS": srgb("#9aaccb"),
    "AREA_GROUND": srgb("#d9dfe6"),
    "AREA_TREES": srgb("#7fa782"),
    "OVERPASS": srgb("#e3b54f"),
}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(prog="build_campus_model.py")
    parser.add_argument("--obj", required=True, help="The area export (.obj)")
    parser.add_argument("--out", required=True, help="Output .glb path")
    parser.add_argument("--no-draco", action="store_true")
    return parser.parse_args(argv)


def to_eya_matrix():
    """Area coordinates -> EYA model coordinates (Blender, Z up)."""
    rotate = Matrix.Rotation(math.radians(-EYA_FIT["deg"]), 4, "Z")
    shift = Matrix.Translation((-EYA_FIT["t"][0], -EYA_FIT["t"][1], -EYA_FIT["ground"]))
    return rotate @ shift


def in_tile(point):
    return TILE_X[0] <= point.x <= TILE_X[1] and TILE_Y[0] <= point.y <= TILE_Y[1]


def centre(obj):
    return sum((obj.matrix_world @ Vector(c) for c in obj.bound_box), Vector()) / 8


def material(name):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = COLOURS[name]
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = COLOURS[name]
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def join(objects, name):
    if not objects:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.materials.clear()
    joined.data.materials.append(material(name))
    return joined


def crop_ground(ground):
    """Cut the (already moved) ground exactly at the tile's edges."""
    mesh = bmesh.new()
    mesh.from_mesh(ground.data)
    mesh.transform(ground.matrix_world)
    for co, no in (
        ((TILE_X[0], 0, 0), (-1, 0, 0)),
        ((TILE_X[1], 0, 0), (1, 0, 0)),
        ((0, TILE_Y[0], 0), (0, -1, 0)),
        ((0, TILE_Y[1], 0), (0, 1, 0)),
    ):
        geom = mesh.verts[:] + mesh.edges[:] + mesh.faces[:]
        bmesh.ops.bisect_plane(mesh, geom=geom, plane_co=co, plane_no=no, clear_outer=True)
    mesh.to_mesh(ground.data)
    mesh.free()
    ground.matrix_world = Matrix.Identity(4)


def strip(name, a, b, width, z):
    """A box along the ground from `a` to `b` (EYA coordinates), `width`
    wide, from height z[0] to z[1]."""
    a, b = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0))
    along = (b - a).normalized()
    side = Vector((-along.y, along.x, 0)) * (width / 2)
    corners = [a - side, b - side, b + side, a + side]
    mesh = bmesh.new()
    bottom = [mesh.verts.new((c.x, c.y, z[0])) for c in corners]
    top = [mesh.verts.new((c.x, c.y, z[1])) for c in corners]
    mesh.faces.new(bottom[::-1])
    mesh.faces.new(top)
    for i in range(4):
        j = (i + 1) % 4
        mesh.faces.new((bottom[i], bottom[j], top[j], top[i]))
    data = bpy.data.meshes.new(name)
    mesh.to_mesh(data)
    mesh.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def overpass(to_eya):
    a = to_eya @ Vector((*OVERPASS["from"], 0))
    b = to_eya @ Vector((*OVERPASS["to"], 0))
    width, (d0, d1), rail = OVERPASS["width"], OVERPASS["deck"], OVERPASS["rail"]
    along = (b - a).normalized()
    side = Vector((-along.y, along.x, 0)) * (width / 2 - 0.1)
    parts = [strip("deck", a, b, width, (d0, d1))]
    for offset in (side, -side):
        parts.append(strip("rail", a + offset, b + offset, 0.15, (d1, d1 + rail)))
    for end in (a + along * 2.0, b - along * 2.0):
        parts.append(strip("pier", end - along * 0.4, end + along * 0.4, width - 2.0, (0.0, d0)))
    return join(parts, "OVERPASS")


def main():
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.obj_import(filepath=args.obj, up_axis="Z", forward_axis="Y")
    to_eya = to_eya_matrix()
    buildings, trees, ground = [], [], None
    for obj in list(bpy.context.scene.objects):
        obj.matrix_world = to_eya @ obj.matrix_world
        name = obj.name
        if name.startswith("TPX_Ground"):
            ground = obj
            continue
        keep = name not in (EYA_BLOCK, A_BLOCK) and in_tile(centre(obj))
        if not keep:
            bpy.data.objects.remove(obj)
        elif name.startswith("TPX_Trees"):
            trees.append(obj)
        else:
            buildings.append(obj)
    print(f"[campus] kept {len(buildings)} buildings and {len(trees)} trees")
    join(buildings, "AREA_BUILDINGS")
    join(trees, "AREA_TREES")
    if ground is not None:
        crop_ground(ground)
        ground.data.materials.clear()
        ground.data.materials.append(material("AREA_GROUND"))
        ground.name = "AREA_GROUND"
    overpass(to_eya)
    bpy.ops.export_scene.gltf(
        filepath=args.out,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_draco_mesh_compression_enable=not args.no_draco,
        export_draco_mesh_compression_level=6,
    )
    print(f"[campus] wrote {args.out}")


main()
