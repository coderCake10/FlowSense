# Step 13: The A Building in the kiosk, routes from EYA over the overpass, Take offline

| | |
|---|---|
| Branch | `claude/admiring-heisenberg-gwhi4u` |
| Asked by the team (2026-09-27) | 1. The A Building, made live in Asset Management, showed only in the campus view: not in the kiosk as a building of its own, and not in Map Annotation. The latest model is `A BUILDING4` (Drive). 2. A building made live couldn't be taken back offline. Decisions: routes both inside the A Building **and** from the EYA kiosk out of EYA, over the MacArthur Highway overpass, into A and to the room; add **Take offline**. |
| Test report | [step-13-test-report.md](../qa/step-13-test-report.md) |
| Resolves | QA-121, QA-122, QA-123, QA-127, QA-128 |

## Why the A Building didn't show

The kiosk and Map Annotation list the buildings in
`client/src/data/buildings.ts`, and only EYA was there. The database had no A
Building either (no area, floors or rooms), so there was nothing to route to.
Making the A model live in Asset Management only changed the model the campus
view could use. Now the A Building has its own configuration, area, rooms and
routes, and its model is live.

## What changed

| Area | Change |
|---|---|
| A model | `A.glb` re-exported from `A BUILDING4.blend` (2.0 MB): `BACKUP` left out, the loose room signs grouped (`--collect-loose SIGNS`), sign lettering at 3 curve steps (`--text-resolution 3`; 1.4 M → 0.4 M triangles). Its origin moved from the earlier file by (56.84, −1.65) m, so the placement moved with it: `[-189.35, 3.2, 133.44]`, 90°. |
| Rooms | `seed_campus` adds the A Building (area `A`): 4 floors, 48 rooms from the "Data gathering" document (A section) and the model's signs, and the front entrance; and the campus walkways (area `AUF-WALKWAYS`, outdoor, one level). |
| A routes | `build_navigation.py --building a`: the same method as EYA, for A's model (slab names, signs by height, hollow wall and room boxes, doors beside stair landings, no elevator). 99 points, 94 connections, 9 stair links, 46 rooms. EYA's output is byte for byte unchanged. `seed_a_routes` loads it in campus coordinates. |
| The walk between buildings | `seed_a_routes` also loads the walk EYA kiosk → EYA front doors → MacArthur Highway's north side → overpass → its south side → A front gate → A front entrance (12 points, 252 m), each line checked clear of the campus model. One route runs from the EYA kiosk to any A room (A* over the whole campus). |
| Navigation API | Each segment carries `stops` (additive): each point's node, name, area and floor. Notices cover every building the route goes through. |
| Kiosk | The building list has the A Building: its 48 rooms, its whole building and floors. A route into it is split by the stops: EYA's first floor, the walk outside (drawn in the campus view), then A's floors. The map changes building as the steps go on: "Walk out of the EYA Building." → "Cross the highway on the overpass, then walk to the A Building." → "Walk to the stairs, then go up to the third floor." → "Walk to A-305." Follow on this kiosk plays them all. The header and starting point stay the EYA kiosk. |
| Phone | The same route: start at the kiosk, leave the EYA Building, walk to the A Building over the overpass (one step: the campus map is too rough for turns), enter the A Building, then its floors. The sketch frames the whole walk. |
| Campus view | The A Building shows its live model (Asset Management). |
| Map Annotation | Building: EYA or the A Building (EYA first). A's points are shown on A's model and stored in campus coordinates by its placement. Walking heights come from the building configuration (a model's measured lowest points can sit below the slab). |
| Asset Management, **Take offline** | On a live model: the kiosk goes back to the bundled model; versions stay; logged. `POST /assets/{id}/deactivate` (additive). `seed_assets` makes the A model live (linked to its building) and leaves a model an admin took offline, or replaced with another asset, offline. |
| Dashboard | Counts buildings' floors only (not the walkways' level). |

## Files

| File | Role |
|---|---|
| `backend/django/apps/map/seed_data/a_building.py` (**new**), `a_navigation.json` (**new**), `management/commands/seed_campus.py`, `tests.py` | A rooms, placement, walk; walkways |
| `backend/django/apps/navigation/management/commands/seed_a_routes.py` (**new**), `seed_eya_routes.py`, `services.py`, `serializers/routes.py`, `tests.py` | A routes, the walk, `stops` |
| `backend/django/apps/assets/services.py`, `views.py`, `management/commands/seed_assets.py`, `tests.py` | Take offline; A model live |
| `backend/django/apps/analytics/dashboard.py`, `tests.py` | Floor count |
| `frontend/scripts/blender/build_navigation.py`, `export_kiosk_model.py` | Building profiles; export options |
| `frontend/client/public/models/A.glb` | A BUILDING4 |
| `frontend/client/src/data/aNavigation.ts` (**new**), `buildings.ts`, `eyaNavigation.ts`, `navigation.ts` | A configuration, placement |
| `frontend/client/src/lib/mapView.ts`, `mapCoordinates.ts`, `kioskDirectory.ts`, `routeSteps.ts`, `annotationApi.ts`, `assetsApi.ts`, `api.ts`, `crossBuilding.test.ts` (**new**) | Legs by building, placement, steps |
| `frontend/client/src/components/BuildingFloorMap.tsx`, `map/CampusScene.tsx`, `RouteSketch.tsx`, `pages/experience/KioskPage.tsx`, `MobilePage.tsx`, `pages/workspaces/MapAnnotation.tsx`, `AssetManagement.tsx` | Kiosk, phone, Map Annotation, Take offline |
| `frontend/e2e/step13.qa.mjs` (**new**), `step8b.qa.mjs`, `step7b.qa.mjs`, `step5b.qa.mjs`, `package.json` | Suites |
| `docs/setup/building-models.md`, `map-annotation.md`, `team-local-setup.md`, `local-development.md`, `docs/openapi/flowsense-openapi.yaml`, `docs/architecture/conformance-review.md` | Docs |

## Still open

- A-401 and A-412 are in the document but have no sign in the model, so no
  door point: place them in Map Annotation, or add signs to the model (QA-124).
- On the fourth floor the back stairs arrive on the auditorium's side of the
  corridor; the generator reports it and the other stairs serve the floor
  (QA-125).
- Activation measures each floor's height as the model's lowest point there;
  for A that's below the slab (4F: 6.88 m, a door modelled a floor down).
  The kiosk and Map Annotation use the configured heights (QA-126).
- Names on the A signs and in the document differ in places (QA-129).
