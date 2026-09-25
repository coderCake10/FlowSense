"""Export a kiosk-ready .glb from a building's .blend file.

The team's .blend stays the editable source. This script opens it, prepares a
copy in memory, and exports a smaller .glb for the kiosk; it never saves the
.blend. Run it with Blender (4.2 or later) from a terminal:

    blender -b "CAPSTONE EYA.blend" --python export_kiosk_model.py -- \
        --out ../../client/public/models/EYA.glb

What it does (see docs/setup/building-models.md):
  * exports every collection, including ones hidden in the viewport, and keeps
    the collection hierarchy (BUILDING_EYA > FLOOR_1 ...) as nodes so the
    kiosk can show or hide each floor;
  * removes objects listed with --drop (by exact name);
  * scales textures down to at most --max-texture pixels and saves them as
    JPEG (images with transparency stay PNG);
  * compresses geometry with Draco. Shapes, names and materials are unchanged.
"""

import argparse
import sys

import bpy


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(prog="export_kiosk_model.py")
    parser.add_argument("--out", required=True, help="Output .glb path")
    parser.add_argument("--max-texture", type=int, default=2048,
                        help="Largest texture side in pixels (default 2048)")
    parser.add_argument("--jpeg-quality", type=int, default=80)
    parser.add_argument("--drop", action="append", default=[],
                        help="Exact name of an object to leave out (repeatable)")
    parser.add_argument("--no-draco", action="store_true",
                        help="Skip Draco compression (larger file)")
    return parser.parse_args(argv)


def show_everything():
    """Export ignores viewport visibility, but hidden layer collections are
    easy to miss; unhide them so the export matches the full building."""
    def unhide(layer):
        layer.hide_viewport = False
        for child in layer.children:
            unhide(child)
    unhide(bpy.context.view_layer.layer_collection)
    for obj in bpy.context.scene.objects:
        obj.hide_set(False)


def drop_objects(names):
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj is None:
            print(f"[export] --drop: no object named {name!r}; skipped")
            continue
        bpy.data.objects.remove(obj)
        print(f"[export] dropped {name!r}")


def shrink_textures(max_side):
    for image in bpy.data.images:
        width, height = image.size
        if max(width, height) <= max_side:
            continue
        factor = max_side / max(width, height)
        image.scale(max(1, round(width * factor)), max(1, round(height * factor)))
        print(f"[export] texture {image.name!r}: {width}x{height} -> {image.size[0]}x{image.size[1]}")


def main():
    args = parse_args()
    show_everything()
    drop_objects(args.drop)
    shrink_textures(args.max_texture)
    bpy.ops.export_scene.gltf(
        filepath=args.out,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        use_visible=False,
        export_hierarchy_full_collections=True,
        export_image_format="JPEG",
        export_jpeg_quality=args.jpeg_quality,
        export_unused_images=False,
        export_draco_mesh_compression_enable=not args.no_draco,
        export_draco_mesh_compression_level=6,
    )
    print(f"[export] wrote {args.out}")


main()
