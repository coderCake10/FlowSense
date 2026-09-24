# QA tracker

Source: QA walkthrough notes ("EYA LABELS" doc, QA tab). Each observation gets
an ID, a root cause traced to code, an owner step, and a status.

Status values: **Fixed** (verified by automated checks), **Planned** (assigned
to a roadmap step), and **Blocked** (waiting on the backend or the database).

## Kiosk

| ID | Observation | Root cause | Status | Step |
|---|---|---|---|---|
| QA-01 | Picking the wrong destination can't be undone; "Reset view" only resets the angle | Reset view remounts the camera only. The only clear control was an unlabeled ✕ icon. | **Fixed** | 1 |
| QA-02 | "Add to queue" shows a QR code right away instead of navigating | "Add to queue" and "Navigate" opened the same dialog, which showed a large QR tile next to "Start Navigation". The queue only held one item. | **Fixed** | 1 |
| QA-03 | The dialog overlaps "You are here" | drei `<Html>` labels default to a z-index of about 16.7M, which is above every dialog (z-50) | **Fixed** | 1 |
| QA-04 | The QR code doesn't work | It is an icon, not a generated QR code. No handoff URL exists. | **Fixed**. The QR is real and scannable (the decoded image is verified). | 2 |
| QA-05 | Only the A Building and the EYA 1st floor exist; the A Building is rough | `aBuildingNavigation.ts` uses placeholder start and route coordinates at y=0 and copies EYA's camera | Planned | 3 |
| QA-06 | The 2D navigation path needs improvement | Routes are hand-placed polylines (see `client/src/data/README.md`). Automatic routing needs backend A* plus the node and edge data. | Planned | 3–4 |

## Attraction screen

| ID | Observation | Root cause | Status | Step |
|---|---|---|---|---|
| QA-07 | The sneak peek needs to change | It is a CSS pin-and-line animation, not product footage | Planned | 3 |

## Auth

| ID | Observation | Root cause | Status | Step |
|---|---|---|---|---|
| QA-08 | No negative testing yet | Inputs were uncontrolled, and every button showed success | **Fixed** (client-side). Server-side cases are Blocked. | 1 / 4 |
| QA-09 | The demo state must be removed | Success card with "This demo state is ready to connect…" | **Fixed** | 1 |

## Mobile handoff

| ID | Observation | Root cause | Status | Step |
|---|---|---|---|---|
| QA-10 | Not connected | `MobilePage.tsx` has a hardcoded destination and steps | **Fixed**. The checklist is built from the scanned queue, with manual arrival confirmation. | 2 |

## Admin dashboard

| ID | Observation | Root cause | Status | Step |
|---|---|---|---|---|
| QA-11 | Sign-out should use a proper dialog, not a browser alert | `window.confirm` in `FlowSenseShell.tsx` | **Fixed** | 1 |
| QA-12 | Only "+ New map update" works on the dashboard | Other actions only show toasts; no data source | Blocked | 4 |
| QA-13 | Map Annotation shows a flat model | Draws placeholder boxes and never loads the GLB | Planned | 3 |
| QA-14 | Asset Management does nothing; the three tabs show the same content | Overview, Asset, and Model share one template that swaps only the heading. There is no assets API. | Blocked | 4 |
| QA-15 | User Management is not done | Hardcoded list; auth and users routes not mounted | Blocked | 4 |
| QA-16 | Analytics shows static data | Hardcoded arrays; there is no analytics API | Blocked | 4 |
| QA-17 | Generated reports don't exist | "Generate report" only shows a toast | Blocked | 4 |

## New findings raised by SQA during step 1

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-18 | Admin pages load without a session; there is no route guard on the frontend | High, once real data exists. The backend permission classes still protect the API. | **Fixed** | 4a |
| QA-19 | The login-link email points to `/login/verify?token=…`, but that route doesn't exist and `/auth/verify` also requires `email` | Medium | **Fixed**: `/auth?email=…&token=…` with automatic verify | 4a |
| QA-20 | No rate limiting on `/auth/login` or `/auth/verify`. The UI handles 429, but the backend never sends it. | High, because a 6-digit code can be brute-forced without throttling | **Fixed**: limits per IP and per email | 4a |
| QA-21 | Login emails are never sent (tasks are not `.delay()`-ed, and there is no `EMAIL_BACKEND`) | High, because it blocks sign-in | **Fixed** | 4a |

## Findings from the architecture conformance review

Details are in [the conformance review](../architecture/conformance-review.md).

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-22 | Navigate and queue behavior in the first step 1 build contradicted the kiosk spec | High | **Fixed** (step 1 revision) | 1 |
| QA-23 | Missing tables `operations.settings` and `operations.semesters`, and the `asset_audit_history` view is never created (DB-1 to DB-3) | High | **Fixed** | 4b |
| QA-24 | 23 of the spec's 24 CHECK constraints aren't enforced in the database (DB-4) | Medium | **Fixed**: all 24 enforced | 4b |
| QA-25 | Backend routes drift from the API design (prefix, `annotation` vs. `annotations`, `device` vs. `devices`, trailing slash); 6 API areas unbuilt | High | Routing **fixed** (4a); the 6 unbuilt areas are Planned | 4a / 4c+ |
| QA-26 | Kiosk P1 gaps: map can rotate (spec: fixed isometric view), no Area → Building → Floor → Destination back navigation, no Location Details sidebar | High | Deferred (needs the complete models installed locally) | later |
| QA-27 | `eya-floor-1.glb` is 57 MB without Draco compression | Medium (kiosk load time) | Deferred. The compression command is in the models guide. | later |
| QA-28 | No kiosk device authentication; session endpoints are open | Medium | Planned | 4 |

## Findings from step 2

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-29 | Automatic arrival detection over BLE (spec P1) needs ESP32 sensors and the backend; visitors confirm arrival manually for now | Medium | Planned | 4+ |
| QA-30 | The kiosk queue modal doesn't auto-close when the QR is scanned (spec P2). Only the backend can observe the scan. | Low | Planned | 4 |
| QA-31 | Phones can't open `localhost` QR links. A kiosk served locally must set `VITE_PUBLIC_BASE_URL` to its LAN address. | Medium (deployment) | Documented | 2 |

## Findings from step 3 (revised)

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-32 | Complete `.glb` models are too large for GitHub | High (blocks sharing models through the repo) | **Resolved**: models are installed per machine; `models:check` verifies them | 3 |
| QA-33 | Old models remain in git history (about 57 MB of clone size) | Low | Accepted. A history rewrite would disrupt the team. | n/a |

## Findings from step 4a

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-34 | `manage.py test` crashed: a `hardware` command named `test` shadowed Django's and printed the MQTT credentials | High (no backend tests could run) | **Fixed** | 4a |
| QA-35 | `/api/hardware/device/` was open without an admin session (no permission class, no secure default) | High (security) | **Fixed** | 4a |
| QA-36 | `POST /sessions/kiosk` without `kiosk` returned HTTP 500 | Medium | **Fixed** | 4a |
| QA-37 | Test discovery found 0 tests (`apps/` is not a package) | High | **Fixed** | 4a |
| QA-38 | With Redis down, login hung about 20 s while Celery retried | Medium | **Fixed**: fail-fast, about 6 s, still succeeds | 4a |
| QA-39 | `/auth/me` response didn't match the frontend profile type | Medium | **Fixed** | 4a |
| QA-40 | `check --deploy` flags HTTPS hardening (HSTS, SSL redirect, secure CSRF and session cookies) | Medium (production) | Planned with the HTTPS deployment | deploy |
| QA-41 | No way to create the first administrator | High (blocks use) | **Fixed**: `manage.py create_admin` | 4a |

## Findings from step 4b

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-42 | Search typo tolerance is weak for long room names (`guidanse` finds nothing); trigram similarity is measured against the whole alias | Low | Planned (use `TrigramWordSimilarity`) | Search API |
| QA-43 | EYA seed decisions to confirm: code format, "CAS" = College of Arts and Sciences, names for unnamed and "Open" rooms | Low | **Resolved**: codes `EA-101A` style; CAS confirmed; unnamed rooms are lecture or laboratory rooms | 4b |
