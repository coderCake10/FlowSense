# Step 14: Campus editing in Map Annotation, and adding buildings without code

| | |
|---|---|
| Branch | `claude/admiring-heisenberg-gwhi4u` |
| Asked by the team (2026-09-27) | Admins should edit the campus (the low-fidelity area) in Map Annotation: put building models on it as was done for EYA and A, label buildings and places, and add new buildings, since more buildings are expected after handover to the client. Schema additions approved. |
| Test report | [step-14-test-report.md](../qa/step-14-test-report.md) |
| Resolves | QA-93 (floor names), QA-94 (for buildings added from the admin panel), QA-134, QA-135, QA-136, QA-137 |

## What changed

| Area | Change |
|---|---|
| Schema (additive, `map` 0004) | `campus.areas.placement` (where a building's model stands in the campus: position, rotation), `campus.areas.map_settings` (how the kiosk shows a building added from the admin panel: exterior objects, sign groups, entrance), `campus.floors.display_name` and `short_name`, and a `campus.labels` table (the campus view's names). |
| API (additive) | `PATCH /map/areas/{id}` takes `placement` (the building's navigation points move with it) and `map_settings`; areas and floors return the new fields. `/annotations/labels`, `/annotations/floors`, `/annotations/rooms/new`, `/annotations/rooms/{id}/remove`, `/annotations/buildings`. The walkways' scene (`GET /annotations?area_id=` of the outdoor area) also returns the points walks can join (entrances, kiosk, linked points). |
| Seeds | `seed_campus` sets the A Building's placement once, fills floor names, and adds the three campus labels (Overpass, Professional School, SCC) once; afterwards they're edited in Map Annotation. `seed_a_routes` uses the A Building's stored placement. |
| Kiosk, phone, Map Annotation | The building list comes from the API (`lib/buildingRegistry.ts`), with the bundled EYA and A configurations as the offline fallback: placements and floor names from the API, and a building added from the admin panel appears once its model is live (its floors, model, entrance). The campus view's buildings and labels come from it. |
| Map Annotation, **Campus (outdoors)** | Walkway points (on the ground or the overpass deck, not roofs), joined to buildings' entrances and the kiosk; labels (place, rename, move, delete); **Place a building** (click, turn, ground height, Save; its points move with it). |
| Kiosk search and campus taps | Search covers every building: a visitor in EYA finds A Building rooms ("A Building · Second floor") and gets the route from the kiosk across. Tapping a building's model in the campus view opens it (the map's own tap no longer takes it to the picked building first). |
| Map Annotation, buildings | **Add building** (name, code, floors); a building waiting for its model shows in the picker. **Add a room**, **Remove this room**, a floor's button label and name, **Add floor**, and walking heights for buildings added here. The **Entrance** tool records where routes into such a building arrive (the kiosk's marker). |

## How a new building gets to the kiosk

Add building → upload its model in Asset Management (linked to it, floor
groups `FLOOR_1…n`) and make it live → place it in the Campus view → add its
rooms, entrance, corridors, doors and floor links → draw the walk to its
entrance. No code or seed file changes. See
[Map Annotation](../setup/map-annotation.md#adding-a-building).

## Files

| File | Role |
|---|---|
| `backend/django/apps/map/models.py`, `migrations/0004_campus_editing.py`, `placement.py` (**new**), `serializers/areas.py`, `serializers/floors.py`, `views/areas.py`, `seed_data/eya.py`, `seed_data/a_building.py`, `management/commands/seed_campus.py`, `tests.py` | Schema, placement, API, seeds |
| `backend/django/apps/annotation/serializers/campus.py`, `views/campus.py` (**new**), `urls.py`, `services.py` | Labels, floors, rooms, buildings; walkways scene |
| `backend/django/apps/navigation/management/commands/seed_a_routes.py` | Stored placement |
| `frontend/client/src/lib/buildingRegistry.ts` (**new**, with tests), `annotationApi.ts`, `api.ts`, `kioskDirectory.ts` | Registry, hooks, endpoints |
| `frontend/client/src/components/map/AnnotationCanvas.tsx`, `BuildingFloorMap.tsx`, `pages/workspaces/MapAnnotation.tsx`, `annotation/CampusEditor.tsx` and `annotation/BuildingPanels.tsx` (**new**), `assets/BuildingTab.tsx`, `pages/experience/KioskPage.tsx`, `MobilePage.tsx` | Campus view, building editing, registry use |
| `frontend/e2e/step14.qa.mjs` (**new**), `package.json` | Suite |
| `docs/setup/map-annotation.md`, `building-models.md`, `docs/openapi/flowsense-openapi.yaml`, `docs/architecture/conformance-review.md` | Docs |

## Limits

- The campus model itself (streets, blocks, trees) is still built from the
  team's area file by `build_campus_model.py` and replaced in Asset
  Management; blocks can't be edited in Map Annotation.
- Making a new model version live resets a new building's walking heights to
  the model's lowest point per floor (QA-126): check them in **This floor**.
- Routes for a new building are drawn in Map Annotation; generating them
  from its model needs a new profile in `build_navigation.py`.
