# Building models

The kiosk's 3D building models are **compressed, kiosk-ready `.glb` files
committed to git** in `FlowSense/frontend/client/public/models/`. A fresh
clone has them; nothing needs copying.

They are exported from the team's `.blend` files, which stay on the shared
drive as the editable source and are **not** stored in git.

| File | Source | Size |
|---|---|---|
| `EYA.glb` | `CAPSTONE EYA.blend` (Drive: EYA BUILDING / NEW, 2026-09-25) | 16.5 MB |

## 1. Which files the app needs

The list lives in one place, `frontend/client/src/data/models.ts`:

```ts
export const MODEL_FILES = {
  eya: "EYA.glb",
} as const;
```

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
blender -b "/path/to/CAPSTONE EYA.blend" --python scripts/blender/export_kiosk_model.py -- \
    --out client/public/models/EYA.glb \
    --drop "GEO-foot.005_male_primitive_realistic.L"
```

| Option | Meaning |
|---|---|
| `--out` | Output file (required) |
| `--max-texture` | Largest texture side in pixels. Default 2048. 1024 blurs close-up floor tiles. |
| `--jpeg-quality` | Default 80 |
| `--drop NAME` | Leave out an object by exact name. Repeat it for several objects. The EYA file still contains a stray human figure, which is dropped here. |
| `--no-draco` | Skip compression. The file will be about 4 times larger. |

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
  OK       EYA.glb (16.5 MB)

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
Open items, agreed on 2026-09-25:

1. Remove the human figure `GEO-foot.005_male_primitive_realistic.L` from the
   scene root. The export drops it meanwhile.
2. Keep the current detail on fences, fire-extinguisher canisters and the
   exterior. Don't simplify them.
3. Rename the `.00N` duplicates to descriptive names, e.g. `Door_EA-101A`
   instead of `DOOR_.001`. 755 of 812 objects have them.
4. Apply transforms before export (Ctrl+A → All Transforms). 397 objects
   still have unapplied scale or rotation.
5. Move the room signs from `SIGNS 1-6` into their floors. Meanwhile the kiosk
   works out each sign's floor from its height (`byHeight` in the building
   configuration).
6. Remove images linked from `Downloads` or temp folders (for example
   `canary_wharf_4k.hdr`).

The A Building model folder is empty, so the A Building view was removed
from the kiosk. It comes back when that model is delivered.

## 7. Old model files

`eya-floor-1.glb` and `a-building.glb` are no longer used. If they are still
in your models folder, delete them. They stay ignored by git either way.
