# Step 13 test report

| | |
|---|---|
| Change record | [step-13-a-building.md](../changes/step-13-a-building.md) |
| Result | **All gates pass.** Every A room with a sign (46) routes from the EYA kiosk over the overpass. Backend 161/161. Frontend unit tests 106/106. Every browser suite passes. |

## Gates

| Gate | Result |
|---|---|
| `manage.py test --noinput` | **161 passed** |
| `npm run check`, `npm test` | No errors, 106/106 |
| `npm run lint` | 0 errors, 34 warnings (unchanged; none in touched files) |
| `npm run build`, `npm run models:check` | Succeed; A.glb 2.0 MB |

## Model and network

| Check | Result |
|---|---|
| EYA network regenerated with the changed script | Byte for byte identical to the committed file |
| A network | 99 points, 94 connections, 9 stair links, 46 rooms; one expected report (4F back stairs) |
| A.glb inspected by the Assets API | 4 floors (FLOOR_1 … FLOOR_4), Draco, validation passed |
| Placement | The front entrance in A's model maps to campus `[-187.85, 3.3, 73.64]`, the same in the backend and the kiosk (tests on both sides) |
| Walk outside | Each line sampled every 0.25 m against the campus model: no building or tree |
| `seed_campus`, `seed_a_routes`, `seed_assets` twice | Second runs identical |

## Backend tests (new or changed)

| Test | Checks |
|---|---|
| `test_seeds_the_a_building_and_the_walkways` | Rooms per floor 10/14/16/8; names from the document; the walkways |
| `BuildingToBuildingTests.test_seed_is_repeatable` | Nothing added or deleted on a re-run |
| `test_places_the_model_in_the_campus` | The placement |
| `test_every_a_room_is_routed_from_the_eya_kiosk_over_the_overpass` | All 46 doors: EYA, then outside (over the overpass), then A, never back |
| `test_route_says_where_each_point_is` | `stops` one per point, EYA to A 3F, one stairs ride; the same from GET |
| `test_stairs_out_of_service_in_a_are_announced` | "The front right stairs are out of service."; the route avoids them |
| `test_take_offline_returns_the_kiosk_to_its_bundled_model` | Deactivate, audit, 409 when not live, the model gone from the Map API, live again |
| `test_a_model_registered_before_its_building_gets_it`, `test_a_model_taken_offline_stays_offline` | `seed_assets` |

## Browser suites

| Suite | Result |
|---|---|
| `qa:step13` (new: A in the kiosk, a route to A-305 step by step, the phone, Map Annotation, Take offline) | 19/19 |
| `qa:step8a`, `qa:step8b`, `qa:step8d`, `qa:step8e` | 14/14, 15/15, 10/10, 7/7 |
| `qa:step10`, `qa:step11`, `qa:step5b`, `qa:audit1` | 19/19, 12/12, 25/25, 6/6 |
| `qa:step7a`, `qa:step7b` (offline demo) | 7/7, 13/13 |

Found while testing: Map Annotation opened the A Building first (areas in
alphabetical order); it now follows the kiosk's order, EYA first.
`qa:step8b` A12 read the elevator's links before its saves finished (QA-127);
`qa:step7b` matched the building list's "A Building" as well as the campus
label; `qa:step5b` expected 97 rooms (now 145). The dashboard counted the
walkways' level as a floor (QA-128).

## Screenshots (reviewed)

The whole A Building with its front entrance; EYA's first floor with the
route to the exit; the campus view with the walk over the overpass; A's
first floor to the stairs; A's third floor to A-305; the phone's directions;
Map Annotation on the A Building's first floor.
