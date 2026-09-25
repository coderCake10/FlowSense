# Step 8b test report

| | |
|---|---|
| Change record | [step-08b-map-annotation.md](../changes/step-08b-map-annotation.md) |
| Result | **All gates pass.** Backend 113/113 (8 new). Frontend unit tests 71/71. New annotation suite 8/8, and it passes twice in a row because it cleans up after itself. Every earlier suite passes. |

## Gates

| Gate | Result |
|---|---|
| `manage.py test --noinput` | **113 passed** |
| `npm run check`, `npm test` | No errors, 71/71 |
| ESLint and Prettier on changed files | Clean |
| **`npm run qa:step8b`** (real backend) | **8/8**, run twice in a row |
| `qa:step8a` (live kiosk) | 10/10 |
| `qa:step1`, `qa:step2`, `qa:step7a`, `qa:step7b`, `qa:models` | 36/36, 22/22, 7/7, 10/10, 3/3 |
| OpenAPI file | Parses (YAML) |

Not re-run: `qa:step5b` and `qa:step6` (admin Hardware, Users, Settings and
Analytics pages). Those pages didn't change. The shared API client only
gained an optional headers argument.

## `qa:step8b`

| ID | Check |
|---|---|
| A1 | The page opens the EYA model on the first floor, listing its 15 rooms. |
| A2 | It shows the saved graph: 9 points, 3 of 92 rooms placed (the starter routes). |
| A3 | 3F lists that floor's 16 rooms. |
| A4 | Two corridor clicks save two points and one connection (place order). |
| A5 | Placing EA-305's door ticks the room and connects the door to the corridor. |
| A6 | The new door is selected, and its connection is listed. |
| A7 | The Delete tool removes all three points and their connections; EA-305 is unticked. |
| A8 | No uncaught page errors |

## Defects found and fixed during this step

| Found | Cause | Fix |
|---|---|---|
| Points placed through the API were stored about 500 km away, so they never appeared | GeoJSON input was reprojected from WGS84 (QA-78) | The field uses the column's SRID; regression tests in `common/tests.py` and `annotation/tests.py` |
| Clicking existing points often did nothing | The model's click ray hit invisible lifted floors and room ceilings first. In the atrium it passed through to a lower floor. | Clicks pick points on screen and land on the floor plane |
| The map re-framed whenever the side panel's content changed | The workspace grew with the panels | Fixed-height workspace; the panels scroll |
| Points were hard to click at building zoom (about 5 px) | World-sized discs | Screen-sized points (16 px) |
| Clicks were ignored for seconds after each save | A mutation stayed "pending" until every view had refreshed | Saving ends when the request succeeds; views refresh in the background |
| The kiosk opened a multi-floor room on its own floor, and a line dropped through the floors | The map keyed on the room, not the route, and each leg repeated the point below | The map opens where the route starts; legs no longer join across floors; "Go to 3F" marker |

## Backend tests

- `annotation/tests.py` (6):
  - annotation needs an admin,
  - a room node links to its room and is stored at exactly the given
    coordinates,
  - a room node requires a room,
  - corridor points chain in place order (the edge is 5.0 m),
  - the scene lists the building, and deleting a node drops its edges,
  - a stairs link joins floors into one route whose points are at 1.02 m
    and 8.09 m.
- `common/tests.py` (2): GeoJSON coordinates are kept as given in 3857, and
  an explicit CRS is respected.

## Visual check: a route across floors

A temporary network was placed in the development database:

- the kiosk to the front stairs (1F),
- a stairs link to 3F,
- the 3F corridor to EA-305's door.

The kiosk:

- opened the first floor with the route to the stairs, labelled "Go to 3F",
- read "From Kiosk: First floor → Third floor",
- drew, on 3F, the leg from the stairs to EA-305.

The temporary network was then deleted.

## Environment notes

- The sign-in rate limit (10 verifies per hour per email) stopped the suite
  after many runs. A separate QA admin was used; the limit was left
  unchanged.
- The suite needs a clean third floor to start with. It cleans up after
  itself; if a run fails part-way, delete the leftover 3F points before
  re-running.
