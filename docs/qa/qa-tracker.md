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
| QA-26 | Kiosk P1 gaps: map can rotate (spec: fixed isometric view), no Area → Building → Floor → Destination back navigation, no Location Details sidebar | High | **Partly fixed (7b)**: the view angle is locked (isometric), though visitors can still turn around the building. Building ↔ floor navigation works: tap to open, floor buttons, whole-building button. Still open: the Area level (one building so far) and the Location Details sidebar. | 7b |
| QA-27 | `eya-floor-1.glb` is 57 MB without Draco compression | Medium (kiosk load time) | **Fixed**: the complete EYA model ships as a 16.5 MB Draco `.glb` (2048 px textures), with the decoder served by the app | 7a |
| QA-28 | No kiosk device authentication; session endpoints are open | Medium | Planned: the contract's `KioskDeviceToken` (device credential exchange). The kiosk heartbeat (5c) identifies kiosks by ID only; close this before the handover. | handover |

## Findings from step 2

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-29 | Automatic arrival detection over BLE (spec P1) needs ESP32 sensors and the backend; visitors confirm arrival manually for now | Medium | Planned | 4+ |
| QA-30 | The kiosk queue modal doesn't auto-close when the QR is scanned (spec P2). Only the backend can observe the scan. | Low | Planned | 4 |
| QA-31 | Phones can't open `localhost` QR links. A kiosk served locally must set `VITE_PUBLIC_BASE_URL` to its LAN address. | Medium (deployment) | Documented | 2 |

## Findings from step 3 (revised)

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-32 | Complete `.glb` models are too large for GitHub | High (blocks sharing models through the repo) | **Resolved**: models were installed per machine (3); since 7a the compressed kiosk models (16.5 MB) are committed, and the `.blend` sources stay on Drive | 3, 7a |
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

## Findings from the hardware pipeline run

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-44 | The committed Mosquitto `passwd` rejected the documented backend login (`flowsense_backend` / `backend`) | High (the consumer can't connect) | **Fixed** | 4 follow-up |
| QA-45 | A registered sensor's readings were never stored (the sensor lookup used the ESP32 ID against the numeric FK, and the topic check compared the zone to the area name) | High | **Fixed** | 4 follow-up |
| QA-46 | Registration didn't save `map_node_id` (typo `map_node_Id`) | Medium | **Fixed** | 4 follow-up |
| QA-47 | The device list had no `id` (needed to register), and `last_ping` was always empty | Medium | **Fixed** | 4 follow-up |
| QA-48 | Telemetry didn't update health timestamps and failed without `observed_at` | Medium | **Fixed** | 4 follow-up |
| QA-49 | No screen for registering devices (the Hardware page is mock; the Django admin has no hardware models) | Medium | **Fixed**: the Hardware page registers, edits, enables/disables, and deletes devices | 5b |
| QA-50 | Manifest `start_url` is `/mobile`, so "Add to Home Screen" on the kiosk iPad opens the phone page | Low | Planned (use Safari + Guided Access for now) | 4c |
| QA-51 | The kiosk iPad isn't linked to the admin dashboard (no kiosk registration or heartbeat from the kiosk screen; device auth QA-28) | Medium | **Fixed**: heartbeat, registration on the Hardware page, and visitor sessions. Device auth remains QA-28. | 5c |
| QA-52 | `.env.example` mixed `KEY = value` spacing | Low | **Fixed** | 4 follow-up |

## Findings from the stack audit (2026-09-24)

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-53 | Libraries and tools were added that aren't in the tech stack notes, without the team's confirmation (`qrcode.react`, test tools, paho-mqtt 2.x, Arduino libraries in the guide, iPad kiosk) | Medium (process) | **Resolved**: each one decided by the team and recorded in the conformance review | 4 follow-up |
| QA-54 | Settings and Semesters were in a separate `configuration` app; the API design places them under `common` | Low | **Fixed**: moved to `common`, and the migration keeps existing data | 4 follow-up |
| QA-55 | Production containers run development servers (`runserver`, `npm run dev`) | High (production) | Deferred by the team (2026-09-25): development continues on `runserver`; the application server is decided before handover | Production |
| QA-56 | A real-looking `EMAIL_HOST_PASSWORD` was committed to `.env.example` in the **public** coderCake10/FlowSense repo (commit `d6f0c25`) | **Critical (security)** | **Resolved** (2026-09-25): the owner revoked the App Password, created a new one kept only in `.env`, and replaced the value in `.env.example` with a placeholder | now |

## Findings from step 5a

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-57 | `DELETE /hardware/devices/{id}` permanently deleted the row; `PUT` could overwrite any field | High | **Fixed**: soft delete (decommission); `PUT` returns 405 | 5a |
| QA-58 | Registration left devices in `registered`, which the registry never displays | Medium | **Fixed** | 5a |
| QA-59 | Disabled devices' readings were stored | Medium | **Fixed** | 5a |
| QA-60 | Kiosks discovered over MQTT got no `kiosks` row | Low | **Fixed** | 5a |
| QA-61 | The OpenAPI contract's `{success, data, meta}` envelope doesn't match any implemented endpoint | Medium (consistency) | **Resolved** (team: follow the docs): every endpoint uses the contract's envelope and pagination | 5c |
| QA-62 | No API design endpoint lets a kiosk announce itself or report that it's online | Medium | **Resolved**: approved `POST /hardware/kiosks/heartbeat`; kiosks register on the Hardware page, show online/offline, and record visitor sessions | 5c |
| QA-63 | Ping and Restart need a firmware command topic (not in the IoT notes) | Low | Firmware received 2026-09-25: it publishes only and subscribes to no command topic, so Ping and Restart stay 501 | 5a |
| QA-64 | The density level thresholds assume a 0–1 `estimated_density` | Low | Firmware received 2026-09-25: density is still a mock value (0.85, within 0–1); waiting on the real calculation | 5a |

## Findings from step 6

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-65 | Reports and exports need storage for generated files (no reports table in the schema) and a PDF library (not in the stack) | Medium | **Needs a team decision** | 6 |
| QA-66 | The kiosk doesn't create search, navigation, or QR events (local search, hand-placed routes, browser-built QR link), so those analytics stay at zero from real use | High (analytics) | **Partly fixed (8a)**: the kiosk searches through the Search API, where each search is logged, and gets routes from the Navigation API, where each route is logged. Still open: the QR handoff uses the browser-built link, not the QR Session API. | 8a |
| QA-67 | Search-to-render time and API success rate have no data source (no client timing; no request log table) | Low | Shown as "Not collected yet" with the reason | later |

## Findings from the first run on the team's machine

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-68 | In Docker, opening the frontend on `localhost:3000` showed "We couldn't reach the sign-in service": the frontend container forwarded `/api` to `127.0.0.1:8000`, which is itself, not the backend | Medium | **Fixed**: the compose file sets `VITE_API_PROXY_TARGET=http://backend:8000`. The intended address, `http://localhost` (Nginx), was never affected. | 7 |

## Findings from step 7a

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-69 | The app loads its web fonts (IBM Plex Sans, Space Grotesk) from Google Fonts. On an offline network the kiosk falls back to system fonts. | Low | Open. Self-hosting the fonts needs the font files in the repo (or a font package), so it waits for a team decision. | later |
| QA-70 | The EYA model keeps every floor's room signs in one `SIGNS 1-6` group, so a floor view can't show just its own signs | Low | **Fixed (7b)**: each sign follows the floor at its height (`byHeight`). Moving the signs in Blender is still preferred. | 7a, 7b |
| QA-71 | EYA model hygiene: 755 of 812 objects have `.00N` names, 397 have unapplied transforms, a stray human figure, and images linked from Downloads or temp folders | Low | The export drops the figure. The rest is with the modeling team (see the models guide, section 6). | 7a |
| QA-72 | Celery beat's runtime files (`celerybeat-schedule*`) were committed | Low | **Fixed**: untracked and git-ignored | 7a |

## Findings from step 7b

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-73 | Only the first floor has destinations and routes. Routes are still the three hand-placed demo routes; the other floors have none until Map Annotation and the Navigation API exist. | High (scope) | **Tooling done (8b)**: all 92 rooms are searchable (8a), Map Annotation places doors, corridors, kiosks and stairs on the real model, and multi-floor routes work end to end. Still open: annotating floors 1–6 (team task; see docs/setup/map-annotation.md). | 8a, 8b |
| QA-74 | Rendering speed on the iPad is unverified. The development browser renders in software (about one frame every 2 s for the whole building), so smoothness can only be judged on the device. | Medium | Open. Mitigations are in: the map draws only when something moves; animations are time-based; the attract preview uses 1× pixel density. Check on the iPad before the defense. | 7b |

## Findings from step 8a

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-75 | The attract screen jumped to the kiosk after 15 s without a tap | Medium | **Fixed**: it stays until a visitor taps; the preview loops | 8a |
| QA-76 | The API contract gave the kiosk no way to find a room's navigation node or its own origin node, so it couldn't request a route | High | **Fixed with two additive fields** (documented in the OpenAPI file): `node_id` on rooms (`GET /map/rooms`, `GET /search`) and `map_node_id` in the kiosk heartbeat reply | 8a |
| QA-77 | Searches for loose terms return many weak matches (e.g. "computer studies" also matches "Studio" rooms) | Low | The kiosk shows the top 20, best first. The matching thresholds are the Search API's (`search/services.py`). | later |

## Findings from step 8b

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-78 | GeoJSON input was reprojected from WGS84: GEOS reads GeoJSON as EPSG:4326, so metre coordinates were stored as if they were longitude/latitude (about 500 km off). This affected every geometry written through the API. | **Critical (data)** | **Fixed**: input uses the column's SRID (3857) unless it names a CRS, as the contract says; regression tests added | 8b |
| QA-79 | The Admin notes say room nodes snap to door objects in the model; doors are placed by clicking instead | Low | Open: needs door objects named by room (e.g. `Door_EA-101A`, QA-71) | later |
| QA-80 | The OpenAPI node input uses `floor_id`/`room_id`; the implemented API uses `floor`/`room` | Low (contract) | Open: the page follows the implementation; align the contract or the serializer | later |
| QA-81 | The Map Annotation page was a mock (hard-coded boxes and devices) | High | **Fixed**: rewritten on the real model and the Annotation API | 8b |
| QA-82 | On a one-floor route the destination marker read "Go to 1F" instead of the room code (legs compared by object identity, rebuilt each render) | Medium | **Fixed**: legs matched by floor; `qa:step7b` B4b and `qa:step8a` L7b check it | 8b |
| QA-83 | Without `seed_eya_routes`, the live kiosk lost the three original first-floor routes | Medium | **Fixed**: when the map has no route for a room, the kiosk uses its built-in hand-placed route for that room code, if one exists | 8b |

