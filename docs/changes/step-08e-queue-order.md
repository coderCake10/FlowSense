# Step 8e: Destination Queue in the shortest walking order

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Requested by the team (2026-09-25) | The Destination Queue should be optimized (paper: "optimized for the shortest continuous walking distance"), with a way to keep a required order such as enrollment steps. |
| Scope | Navigation API (`optimize_order`), kiosk queue |
| Test report | [step-08e-test-report.md](../qa/step-08e-test-report.md) |

## What changed

| Area | Change |
|---|---|
| API: `POST /navigation/routes` | New optional `optimize_order` (default `false`, so existing clients are unchanged). When true, the service works out the walking cost between the origin and every stop and between every pair of stops (A*, with the stairs and elevator weights), then picks the visiting order with the shortest total walk. It tries every order for up to 7 stops, and uses nearest neighbour improved by 2-opt beyond that. The route is generated in that order and the response lists the stops by `destination_order`. Ties keep the visitor's order, repeated stops keep the order given, and if no order connects every stop the given order is kept (the usual 422 then applies). |
| Kiosk queue | A **Keep my order** checkbox in the queue dialog, off by default. It is offered when the kiosk is live and has two or more stops. Pressing **Navigate** with it off asks the Navigation API for the shortest-walk order (one multi-stop request), re-sorts the queue, shows "Stops arranged for the shortest walk", and starts the first stop. Stops that aren't on the map yet keep their order after the others. If the request fails, the visitor's order is kept. While it runs, Navigate reads "Arranging stops…". |
| Analytics | The kiosk now sends real multi-destination requests, so Navigation Analytics' queue usage, average queue size and common destination sequences receive data. |

## Things to know

- The phone checklist follows the new order. Each stop's directions on the phone still start from the kiosk, as before (the per-stop routes the kiosk loaded).
- Only the order changes; each leg is still A*'s shortest path.

## Files

| File | Role |
|---|---|
| `backend/django/apps/navigation/services.py` | `best_visiting_order`, `optimize_order` in `generate_route` |
| `backend/django/apps/navigation/serializers/routes.py`, `views/routes.py` | The new field |
| `backend/django/apps/navigation/tests.py` | 3 new tests |
| `frontend/client/src/lib/kioskDirectory.ts`, `kioskDirectory.test.ts` | `shortestWalkOrder` and its tests (2) |
| `frontend/client/src/pages/experience/KioskPage.tsx` | Keep my order, Navigate arranges the stops |
| `frontend/e2e/step8e.qa.mjs` (**new**) | Browser check |
| `docs/openapi/flowsense-openapi.yaml` | `optimize_order` |
