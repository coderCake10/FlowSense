# Step 8a test report

| | |
|---|---|
| Change record | [step-08a-kiosk-live-search.md](../changes/step-08a-kiosk-live-search.md) |
| Result | **All gates pass.** Backend 105/105 (9 new). Frontend unit tests 71/71 (6 new). The new live browser suite passes 10/10 against the real backend. All earlier kiosk suites pass. |

## Gates

| Gate | Result |
|---|---|
| `manage.py test --noinput` | **105 passed** |
| `makemigrations --check` | No changes (no schema change) |
| `npm run check`, `npm test` | No errors, **71/71** |
| ESLint and Prettier on changed files | Clean |
| **`npm run qa:step8a`** (real backend, live mode) | **10/10** |
| `qa:step1`, `qa:step2` (demo mode) | 36/36, 22/22 |
| `qa:step7a`, `qa:step7b`, `qa:models` | 7/7, 10/10, 3/3 |
| OpenAPI file | Parses (YAML) |

## `qa:step8a`

The backend ran on :8000 with `seed_campus` and `seed_eya_routes` loaded;
Vite ran on :3002 with `VITE_API_BASE_URL=/api/v1`.

| ID | Check |
|---|---|
| L1 | The attract screen is still up after 20 s without a tap. |
| L2 | The kiosk lists 92 destinations "by floor". |
| L3 | An upper-floor room (EA-305) is in the list. |
| L4 | Searching "computer studies" finds EA-110 and EA-111 first. |
| L5 | Exactly one Search API request is sent, after typing stops. |
| L6 | Choosing EA-110 sends `POST /navigation/routes`, answered 201. |
| L7 | The route preview shows on the first floor. |
| L8 | Choosing EA-305 opens the third floor. |
| L9 | EA-305 says "isn't on the map yet" and draws no route. |
| L10 | No uncaught page errors |

The first run failed L6: the route reply arrived before the test started
listening. The test now listens before it clicks, and L7 had already
confirmed the route was there.

Screenshot `step8a-live-route.png`: the route the Navigation API returned for
EA-110 matches the original hand-placed route on the model. Checked in the
database afterwards: the searches were stored as search events, and each
route as a navigation request.

## Backend tests (`navigation/tests.py`)

- Coordinates round-trip between the model and the stored form.
- `seed_eya_routes` can be re-run: still 9 nodes, 8 edges and one kiosk node.
- Floors report `FLOOR_1`, `FLOOR_2`, … from the Map API.
- `GET /map/rooms`: EA-110 carries its node; EA-305 has `node_id: null`.
- `GET /search`: the result for EA-110 carries its node, and one search event
  is logged.
- Heartbeat `map_node_id`:
  - with no node assigned, it's the only kiosk node,
  - an assigned node wins,
  - with two kiosk nodes and none assigned, it's null.
- A kiosk route to EA-110 starts at the kiosk position and ends at the door.
  It's 46 m (the hand-placed route's length), and one navigation request is
  recorded.

## Frontend unit tests

- `mapView.test.ts`:
  - hand-placed points form one leg,
  - a room without a route has no legs and opens its own floor,
  - only the leg on the floor shown is drawn,
  - a route that climbs a floor splits into two joined legs.
- `handoff.test.ts`: live rooms carry their labels to the phone, and
  malformed labels are rejected.
