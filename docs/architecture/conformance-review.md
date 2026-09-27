# Architecture conformance review

| | |
|---|---|
| Reference | `architecture-notes-main/` in `wendy-calma/capstone-flowsense` (requirements, system architecture, app specs, **06 Database/01 Final Database Schema**, **07 API/00 API Design**) |
| Compared against | First review: `coderCake10/FlowSense` `main` (`856ffc8`) plus step 1. **Refreshed 2026-09-26** against `main` after step 9a (`249a5be`). |
| Method | Every Django model was extracted and diffed table by table against the SQL schema. Every mounted route and router registration was compared with the API design, and so was the frontend `endpointMap` (`client/src/lib/api.ts`). App-level specs were checked against the running UI. |

## Verdict

- **Database: fully conformant after step 4b.** At the first review, 33 of
  the spec's 35 tables existed as models; two tables, one view, and 23 of the
  24 `CHECK` constraints were missing. Step 4b added all of them.
- **API: all 14 areas are built.** At the first review the backend used
  different prefixes and names, left auth and users unmounted, and had no
  implementation for 6 areas. **Decision: the API design doc is the contract,
  and the backend is brought to it.** Steps 4a to 11 did that. Every
  endpoint of the API design is built; the deviations are listed below.
- **Kiosk UI.** The Navigate and queue flow matches the spec (step 1). The
  view is isometric and floors open from the model (7b); search and routes
  come from the API (8a). Still missing from P1: the Location Details
  sidebar and the Area level (section 4).

## 1. Database (`06 Database/01 Final Database Schema.md`)

### Matches

Schemas `campus`, `navigation`, `assets`, `hardware`, `operations`, and
`analytics` are all created by migrations, along with `postgis` and `pg_trgm`.
These tables match the spec in name, columns, and types:

- **campus:** areas, floors, rooms, personnel, room_personnel, entrances,
  stairs, elevators, outdoor_walkways
- **navigation:** nodes (PointZ), edges (LineStringZ), floor_transitions
- **hardware:** devices, kiosks, sensors, sensor_observations
- **operations:** admin_users, auth_challenges, admin_sessions,
  navigation_sessions, alerts
- **analytics:** kiosk_sessions, navigation_requests, navigation_destinations,
  search_events, qr_events, audit_events, hourly_kiosk_statistics,
  sensor_statistics
- **assets:** assets, asset_versions, validation_runs, validation_checks

Unique constraints `uq_floor_order`, `uq_room_code_per_floor`,
`(asset_id, version)`, and `chk_edge_nodes_different` are present. Spatial
GiST indexes are created automatically by GeoDjango.

### Deviations

| # | Spec | Current | Impact | Fix (step 4) |
|---|---|---|---|---|
| DB-1 | `operations.settings` (plus a seed row `informational_alert_clear_time`) | ✓ **Fixed in 4b**, seeded. Owned by `common`, per the API design's "common/settings" (moved from a separate `configuration` app on 2026-09-24). Was: no model and no table. | The Settings API and alert auto-clear can't work | Add a model and migration, seed the row in a data migration |
| DB-2 | `operations.semesters` | ✓ **Fixed in 4b**, with the date-range CHECK. Was: no model and no table. | The Settings → Semesters API can't work; analytics can't group by semester | Add a model and migration with `CHECK (start_date <= end_date)` |
| DB-3 | `assets.asset_audit_history` view | ✓ **Fixed in 4b** (migration creates it). Was: an unmanaged model, but no migration created the view. | Any query on it fails with "relation does not exist" | `RunSQL` with `CREATE VIEW` (and a reverse `DROP VIEW`) |
| DB-4 | 24 `CHECK` constraints (area_type, room_type, node_type, direction, device status, roles, and more) | ✓ **Fixed in 4b**: all 24 enforced by PostgreSQL. Was: only `chk_edge_nodes_different`. | Raw SQL, the MQTT consumer, or seed scripts can write invalid values | Add `CheckConstraint`s in a migration |
| DB-5 | `idx_rooms_search` GIN full-text index | ✓ **Fixed in 4b**. Was: missing. | Search does a full scan (fine at current scale) | `GinIndex(SearchVector(...))` or `RunSQL` |
| DB-6 | Composite primary keys on room_personnel, hourly_kiosk_statistics, and sensor_statistics | A surrogate `id` plus a `UniqueConstraint` on the same columns | None functionally. This is a deliberate, documented Django trade-off. | Keep; note it in the schema doc |
| DB-8 | No table for generated reports | ✓ **Added in step 11** (team decision on QA-65): `analytics.reports` with CHECKs on status, format and period. An addition to the spec's schema; nothing existing changed. | Reports work | Add it to `06 Database/01 Final Database Schema.md` |
| DB-7 | `mac_address MACADDR`, UUID `DEFAULT gen_random_uuid()` | `VARCHAR`, and UUIDs generated in the app with `uuid4` | Low. Only matters for raw SQL inserts. | Optional |

### Errors in the spec (fix in the notes)

- The `operations.alerts.alert_type` CHECK repeats the severity values
  (`informational`/`warning`/`critical`). It should list real alert types.
- The API doc's table lists have typos: `navigation.floor_transactions`,
  `analytics.kiosk_sesions`, `analytics.kiosk_hourly_statistics`, and
  `assets.asset_version`.
- The Settings API's table list names `admin_users` and `auth_challenges`. It
  should be `operations.settings` and `operations.semesters`.

## 2. API (`07 API/00 API Design.md`)

| API area | Spec base | Backend today | Frontend `endpointMap` | Gap |
|---|---|---|---|---|
| Authentication | `/api/v1/auth/*` | ✓ Mounted and hardened (4a) | ✓ spec | None |
| Users | `/api/v1/users` | ✓ Mounted (4a) | ✓ spec | None |
| Map | `/api/v1/map/*` | ✓ (4a). Additive (step 14): `placement` and `map_settings` on areas (PATCH moves a building's points), `display_name` and `short_name` on floors | ✓ spec | None |
| Navigation | `/api/v1/navigation/*` | ✓ (4a). Additive (step 12b): `floor_changes` on each route segment (the stairs or lift rides, so directions can name them); (step 12c) `notices` on a route (stairs or elevators out of service); (step 13) `stops` on each segment (each point's building and floor, for routes between buildings) | ✓ spec | None |
| Search | `/api/v1/search` | ✓ (4a) | ✓ spec | None |
| Navigation, QR, and kiosk sessions | `/api/v1/sessions/*` | ✓ Implemented and correctly prefixed | ✓ spec | None |
| Annotation | `/api/v1/annotations/*` | ✓ Renamed (4a). Addition (step 12b): `PATCH /annotations/nodes/{id}` moves a point (position, optionally name) and redraws its connections; the spec has no node update, and Map Annotation's drag needs one. Additions (step 14): `/annotations/labels`, `/annotations/floors`, `/annotations/rooms/new`, `/annotations/rooms/{id}/remove`, `/annotations/buildings` (campus editing, adding buildings) | ✓ spec (plural) | Add the PATCH row to the API design |
| Hardware | `/api/v1/hardware/devices…`, `kiosks`, `sensors`, `commands` | ✓ Devices (list, detail, `/{id}/register`, `/{id}/commands/{command}`, `/{id}/observations`, `/{id}/statistics`), kiosks, sensors (5a), and `POST /hardware/kiosks/heartbeat` (5c, approved addition) | ✓ spec. The page calls `/devices/{id}/register`; the old `endpointMap.hardware.register` entry is unused. | None |
| Assets | `/api/v1/assets/*` (16 endpoints) | ✓ All 16 (step 10). Additive: `version_id` on activate, `structure` on version detail, `model` on map areas, (step 13) `POST /assets/{id}/deactivate` (Take offline) | ✓ spec | None |
| Analytics | `/api/v1/analytics/*` (13) | ✓ All 13: overview, dashboard, navigation, search, kiosks, sensors, spatial, system, activity, QR and QR events (step 6); reports (step 11). Deviation: `GET /reports/{id}` returns the snapshot as JSON (the admin app prints it to PDF) or `?download=csv` as a ZIP, not a server-made PDF | ✓ spec | None |
| Alerts | `/api/v1/alerts/*` (4) | ✓ (5a), with acknowledge and clear | ✓ spec | None |
| Activity | `/api/v1/activity/*` (2) | ✓ (5a) | ✓ spec | None |
| Settings | `/api/v1/settings/*` (8) | ✓ (5a), in `common/settings`, including semesters | ✓ spec | None |
| System | `/api/v1/system/status`, `/health` | ✓ (5a), in `common/system` | ✓ spec | None |

These cut across every area:

- **Trailing slash.** ✓ Optional for all `/api/` paths
  (`ApiTrailingSlashMiddleware`, 4a).
- **Spec typo.** `POST /annotations/nodes/{id}` should be
  `POST /annotations/nodes`.
- **Module paths.** ✓ `config/urls.py` includes apps by their own names (4a).

## 3. Authentication (`02 System Architecture/07 Authentication.md`)

| Spec | Status |
|---|---|
| Passwordless admin login with OTP and/or login link | ✓ Both, end to end: emails sent, link sign-in, rate limited (4a) |
| Short-lived, single-use tokens | ✓ Backend (10-minute TTL, hashed, consumed on use) |
| Backend rejects unauthenticated admin requests | ✓ Admin-only by default with real 401s (4a) |
| **Kiosk device authentication** (per-kiosk credentials leading to short-lived kiosk tokens; no credentials stored in React) | **Not implemented.** The API is admin-only by default (4a), and the kiosk-facing endpoints (search, sessions, QR, kiosk heartbeat) opt out with `AllowAny`. Kiosks identify themselves by device ID in the heartbeat (5c); the contract's `KioskDeviceToken` exchange is still to be built. |
| ESP32 per-device MQTT credentials | Partly done. There is a Mosquitto password file; registry checks happen in the consumer. |
| "Temporary development-only username/password" login allowed | Not needed: the console email backend prints the code locally (4a) |

## 4. Kiosk application (`04 Application/00 Kiosk/02 Interactive 3D Map.md`)

| Spec item | Priority | Status |
|---|---|---|
| Navigate activates the queue; the queue modal lists instructions and shows the QR | P1 | ✓ Step 1 (corrected); real, scannable QR in step 2 |
| Add to queue button | P1 | ✓ Step 1 |
| Shortest path shown when a destination is selected | P1 | ✓ Step 8a/8b: routes come from the backend's A* over the annotated node graph (`navigation/services.py`). Rooms not yet annotated say so. |
| **Non-rotatable isometric view** | P1 | ✓ Step 7b: the angle from above is locked. Visitors can still turn around the building. |
| **Back button through the view hierarchy Area → Building → Floor → Destination** | P1 | Partial. Campus → building → floor works through the Campus, Whole building and floor buttons (7b, 9a). There is no Area level yet (QA-26). |
| **Location Details right sidebar** (code, alias, description, personnel and contacts, office hours, image, sticky Add to queue) | P1 | ✗ Only a bottom bar with name, code, floor and route status (QA-26) |
| Search by room code, alias, **personnel, or building name** | P1 | Partial. The kiosk uses `GET /search` (8a), which matches room code, alias, description and personnel. Building names aren't searched. |
| List of locations grouped by building, then floor | P1 | ✓ Grouped by floor for the live building (8a) |
| Area selection dropdown | P1 | ✓ |
| Top bar: app name, building and kiosk name, **current time** | P2 | Partial. No time. |
| Exterior-shell reveal animation; floor focus with fading | P2 | ✓ Step 7b: the exterior and the floors above lift away |
| Queue modal auto-closes on idle or on QR scan | P2 | ✗ Needs the backend scan event (QA-30) |

## 4b. Mobile handoff (`04 Application/01 Mobile Handoff`)

| Spec item | Priority | Status |
|---|---|---|
| Navigation checklist of instruction cards | P1 | ✓ Step 2: ordered stop cards with a top-down route sketch |
| Dynamic update on BLE detection from ESP32 sensors | P1 | ✗ Manual "I've arrived" for now (QA-29) |
| Arrival confirmation modal | P2 | ✓ Step 2 |
| Sticky button to reopen it after cancelling (grays out when out of range) | P2 | ✓ Step 2, shown only after cancel. "Out of range" needs BLE. |
| Loading page with a progress bar | P2 | ✓ Step 8d: loading page (team wireframe) |
| QR Sessions API (`/sessions`, `/scan`) | n/a | ✓ Built (`fs_sessions`). The phone receives the kiosk's real route (8d). |

## 5. Technology stack (`01 Technology/00 Tech Stack.md`)

| Spec | Current | Note |
|---|---|---|
| React Router | `wouter` | Fine (lighter, same role). Update the notes. |
| Zustand, TanStack Query | TanStack Query is used for every admin API call (5b). Zustand is installed but unused. | Fine; add Zustand only when shared client state needs it |
| React PWA for the mobile handoff | `manifest.json` only; no service worker | The handoff works as a plain web page (step 2). Installable PWA and offline support are deferred; they aren't needed for a single visit. |
| **Draco compression** for GLB | ✓ Step 7a: `EYA.glb` 17 MB, `A.glb` 0.7 MB, `CAMPUS.glb` 0.05 MB, all Draco; the decoder is served from `public/draco/` | None |
| Recast / three-pathfinding (navmesh) | Not used | Conflicts with the schema and backend, which use a **node/edge graph with A*** (`navigation.nodes`/`edges`, `navigation/services.py`). **Recommendation:** the graph plus A* is the source of truth; mark navmesh as optional in the notes. |
| Celery beat for cleanup and analytics | ✓ Cleanup tasks (4a), offline-device marking, informational-alert clearing and trend alerts (5a, 6). No task fills `hourly_kiosk_statistics` or `sensor_statistics`; the Analytics API aggregates on request. |

**Additions and substitutions, decided by the team on 2026-09-24**
([decision record](../changes/step-04-stack-decisions.md)):

| Item | Not in the stack notes because | Decision |
|---|---|---|
| `qrcode.react` (draws the handoff QR) | The notes name the QR handoff but no library for drawing it | **Approved** |
| `paho-mqtt` 2.x (Python MQTT client for `run_mqtt_consumer`) | The notes name MQTT and Mosquitto but not the backend client; it was already in the repo at 1.x | **Approved** (upgraded to 2.x) |
| `playwright`, `jsqr`, `pngjs`, `vitest` | Test tooling isn't covered by the notes | **Approved as dev-only.** They're `devDependencies`: a production build doesn't include them, and they never reach the kiosk, phones, or server. |
| `pnpm` (the notes say npm) | It was already in the repo before this work | **Switched to npm** on 2026-09-25, matching the notes. Package versions are unchanged. |
| Arduino IDE (ESP32 firmware) | The notes don't name a firmware toolchain | **Approved.** The team's ESP32 firmware already exists and is built with it. |
| Workflow Engine ("Django App (workflow)") | Listed in the notes | **Out of scope** (decided 2026-09-25): enrollment and clearance are only example reasons a visitor uses the kiosk. Nothing is built for it. |
| iPad as the kiosk | HR-01 to HR-06 specify a dedicated kiosk PC with a 21–24" touchscreen | **Temporary**, for the presentation and defense only. HR-01 to HR-06 stay as the handover requirement; the client provides the kiosk device. |

## Impact on the roadmap (first review, kept for history)

These were the plans at the first review. Steps 2 to 9a carried them out,
except the items still marked open above.

- **Step 2 (QR handoff).** Use the spec's QR session contract
  (`POST /api/v1/sessions` → `/sessions/{id}/scan`) as the target shape, even
  for the no-backend version, so the later switch is only a transport change.
- **Step 3 (3D).** Add the P1 kiosk items that depend on the model: isometric
  lock, the view-hierarchy Back button, and floor focus. Also compress the
  GLBs, fix the A Building coordinates, and use the real GLB in Map
  Annotation. **This is where the building model files are needed.**
- **Step 4 (backend and database).** In this order:
  1. Prefix `/api/v1`, mount auth and users, rename annotation and hardware
     routes, set the trailing-slash rule.
  2. Migrations for DB-1 to DB-5.
  3. Seed the EYA rooms from the labels doc.
  4. Build the missing API areas.
  5. Kiosk device auth.
