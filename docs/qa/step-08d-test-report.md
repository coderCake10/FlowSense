# Step 8d test report

| | |
|---|---|
| Change record | [step-08d-mobile-directions.md](../changes/step-08d-mobile-directions.md) |
| Result | **All gates pass.** Frontend unit tests 80/80 (7 new). New kiosk → phone suite 8/8. QR handoff suite 22/22, live kiosk suite 11/11. |

## Gates

| Gate | Result |
|---|---|
| `npm run check`, `npm test` | No errors, 80/80 |
| ESLint and Prettier on changed files | Clean |
| **`npm run qa:step8d`** (real backend) | **8/8** |
| `qa:step2` (QR handoff, phone checklist) | 22/22. Its wording checks were updated. One earlier run timed out while loading the kiosk page, before any phone step. The next run passed in full. |
| `qa:step8a` (live kiosk) | 11/11 |

No backend code changed.

## `qa:step8d`

| ID | Check |
|---|---|
| H1 | The kiosk routes EA-110 through the Navigation API (201, route id). |
| H2 | The QR link carries that route id. |
| H3 | The phone shows "Preparing your route" while it loads. |
| H4 | Directions run from "Start at the kiosk" to "Arrive at EA-110". The run gave: start → turn left → arrive, which matches the route sketch (east, then north). |
| H5 | The phone made exactly one route request, `GET /navigation/routes/{id}`, and no new route. |
| H6 | "I've arrived" asks "Have you reached Office of the Dean…?" and shows "EA-110 · First floor". |
| H7 | "Yes, finish" completes the route. |
| H8 | No uncaught page errors |

## Unit tests

- `routeSteps.test.ts` (5):
  - a right turn and a left turn, read from above;
  - gentle bends and short jogs count as straight on;
  - a floor change between legs;
  - no steps without a route.
- `handoff.test.ts` (+2):
  - route ids round-trip through the QR payload;
  - malformed route ids are rejected.
