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
| QA-05 | Only the A Building and the EYA 1st floor exist; the A Building is rough | `aBuildingNavigation.ts` uses placeholder start and route coordinates at y=0 and copies EYA's camera | Partly fixed (9a): the A Building model is in the campus view, still preliminary. Its rooms, floors, search and annotation are Planned for 9b. | 9a / 9b |
| QA-06 | The 2D navigation path needs improvement | Routes are hand-placed polylines (see `client/src/data/README.md`). Automatic routing needs backend A* plus the node and edge data. | **Fixed** (8a/8b): routes come from backend A* over the node graph drawn in Map Annotation. Only annotated rooms have routes. | 8a / 8b |

## Attraction screen

| ID | Observation | Root cause | Status | Step |
|---|---|---|---|---|
| QA-07 | The sneak peek needs to change | It is a CSS pin-and-line animation, not product footage | **Fixed** (7b): the attract screen shows a live 3D preview of the building. | 7b |

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
| QA-13 | Map Annotation shows a flat model | Draws placeholder boxes and never loads the GLB | **Fixed** (8b): Map Annotation loads the real EYA model. | 8b |
| QA-14 | Asset Management does nothing; the three tabs show the same content | Overview, Asset, and Model share one template that swaps only the heading. There is no assets API. | **Fixed** (step 10): the Assets API is built and the page uses it: upload, checks, 3D view, activate, restore, activity. | 10 |
| QA-15 | User Management is not done | Hardcoded list; auth and users routes not mounted | **Fixed** (5b): the directory, invitations and enable/disable use the Users API. | 5b |
| QA-16 | Analytics shows static data | Hardcoded arrays; there is no analytics API | **Fixed** (6): Analytics reads the Analytics API. | 6 |
| QA-17 | Generated reports don't exist | "Generate report" only shows a toast | **Fixed** (step 11): Reports and exports generates snapshot reports, opens them as a printable page (save as PDF) and exports CSV. | 11 |

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
| QA-30 | The kiosk queue modal doesn't auto-close when the QR is scanned (spec P2). Only the backend can observe the scan. | Low | **Fixed (12c)**: the kiosk watches its QR session and says "Opened on your phone", then closes the window | 12c |
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
| QA-64 | The density level thresholds assume a 0–1 `estimated_density` | Low | Firmware received 2026-09-25: density was a mock value (0.85). **2026-09-27**: `firmware/flowsense_sensor` counts nearby Bluetooth devices and sends `min(1, count / CAPACITY)`; to be flashed and calibrated on site | 5a |

## Findings from step 6

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-65 | Reports and exports need storage for generated files (no reports table in the schema) and a PDF library (not in the stack) | Medium | **Resolved** (team decision 2026-09-26): an `analytics.reports` table stores each report as a snapshot of its figures (JSON, no files); PDF is the browser's "Save as PDF" of a printable page, CSV a ZIP built with the standard library. No new dependency. | 11 |
| QA-66 | The kiosk doesn't create search, navigation, or QR events (local search, hand-placed routes, browser-built QR link), so those analytics stay at zero from real use | High (analytics) | **Fixed (8a, 12c)**: searches and routes through their APIs (8a); each QR shown opens a QR Sessions API session and the phone reports the scan (12c) | 8a |
| QA-67 | Search-to-render time and API success rate have no data source (no client timing; no request log table) | Low | Shown as "Not collected yet" with the reason | later |

## Findings from the first run on the team's machine

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-68 | In Docker, opening the frontend on `localhost:3000` showed "We couldn't reach the sign-in service": the frontend container forwarded `/api` to `127.0.0.1:8000`, which is itself, not the backend | Medium | **Fixed**: the compose file sets `VITE_API_PROXY_TARGET=http://backend:8000`. The intended address, `http://localhost` (Nginx), was never affected. | 7 |

## Findings from step 7a

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-69 | The app loads its web fonts (IBM Plex Sans, Space Grotesk) from Google Fonts. On an offline network the kiosk falls back to system fonts. | Low | Open. Self-hosting the fonts needs the font files in the repo (or a font package), so it waits for a team decision. | later |
| QA-70 | The EYA model keeps every floor's room signs in one `SIGNS 1-6` group, so a floor view can't show just its own signs | Low | **Fixed** (model update 2026-09-26): in `CAPSTONE EYA2.blend` each floor holds its own signs; the kiosk's `byHeight` workaround is removed. | 7a, 7b |
| QA-71 | EYA model hygiene: 755 of 812 objects have `.00N` names, 397 have unapplied transforms, a stray human figure, and images linked from Downloads or temp folders | Low | The export drops the figure. The rest is with the modeling team (see the models guide, section 6). | 7a |
| QA-72 | Celery beat's runtime files (`celerybeat-schedule*`) were committed | Low | **Fixed**: untracked and git-ignored | 7a |

## Findings from step 7b

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-73 | Only the first floor has destinations and routes. Routes are still the three hand-placed demo routes; the other floors have none until Map Annotation and the Navigation API exist. | High (scope) | **Fixed (12)**: routes are generated from the model for all 97 rooms on all six floors, with stairs and the lift (`seed_eya_routes`). Map Annotation adjusts them. | 8a, 8b, 12 |
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
| QA-84 | Scanning the kiosk QR for a room from the live directory crashed the phone page ("Cannot read properties of undefined (reading '0')" in RouteSketch) | High | **Fixed**: the phone uses the built-in route for the same room code (as the kiosk does); a room with no route shows "no route sketch yet, head to <floor> and follow the room signs" instead of a sketch. Unit tests in `handoff.test.ts`; checked in a phone-sized browser for EA-305 and EA-110 | 8b |

| QA-85 | Re-running `seed_campus` reset every room's name and description to the built-in values, which would undo edits made in Map Annotation | High | **Fixed**: the seed only adds missing rooms (`get_or_create`); regression test `test_seeding_again_keeps_edited_details` | 8c |
| QA-86 | `PATCH /annotations/rooms/{id}` with a room number already used on the floor failed with a database error (500) | Medium | **Fixed**: validated in the serializer, returns 400 "EA-111 is already used on this floor."; test `test_room_number_must_be_unique_on_the_floor_and_not_blank` | 8c |
| QA-87 | The starter route to EA-110 and EA-111 ran along the east wall, and its arrows looked painted on the wall | Medium | **Fixed**: (1) the east walkway points moved from x 5.15 to x 4.5, the middle of the walkway (columns at 3.46, wall at 5.89) and of the east turnstile lane (4.01–4.83), in `seed_eya_routes` and the kiosk's built-in routes; (2) an open floor is viewed more steeply (62° instead of about 45°), so a wall in front hides about 1.4 m of floor instead of the whole 2.4 m corridor. The model isn't cut: a cutaway (walls clipped at 1.3 m) was tried and dropped because it sliced doors and windows in half. The camera turns smoothly between the two angles and keeps the visitor's heading. Also fixed: the camera now lands exactly on its goal at the end of a move (the last frame was skipped). Re-run `seed_eya_routes` to move existing starter points. `qa:step7b` 11/11, `qa:step8a` 11/11, `qa:step8b` 10/10 (twice), `qa:step8d` 8/8 | 8e |
| QA-88 | The campus view placed EYA on the Professional School's block, and the overpass at EYA's lobby | High | **Fixed**: from the team's corrected satellite view, EYA is on block `mesh1893` (between D Fajardo St and P Peralta St) with its lobby toward MacArthur Highway. The overpass crosses at Diego Silang St between the Professional School and the medical center, and the Professional School stays as a labelled neighbour. Placement re-checked on a top-down plan; `qa:step7b` 13/13 | 9a |

## Findings from system audit 1 (2026-09-26)

Details are in [the change record](../changes/audit-01-system-check.md).

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-89 | Asset Management reported "saved", "requested" and "opened" for actions that never reached a server, and said "Asset API · connected" although the Assets API isn't built | High (the page claimed work that didn't happen) | **Fixed**: banner, and every action says it isn't available yet. Connecting it waits for the Assets API (QA-14). **Superseded** by step 10: the page is connected. | audit 1 |
| QA-90 | Help: the four quick-guide buttons did nothing, and "Open PDF manual" only showed a toast | Medium | **Fixed**: the guides open with steps and a link; the PDF card says it isn't published | audit 1 |
| QA-91 | Hardware "View on map" linked to `/map-annotation?node=<id>`, but Map Annotation ignored `node` | Medium | **Fixed**: opens the node's floor and selects it; a missing node is reported | audit 1 |
| QA-92 | Handover, tech stack, roadmap, conformance review and tracker were out of date; stray empty files | Medium (misleads a new developer) | **Fixed** | audit 1 |

## Findings from step 10 (Assets API and Asset Management)

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-93 | The Asset Management spec edits floors (display and short names, navigability, kiosk visibility), spatial settings and kiosk defaults, but the schema has no display or short name columns and the API design has no floor-edit endpoint. The Building tab shows them read-only; activation sets each floor's GLB node and height from the model. | Medium | **Partly fixed (step 14)**: floors have display and short names, edited in Map Annotation (*This floor*), with `/annotations/floors`; navigability and kiosk visibility stay read-only | 14 |
| QA-94 | The kiosk's building configuration (`client/src/data/`) still names each model's floor groups and heights by hand. A live model that renames floors needs that file changed too. | Low | **Fixed for new buildings (step 14)**: a building added from the admin panel takes its floors, names and heights from the API; the bundled EYA and A keep their measured heights in code, with names from the API | 14 |
| QA-95 | The campus and A Building models aren't linked to buildings yet, so they stay the committed files | Low | Partly fixed (QA-100): the campus model is the AUF area's model in Asset Management and the kiosk loads the live one. The A Building gets its area in step 9b. | 9b |
| QA-96 | The Activity API filtered one `entity_type` at a time, so the asset history needed three requests | Low | **Fixed**: `event_type`, `action` and `entity_type` take a comma-separated list | 10 |

## Findings from step 11 (analytics reports)

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-97 | A custom analytics range ending on a plain date (`end_date=2026-09-26`) stopped at that day's midnight, so the whole last day was missing from the Analytics page's custom ranges. Django's `parse_datetime` now accepts plain dates as midnight, which bypassed the end-of-day rule. | High (wrong figures) | **Fixed**: plain dates are read as whole local days; regression test in `DateRangeTests` | 11 |
| QA-98 | The printable report showed the period in the browser's time zone, a day off from the title for viewers outside Asia/Manila | Medium | **Fixed**: the server labels the period (`period_label`); `qa:step11` runs the browser in New York time | 11 |
| QA-99 | Scheduled reports (spec P2: daily, weekly, monthly, semesterly) | Low | Planned: needs a schedules table and a Celery beat task that creates snapshots; the API refuses `schedule` with a clear message meanwhile | later |

## Findings from the team's review (2026-09-26)

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-100 | Asset Management started empty: the committed models (EYA, the campus, A) were registered only on the test server, with a manual `import_asset` command; the campus (low-fidelity area) couldn't be registered at all, because only building models were served to the kiosk | Medium | **Fixed**: `seed_assets` registers all three (EYA and the campus live), is safe to re-run, and never replaces an admin's live version; `/map/areas` serves area models, and the campus view loads the live one | review |
| QA-101 | Settings and Help & manual weren't highlighted in the admin sidebar when open | Low | **Fixed**: they use the same active style as the other links | review |
| QA-102 | Sign-in codes appear in the backend log, not in Gmail | — | Not a defect: the default email backend is the console. Real delivery is configuration (team setup guide 7.1, Gmail app password in `.env`) | review |
| QA-103 | The `step10` suite expected the old EYA model's size (16.5 MB) | Low | **Fixed**: the suite reads the committed file's size | review |
| QA-104 | The campus view didn't name the Sports and Cultural Center (SCC), the arena across the highway from EYA | Low | **Fixed**: labelled in `campus.landmarks`. Labels stay in the kiosk configuration; editing them from the admin panel would need a table and API (not in the spec). | review |
| QA-105 | The campus view had a row of trees down the middle of MacArthur Highway (they're in the team's area file, not on the road) | Low | **Fixed**: `build_campus_model.py` drops trees centred in the highway band (7 trees); `CAMPUS.glb` rebuilt, buildings unchanged | review |

## Findings from step 12 (generated routes)

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-106 | EA-207's sign (2F) is about 1 m from EA-204's, beside the same door, with no EA-207 door near it | Low | Open (modelling team): EA-204 gets the door; EA-207 routes to its sign (team decision) | 12 |
| QA-107 | An interrupted `qa:step8b` run could leave its test door behind, and the next run took it for the generated one | Low | **Fixed**: the suite takes out every EA-305 door first and restores only the generated one | 12 |
| QA-108 | Routes to upper floors said "Go to 2F" when the lift or stairs passed the second floor | Medium | **Fixed**: floors a route only passes through aren't legs ("Go to 3F") | 12 |
| QA-109 | Routes went through the elevator (its car is hollow in the model) | High | **Fixed (12b)**: the lift's footprint is blocked; the lift point is in front of its doors | 12b |
| QA-110 | Routes were longer than needed: they followed corridor centre lines, then cut across to doors | High | **Fixed (12b)**: sight lines between corners; first-floor routes at most 1.07× the grid walk | 12b |
| QA-111 | On a multi-floor route the kiosk showed "Go to 3F" and nothing after it | High | **Fixed (12b)**: step bar with the floor's instruction, Next and Back; the marker and phone name the ride (elevator or stairs) | 12b |
| QA-112 | Map Annotation points couldn't be moved, only deleted | Medium | **Fixed (12b)**: drag with Select; `PATCH /annotations/nodes/{id}` (addition to the API design) | 12b |
| QA-113 | Upper-floor routes always take the elevator (it's beside the kiosk) | — | **Decided (2026-09-27)**: routes stay with A*; an elevator under maintenance is switched off in Map Annotation and routes take the stairs (QA-116) | 12c |
| QA-114 | Map Annotation couldn't delete a connection on its own, only a point with all its connections | Medium | **Fixed (12b)**: click a line with Delete, or Remove in *Selected point* | 12b |
| QA-115 | "Follow on this kiosk" only closed the queue window; the map showed the first floor and stopped | Medium | **Fixed (12c)**: the kiosk plays the route floor by floor, animated, and loops; Pause and Play | 12c |
| QA-116 | No way for admins to mark an elevator or stairs out of service | Medium | **Fixed (12c)**: switches in Map Annotation; routes go another way and say why | 12c |
| QA-117 | The iPad couldn't open the kiosk ("the server stopped responding") | Medium (deployment) | Documented: team setup guide 11.2a (firewall, network profile, Docker block rules, Docker Desktop vs WSL) | 12c |
| QA-118 | A kiosk deleted on the Hardware page never came back, even when its iPad reconnected (same ID; deleted devices are ignored), and there was no way to restore it | Medium | **Fixed (12c)**: Deleted status filter and Restore (Register again); the kiosk's attract screen says it was deleted | 12c |
| QA-119 | The Hardware page showed only the first 100 devices; new unregistered devices (unnamed, sorted last) could be hidden | Medium | **Fixed (12c)**: the page reads every page of the registry | 12c |
| QA-120 | `qa:step5b` still expected 92 rooms after step 12 added five | Low | **Fixed (12c)**: 97 | 12c |

## Findings from step 13 (the A Building)

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-121 | The A Building, live in Asset Management, showed only in the campus view: not in the kiosk's building list or Map Annotation (no configuration, no area, rooms or routes) | High | **Fixed**: A configuration, 48 rooms, routes inside A and from the EYA kiosk over the overpass | 13 |
| QA-122 | A live model couldn't be taken offline | Medium | **Fixed**: Take offline (`POST /assets/{id}/deactivate`, additive) | 13 |
| QA-123 | `seed_assets` would make a committed model live again after an admin took it offline or replaced it with another asset | Medium | **Fixed**: it leaves those offline | 13 |
| QA-124 | A-401 (MIS Service) and A-412 (Rehearsal Room) are in the document but have no sign in the A model | Low | Open (modelling team, or place their doors in Map Annotation) | 13 |
| QA-125 | On the A Building's fourth floor the back stairs arrive on the auditorium's side of the corridor | Low | Open (by design of the model?): the other stairs serve the floor | 13 |
| QA-126 | Activation sets each floor's height to the model's lowest point there, which for A is below the slab (4F: 6.88 m, a door modelled a floor down) | Low | Mitigated: the kiosk and Map Annotation use the configured walking heights | 13 |
| QA-127 | `qa:step8b` A12 could read the elevator's links before the switch's saves finished | Low | **Fixed**: the suite waits for them | 13 |
| QA-128 | The dashboard counted the campus walkways' level as a floor | Low | **Fixed**: buildings' floors only | 13 |
| QA-129 | Names differ between the A signs and the document: "University Register" (sign) vs Registrar; "Campus Facilities Development Office" beside A-304 (sign) vs "Campus Faculty Development Office" (document); CDFO in A-301 (document) | Low | Open (team to confirm); the seed uses the document, editable in Map Annotation | 13 |
| QA-130 | The handover firmware sent one fixed reading right after connecting and then nothing (the board would show Offline after 90 s), with a numeric `device_id` (1) on a `test` topic, and Wi-Fi and MQTT passwords in the sketch | Medium | **Fixed in code, not yet on a board**: `firmware/flowsense_sensor` sends every 10 s with a text ID on `flowsense/sensors/eya/lobby`, reconnects, and keeps logins in an ignored `secrets.h` | 13 |
| QA-131 | Tapping the A Building in the kiosk's campus view didn't open it (a tap there opened the building picked in the list) | Medium | **Fixed**: its name is a button, and tapping its model opens it too | 13b |
| QA-132 | Map Annotation drew the entrance point purple, like the "linked to another floor" ring, with no legend entry or tool to place one | Low | **Fixed**: **Entrance** tool, legend entry, teal | 13b |
| QA-133 | The committed A model, linked to the EYA Building by hand, failed validation (EYA's 6 floors) and `seed_assets` left it there | Medium | **Fixed**: `seed_assets` moves a committed model that isn't live back to its own building, validates it again, and makes it live | 13b |

## Findings from step 14 (campus editing)

| ID | Finding | Severity | Status | Step |
|---|---|---|---|---|
| QA-134 | The campus (buildings' placement, labels, the walk between buildings) and new buildings could only be changed in code and seed files | Medium | **Fixed**: Map Annotation's Campus view and Add building; the kiosk reads them from the API | 14 |
| QA-135 | Clicks in the Campus view landed on a hidden plane, then on roofs, so points and buildings were placed at the wrong height | Medium | **Fixed** before release: clicks land on the ground or the overpass deck | 14 |
| QA-136 | Tapping the A Building's model (not its name) in the kiosk's campus view opened the EYA Building: the map's own tap ran first | Medium | **Fixed**: the map's tap waits for a building tap | 14 |
| QA-137 | Kiosk search only covered the building picked in the list: from EYA, A Building rooms couldn't be found | High | **Fixed**: search covers every building; results from another building say which, and route from the kiosk across | 14 |

