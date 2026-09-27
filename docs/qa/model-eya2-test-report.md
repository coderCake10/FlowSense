# Model update EYA2: test report

| | |
|---|---|
| Change record | [model-eya2.md](../changes/model-eya2.md) |
| Result | **All checks pass.** Validation 16/16. Every map suite passes, both with EYA2 live from the Assets API and with it as the committed model. |

## Checks

| Check | Result |
|---|---|
| Assets API validation (v4 of the EYA model) | 16 passed, 0 warnings, 0 errors |
| Floor changes on activation | None: heights and GLB nodes match |
| Structure (FlowSense's GLB inspector) | FLOOR_1 to FLOOR_6 at 0.927, 4.419, 7.996, 11.519, 15.076, 18.533 m; `EXTERIOR`, `ROOF`; the floor groups hold 185, 172, 215, 197, 190 and 188 objects |
| Kiosk screenshots, v3 against v4 | Whole building, 1F and 3F match apart from the closed roof |

## Browser suites with EYA2 live (loaded through the Assets API)

| Suite | Result |
|---|---|
| `qa:step8a` (live kiosk: directory, search, routes) | 11/11 |
| `qa:step8b` (Map Annotation on the model: walkways, doors, room details) | 10/10 |
| `qa:step8d` (phone directions from the kiosk's route) | 8/8 |
| `qa:step8e` (Destination Queue order) | 7/7 |

## Browser suites with EYA2 as the committed model (offline demo, `/models/EYA.glb`)

| Suite | Result |
|---|---|
| `qa:step7a` (the complete model in the kiosk) | 7/7 |
| `qa:step7b` (whole building, floors, routes, signs by floor, campus) | 13/13 |
| `npm run models:check` | OK |
