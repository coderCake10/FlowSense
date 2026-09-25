# Step 5c test report

| | |
|---|---|
| Change record | [step-05c-envelope-and-kiosk.md](../changes/step-05c-envelope-and-kiosk.md) |
| Result | **All gates pass.** Backend 84/84 and frontend 52/52. End-to-end: step 5b 23/23 (including 4 new kiosk checks), 4a 13/13, 1 36/36, 2 22/22, models 3/3. |

## Gates

| Gate | Result |
|---|---|
| `manage.py check`, `makemigrations --check` | No issues, no changes (no schema change) |
| `manage.py test --noinput` | **84 passed** |
| `npm run check` | No errors |
| `npm test` | **52 passed** (6 new) |
| `npm run qa:step5b` (real backend and broker) | **23/23** |
| `npm run qa:step4a` | 13/13 |
| `npm run qa:step1`, `qa:step2`, `qa:models` (demo mode) | 36/36, 22/22, 3/3 |

## What the tests cover

**Envelope:**
- Every existing API test now reads `data`, `meta`, and `error` through
  helpers that also assert `success`.
- New assertions cover:
  - the exact `meta` of a paginated list (page 1, size 25, total 2, 1 page)
  - the observations' `total_pages`
  - `NOT_FOUND` for an unknown setting
  - `VALIDATION_ERROR` with `fields` for bad input
  - `NOT_IMPLEMENTED` for ping
  - `RATE_LIMITED` for too many heartbeats
  - DELETE returning 200 with the `SuccessNoData` body
  - logout returning 200
- Frontend unit tests cover unwrapping `data`, `getPage` returning rows and
  meta, and the server's error message reaching the UI.

**Kiosk heartbeat (backend):**
- The first heartbeat discovers an unregistered kiosk and records its OS and
  IP.
- Once registered, the kiosk is online and records sessions; a kiosk session
  can be created with the returned `id`; the details show resolution, touch
  support, "running", and uptime.
- A silent kiosk goes offline with an alert.
- An invalid ID is rejected, and nothing is created.
- A decommissioned kiosk stays decommissioned.
- Heartbeats are rate-limited per IP.

**Kiosk, end to end:** a separate touch-screen browser plays the kiosk.

| ID | Check |
|---|---|
| K1 | The attract screen shows the new kiosk's ID |
| K2 | The kiosk appears on the Hardware page as an Unregistered kiosk |
| K3 | After Register it's Online, and its details show 1366×1024 and touchscreen status |
| K4 | A touch, then **Back**, raises today's kiosk session count by exactly 1 |
