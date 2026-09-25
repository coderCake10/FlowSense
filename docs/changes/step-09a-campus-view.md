# Step 9a: Campus view with the A Building and the overpass

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Requested by the team (2026-09-25) | Both buildings are in scope. Show the low-fidelity area (only a few buildings around EYA and the A Building) with both buildings and the overpass across MacArthur Highway. |
| Scope | Two new models, a campus view on the kiosk map, build and export scripts |
| Guide | [Building models](../setup/building-models.md#2b-the-campus-model) |
| Test report | [step-09a-test-report.md](../qa/step-09a-test-report.md) |

## What changed

| Area | Change |
|---|---|
| Campus model (`CAMPUS.glb`) | Built from the team's `LFA_AUF.obj` by `scripts/blender/build_campus_model.py`. It keeps a tile of about 270 × 275 m around the two buildings: 171 nearby buildings, 102 trees, and the ground cut at the tile's edges. It leaves out the two blocks that stand in for EYA and the A Building. It keeps the Professional School as a labelled neighbour, adds a simple overpass across the highway at Diego Silang St, and uses flat colours (blue-grey buildings, green trees). It is stored in EYA's model coordinates, so nothing already on the map moves. |
| A Building (`A.glb`, 0.7 MB) | Exported from `A BUILDING.blend` with the kiosk export script, keeping only the `A BUILDING` collection. The script gained `--drop-collection`. **Preliminary:** the source model is still being built. |
| Placement | Both models were fitted onto their blocks in the area file. A top-down plan confirmed that both footprints sit on their blocks. The A Building's front entrances face MacArthur Highway, and so does EYA's curved lobby (checked against the team's satellite view). **Correction (QA-88):** EYA was first placed on the Professional School's block. The team's second satellite view showed EYA further south, between D Fajardo St and P Peralta St, with the overpass at Diego Silang St between the Professional School and the medical center. |
| Kiosk map | A **Campus** button above "Whole building" shows the campus: EYA in full detail with "You are here", the A Building, the neighbourhood, and labels for both buildings, the Professional School and the overpass. Tapping goes to the EYA Building. The camera frames both buildings and the overpass. Routes are still drawn per floor, so none appear in the campus view. The kiosk still opens on the whole-building view. |
| Loading | The campus loads on its own. A missing campus file never takes the building map down. |

## Not yet

- **A Building rooms, floors on the kiosk, search, and Map Annotation.** These need its room list (step 9b).
- **Routes between the buildings** over the overpass (step 9c).
- **Overpass details.** Its length, deck height and landings are estimates. Walking from EYA to the A Building means going north along the highway to the overpass, so the route in step 9c needs the sidewalk and the overpass's stair or ramp positions.

## Files

| File | Role |
|---|---|
| `frontend/scripts/blender/build_campus_model.py` (**new**) | Builds `CAMPUS.glb` |
| `frontend/scripts/blender/export_kiosk_model.py` | `--drop-collection` |
| `frontend/client/public/models/A.glb`, `CAMPUS.glb` (**new**), `frontend/.gitignore` | Models, whitelisted |
| `frontend/client/src/data/models.ts`, `navigation.ts`, `eyaNavigation.ts` | Model list, `CampusConfig`, the EYA campus settings |
| `frontend/client/src/lib/mapView.ts`, `mapView.test.ts` | `CAMPUS_VIEW` (3 new tests) |
| `frontend/client/src/components/map/CampusScene.tsx` (**new**) | The campus layer |
| `frontend/client/src/components/map/BuildingScene.tsx` | Campus framing and zoom range |
| `frontend/client/src/components/BuildingFloorMap.tsx` | Campus button, tap, hint |
| `frontend/e2e/step7b.qa.mjs` | Checks B7b and B7c |
| `docs/setup/building-models.md` | Campus model, placement, A Building export |
