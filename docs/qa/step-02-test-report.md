# Step 2 test report

| | |
|---|---|
| Change record | [step-02-qr-handoff.md](../changes/step-02-qr-handoff.md) |
| Environment | Node 22, pnpm 10.4, Chromium (Playwright 1.56.1). Kiosk at 1440×900; phone emulated as an iPhone 13 (touch, mobile user agent). |
| Result | **All gates pass.** 46/46 unit tests; step 2 browser suite 22/22 on 3 consecutive runs; step 1 suite 36/36 (no regressions) |

## Quality gates

| Gate | After step 1 | After step 2 |
|---|---|---|
| `npm run check` | Pass | Pass |
| `npm run lint` | 0 errors, 386 warnings | 0 errors, **372** warnings (the mobile page's unused imports are gone) |
| `npm test` | 27 | **46** |
| `npm run build` | Pass | Pass |
| `npm run qa:step1` | 36/36 | 36/36 (regression) |
| `npm run qa:step2` | n/a | 22/22, three runs in a row |

## Unit tests (19 new)

- **handoff (15).**
  - The payload captures the building, the queue order, and a 900-second expiry.
  - The encoding round-trips and is URL-safe.
  - Decoding rejects garbage, non-JSON, the wrong version, an empty queue,
    an expiry at or before issue, and a missing session id.
  - `handoffUrl` targets `/mobile` on the given origin.
  - `resolveHandoff` keeps the queue order, reports a missing token, and
    rejects unknown buildings or destinations (stale or tampered links).
  - It expires exactly at `exp`, **unless this phone already started the
    session**.
  - `currentStopIndex` finds the first unreached stop, or -1 when all are done.
  - Session ids are 16 hex characters and vary.
- **routeSketch (4).**
  - +X maps to screen right and +Z to screen down (top-down, not mirrored).
  - The scale is uniform and the shorter axis is centered.
  - A single route is framed against the whole building.
  - A single-point frame doesn't break the projection.

## Browser checks (`e2e/step2.qa.mjs`)

### Kiosk QR (QA-04)

| ID | Check | Result |
|---|---|---|
| Q1 | The Navigate modal shows a real QR code and no placeholder text | Pass |
| Q2 | **The QR as rendered on screen decodes (jsQR on a screenshot) to exactly the handoff URL** | Pass |
| Q3 | The URL targets `/mobile` with an `h=` payload | Pass |
| Q4 | The modal states the stop count and the expiry time | Pass |
| Q5 | Removing a stop updates the QR (same session, one stop) | Pass |
| Q6 | Reopening the modal issues a new handoff session | Pass |

### Phone checklist (QA-10)

| ID | Check | Result |
|---|---|---|
| M1 | The scanned URL opens the checklist for the first stop | Pass |
| M2 | Both stops are listed in queue order | Pass |
| M3 | The current stop shows the route sketch | Pass |
| M4 | Progress starts at "0 of 2 reached" | Pass |
| M5b | No sticky confirm button before the visitor cancels (spec P2) | Pass |
| M5 | An honest note says sensor arrival detection isn't active yet | Pass |
| M6 | "I've arrived" opens the arrival confirmation | Pass |
| M7 | After "Not yet", a sticky button reopens the confirmation | Pass |
| M8 | Confirming marks the stop reached and advances to the next | Pass |
| M9 | Progress survives a reload | Pass |
| M10 | Completing every stop shows the finished state; no confirm button remains | Pass |
| M11 | A started session still opens after the QR expired (clock moved +16 min) | Pass |
| M12 | An unstarted link after 15 minutes shows "expired" | Pass |
| M13 | A garbage or tampered link shows "couldn't be read" | Pass |
| M14 | No link shows "No route to show" | Pass |
| E1 | No uncaught page errors on either device | Pass |

## Defects found and fixed during QA

| Found by | Defect | Fix |
|---|---|---|
| Screenshot review | The sticky "Confirm arrival" button showed from the start, which contradicts the spec (only after cancel) and duplicates "I've arrived" | Shown only after the confirmation is dismissed; covered by M5b and M7 |
| Screenshot review | The sticky button's label wrapped ("EA-" / "110") | `whitespace-nowrap` |
| Screenshot review | Visitors' phones showed "Loading FlowSense workspace…" | Changed to "Loading FlowSense…" |

## Test-harness issues (not app defects)

- **Checks run before the page rendered.** `/mobile` is lazy-loaded, so checks
  ran against the loader. The test now waits for the page's `<h1>` after
  every navigation.
- **M10 read the page while the dialog was still closing.** For about 300 ms
  the closing dialog keeps the page `aria-hidden`. A debug script confirmed
  the app state was already correct. The test now waits for the dialog to
  detach.

## How to re-run

```bash
cd frontend
npm install
npx playwright install chromium        # first time only
npx vite --host 127.0.0.1 --port 3000 &
npm run qa:step2                            # screenshots in e2e/output/
```

## Manual check before the demo (recommended)

Run the frontend with `VITE_PUBLIC_BASE_URL` set to the kiosk's LAN address.
Then scan the kiosk screen with a real Android phone and a real iPhone on
campus Wi-Fi. Confirm the camera app recognizes the code, the checklist opens,
and a reload keeps progress.
