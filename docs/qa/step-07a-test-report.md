# Step 7a test report

| | |
|---|---|
| Change record | [step-07a-eya-model.md](../changes/step-07a-eya-model.md) |
| Result | **All gates pass.** New suite 7/7. Every earlier kiosk suite passes on the new model. |

## Gates

| Gate | Result |
|---|---|
| `npm run check` (TypeScript) | No errors |
| `npx eslint client scripts e2e` | 0 errors; the changed and new files lint clean (the warnings are all in untouched files) |
| `npm test` | 52/52 |
| `npm run build` | Succeeds. `dist/public/draco` and `dist/public/models/EYA.glb` are included. |
| `npm run models:check` | `OK EYA.glb (16.5 MB)`; decoder present |
| **`npm run qa:step7a`** | **7/7** |
| `qa:step1` (kiosk, auth, sign-out) | 36/36 |
| `qa:step2` (QR handoff, mobile) | 22/22 |
| `qa:models` (missing model) | 3/3 |

## `qa:step7a`

| ID | Check |
|---|---|
| M1 | The kiosk downloads `/models/EYA.glb` (HTTP 200). |
| M2 | The model decodes and the map renders ("You are here" label shown). |
| M3 | `draco_decoder.wasm` and `draco_wasm_wrapper.js` are requested from the app's own origin. |
| M4 | No request goes to another server except the web fonts (QA-69). In particular, nothing goes to a CDN for the model or the decoder. |
| M5 | No "map isn't available" message |
| M6 | An existing route (EA-110) still previews on the new model. |
| M7 | No uncaught page errors |

The first M4 run failed on `fonts.googleapis.com`. The app has loaded its
web fonts from Google since before this step. The check was narrowed to the
map's own assets, and the fonts were logged as QA-69.

## Model checks (outside the suites)

| Check | Result |
|---|---|
| Export script reproducibility | Re-running `export_kiosk_model.py` gives a byte-identical file (same MD5) to the file reviewed with the team. |
| Hierarchy survives compression | Uncompressed vs compressed: 899/899 nodes, 809/809 meshes, 78/78 materials, 170/170 doors, `FLOOR_1`–`FLOOR_6` present. |
| Coordinates vs the old `eya-floor-1.glb` | World bounding boxes of `DOOR_.001`, `DOOR_.009`, `DOOR_.007` and `BASE FLOOR` are identical to 0.01 m, so the hand-placed routes needed no change. |
| Visual comparison | Rendered with three.js in Chromium: the whole building, the first floor, and a close-up. Mean pixel difference against the uncompressed export is 1.34, 0.31 and 0.22 /255 at 2048 px. At 1024 px, close-up floor tiles blur visibly, so 1024 was rejected. |
| Screenshot | `e2e/output/step7a-kiosk-eya.png`: first floor only, with the route to EA-110 |

## Environment

- Blender 5.2.2 LTS (headless) exported the model. It was used only in the
  development environment; it isn't a runtime dependency.
- The browser tests ran in Chromium (Playwright) with SwiftShader WebGL
  against Vite dev servers on :3000, :3002 and :3004.
