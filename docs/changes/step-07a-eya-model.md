# Step 7a: The complete EYA model in the kiosk

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Source | `CAPSTONE EYA.blend` from the team's Drive (EYA BUILDING / NEW, 2026-09-25) |
| Decisions (team, 2026-09-25) | Blender may be used on the `.blend` files. Textures at 2048 px + Draco compression. The decoder is served by the app. The compressed model is committed to git; if the history grows too heavy, the team starts a fresh repository from the latest version. Remove the human figure. Don't lower the detail. |
| Scope | Frontend models, kiosk map, tooling, docs; untracks Celery beat state |
| Guide | [Building models](../setup/building-models.md) |
| Test report | [step-07a-test-report.md](../qa/step-07a-test-report.md) |

## What changed

| Area | Change |
|---|---|
| Model | **New** `client/public/models/EYA.glb` (16.5 MB) is the whole building: exterior, roof, floors 1–6 and the signs. Exported from the team's 115 MB `.blend`; the team's own `.glb` export was 139 MB. Committed to git, and whitelisted in `frontend/.gitignore`. |
| Export script | **New** `scripts/blender/export_kiosk_model.py`, run with `blender -b`. It exports all collections with the collection tree kept as nodes, drops named objects, scales textures to 2048 px JPEG, and applies Draco. It never saves the `.blend`. Re-running it reproduces the committed file byte for byte. |
| Draco decoder | **New** `client/public/draco/`: the glTF decoder (`draco_wasm_wrapper.js`, `draco_decoder.wasm`, 245 KB) copied unchanged from `three` 0.185.1. `DRACO_DECODER_PATH` in `models.ts` points drei's `useGLTF` at it instead of Google's CDN. Excluded from ESLint and Prettier. |
| Kiosk | The EYA first-floor view uses `EYA.glb`. **New** optional `hiddenObjects` on a building view hides objects by their Blender name. The first-floor view hides `EXTERIOR`, `ROOF`, `FLOOR_2`–`FLOOR_6` and `SIGNS 1-6`. The route coordinates didn't change, because the new model's first floor sits at exactly the old coordinates (the three route doors' bounding boxes match to 1 cm). |
| "You are here" person | The figure the kiosk used to move to the start point (`kioskObject`) is the stray human figure, and it is dropped from the export. The kiosk keeps its "You are here" ring and label. `kioskObject` stays available for a future kiosk model. |
| A Building | `aBuildingNavigation.ts` removed and the view unregistered. The team's A Building folder is empty; it returns with its model. |
| Model registry | `MODEL_FILES` is now `{ eya: "EYA.glb" }`. `eya-floor-1.glb` and `a-building.glb` are no longer used. |
| Check tool | `npm run models:check` also reports a missing Draco decoder. |
| QA | **New** `npm run qa:step7a`. `qa:models` expects `EYA.glb`. |
| Docker | Comment only: models are committed; `FLOWSENSE_MODELS_DIR` still overrides the folder. |
| Git hygiene | `backend/django/celerybeat-schedule*` untracked and ignored. That's Celery beat's runtime state, rewritten on every run; it was committed on `main` in `7153f9c`. |

## Size and quality

| Export | Size | Result |
|---|---|---|
| Team `.glb` | 139 MB | 3K PNG textures (77 MB), 1.19M triangles |
| 1024 px JPEG | 64 MB | Textures 2.3 MB; the rest is geometry |
| 1024 px + Draco | 11 MB | Close-up floor tiles visibly blurred |
| **2048 px + Draco (chosen)** | **16.5 MB** | No visible change at kiosk distance (mean pixel difference ≤ 1.34/255). Close-up tiles are slightly softer. |

Draco changes storage only: 899 nodes, 809 meshes, 78 materials and 170
doors, the same as the uncompressed export. Every object stays separate,
named and interactive.

## Findings for the modeling team

These are logged in the [building models guide](../setup/building-models.md#6-notes-for-the-modeling-team).

- A stray human figure (dropped by the export).
- 755 of 812 objects have `.00N` names.
- 397 objects have unapplied transforms.
- The signs are grouped outside their floors (QA-70).
- Some images are linked from Downloads or temp folders.

## Not in this step

- Floor switching, the fixed isometric view and the front lifting away on
  tap (Software Plan, QA-26) come next, now that the complete model is in.
- The web fonts still load from Google Fonts (QA-69).
