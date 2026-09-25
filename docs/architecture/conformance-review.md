# Architecture conformance review

| | |
|---|---|
| Reference | `architecture-notes-main/` in `wendy-calma/capstone-flowsense` (requirements, system architecture, app specs, **06 Database/01 Final Database Schema**, **07 API/00 API Design**) |
| Compared against | `coderCake10/FlowSense` `main` (`856ffc8`) plus step 1 |
| Method | Every Django model was extracted and diffed table by table against the SQL schema. Every mounted route and router registration was compared with the API design, and so was the frontend `endpointMap` (`client/src/lib/api.ts`). App-level specs were checked against the running UI. |

## Verdict

- **Database: fully conformant after step 4b.** Originally 33 of the spec's 35 tables existed as models
  and match its names, schemas, and columns. Two tables and one view are
  missing, and 23 of the 24 `CHECK` constraints exist only as Django
  `choices`, not in the database.
- **API: the frontend conforms, the backend drifted.** The frontend endpoint
  map follows the API design almost exactly (`/api/v1/…`, `/annotations`,
  `/hardware/devices`). The backend uses different prefixes and names, leaves
  auth and users unmounted, and has no implementation for 6 of the 14 API
  areas. **Decision: the API design doc is the contract, and the backend is
  brought to it** (not the other way round), since the frontend and the doc
  already agree.
- **Kiosk UI.** Step 1 originally misread the Navigate and queue flow. That is
  now fixed to match the spec (see the step 1 change record). Several P1
  kiosk features in the spec are still missing (below).

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
| Map | `/api/v1/map/*` | ✓ (4a) | ✓ spec | None |
| Navigation | `/api/v1/navigation/*` | ✓ (4a) | ✓ spec | None |
| Search | `/api/v1/search` | ✓ (4a) | ✓ spec | None |
| Navigation, QR, and kiosk sessions | `/api/v1/sessions/*` | ✓ Implemented and correctly prefixed | ✓ spec | None |
| Annotation | `/api/v1/annotations/*` | ✓ Renamed (4a) | ✓ spec (plural) | None |
| Hardware | `/api/v1/hardware/devices…`, `kiosks`, `sensors`, `commands` | `/api/v1/hardware/devices` (4a, admin-only) with list, detail, and register. Kiosks, sensors, observations, statistics, and commands are stubs. | ✓ spec, except `register` points to `/hardware/devices/register` instead of `/devices/{id}/register` | Rename, implement the rest, fix the frontend `register` path |
| Assets | `/api/v1/assets/*` (16 endpoints) | **Not implemented** | ✓ spec | Build |
| Analytics | `/api/v1/analytics/*` (13) | **Not implemented** | ✓ spec | Build |
| Alerts | `/api/v1/alerts/*` (4) | **Not implemented** (the model exists) | ✓ spec | Build |
| Activity | `/api/v1/activity/*` (2) | **Not implemented** | ✓ spec | Build (after DB-3) |
| Settings | `/api/v1/settings/*` (8) | **Not implemented** | ✓ spec | Build (after DB-1 and DB-2) |
| System | `/api/v1/system/status`, `/health` | **Not implemented** | ✓ spec | Build |

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
| **Kiosk device authentication** (per-kiosk credentials leading to short-lived kiosk tokens; no credentials stored in React) | **Not implemented.** Kiosk and QR session endpoints are open (no `permission_classes` and no `REST_FRAMEWORK` defaults, so DRF falls back to `AllowAny`). Planned for step 4. |
| ESP32 per-device MQTT credentials | Partly done. There is a Mosquitto password file; registry checks happen in the consumer. |
| "Temporary development-only username/password" login allowed | Not needed: the console email backend prints the code locally (4a) |

## 4. Kiosk application (`04 Application/00 Kiosk/02 Interactive 3D Map.md`)

| Spec item | Priority | Status |
|---|---|---|
| Navigate activates the queue; the queue modal lists instructions and shows the QR | P1 | ✓ Step 1 (corrected); real, scannable QR in step 2 |
| Add to queue button | P1 | ✓ Step 1 |
| Shortest path shown when a destination is selected | P1 | Partial. The routes are hand-drawn polylines, not backend A*. |
| **Non-rotatable isometric view** | P1 | ✗ `OrbitControls` allows free rotation ("Drag to rotate") |
| **Back button through the view hierarchy Area → Building → Floor → Destination** | P1 | ✗ Only "Back" to the attract screen |
| **Location Details right sidebar** (code, alias, description, personnel and contacts, office hours, image, sticky Add to queue) | P1 | ✗ Only a bottom bar with name and code |
| Search by room code, alias, **personnel, or building name** | P1 | Partial. The frontend filters name and code locally; the backend search API supports more. |
| List of locations grouped by building, then floor | P1 | Partial. Only building level. |
| Area selection dropdown | P1 | ✓ |
| Top bar: app name, building and kiosk name, **current time** | P2 | Partial. No time. |
| Exterior-shell reveal animation; floor focus with fading | P2 | ✗ |
| Queue modal auto-closes on idle or on QR scan | P2 | ✗ Needs the backend scan event (QA-30, step 4) |

## 4b. Mobile handoff (`04 Application/01 Mobile Handoff`)

| Spec item | Priority | Status |
|---|---|---|
| Navigation checklist of instruction cards | P1 | ✓ Step 2: ordered stop cards with a top-down route sketch |
| Dynamic update on BLE detection from ESP32 sensors | P1 | ✗ Manual "I've arrived" for now (QA-29) |
| Arrival confirmation modal | P2 | ✓ Step 2 |
| Sticky button to reopen it after cancelling (grays out when out of range) | P2 | ✓ Step 2, shown only after cancel. "Out of range" needs BLE. |
| Loading page with a progress bar | P2 | Partial. Route loader text only; the progress bar is deferred to the backend transport. |
| QR Sessions API (`/sessions`, `/scan`) | n/a | Shape mirrored by `lib/handoff.ts`; the local transport is used until step 4 |

## 5. Technology stack (`01 Technology/00 Tech Stack.md`)

| Spec | Current | Note |
|---|---|---|
| React Router | `wouter` | Fine (lighter, same role). Update the notes. |
| Zustand, TanStack Query | Installed, **unused** | Use TanStack Query when wiring the API in step 4 |
| React PWA for the mobile handoff | `manifest.json` only; no service worker | The handoff works as a plain web page (step 2). Installable PWA and offline support are deferred; they aren't needed for a single visit. |
| **Draco compression** for GLB | **Not used.** `eya-floor-1.glb` is **57 MB** (19 textures); `a-building.glb` is 1.5 MB | Kiosk load time and memory risk. Compress in step 3. |
| Recast / three-pathfinding (navmesh) | Not used | Conflicts with the schema and backend, which use a **node/edge graph with A*** (`navigation.nodes`/`edges`, `navigation/services.py`). **Recommendation:** the graph plus A* is the source of truth; mark navmesh as optional in the notes. |
| Celery beat for cleanup and analytics | ✓ Cleanup tasks scheduled and registered (4a); analytics aggregation comes with the Analytics API |

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

## Impact on the roadmap

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
