# Step 1: Kiosk flow, label overlap, auth validation, and sign-out dialog

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Resolves | QA-01, QA-02, QA-03, QA-08 (client side), QA-09, QA-11 |
| Scope | Frontend only (`frontend/`). No backend or database changes. |
| Evidence | [Step 1 test report](../qa/step-01-test-report.md) |

## Summary

- **Kiosk.** "Add to queue" only adds to a real multi-stop queue. "Navigate"
  activates the queue and opens the destination-queue modal with the stops and
  the QR panel, as the architecture notes specify. A labeled "Change
  destination" button replaces the unlabeled ✕.
- **Map labels** no longer draw on top of dialogs.
- **Admin sign-in** validates input and calls the real API. The demo success
  state is gone.
- **Sign-out** uses an in-app confirmation dialog instead of the browser's
  `confirm()` alert.

## Changes by observation

### QA-01: Recovering from a wrong destination

**Before.** The only way to clear a pick was a small ✕ icon with no label.
Visitors reached for "Reset view", which only resets the camera.

**After.** A **Change destination** button, labeled and with an icon, is
visible both in route preview and during navigation. It clears the
selection, ends any active route, and moves focus to the search box so the
visitor can pick again right away.

### QA-02: Queue vs. navigate

**Before.** "Add to queue" opened the queue dialog and showed the QR code right
away. The queue held only one destination.

**Spec.** From `architecture-notes-main/04 Application/00 Kiosk/02 Interactive 3D Map.md`:
Navigate "activates the destination queue… if the queue is empty and a
destination is selected… it will set that destination as the only part of the
queue and begin navigation". The Destination Queue is "a modal that opens…
once the navigate button is pressed, lists the navigation instructions and
presents a QR code". Your QA note says the same: showing the QR code is
Navigate's job, not Add to queue's.

> **Revision note.** The first version of step 1 made Navigate start the route
> with no modal and put the QR code behind a "Send to my phone" button. That
> contradicted the spec and was corrected during the architecture review (see
> [architecture conformance review](../architecture/conformance-review.md)).
> The behavior below is the corrected one.

**After.**

| Control | Behavior |
|---|---|
| **Add to queue** | Only adds. It appends the destination to an ordered, duplicate-free queue, shows a toast, and switches to a disabled "In queue" state. The sidebar tags the room "In queue". No modal or QR opens. |
| **Navigate** | Activates the queue (`activateQueue`): an empty queue becomes just the selection, and a selection that isn't queued yet is appended. It starts the first stop on the map and opens the **Destination queue** modal. Navigate is also shown when nothing is selected but the queue has stops. |
| **Destination queue modal** | Lists the stops in order. The current one is highlighted as "Navigating now"; the others have **Go** and **Remove**. Next to the list is the **Continue on your phone** QR panel (a placeholder until step 2, QA-04), plus **Follow on this kiosk** to close. |
| **Queue (n)** | Reopens the modal at any time. |
| **Next stop · CODE** | Shown during navigation when another stop is queued. Moves to that stop and drops the finished one. |
| **End route**, or removing the current stop | Ends that route and removes it from the queue. |

Switching buildings clears the queue, because queued destinations belong to a
building's model.

### QA-03: Dialog overlapping "You are here"

**Cause.** drei's `<Html>` renders labels as DOM elements with a z-index range
of 16,777,271 to 0, which is far above the dialog layer (Tailwind `z-50`).

**Fix.** Labels and the loading indicator use `zIndexRange={[10, 0]}`
(`LABEL_Z_RANGE`). The map's own overlay controls ("Reset view", the gesture
hint) are raised to `z-20` so labels can't cover them either.

### QA-08 and QA-09: Auth negative testing and the demo state

**Before.** The inputs ignored what was typed, and every button showed a
"Check your inbox" card that mentioned a "demo state". An empty email or any
code "succeeded".

**After.** There is a two-step flow that matches the backend contract in
`backend/django/apps/authentication`:

1. **Email step.** The client rejects an empty address, a malformed address,
   and any domain other than `@auf.edu.ph` or its subdomains. The address is
   trimmed and lowercased, then sent to `POST {API}/auth/login`.
2. **Code step.** The field accepts digits only (up to 6) and has
   `autocomplete="one-time-code"`. The client rejects codes that are too
   short. The request is `POST {API}/auth/verify` with body `{ email, token }`.
   On success, the page redirects to the dashboard.

| Condition | Message shown |
|---|---|
| API not configured (`VITE_API_BASE_URL` unset) | "The sign-in service is not connected…" (no fake success) |
| 400/401/403 on verify | "That code is incorrect or has expired…" |
| 429 | "Too many attempts. Wait a few minutes, then try again." |
| Network or 5xx | "We couldn't reach the sign-in service…" |

After an email is submitted, the copy always reads "If an administrator
account exists for …", so the UI never reveals which emails are real admins.
This matches the backend's anti-enumeration design. "Send a new code" re-sends
and confirms with a toast. Fields use `aria-invalid` and
`aria-describedby`, and errors are announced through `role="alert"`.

### QA-11: Sign-out confirmation

`window.confirm` is replaced with the project's existing `AlertDialog`
component ("Stay signed in" / "Sign out"). While `POST /auth/logout` is in
flight, the dialog stays open and shows "Signing out…", and both buttons are
disabled. The app then returns to `/auth` whether or not the API was
reachable, which is the same fallback behavior as before.

## Files changed

| File | Change |
|---|---|
| `frontend/client/src/pages/experience/KioskPage.tsx` | Rebuilt the action bar and queue dialog; added queue state, the Change destination control, and next-stop handling |
| `frontend/client/src/components/BuildingFloorMap.tsx` | `LABEL_Z_RANGE` on both `<Html>` elements; `z-20` on the map controls |
| `frontend/client/src/pages/experience/AuthPage.tsx` | Rewritten: validated two-step flow against the real API; demo state and unused mock data removed |
| `frontend/client/src/components/FlowSenseShell.tsx` | `AlertDialog` sign-out confirmation with an in-flight state |
| `frontend/client/src/lib/api.ts` | New `ApiError` (extends `Error`, adds `status`). Existing callers are unaffected. |
| `frontend/client/src/lib/authValidation.ts` | **New.** Pure email and OTP validation rules |
| `frontend/client/src/lib/kioskQueue.ts` | **New.** Pure queue operations (add, remove, next stop, activate on Navigate) |
| `frontend/client/src/lib/*.test.ts` | **New.** 27 unit tests |
| `frontend/e2e/step1.qa.mjs` | **New.** 36-check Playwright browser QA suite |
| `frontend/package.json`, `pnpm-lock.yaml` | Added `test` and `qa:step1` scripts and the `playwright` dev dependency |
| `frontend/eslint.config.js` | Node and browser globals for `e2e/**/*.mjs` |
| `frontend/.gitignore` | Ignore `e2e/output/` screenshots |

## Known limitations (intentional; tracked)

- The QR panel is still a placeholder (QA-04, step 2).
- Real sign-in can't complete until the backend handoff items below are done.
  Until then, the auth page correctly reports that the service is not
  connected.
- The login-link half of the emailed challenge isn't handled by the frontend
  yet (QA-19).

## Backend handoff (database / backend specialist)

Found while wiring the auth flow. These block real sign-in and belong to step 4.

1. **Mount the auth routes.** `config/urls.py` doesn't include
   `authentication.urls`, so every `/auth/*` call returns 404.
2. **Unify the API prefix.** The frontend calls `{VITE_API_BASE_URL}/auth/login`
   with `VITE_API_BASE_URL=/api/v1`. The backend mounts most apps under `/api/…`
   (no `v1`), and only sessions under `/api/v1/…`. Choose `/api/v1/` everywhere
   and settle the trailing-slash rule. Django's `APPEND_SLASH` can't redirect a
   POST, so either the frontend adds a trailing `/` or the routes accept both.
3. **Send the emails** (QA-21). Call `send_login_challenge_email.delay(...)` from
   `services._send_login_challenge_email()`, and configure `EMAIL_BACKEND`
   (the console backend is fine for local development).
4. **Throttle auth** (QA-20). Add a `REST_FRAMEWORK` block with
   `ScopedRateThrottle` on login and verify (for example, 5/min per IP and
   email). The UI already handles 429.
5. **Fix the login link** (QA-19). Either include the email in the link or look
   login-link tokens up by hash alone (they are 32 random bytes, so they are
   unique), and have the frontend handle the `/auth?token=…` route.
6. **Guard the admin routes** (QA-18). Once the auth endpoints are live, the
   admin shell should call `GET /auth/session` and redirect to `/auth` on 401.
