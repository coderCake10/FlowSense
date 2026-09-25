# Step 9a test report

| | |
|---|---|
| Change record | [step-09a-campus-view.md](../changes/step-09a-campus-view.md) |
| Result | **All gates pass.** Frontend unit tests 85/85 (3 new). Kiosk map suite 13/13 (2 new checks). Every map suite passes. |

## Gates

| Gate | Result |
|---|---|
| `npm run check`, `npm test` | No errors, 85/85 |
| ESLint and Prettier on changed files | Clean |
| `npm run models:check` | EYA.glb, A.glb, CAMPUS.glb and the Draco decoder present |
| **`qa:step7b`** (kiosk map) | **13/13**: new B7b (the campus view names both buildings and the overpass), B7c (tapping goes to the whole building) |
| `qa:step8a`, `qa:step8b`, `qa:step8d`, `qa:step8e` | 11/11, 10/10, 8/8, 7/7 |

No backend code changed.

## Placement check

The detailed models' footprints (floors above 3 m) were drawn over the area
file's buildings, top-down. The A Building's L sits on its block, and EYA
sits on its block with the curved lobby toward MacArthur Highway. The
automatic fit's overlap score is low (about 20%), because the area file's
outlines are simplified. So the orientation was settled by the buildings'
entrances and the team's satellite view, not by the score alone.
