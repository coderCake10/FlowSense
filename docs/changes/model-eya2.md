# Model update: EYA2 (2026-09-26)

| | |
|---|---|
| Source | `CAPSTONE EYA2.blend` (114 MB, the team's Drive, modified 2026-09-26) |
| Export | `scripts/blender/export_kiosk_model.py` with Blender 5.2.2 LTS: textures at most 2048 px JPEG, Draco level 6, the collection tree kept |
| Result | `client/public/models/EYA.glb`: 17.3 MB (was 16.5 MB) |
| Resolves | QA-70 (signs now in their floors) |

## What changed in the model

| | Before (EYA) | EYA2 |
|---|---|---|
| Objects / meshes | 899 / 809 | 1,160 / 1,064 |
| Triangles | 1.19 M | 1.29 M |
| Size (W × H × D) | 28.5 × 23.2 × 71.8 m | 28.5 × 23.5 × 71.8 m |
| Floor heights (slab tops) | 0.93, 4.42, 8.00, 11.52, 15.08, 18.53 m | **Identical** |
| Origin and orientation | | **Unchanged**: Map Annotation's walkways still fit |
| Room signs | One `SIGNS 1-6` group | Each floor holds its own (167 signs, all at their floor's height) |
| Human figure | In the scene (dropped by the export) | Removed |
| Images | Some linked from outside the file | All 34 packed in the `.blend` |
| Roof | Pale deck with three open courtyards | One closed surface. **To confirm with the modeling team.** |

The `.blend` now parents every object to an empty `GROUND FLOOR`. The
export keeps the collection tree (`BUILDING_EYA → FLOOR_n`), so the kiosk's
floor groups are complete.

## Code

`eyaNavigation.ts`: `byHeight: ["SIGNS 1-6"]` removed. The signs are in
their floors, so the kiosk no longer sorts them by height.

## Checks

- **Assets API, as v4 of the EYA model:** 16/16 validation checks passed. Activation changed no floors.
- **Kiosk, side by side with v3:** the whole building, 1F and 3F render the same, apart from the roof; "You are here" is in the same place.
- **Browser suites with EYA2 live:** see the [test report](../qa/model-eya2-test-report.md).
