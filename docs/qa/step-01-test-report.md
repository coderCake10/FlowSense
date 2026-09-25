# Step 1 test report

| | |
|---|---|
| Change record | [step-01-kiosk-auth-signout.md](../changes/step-01-kiosk-auth-signout.md) |
| Environment | Node 22, pnpm 10.4, Chromium (Playwright 1.56.1, SwiftShader WebGL), 1440×900 viewport |
| Result | **All gates pass.** 27/27 unit tests; 36/36 browser checks on 3 consecutive runs |

## Quality gates

| Gate | Baseline (before step 1) | After step 1 |
|---|---|---|
| `npm run check` (tsc) | Pass | Pass |
| `npm run lint` | 0 errors, 403 warnings | 0 errors, 386 warnings (unused imports removed from the auth page) |
| `npm test` | No tests existed | 27 passed |
| `npm run build` | Pass | Pass |
| `npm run qa:step1` | n/a | 36/36, three runs in a row |

## Unit tests (`client/src/lib/*.test.ts`)

- **authValidation (18).** Accepts `@auf.edu.ph`, subdomains, and mixed case
  or padded input. Rejects empty and whitespace-only input, a missing `@`, an
  empty domain, embedded spaces, `gmail.com`, look-alike domains
  (`notauf.edu.ph`), and suffix attacks (`auf.edu.ph.evil.com`). Codes: accepts
  leading zeros; rejects empty, 5 digits, 7 digits, and non-digits; the
  sanitizer strips non-digits and caps at 6.
- **kioskQueue (9).** Keeps order and ignores duplicates, doesn't mutate its
  input, removes by id, reports membership, and picks the next stop correctly
  (including the last-stop and empty-queue cases). `activateQueue` follows
  the spec's Navigate rule: an empty queue becomes the selection, an unqueued
  selection is appended, an already-queued selection keeps its order, and with
  no selection the existing queue runs.

## Browser checks (`frontend/e2e/step1.qa.mjs`)

### Kiosk (QA-01, QA-02, QA-03)

| ID | Check | Result |
|---|---|---|
| K1 | Selecting a destination opens no dialog | Pass |
| K2 | A labeled "Change destination" button is visible in preview | Pass |
| K3 | "Add to queue" doesn't open a dialog or QR code | Pass |
| K4 | The button becomes a disabled "In queue" | Pass |
| K5 | A "Queue (1)" button appears | Pass |
| K6 | The Queue button stays visible while another destination is previewed | Pass |
| K7 | "Change destination" clears the selection | Pass |
| K8 | "Change destination" moves focus to search | Pass |
| K9 | **Navigate opens the destination queue modal** (spec) | Pass |
| K10 | The modal lists stops in queue order; the first is "Navigating now" | Pass |
| K11 | The modal presents the "Continue on your phone" QR panel (spec) | Pass |
| K12 | The EYA model and the "You are here" label render | Pass |
| K13 | **With the modal open, the element at the label's position is the overlay, not the label** (overlap fix) | Pass |
| K14 | "Follow on this kiosk" closes the modal and the route stays active | Pass |
| K15 | "Change destination" is available while navigating | Pass |
| K16 | "Next stop" offers the other queued destination | Pass |
| K17 | "Next stop" navigates to it and drops the finished stop | Pass |
| K18 | Removing the stop being navigated empties the queue and ends that route | Pass |
| K19 | With an empty queue, Navigate makes the selection the only stop and starts it (spec) | Pass |
| K20 | No uncaught page errors | Pass |

### Auth, no API configured (QA-08, QA-09)

| ID | Check | Result |
|---|---|---|
| A1 | An empty email is rejected | Pass |
| A2 | A malformed email is rejected | Pass |
| A3 | A non-AUF domain is rejected | Pass |
| A4 | The field is marked `aria-invalid` | Pass |
| A5 | A valid email shows "not connected" and no fake success | Pass |
| A6 | The demo-state text is gone | Pass |

### Auth, API configured (backend mocked with Playwright routes)

| ID | Check | Result |
|---|---|---|
| A7 | A valid, padded, mixed-case email advances to the code step with non-enumerating copy | Pass |
| A8 | The code input keeps digits only | Pass |
| A9 | A short code is rejected on the client | Pass |
| A10 | A 401 shows "incorrect or has expired" | Pass |
| A12 | A 429 shows the rate-limit message | Pass |
| A13 | "Send a new code" shows a confirmation toast | Pass |
| A14 | The correct code redirects to the dashboard | Pass |

### Sign-out (QA-11)

| ID | Check | Result |
|---|---|---|
| S1 | Sign-out opens an in-app alert dialog (no native `confirm`) | Pass |
| S2 | "Stay signed in" keeps the user on the dashboard | Pass |
| S3 | Confirming sends `POST /auth/logout` and returns to `/auth` | Pass |

## Revision

The kiosk checks were rewritten after the architecture review found that the
first version of Navigate didn't match the kiosk spec (see the change record's
revision note). The suite was re-run three times after the correction:
36/36 each time.

## Flakiness log

Two checks failed on the first runs. In both cases the test read the page
before an animation or network response had finished. Neither was an app
defect. Both were fixed in the test by waiting for the state to settle, then
confirmed with three consecutive clean runs.

- **S2** read the page while the dialog's close animation was still running.
  The test now waits for the dialog to detach.
- **A13** checked for the toast before the resend request had resolved. The
  test now waits for the toast.

## How to re-run

```bash
cd frontend
npm install
npx playwright install chromium        # first time only, on your machine
npx vite --host 127.0.0.1 --port 3000 &
VITE_API_BASE_URL=/api/v1 npx vite --host 127.0.0.1 --port 3002 --strictPort &
npm run qa:step1                            # screenshots land in e2e/output/
```

## Not covered in step 1 (by design)

- Real backend authentication. The endpoints aren't mounted yet (see the
  backend handoff in the change record).
- A touch-hardware pass on the physical kiosk display. Recommended before the
  demo: check button sizes and the on-screen keyboard with the queue dialog open.
