# Step 12b: Route fixes after the team's review

| | |
|---|---|
| Branch | `claude/admiring-heisenberg-gwhi4u` |
| Reported by the team (2026-09-27) | 1. Routes went through the elevator and were longer than they should be. 2. On other floors the kiosk only said "use the elevator", with no directions after it. 3. Map Annotation could delete a point but not move it, 4. nor delete a connection on its own. |
| Test report | [step-12b-test-report.md](../qa/step-12b-test-report.md) |
| Resolves | QA-109, QA-110, QA-111, QA-112, QA-114 |

## What changed

| Area | Change |
|---|---|
| Generator (`scripts/blender/build_navigation.py`) | **The lift is an obstacle.** Its car is hollow in the model, so the knee-to-head test saw open floor and routes ran through it; its footprint is now blocked, and the lift point sits in front of its doors (they face the corridor side of the turnstiles). **Straight routes.** Corridor centre lines are replaced by sight lines between the corners people walk around (kept 0.35 m clear); per floor, the shortest walks from where the kiosk's routes arrive (the kiosk, or the lift) to every door, stairs and lift are kept. First-floor routes are now at most 1.07× the grid walking distance (they were up to 1.46× the straight line). 157 points, 151 connections, 15 floor links, 97 rooms. |
| Navigation API | Each route segment lists its `floor_changes` (stairs or lift, from and to which floor; a lift passing floors is one ride). Additive. Kept in the route cache, so the phone sees it too. |
| Kiosk map | Multi-floor routes show a **step bar**: "Step 1 of 2 · First floor — Walk to the elevator, then go up to the third floor", with **Next: Third floor** and **Back**. The floor-change marker names the ride ("Elevator to 3F"). |
| Phone directions | "Take the elevator" or "Take the stairs", from the route, instead of "Take the stairs or the elevator". |
| Map Annotation | **Drag to move**: with Select, press a point and drag it; its connections follow and it saves on release. New `PATCH /annotations/nodes/{id}` (position, optionally name) redraws the connections as straight lines and records an audit entry. An addition to the API design, recorded in the conformance review. **Remove a connection**: with Delete, click its line; or **Remove** next to it in *Selected point* (the API already had `DELETE /annotations/edges/{id}`; nothing in the page used it). The Help guide mentions both, and that the routes come ready-made. |

## Open question for the team

Routes to upper floors all take the elevator: it's beside the kiosk, and the
stairs are about 15 m away, so even with stairs weighted lower (1.5× vs 2×
the climb) the elevator is shorter. If visitors should take the stairs (for
example, if the elevator is for staff or PWD only), the weights in
`navigation/services.py` and the generator change together.

## Files

| File | Role |
|---|---|
| `frontend/scripts/blender/build_navigation.py`, `backend/django/apps/map/seed_data/eya_navigation.json` | Generator, network |
| `backend/django/apps/navigation/services.py`, `serializers/routes.py`, `tests.py` | `floor_changes` |
| `backend/django/apps/annotation/services.py`, `serializers/nodes.py`, `views/nodes.py`, `tests.py` | Move a point |
| `frontend/client/src/lib/mapView.ts`, `mapView.test.ts`, `kioskDirectory.ts`, `routeSteps.ts`, `data/navigation.ts`, `components/BuildingFloorMap.tsx` | Step bar, ride names |
| `frontend/client/src/components/map/AnnotationCanvas.tsx`, `lib/annotationApi.ts`, `pages/workspaces/MapAnnotation.tsx`, `HelpPage.tsx` | Drag to move, remove a connection |
| `frontend/e2e/step8a.qa.mjs`, `step8b.qa.mjs`, `step7b.qa.mjs` | Step bar, drag check, ride labels |
| `docs/openapi/flowsense-openapi.yaml`, `docs/architecture/conformance-review.md`, `docs/setup/*` | Docs |
