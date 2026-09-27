# Step 12: Routes for every room, generated from the model

| | |
|---|---|
| Branch | `claude/admiring-heisenberg-gwhi4u` |
| Decided by the team (2026-09-26) | **Replace** the three starter routes with a network generated from the model; add the rooms the model has but the labels document doesn't |
| Why | Only 3 of 92 rooms had routes; annotating six floors by hand was the team's biggest remaining task. The EYA2 model has a sign on every room (177 text objects, 97 room codes), each within 1.9 m of its door, so the doors can be found from the model. |
| Guide | [Building models, 2c](../setup/building-models.md#2c-the-navigation-network) |
| Test report | [step-12-test-report.md](../qa/step-12-test-report.md) |
| Resolves | QA-73 |

## What changed

| Area | Change |
|---|---|
| Generator (`frontend/scripts/blender/build_navigation.py`, **new**) | Runs in Blender on the team's `.blend`. Per floor: rasterises the walkable slab (0.2 m) minus obstacles between knee and head height, traces the corridors' centre lines, finds each room's door from its sign, connects doors, both stair cores, the lift and the kiosk to the centre lines in clear straight lines, and keeps only the links the kiosk's routes use. Links stair cores and the lift floor to floor. Writes JSON in the kiosk model's coordinates, and optional PNG previews. About 4 s. |
| Network (`backend/django/apps/map/seed_data/eya_navigation.json`, **new**) | 271 points, 283 connections, 15 floor links (2 stair cores and the lift, 5 floor pairs each), 97 room doors. |
| `seed_eya_routes` | Loads that network instead of the three starter routes. Points and connections are tagged (`eya-network`) and updated in place; points dropped from a regenerated file are soft-deleted. The starter points are retired, except the starter kiosk point, which becomes the network's kiosk so kiosk devices assigned to it keep it. A door placed in Map Annotation wins over the generated one (listed in the output); a renumbered room's door is loaded unlinked and listed, not fatal. |
| Rooms (`seed_campus`) | EA-216, EA-317, EA-515, EA-516, EA-517 added as unnamed rooms (the model has their doors and signs; the labels document doesn't list them). 97 rooms. |
| Kiosk (`lib/mapView.ts`) | Floors a route only passes through (one point, on the stairs or in the lift) aren't legs: a 3F room says "Go to 3F" and "First floor → Third floor", not "Go to 2F". |
| Starter data (`map/seed_data/eya.py`) | The hand-placed first-floor route data is removed; a pointer to the network file replaces it. |

## Notes for the modelling team

- **EA-207 (2F)**: its sign is about 1 m from EA-204's, beside the same door
  (`DOOR_.025`), and there's no EA-207 door near it. EA-204 gets the door;
  EA-207's route ends at its sign (team decision, 2026-09-27). Check whether
  the sign is misplaced or a door is missing.

## Not in this step

- A Building routes (step 9b).
- Accessibility (lift-only) routes: the Navigation API weighs stairs 1.5×
  and the lift 2× the climb, and picks whichever is shorter.
- Other kiosk positions: `KIOSK` in the generator; links are kept for the
  kiosk's routes, but every point stays connected, so other origins route too.

## Files

| File | Role |
|---|---|
| `frontend/scripts/blender/build_navigation.py` (**new**) | Generator |
| `backend/django/apps/map/seed_data/eya_navigation.json` (**new**), `eya.py` | Network, rooms |
| `backend/django/apps/navigation/management/commands/seed_eya_routes.py` | Loader |
| `backend/django/apps/map/management/commands/seed_campus.py` | 97 rooms |
| `backend/django/apps/navigation/tests.py`, `annotation/tests.py`, `map/tests.py`, `analytics/tests.py` | Tests |
| `frontend/client/src/lib/mapView.ts`, `mapView.test.ts` | Pass-through floors |
| `frontend/e2e/step8a.qa.mjs`, `step8b.qa.mjs`, `step8d.qa.mjs`, `step8e.qa.mjs` | 97 rooms; EA-305 routed; step8b takes EA-305's door out and restores it |
| `docs/setup/building-models.md`, `map-annotation.md`, `team-local-setup.md`, `local-development.md`, `frontend/HANDOVER.md` | Docs |
