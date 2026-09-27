# Step 14 test report

| | |
|---|---|
| Change record | [step-14-campus-editing.md](../changes/step-14-campus-editing.md) |
| Result | **All gates pass.** A building added in Map Annotation reaches the kiosk (rooms, model, entrance, campus view) with no code change. Backend 167/167. Frontend unit tests 110/110. |

## Gates

| Gate | Result |
|---|---|
| `manage.py test --noinput` | **167 passed** |
| `makemigrations --check` | No changes (0004 added) |
| `npm run check`, `npm test` | No errors, 110/110 |
| `npm run lint`, `npm run build` | 0 errors (34 warnings, unchanged); builds |

## Backend tests (new)

| Test | Checks |
|---|---|
| `test_seed_places_a_and_names_floors_and_labels` | A's placement, floor names, labels seeded |
| `test_moving_a_building_moves_its_points_and_keeps_routes` | PATCH placement moves A's entrance to the same spot on its model; still routed from the EYA kiosk; a bad placement is a 400 |
| `test_labels_are_edited_by_admins_and_read_by_anyone` | Create, rename; public read; 401 to write without signing in |
| `test_add_a_building_with_floors_and_rooms` | Area and FLOOR_1..3 with names; duplicate code 400; rename and add floors; add a room (default name), duplicate 400; a floor with rooms can't be removed (409), then can |
| `test_the_walkways_scene_shows_the_points_walks_can_join` | Walkway points, the EYA front doors, the kiosk and A's entrance |

## Frontend unit tests (new)

`buildingRegistry.test.ts`: bundled only without the API; placements and
floor names from the API; a building added from the admin panel built from
its area, floors and live model (none without a model); the campus view's
neighbours and labels.

## Browser suites

| Suite | Result |
|---|---|
| `qa:step14` (new): Campus view (labels add, rename, delete; a walkway point on the ground; moving the A Building and putting it back, points following); a new building through Asset Management to the kiosk (its room, entrance marker, campus label) | 18/18 |
| `qa:step13` (now also: tapping the A model opens it; searching in EYA finds A rooms and routes to them) | 25/25 |
| `qa:step8a`, `qa:step8b`, `qa:step8d`, `qa:step8e`, `qa:audit1`, `qa:step7b` | 14/14, 15/15, 10/10, 7/7, 6/6, 13/13 |

Found while testing: clicks in the Campus view first landed on a hidden
plane (R3F lists only objects with handlers), then on roofs; they now land
on the ground or the overpass deck (QA-135). `qa:step8a` failed once on a
missing EA-305 door left by an interrupted `qa:step8b` run; `seed_eya_routes`
restored it, and `qa:step8b` restores it on a normal run.
