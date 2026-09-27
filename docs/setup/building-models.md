# Building models

The kiosk's 3D building models are **compressed, kiosk-ready `.glb` files
committed to git** in `FlowSense/frontend/client/public/models/`. A fresh
clone has them; nothing needs copying.

Since step 10 a building's model can also be **replaced without a code
change**: upload it in **Asset Management**, check it, and make it live
(section 8). The kiosk, the attract screen and Map Annotation then load the
live version from the server, and fall back to the committed file when no
version is live or the server can't be reached.

They are exported from the team's `.blend` files, which stay on the shared
drive as the editable source and are **not** stored in git.

| File | Source | Size |
|---|---|---|
| `EYA.glb` | `CAPSTONE EYA2.blend` (Drive, 2026-09-26), exported with Blender 5.2.2 | 17.3 MB |
| `A.glb` | `A BUILDING4.blend` (Drive, 2026-09-27), exported with Blender 5.2.2 | 2.0 MB |

## 1. Which files the app needs

The list lives in one place, `frontend/client/src/data/models.ts`:

```ts
export const MODEL_FILES = {
  eya: "EYA.glb",
  aBuilding: "A.glb",
  campus: "CAMPUS.glb",
} as const;
```

| File | What it is | Size |
|---|---|---|
| `EYA.glb` | The EYA Building, with floors, rooms and signs (each floor holds its own signs) | 17.3 MB |
| `A.glb` | The A Building, from the team's `A BUILDING4.blend`: 4 floors, rooms, doors, stairs and room signs | 2.0 MB |
| `CAMPUS.glb` | The low-detail neighbourhood for the campus view: nearby buildings, trees, ground, and the overpass over MacArthur Highway (section 2b) | 0.05 MB |

The kiosk, the building configurations, and the check script all read this
list. Each building configuration in `client/src/data/` (for example
`eyaNavigation.ts`) picks a model from it and names the model's exterior
objects and floor groups, so the kiosk can lift them away (see
`client/src/data/README.md`).

## 2. Exporting a new version from Blender

Use the export script rather than Blender's export menu. It applies the same
settings every time:

- It exports every collection, including ones hidden in the viewport.
- It keeps the collection tree (`BUILDING_EYA → FLOOR_1 …`) so the kiosk can
  show or hide each floor.
- It scales textures down to at most 2048 px and saves them as JPEG. Images
  with transparency stay PNG.
- It compresses the geometry with Draco. Shapes, object names and materials
  are unchanged, and every object stays separate and interactive.

It never saves or changes the `.blend`.

```bash
cd FlowSense/frontend
blender -b "/path/to/CAPSTONE EYA2.blend" --python scripts/blender/export_kiosk_model.py -- \
    --out client/public/models/EYA.glb \
    --drop "GEO-foot.005_male_primitive_realistic.L"
```

| Option | Meaning |
|---|---|
| `--out` | Output file (required) |
| `--max-texture` | Largest texture side in pixels. Default 2048. 1024 blurs close-up floor tiles. |
| `--jpeg-quality` | Default 80 |
| `--drop NAME` | Leave out an object by exact name. Repeat it for several objects. The EYA file still contains a stray human figure, which is dropped here. |
| `--drop-collection NAME` | Leave out a collection and everything in it, by exact name. Repeatable. |
| `--collect-loose NAME` | Put objects that aren't in any collection (at the top of the scene) into a group `NAME`, so the kiosk can split them between floors by height. |
| `--text-resolution N` | Draw text (room signs) with `N` curve steps instead of the file's (12). Fewer triangles, same signs at kiosk distance. |
| `--no-draco` | Skip compression. The file will be about 4 times larger. |

The A Building's file keeps old copies in a `BACKUP` collection, and most of
its room signs sit at the top of the scene rather than in a collection.
Export it with:

```bash
blender -b "/path/to/A BUILDING4.blend" --python scripts/blender/export_kiosk_model.py -- \
    --out client/public/models/A.glb \
    --drop-collection BACKUP --collect-loose SIGNS --text-resolution 3
```

Without `--text-resolution 3` the signs' lettering alone is 1.3 million
triangles (the file 4.5 MB instead of 2 MB). The kiosk's A configuration
(`client/src/data/aNavigation.ts`) splits `SIGNS` and `SIGNS 1_4` between the
floors by height.

**Where the A Building stands.** Its model has its own origin; the kiosk
places it in the campus (the EYA model's coordinates) turned 90° and moved to
its area's `placement`, which `seed_campus` sets once from `PLACEMENT` in
`backend/django/apps/map/seed_data/a_building.py` and Map Annotation's Campus
view moves afterwards (`A_PLACEMENT` in `aNavigation.ts` is only the offline
fallback). A BUILDING4's origin is
56.84 m along X and −1.65 m along Y (Blender) from the earlier A file's, so
the placement moved by the same amount turned. If a new export moves the
origin again, compare the ground slab's box with the old file's and update
both placements.

Blender 4.2 or later works; the EYA model was exported with Blender 5.2.2 LTS.

The textures and compression were compared against the uncompressed export,
rendered with the same three.js viewer the kiosk uses. At kiosk viewing
distance there's no visible difference, with an average pixel difference
under 1.5/255. Only extreme close-ups of floor tiles look slightly softer.

After exporting:

```bash
npm run models:check      # size, glTF header, Draco decoder present
npm run qa:step7a         # kiosk loads it, offline-safe (dev server on :3000)
```

Then commit the new `.glb`. A new file name also needs a whitelist line in
`frontend/.gitignore`: only listed models are committed, so large source files
dropped in the folder can't be committed by accident.

**Repository growth:** git keeps every committed version. Each EYA update adds
about 16 MB to the history. If the history grows too heavy, the team starts
a fresh repository from the latest version.

## 2b. The campus model

`scripts/blender/build_campus_model.py` makes `CAMPUS.glb` from the team's
area export (`LFA_AUF.obj`, a TopoExport OBJ in metres):

```bash
blender -b --python scripts/blender/build_campus_model.py -- \
    --obj "/path/to/LFA_AUF.obj" --out client/public/models/CAMPUS.glb
```

What it does:

- **Moves the area into the EYA model's coordinates,** so the campus lines up
  with the kiosk's existing map and navigation points. EYA stays at the
  origin.
- **Keeps a rectangular tile** around the two buildings (`TILE_X`, `TILE_Y`)
  and cuts the ground at its edges.
- **Leaves out two blocks:** `mesh1893` (EYA) and `mesh2312` (A Building),
  which the detailed models replace. The Professional School (`mesh1954`)
  stays as a neighbouring block.
- **Adds a simple overpass** across MacArthur Highway at Diego Silang St, from
  the Professional School's west end to the medical center's side
  (`OVERPASS`, in area coordinates). Its length, deck height and landing are
  estimates from the satellite view; correct them in the script if needed.
- **Drops the trees in the middle of MacArthur Highway.** The area file has a
  row of trees down the road's centre line that isn't there. Trees centred in
  `HIGHWAY_MEDIAN_Y` (EYA coordinates) are left out; the pavements' trees stay.
- **Gives everything flat colours** and compresses it with Draco.

**Placement.** Each detailed model was fitted onto its block in the area file
by rotation about the vertical axis and a horizontal offset. The front
entrances and the overpass decided which way each building faces:

- the A Building's front entrances face MacArthur Highway;
- EYA's curved lobby faces the highway.

| Building | Area block | Rotation | Offset (area x, y) | Ground height |
|---|---|---|---|---|
| EYA | `TPX_Buildings_mesh1893` | 297.25° | 516.94, 362.96 | 87.4 m |
| A Building | `TPX_Buildings_mesh2312` | 27.25° | 362.9, 494.76 | 90.6 m |

(The A row was fitted with the earlier A file; A BUILDING4's origin is moved,
see section 2.) In the kiosk, the A Building is placed at
`[-189.35, 3.2, 133.44]` and turned 1.5708 rad (90°) in EYA's coordinates:
the A Building area's `placement`
(set by `seed_campus`, then moved in Map Annotation's Campus view). If a
model's origin changes in Blender, move it again in the Campus view: its
route points move with it.

**Labels.** The campus view's names are in `campus.landmarks` in the same
file, in EYA's model coordinates (x, height, −y of the Blender tile):
the overpass, the Professional School (`mesh1954`) and the Sports and Cultural
Center (`mesh2194`, the 60 × 60 m arena across the highway). To name another
block, find it in the area file, and add its centre with a height a few metres
above its roof.

After rebuilding `CAMPUS.glb`, run `python manage.py seed_assets` so Asset
Management gets it as the campus model's next version.

## 2c. The navigation network

The kiosk's routes are generated from the team's `.blend` files by
`scripts/blender/build_navigation.py`, into
`backend/django/apps/map/seed_data/eya_navigation.json` (loaded by
`python manage.py seed_eya_routes`) and `a_navigation.json` (loaded by
`python manage.py seed_a_routes`). Regenerate them whenever a model changes
rooms, corridors, stairs or signs:

```bash
cd FlowSense/frontend/scripts/blender
blender -b "/path/to/CAPSTONE EYA2.blend" --python build_navigation.py -- \
    --out ../../../backend/django/apps/map/seed_data/eya_navigation.json \
    --preview /tmp/eya-nav
blender -b "/path/to/A BUILDING4.blend" --python build_navigation.py -- --building a \
    --out ../../../backend/django/apps/map/seed_data/a_navigation.json \
    --preview /tmp/a-nav
```

It takes a few seconds. `--preview` writes a PNG per floor (walkable area in
green, routes in navy, doors red, stairs orange, lift purple, kiosk blue):
look at them before committing. Then run `seed_eya_routes` again.

How it works, per floor:

1. **Walkable area.** The `FLOOR_n` slab (the public corridors and lobby) on a
   0.2 m grid, minus anything between knee and head height: walls, columns,
   doors, turnstiles, stairs, bins. The lift's footprint is blocked too: its
   car is hollow in the model, so the height test alone would let routes
   through it.
2. **Corners and sight lines.** Routes bend only where people bend: at the
   corners of walls, columns and cores, kept 0.35 m clear. Every pair of
   corners (and doors, stairs, lift, kiosk) that can see each other in a clear
   straight line is joined.
3. **Doors.** Every text object reading a room code (`EA-###`) is a room
   sign. The door point is 0.6 m out from the door nearest the sign, on the
   corridor side (the sign's facing), or 0.8 m out from the sign when no door
   is within 2 m. A door beside two signs goes to the nearer one; the other
   room uses its own sign. A room with several signs keeps the door nearest
   the kiosk.
4. **Stairs and lift.** Stairs are joined at their open side on each floor.
   The lift is joined in front of its doors, which face the corridor side of
   the turnstiles (`LIFT_DOOR_SIDE`). Each stair core and the lift are linked
   floor to floor, weighed like the Navigation API (stairs 1.5×, lift 2× the
   climb).
5. **What's kept.** On each floor, the shortest walks from where the kiosk's
   routes arrive (the kiosk, or the lift) to every door, stairs and lift: a
   tree, the fewest lines that give every room its shortest route. The script
   prints how the first floor's routes compare with walking the grid itself
   (1.07× at most for EYA2; the grid walk is itself a little longer than a
   straight line).

The kiosk's position is `start` in the script's `eya` profile. A room sign
the model lacks means no door point: place that room's door in Map
Annotation.

**The A Building** (`--building a`, the `a` profile) differs from EYA in its
model, not in the method:

| | EYA | A |
|---|---|---|
| Floor slabs | `FLOOR_1` … `FLOOR_6` | `GROUND FLOOR_1`, `2`, `FLOORS_3`, `FLOORS_4`; walking height is the height most of the slab is at (0, 3.6, 7.0, 10.05 m), since the slabs have raised parts |
| Room signs | `EA-###`, in their floor's collection | `A-###`, mostly at the top of the scene: the floor is the one below the sign's height |
| Walls and room boxes | Stand beside the slab | Stand on one ground slab and are hollow: a cell inside a closed box counts as blocked |
| Routes start at | The kiosk | The front entrance, inside the front gate's opening |
| Stairs | Front, back | Front left, front right (seen from the gate), back; no elevator |

Some A doors sit just past a slab's edge (landings by the stairs): their
point moves to the nearest walkable spot within 5 m, and the script says so.
Small walkable pockets (under 25 m², e.g. inside stair cores) aren't used. On
the fourth floor the back stairs arrive in the auditorium's side of the
corridor (the auditorium closes it), so the script reports "Back stairs can't
be walked to on its floor"; the other stairs serve that floor. 46 rooms get a
door; A-401 and A-412 have no sign in the model.

**The walk between the buildings** isn't generated: it's the `WALK` list in
`seed_data/a_building.py`, points in campus coordinates from the EYA front
doors along MacArthur Highway, over the overpass, to the A Building's front
gate, each line checked clear of the campus model's buildings and trees.
`seed_a_routes` loads it on the campus walkways (an outdoor area) and joins it
to the EYA kiosk and the A Building's front entrance. Move its points there
if the campus model changes.

## 3. The Draco decoder

Compressed models need the Draco decoder in the browser. It is served by the
app itself from `client/public/draco/`, as two files copied unchanged from the
`three` package. drei's default would fetch it from Google's CDN, which fails on
an offline kiosk network. `DRACO_DECODER_PATH` in `models.ts` points the loader at
the local copy. If `three` is upgraded, copy the files again:

```bash
cp node_modules/three/examples/jsm/libs/draco/gltf/draco_{wasm_wrapper.js,decoder.wasm} client/public/draco/
```

## 4. Check the installation

```bash
cd FlowSense/frontend
npm run models:check
```

```
  OK       EYA.glb (17.3 MB)

All 1 models and the Draco decoder are installed.
```

Each model is reported as `OK`, `MISSING`, or `INVALID`. `INVALID` means the
file isn't a binary glTF 2.0: it could be a `.gltf`, a Git LFS pointer, or a
download that stopped partway. The command exits with 1 when anything needs
attention.

If a model is missing at runtime, the kiosk shows "This building's map isn't
available on this kiosk right now". In development it also shows the exact
missing file.

## 5. Serving models from elsewhere (optional)

- **Another folder, with Docker Compose:** set `FLOWSENSE_MODELS_DIR` in
  `FlowSense/.env`. Compose mounts it read-only as the app's `/models`
  (default: the committed folder).
- **Another server:** set `VITE_MODELS_BASE_URL` in `frontend/.env.local`.
  The server must allow CORS from the kiosk's origin.

## 6. Notes for the modeling team

The EYA file follows the asset specification's hierarchy and real-world scale.
Items agreed on 2026-09-25, as of `CAPSTONE EYA2.blend` (2026-09-26):

1. ✓ **Done.** The human figure is gone from the scene.
2. Keep the current detail on fences, fire-extinguisher canisters and the
   exterior. Don't simplify them.
3. Rename the `.00N` duplicates to descriptive names, e.g. `Door_EA-101A`
   instead of `DOOR_.001`. Still open: 1,010 of 1,066 objects have them.
4. Apply transforms before export (Ctrl+A → All Transforms). Still open: 522
   objects have unapplied scale or rotation.
5. ✓ **Done.** Each floor holds its own room signs (167 signs, all at their
   floor's height), so the kiosk no longer sorts them by height.
6. ✓ **Done.** All 34 images are packed into the `.blend`.

Keep, as in EYA2: the origin and orientation (Map Annotation's walkways depend
on them), the `BUILDING_EYA → FLOOR_n` collections, each floor's slab named
`FLOOR_n`, and `EXTERIOR` / `ROOF`. EYA2 parents every object to an empty
`GROUND FLOOR`; the export keeps the collection tree, so that's harmless.

The A Building (`A.glb`): keep its origin, the `A BUILDING → FLOOR_1..4`
collections, the slabs (`GROUND FLOOR_1`, `2`, `FLOORS_3`, `FLOORS_4`) and
`ROOF`, and room signs reading `A-###`. Signs may stay at the top of the scene
(the export groups them). A model that moves its origin needs the placement
updated (section 2) and `seed_a_routes` run again.

## 7. Old model files

`eya-floor-1.glb` and `a-building.glb` are no longer used. If they are still
in your models folder, delete them. They stay ignored by git either way.

## 7b. A new building

A building the kiosk doesn't know yet needs no code: add it in Map
Annotation (**Add building**: name, code, floors), upload its `.glb` in Asset
Management linked to it, make it live, then place and annotate it in Map
Annotation (see [Map Annotation](map-annotation.md#adding-a-building)). The
model needs:

- one group per floor named `FLOOR_1`, `FLOOR_2`, … (the export script keeps
  collections as groups), matching the building's floors;
- the roof and outer shell in objects named `EXTERIOR` or `ROOF` (lifted
  away when the visitor opens the building);
- Y-up metres (the export script's default), Draco compression.

Signs with room numbers help the team generate routes with
`build_navigation.py` (a new profile per building); otherwise draw them in
Map Annotation.

## 8. Replacing a model through Asset Management

For a finished or corrected export of a building that the kiosk already
knows (EYA and the A Building):

1. Export the `.glb` as in section 2: Draco-compressed, one group per floor
   named `FLOOR_1`, `FLOOR_2`, …, the exterior in objects named `EXTERIOR` or
   `ROOF`, and **the same origin and orientation** as the current model.
   Walkways drawn in Map Annotation are stored in the model's coordinates, so
   a moved origin misplaces them.
2. In **Asset Management**, choose **Upload model** (a new asset, linked to
   its building) or, on the building's existing asset, **Upload a new
   version**.
3. FlowSense reads the file and runs 16 checks in five groups (file, geometry,
   floor structure, the building's configured floors, kiosk compatibility).
   **Errors** block activation, for example a configured floor missing from
   the model. **Warnings** don't, for example no Draco compression.
4. Check the **Model** tab: the 3D view, and the floors found with their
   walking heights (the top of each floor's slab).
5. Choose **Make live**. The building's floors take their GLB node names and
   heights from the model, and every kiosk shows the new model from its next
   load. **Restore** on an earlier version in the Asset tab goes back.
6. **Take offline** (under Actions, on a live model) undoes going live: the
   kiosk, attract screen and phones go back to the model bundled with the app
   from their next load. The versions stay, and **Make live** brings one back.
   It's in the activity log (`POST /assets/{id}/deactivate`, an addition to
   the API design).

The models that come with the app (EYA, the campus and A) are registered
by `python manage.py seed_assets` (see the team setup guide, 6.3). It is safe
to re-run after pulling a newer committed model, it never replaces a
version an admin made live, and a model an admin took offline stays offline.

To register any other file from the command line:

```bash
# Docker (the backend container sees the models folder as /models)
docker compose exec backend python manage.py import_asset /models/EYA.glb --area EYA --name "EYA Building model" --activate
# Without Docker, from backend/django
python manage.py import_asset ../../frontend/client/public/models/EYA.glb --area EYA --name "EYA Building model" --activate
```

It uses the same checks and refuses to activate a version that failed them.
Uploaded files are stored under `backend/django/media/assets/` (ignored by
git); back that folder up with the database.

The building's kiosk configuration in `client/src/data/` (floor labels,
starting point, camera) stays in code. A new model that renames floors or
moves the kiosk needs that file updated too.
