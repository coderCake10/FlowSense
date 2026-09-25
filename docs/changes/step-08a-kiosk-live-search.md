# Step 8a: Kiosk search and routes from the APIs

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Reported by the team (2026-09-25) | The attract screen opens the kiosk by itself. The kiosk search only knows three rooms. Search analytics can't be checked. |
| Scope | Kiosk and attract screen; two additive API fields; the starter route seed |
| Test report | [step-08a-test-report.md](../qa/step-08a-test-report.md) |

## What changed

| Area | Change |
|---|---|
| Attract screen | No more 15-second jump to the kiosk. It waits for a tap, and the 3D preview loops (QA-75). |
| Kiosk directory | With the API configured, the destination list is every active room in the building (all 92, on all six floors), loaded from the Map API (`/map/areas`, `/map/areas/{id}/floors`, `/map/rooms`). It's ordered by floor, then room code. Without the API, the kiosk keeps its built-in demo list. |
| Kiosk search | Typing searches the Search API (`GET /search?result_type=room&area_id=…`) 0.6 s after the visitor stops typing, and shows the top 20, best match first. Each search is logged as a search event, with the visitor session when there is one (`X-Kiosk-Session-Id`), so the Analytics search section fills from real use. |
| Routes | Choosing a room asks the Navigation API (`POST /navigation/routes`) for the route from the kiosk's node to the room's node; each route is logged as a navigation request. The route is split into legs by floor, and the map opens the floor where it starts. A room not yet placed on the map opens its own floor and says "This room isn't on the map yet". |
| Queue and QR | Queued live rooms travel in the QR link as (code, name, floor), so the phone checklist can show them (payload field `r`). The hand-placed demo destinations are unchanged. |
| API: rooms | `node_id` on rooms in `GET /map/rooms` and in `GET /search` room results: the room's navigation node, or null (`map.services.with_room_node`). |
| API: kiosk heartbeat | `map_node_id` in the heartbeat reply: the node assigned on the Hardware page, or else the only kiosk node on its floor (or on the map); null when none or ambiguous (`hardware.services.kiosk_origin_node_id`). |
| Floors | `seed_campus` now sets each EYA floor's model group (`glb_node_name` `FLOOR_1` … `FLOOR_6`) and its walking-surface height (`elevation`). |
| Starter routes | **New** `python manage.py seed_eya_routes`: loads the first floor's original hand-placed routes as a real graph: the kiosk, 5 corridor junctions, the doors of EA-101A, EA-110 and EA-111, and 8 connections. It can be re-run; the seeded rows are tagged `{"seed": "eya-demo"}`, and nodes added in Map Annotation are never touched. |
| Coordinates | Model positions (glTF x, y, z; y up) are stored as PointZ(3857) (x, −z, y). Backend: `navigation/coordinates.py`. Frontend: `lib/mapCoordinates.ts`. |

## Files

| File | Role |
|---|---|
| `frontend/client/src/lib/kioskDirectory.ts` (**new**) | Directory, search and route calls, and API rooms as destinations |
| `frontend/client/src/lib/mapCoordinates.ts` (**new**) | Stored ↔ model coordinates |
| `frontend/client/src/lib/mapView.ts` | Route legs by floor: `destinationLegs`, `routeLegInView`, `firstFloorFor`, `splitByFloor` (4 new tests) |
| `frontend/client/src/pages/experience/KioskPage.tsx` | Live list, debounced search, route status line |
| `frontend/client/src/lib/handoff.ts` | Room labels in the QR payload (2 new tests) |
| `frontend/client/src/lib/kioskDevice.ts` | `visitorSessionId()`; `map_node_id` on the heartbeat type |
| `frontend/client/src/pages/experience/AttractionPage.tsx` | Removed the timed jump |
| `backend/django/apps/navigation/management/commands/seed_eya_routes.py`, `navigation/coordinates.py` (**new**) | Starter graph and the coordinate mapping |
| `backend/django/apps/map/services.py`, `map/serializers/rooms.py`, `map/views/rooms.py`, `search/services.py` | `node_id` |
| `backend/django/apps/hardware/services.py`, `hardware/views/kiosk_heartbeat.py` | `map_node_id` |
| `backend/django/apps/navigation/tests.py` | 9 new tests |
| `docs/openapi/flowsense-openapi.yaml` | The two fields |

## Setting it up on the team's machine

```bash
docker compose exec backend python manage.py seed_campus
docker compose exec backend python manage.py seed_eya_routes
```

## Not in this step

- Placing rooms, corridors and stairs for the other floors: that's Map
  Annotation on the real model (step 8b).
- The QR handoff through the QR Session API (QA-66).
