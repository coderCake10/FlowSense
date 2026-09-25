# Step 7b test report

| | |
|---|---|
| Change record | [step-07b-kiosk-3d-map.md](../changes/step-07b-kiosk-3d-map.md) |
| Result | **All gates pass.** New unit tests 13/13 (65 total). New browser suite 10/10. All earlier kiosk suites pass. |

## Gates

| Gate | Result |
|---|---|
| `npm run check` (TypeScript) | No errors |
| ESLint on new and changed files | 0 errors. The attract page's 19 unused-import warnings predate this step. |
| `npm test` | **65/65** (13 new in `mapView.test.ts`) |
| `npm run build` | Succeeds. The chunk-size warnings predate this step. |
| **`npm run qa:step7b`** | **10/10** |
| `qa:step1` (kiosk, auth, sign-out) | 36/36 |
| `qa:step2` (QR handoff, mobile) | 22/22 |
| `qa:step7a` (model and decoder offline-safe) | 7/7 |
| `qa:models` (missing model) | 3/3 |

## `qa:step7b`

| ID | Check |
|---|---|
| B1 | The kiosk opens on the whole building ("Whole building" pressed). |
| B2 | A tap on the building (not a drag) opens the kiosk's floor (1F pressed). |
| B3 | The 3F button switches to the third floor. |
| B4 | Choosing EA-110 returns to the first floor and shows the route preview. |
| B5 | The route arrows move: two captures of the map 1.5 s apart differ. |
| B6 | Reset view keeps the chosen floor. |
| B7 | The whole-building button returns to the outside view. |
| B8 | The attract screen replaces its placeholder with the model canvas. |
| B9 | Tapping the attract preview still opens the kiosk. |
| B10 | No uncaught page errors |

## Unit tests (`mapView.test.ts`)

- The outside view shows everything. A floor view hides the exterior and the
  floors above the chosen one.
- Signs at 2.8 m and 6.4 m land on the first and second floors. Objects
  sunk slightly into the slab, or below the first floor, are handled.
- View labels, and a destination's floor defaulting to the kiosk floor
- Route length on the floor plane, poses and headings on each leg of an
  L-shaped route, clamping at both ends
- Arrow spacing, the gap left for the arrowhead, and forward movement
  that wraps every spacing

## Visual review

The screenshots are in `e2e/output/`:

- `step7b-building.png`: the whole building.
- `step7b-opened.png`: the first floor after opening.
- `step7b-floor3.png`: the third-floor cutaway.
- `step7b-route.png`: the route with arrows.
- `step7b-attract.png`: the attract preview.

Findings fixed during the review:

| Found | Fix |
|---|---|
| The page never went idle: the whole building redrew every frame | Draw on demand, only while something moves |
| Lifting parts stayed half-faded on a slow renderer: the per-frame easing never finished | Time-based animations (0.9 s) |
| A floor view framed only that floor, so the wider floors below were cut off | Frame the chosen floor together with the floors below it |
| The chevrons were too small to read as arrows (world-sized, about 7 px) | Screen-sized chevrons (about 22 px) with a navy edge |
| The arrowhead sat centred on the destination and poked past the door | The tip now sits on the destination |
| On the attract screen, a slow load used up the outside phase | The phases start once the model shows |

## Limits of this test environment

The browser tests use Chromium with software WebGL (SwiftShader). A frame of
the whole building takes about 2 s there, so these tests prove behaviour and
appearance, not smoothness. Frame rate on the iPad is tracked as QA-74.
