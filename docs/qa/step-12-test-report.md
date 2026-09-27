# Step 12 test report

| | |
|---|---|
| Change record | [step-12-generated-routes.md](../changes/step-12-generated-routes.md) |
| Result | **All gates pass.** Every one of the 97 rooms routes from the kiosk. Backend 149/149. Frontend unit tests 93/93. Changed suites pass three consecutive runs. |

## Gates

| Gate | Result |
|---|---|
| `manage.py check`, `makemigrations --check --dry-run` | No issues, no migrations |
| `manage.py test --noinput` | **149 passed** |
| `npm run check`, `npm test` | No errors, 93/93 |
| `npm run lint` | 0 errors, 34 warnings (one fewer; none in touched files) |
| `npm run build` | Succeeds |

## The network

| Check | Result |
|---|---|
| Generator output | 271 points, 283 connections, 15 floor links, 97 rooms, no problems reported |
| Every room from the kiosk (A* in the Navigation API's graph) | 97/97 routed; upper-floor rooms leave the first floor only by stairs or the lift |
| First-floor routes against the straight line | At most 1.46× (EA-113, around the turnstiles); EA-110 49.6 m (1.22×, around the front stair core) |
| `seed_eya_routes` twice | Identical second run; starter points retired (8), starter kiosk kept |
| Kiosk, live (screenshots) | EA-110 along the corridor to its door; EA-305 "Go to 3F", "First floor → Third floor", the 3F leg ends at EA-305; EA-517 and EA-216 (new rooms) routed |

## Backend tests (new or changed)

| Test | Checks |
|---|---|
| `test_seed_is_repeatable` | Counts match the file; 15 floor links; one kiosk; nothing soft-deleted on a re-run |
| `test_every_room_has_a_route_from_the_kiosk` | All 97 rooms; floors change only for upper-floor rooms |
| `test_replaces_the_starter_routes_and_keeps_their_kiosk` | Starter kiosk adopted; a starter junction and its connection retired |
| `test_keeps_doors_placed_in_map_annotation` | A placed door wins, and is listed |
| `test_a_renumbered_room_is_reported_not_fatal` | The door loads unlinked; the room is listed |
| `test_a_route_to_an_upper_floor_changes_floor_once` | EA-517: first floor, up, fifth floor |
| `test_kiosk_gets_a_route_to_a_searched_room` | From the kiosk to EA-110's door, along the corridor |
| `mapView`: skips floors a route only passes through | 1F → 3F with a 2F lift stop gives two legs |

## Browser suites

| Suite | Result |
|---|---|
| `qa:step8a` (live kiosk: 97 rooms, EA-110, EA-305 across floors) | 12/12, three consecutive runs |
| `qa:step8b` (Map Annotation: places and deletes points, restores EA-305's door) | 10/10, three consecutive runs, plus one with a stray EA-305 door planted (cleared) |
| `qa:step8d`, `qa:step8e`, `qa:audit1`, `qa:step10` | 8/8, 7/7, 6/6, 19/19 |
| `qa:step7a`, `qa:step7b` (offline demo) | 7/7, 13/13 |

Found while testing: an interrupted `qa:step8b` run could leave its test door
behind, and the next run then took it for the generated one (QA-107, fixed).
