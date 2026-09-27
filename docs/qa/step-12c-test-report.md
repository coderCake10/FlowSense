# Step 12c test report

| | |
|---|---|
| Change record | [step-12c-kiosk-follow-and-service.md](../changes/step-12c-kiosk-follow-and-service.md) |
| Result | **All gates pass.** Backend 152/152. Frontend unit tests 97/97. Changed suites pass three consecutive runs. |

## Gates

| Gate | Result |
|---|---|
| `manage.py check`, `makemigrations --check --dry-run` | No issues, no migrations |
| `manage.py test --noinput` | **152 passed** |
| `npm run check`, `npm test` | No errors, 97/97 |
| `npm run lint` | 0 errors, 34 warnings (unchanged) |
| `npm run build` | Succeeds |
| OpenAPI file | Parses (YAML) |

## New checks

| Test | Checks |
|---|---|
| `test_an_elevator_out_of_service_sends_the_route_up_the_stairs` | Elevator off: the 5F route rides the stairs and says "The elevator is out of service."; a first-floor route has no notice; re-running `seed_eya_routes` keeps it off; back on, no notice |
| `serviceGroups` (unit) | Floor links grouped per staircase or elevator by name; out of service when any link is off |
| `legSeconds` (unit) | 5 to 12 s per floor |
| `resolveHandoff` (unit) | The QR session reaches the phone; offline links still work; a malformed session is refused |
| `qa:step8a` L11, L12 | Follow on this kiosk plays 1F, 3F, 1F; Pause holds the floor |
| `qa:step8b` A12, A13 | Switching the elevator off: the kiosk route to EA-307 says "Walk to the stairs" and "The elevator is out of service"; switching it on restores it |
| `qa:step8d` H2b, H5b | The QR carries a QR Sessions API session; after the phone opens it, the kiosk says "Opened on your phone" |
| `test_a_deleted_kiosk_can_be_found_and_registered_again` | Deleted: hidden from the registry, listed with `?status=decommissioned`; Register restores it; its heartbeat then counts (online, records sessions) |
| `qa:step5b` K5, K6 | A deleted kiosk's attract screen says so; Deleted filter, Restore, and it's back and online |
| Analytics (API) | After one QR and one scan: generated 1, scanned 1, scan rate 100%, 2.3 s to scan |

## Browser suites

| Suite | Result |
|---|---|
| `qa:step8a` | 14/14, three consecutive runs. One earlier run failed L9 because it read the map's "Elevator to 3F" label before the 3D scene drew it; the check now waits for the label. |
| `qa:step8b` | 15/15, three consecutive runs |
| `qa:step8d` | 10/10, three consecutive runs |
| `qa:step5b` (Hardware, Users, Settings, kiosk; with a local Mosquitto broker) | 25/25, three consecutive runs. Earlier runs found two problems: D2 still expected 92 rooms (QA-120), and K2 failed when the new kiosk landed past the registry's first 100 devices (QA-119, fixed). |
| `qa:audit1` | 6/6 in nine of ten runs. One run failed A2 (the Help guide's link didn't reach Map Annotation within 30 s); six further runs with extra logging all passed, so the cause wasn't found. |
| `qa:step8e`, `qa:step10` | 7/7, 19/19 |
| `qa:step1`, `qa:step2`, `qa:step7a`, `qa:step7b` (offline demo; step2 is the offline QR) | 36/36, 22/22, 7/7, 13/13 |

## Not testable here

The iPad connection is the team laptop's network (Windows Firewall, Wi-Fi,
Docker Desktop); the guide's checks (11.2a) are for that machine.
