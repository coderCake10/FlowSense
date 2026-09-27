# Step 12b test report

| | |
|---|---|
| Change record | [step-12b-route-fixes.md](../changes/step-12b-route-fixes.md) |
| Result | **All gates pass.** Backend 150/150. Frontend unit tests 94/94. Changed suites pass three consecutive runs. |

## Gates

| Gate | Result |
|---|---|
| `manage.py check`, `makemigrations --check --dry-run` | No issues, no migrations |
| `manage.py test --noinput` | **150 passed** |
| `npm run check`, `npm test` | No errors, 94/94 |
| `npm run lint` | 0 errors, 34 warnings (unchanged; none in touched files) |
| `npm run build` | Succeeds |
| OpenAPI file | Parses (YAML) |

## Routes

| Check | Result |
|---|---|
| Every room from the kiosk | 97/97 |
| First floor against the grid walking distance | At most 1.07× (EA-101B) |
| Through the elevator | None: its footprint is blocked; routes pass through the turnstile lanes |
| Kiosk screenshots | EA-104, EA-110: straight along the corridor. EA-113: short hop. EA-305: to the elevator's door side, then 3F from the elevator to the door. |
| Phone directions (EA-608, EA-216) | "Go up to the sixth floor · Take the elevator" |

## Backend tests (new or changed)

| Test | Checks |
|---|---|
| `test_a_route_to_an_upper_floor_changes_floor_once` | EA-517: one ride, 1F to 5F, in `floor_changes`; the saved route (the phone's) has it too. Fails without the cache fix. |
| `test_moving_a_point_redraws_its_connections` | Admin only; the point moves; its connection is redrawn (5 m after a 3-4-5 move); audit entry; a non-point is refused |

## Unit tests (new)

| Test | Checks |
|---|---|
| `mapView`: walks a multi-floor route one floor at a time | Step 1 of 2 "Walk to the elevator, then go up to the third floor", Next; step 2 "Walk to EA-305", Back; none for one-floor routes or other floors; "Elevator to 3F" |

## Browser suites

| Suite | Result |
|---|---|
| `qa:step8a` (EA-305: step bar, "Elevator to 3F", Next opens 3F, Back) | 12/12, three consecutive runs |
| `qa:step8b` (new A11: drag EA-306's door, it saves and its connection follows, then put back; new A6b and A6c: remove one connection from the panel, and one by clicking its line with Delete) | 13/13, three consecutive runs; the generated network intact afterwards |
| `qa:step8d`, `qa:step8e`, `qa:audit1`, `qa:step10` | 8/8, 7/7, 6/6, 19/19 |
| `qa:step7a`, `qa:step7b` (offline demo) | 7/7, 13/13 |
