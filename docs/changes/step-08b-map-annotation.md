# Step 8b: Map Annotation on the real model

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Reported by the team (2026-09-25) | The Map Annotation page doesn't use the actual model. |
| Scope | Map Annotation page (rewritten), the Annotation API's node connection modes, a GeoJSON input fix (API-wide), and kiosk multi-floor routes |
| Guide | [Annotating a floor](../setup/map-annotation.md) |
| Test report | [step-08b-test-report.md](../qa/step-08b-test-report.md) |

## What changed

| Area | Change |
|---|---|
| Map Annotation page | Rewritten (the old page was a mock with made-up boxes and devices). It shows the real EYA model, one floor at a time, with the floors above lifted away as on the kiosk. Top-down and isometric views, the building's floors, and the saved graph from `GET /annotations?area_id=`. Tools: corridor point (chained in order), room door (pick a room, click its door), kiosk, connect, stairs/elevator link across floors, delete. The side panels list the floor's rooms (placed or not), the selected point's connections and floor links, and building totals. Every edit saves straight away through the Annotation API. |
| Clicking | A click picks the nearest point on screen (within a few pixels), or else lands on the chosen floor's walking-surface plane. It no longer uses the model's geometry, where room boxes, ceilings and the atrium caught clicks or let them through to a lower floor. Points keep a fixed on-screen size. The workspace has a fixed height, so the map never resizes and re-frames while someone is working. |
| API: node connection modes | `POST /annotations/nodes` accepts `connection_mode` (`no_connection` / `place_order` / `nearest_node`) and `previous_node_id`. `annotation.services.connect_auxiliary_node` already implemented these; the serializer and view didn't pass them on (a gap the service's own docstring noted). The OpenAPI file documents them. |
| **Fix: GeoJSON input** | `common.serializers.fields.GeoJSONField` meant to use the column's SRID when none is given, but GEOS reads GeoJSON as EPSG:4326, so PostGIS reprojected every input as longitude/latitude. A point at x = −5.6 m was stored at −623 000. Input is now in the column's SRID (3857) unless the payload names a CRS, as the OpenAPI contract says. This affected every GeoJSON input (nodes, edges, rooms, areas). It hadn't been noticed because nothing in the frontend sent geometry until now (QA-78). |
| Kiosk: multi-floor routes | The map opens where the route starts (the kiosk's floor), not the room's floor. Each floor draws only its own leg; the stair climb isn't drawn through the floors. A leg that continues on another floor ends with "Go to 3F". The route line reads, for example, "From Kiosk: First floor → Third floor". A room that's placed but not yet connected says "No walkway on the map reaches this room yet" (HTTP 422 from the Navigation API). |

## Files

| File | Role |
|---|---|
| `frontend/client/src/pages/workspaces/MapAnnotation.tsx` | Rewritten page |
| `frontend/client/src/components/map/AnnotationCanvas.tsx` (**new**) | The 3D workspace: model, points, connections, click picking |
| `frontend/client/src/lib/annotationApi.ts` (**new**) | Areas, floors, rooms, graph (model coordinates), and the edits |
| `frontend/client/src/components/map/BuildingScene.tsx` | `CameraRig` takes an optional viewing direction (top-down) |
| `frontend/client/src/components/BuildingFloorMap.tsx`, `lib/mapView.ts`, `pages/experience/KioskPage.tsx` | Multi-floor route display |
| `backend/django/common/serializers/fields.py` | GeoJSON SRID fix |
| `backend/django/apps/annotation/serializers/nodes.py`, `views/nodes.py`, `services.py` | Connection modes |
| `backend/django/apps/annotation/tests.py`, `common/tests.py` | 8 new tests |
| `docs/setup/map-annotation.md` (**new**) | How to annotate a floor |

## Checked against the design

- The API design's Annotation endpoints are used as specified: nodes,
  edges, transitions, and the scene.
- The Admin Map Annotation notes' auxiliary-node connection modes are
  wired end to end. "Place order" is the corridor tool's chaining.
- The notes also say room nodes should snap to door objects in the model.
  That isn't done: doors are placed by clicking. The model's door objects
  are still named `DOOR_.00N`, not by room, so automatic snapping can't
  tell which door belongs to which room until the team renames them
  (QA-71). Logged as QA-79.
- The contract names the node input fields `floor_id`/`room_id`; the
  implemented API uses `floor`/`room`. The page follows the implementation.
  Logged as QA-80.
