# Step 8e test report

| | |
|---|---|
| Change record | [step-08e-queue-order.md](../changes/step-08e-queue-order.md) |
| Result | **All gates pass.** Backend 122/122 (3 new). Frontend unit tests 82/82 (2 new). New queue suite 7/7. Live kiosk 11/11, kiosk-to-phone 8/8. |

## Gates

| Gate | Result |
|---|---|
| `manage.py test --noinput` | **122 passed** |
| `npm run check`, `npm test` | No errors, 82/82 |
| ESLint and Prettier on changed files | Clean |
| **`npm run qa:step8e`** (real backend) | **7/7** |
| `qa:step8a`, `qa:step8d` | 11/11, 8/8 |
| OpenAPI file | Parses (YAML) |

## Backend tests (`navigation/tests.py`)

1. Without `optimize_order`, a queue of EA-110, EA-101A, EA-111 is routed in that order.
2. With it, the order becomes EA-101A, EA-111, EA-110: the west-wing room by the kiosk first, then down the east corridor. The total distance is shorter than the visitor's order, and there are three legs.
3. With the exact search limited to 1 stop, the nearest-neighbour and 2-opt path gives the same order.

## `qa:step8e`

| ID | Check |
|---|---|
| Q1 | The queue lists EA-110, EA-101A, EA-111 in the order they were added |
| Q2 | "Keep my order" is offered and off by default |
| Q3 | Navigate re-sorts the stops to EA-101A → EA-111 → EA-110 |
| Q4 | One multi-stop request with `optimize_order: true` and 3 destinations |
| Q5 | The first re-sorted stop is the one being navigated |
| Q6 | With "Keep my order" on, the order stays EA-110, EA-101A, EA-111 |
| Q7 | No uncaught page errors |

The suite clicks through `dispatchEvent`. With the route arrows animating, software rendering in the test browser keeps the page too busy for Playwright's scroll-and-settle checks to finish.
