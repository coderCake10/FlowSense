# Step 2: QR handoff from kiosk to phone

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Resolves | QA-04 (the QR code doesn't work), QA-10 (mobile handoff not connected) |
| Spec | `architecture-notes-main`: 04 Application/00 Kiosk/02 Interactive 3D Map (Destination Queue), 04 Application/01 Mobile Handoff (Navigation Checklist), and 07 API (QR Sessions API) |
| Scope | Frontend only. No backend or database changes. |
| Evidence | [Step 2 test report](../qa/step-02-test-report.md) |

## Summary

The kiosk's destination-queue modal now shows a **real, scannable QR code**.
Scanning it opens the **Navigation Checklist** on the phone: the queued stops
in order, a top-down route sketch for the current stop, and arrival
confirmation. Progress is saved on the phone. Links expire after 15 minutes,
the same lifetime as the backend's QR sessions.

## Design: shaped like the backend contract, local transport for now

The backend's QR session flow (`fs_sessions`) is:

```
POST /api/v1/navigation/routes                 → navigation_request (needs node ids)
POST /api/v1/sessions {navigation_request_id}  → { data: {id, expires_at, …}, qr_token }   (15 min)
phone: POST /api/v1/sessions/{id}/scan {qr_token}, GET /api/v1/sessions/{id}
```

It can't be used yet. The routes aren't under `/api/v1` except sessions
(QA-25), and the kiosk's destinations are hand-built frontend data without
database node ids.

`client/src/lib/handoff.ts` mirrors that flow with a **local transport**:

| Backend concept | Local transport (this step) |
|---|---|
| Session `id` | `s`: a random 16-hex id, created when the queue modal opens |
| Destination queue | `b` (building configuration id) plus `d` (destination ids, in order) |
| `expires_at` (15 min) | `iat`/`exp`, with `HANDOFF_TTL_SECONDS = 900` |
| QR carries `qr_token` | The QR carries `/mobile?h=<base64url JSON payload>` |
| `scanned` status survives QR expiry | A phone that has already opened the link keeps working after `exp` |
| Unknown or invalid token | The phone shows "couldn't be read" |

The payload is **encoded, not signed**. Without a server there is no secret to
sign with. It only references public room data, so tampering can at most
produce a wrong but harmless room list, or an "invalid" screen for unknown IDs.
Step 4 replaces `createHandoff` and `resolveHandoff` with the API calls above.
The kiosk and phone UI don't change.

## Kiosk changes (`KioskPage.tsx`)

- **The QR panel** in the destination-queue modal renders the handoff URL
  with `qrcode.react` (152 px, error correction level M). The panel states the
  number of stops and the expiry time ("Valid until 3:55 AM").
- **A new session each time the modal opens** (`showQueue`): a new id and a
  new 15-minute window. Editing the queue while the modal is open (removing a
  stop) updates the same session's QR immediately.
- The QR is computed from state set in event handlers, so rendering stays pure.

## Phone changes (`MobilePage.tsx`, rewritten)

Built from the spec's Navigation Checklist:

| Spec item | Implementation |
|---|---|
| List of instruction cards to each destination (P1) | Ordered cards for each stop, each marked Reached, Next stop, or upcoming. The current card expands to show a **route sketch** (`RouteSketch`): a top-down projection of the kiosk's own route coordinates, with the kiosk as the dark dot and the destination as the colored dot. The sketch is framed on the whole building, so all stops share one scale. |
| Dynamic update on reaching a destination (P1, BLE) | **BLE detection isn't possible yet** (it needs ESP32 sensors and the backend). The phone says so plainly and asks the visitor to confirm each stop with **I've arrived**. |
| Confirmation modal on arrival (P2) | "Arrived at …?" with **Yes, I'm here** / **Not yet** |
| Sticky button to reopen the confirmation after cancelling (P2) | Appears **only after** the visitor cancels. It hides once the stop is confirmed. |
| Loading page (P2) | Uses the app's route loader. Its text changed from "Loading FlowSense workspace…" (admin wording) to "Loading FlowSense…". A progress bar is left for the backend transport, where loading takes measurable time. |

Other behavior:
- **Progress** is saved in `localStorage` per session, so reloading keeps it. If
  storage is blocked, the checklist still works but doesn't survive a reload.
- **Finished state:** "You've reached every stop".
- **Error states:** no link ("No route to show"), a malformed or stale link
  ("This QR code couldn't be read"), and an expired, unstarted link ("This
  route link has expired", with instructions to scan again).
- The old demo UI (a fake "BLE active" toggle, hardcoded "To Guidance Office"
  steps, and a range-toggle switch) is removed.

## Files changed

| File | Change |
|---|---|
| `client/src/lib/handoff.ts` | **New.** Handoff contract plus local transport: create, encode, decode, URL, resolve, progress index, session id, public base URL |
| `client/src/lib/routeSketch.ts` | **New.** Top-down, uniform-scale route projection |
| `client/src/components/RouteSketch.tsx` | **New.** SVG route sketch |
| `client/src/pages/experience/KioskPage.tsx` | Real QR panel; a handoff session is issued when the modal opens |
| `client/src/pages/experience/MobilePage.tsx` | Rewritten as the Navigation Checklist |
| `client/src/App.tsx` | Neutral loader text |
| `client/src/data/README.md` | Documents that the QR references configuration and destination IDs |
| `client/src/lib/handoff.test.ts`, `routeSketch.test.ts` | **New.** 19 unit tests |
| `e2e/step2.qa.mjs` | **New.** 22-check browser suite that decodes the rendered QR image |
| `package.json`, `pnpm-lock.yaml` | `qrcode.react` 4.2.0 (supports React 19). Dev dependencies `jsqr` and `pngjs` (QA only). `qa:step2` script. |

## Running it with real phones

A phone can't open `localhost`. When the kiosk is served from the kiosk
machine itself, set its LAN address before starting the frontend:

```bash
# frontend/.env.local  (or the environment of the frontend container)
VITE_PUBLIC_BASE_URL=http://192.168.1.20      # the kiosk/server IP as phones see it
```

Phones must be on the same network (campus Wi-Fi). Without the variable, the
QR uses the page's own origin, which is correct when the kiosk is opened
through the server's LAN address or hostname via nginx.

## Known limitations (tracked)

- **Automatic arrival by BLE** (ESP32 sensors) is step 4 or later (QA-29).
- **The kiosk modal doesn't auto-close when the QR is scanned** (spec P2). Only
  the backend knows when a scan happens, so this is step 4.
- **Stops after the first** show the route from the kiosk, because routes are
  drawn from the kiosk. Stop-to-stop routing needs backend A* (QA-06).
- **Renaming a destination or building ID** invalidates QR codes already
  issued. This is documented in `data/README.md`.

## Backend handoff (for step 4)

1. Give every kiosk destination its `navigation.nodes` id (from the seed), so
   the kiosk can call `POST /navigation/routes`, then `POST /sessions`.
2. The phone then calls `POST /sessions/{id}/scan` with `qr_token`, replacing
   `resolveHandoff`. The checklist "I've arrived" maps to
   `POST /sessions/{id}/destinations/{destination_id}/reach` with
   `detection_method: "manual"`.
3. The sessions endpoints must stay **public but device-scoped** (QA-28): the
   kiosk creates sessions, and phones only hold the `qr_token`.
