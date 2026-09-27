# FlowSense Handover

**Project:** FlowSense, campus wayfinding for Angeles University Foundation
**Last updated:** 2026-09-26, after step 11 (analytics reports)
**Status:** a full stack. The Django API, PostGIS database, MQTT pipeline, and
React frontend are connected. The admin pages and the kiosk read and write real
data, and building models are uploaded, checked and made live in Asset
Management. Analytics reports are generated as snapshots and printed to PDF or
exported as CSV (step 11).

This file is the entry point for a developer taking over. It says what exists,
where it lives, and what is still open. The details are in `docs/`. Each
delivery step has a change record and a test report there.

> An earlier version of this file described a frontend-only prototype with
> fixture data and no backend. That is no longer true.

## 1. Where things are

| Path | What it is |
| --- | --- |
| `architecture-notes-main/` (repo root) | The specification: requirements, architecture, app specs, **DB schema** (06), **API design** (07). This is the contract. The code is brought to it. |
| `FlowSense/docker-compose.yml` | The whole stack: Django, PostGIS 16, Redis, Celery worker and beat, Mosquitto, nginx, Swagger UI, frontend |
| `FlowSense/backend/django/` | Django REST Framework API under `/api/v1/` |
| `FlowSense/backend/mosquitto/`, `nginx/` | MQTT broker and reverse proxy config |
| `FlowSense/frontend/` | React 19, TypeScript, Vite 7 app (kiosk, phone handoff, admin) |
| `FlowSense/docs/` | Process, setup guides, change records, test reports, QA tracker, conformance review, OpenAPI contract. Start at [`docs/README.md`](../docs/README.md). |

## 2. Getting it running

- Teammates on Windows with Docker: [`docs/setup/team-local-setup.md`](../docs/setup/team-local-setup.md).
- Without Docker, and to run the tests: [`docs/setup/local-development.md`](../docs/setup/local-development.md).
- Building models: [`docs/setup/building-models.md`](../docs/setup/building-models.md).
- Drawing walkways and doors: [`docs/setup/map-annotation.md`](../docs/setup/map-annotation.md).

The short version (backend in `backend/django`):

```bash
python manage.py migrate
python manage.py seed_campus        # EYA floors and rooms
python manage.py seed_eya_routes    # EYA routes for all 97 rooms (generated from the model)
python manage.py seed_assets        # the committed models (EYA, campus, A) in Asset Management
python manage.py create_admin --email you@auf.edu.ph --name "Your Name" --role "super admin"
python manage.py runserver 127.0.0.1:8000
python manage.py run_mqtt_consumer  # only when ESP32 sensors publish
```

Frontend (in `frontend/`): `VITE_API_BASE_URL=/api/v1 npm run dev`. Without
`VITE_API_BASE_URL` the admin pages run as an offline demo with sample data,
say so on screen, and refuse changes.

## 3. Backend apps

| App | API | Notes |
| --- | --- | --- |
| `authentication` | `/auth/*`, `/users` | Passwordless sign-in (6-digit code or link), rate limited, admin session cookie. Roles: Admin, Super Admin. |
| `map` | `/map/*` | Areas, floors, rooms, entrances, stairs, elevators, walkways, personnel |
| `navigation` | `/navigation/*` | Nodes, destinations, **A\*** routes over `navigation.nodes`/`edges` |
| `search` | `/search` | Full-text and trigram search over rooms and personnel |
| `annotation` | `/annotations/*` | Map Annotation writes: nodes, edges, floor transitions, room details |
| `fs_sessions` | `/sessions/*` | Kiosk sessions, navigation sessions, QR handoff sessions |
| `hardware` | `/hardware/*` | Devices, kiosks, sensors, commands, observations, kiosk heartbeat. `run_mqtt_consumer` stores ESP32 readings. |
| `analytics` | `/analytics/*`, `/alerts/*`, `/activity/*` | Dashboard, analytics, alerts, audit activity, and reports (`reports.py`: snapshots of chosen sections, stored in `analytics.reports`; CSV ZIP export). |
| `assets` | `/assets/*` | Building model uploads and versions (files in `media/assets/`), a GLB inspector (`glb.py`), 16 validation checks, activation and restore. The active version is public at its download URL; `GET /map/areas` gives each building's `model`. |
| `common` | `/settings/*`, `/system/*` | Settings, semesters, system status and health; shared envelope, permissions, pagination |

The API is admin-only by default. Kiosk and phone endpoints opt out with
`AllowAny`. Every response uses the `{success, data, meta}` envelope from the
OpenAPI contract (`docs/openapi/flowsense-openapi.yaml`, served at `/docs/`).

## 4. Frontend pages

| Route | File (`client/src/pages/`) | State |
| --- | --- | --- |
| `/attraction` | `experience/AttractionPage.tsx` | 3D building preview; waits for a tap |
| `/kiosk` | `experience/KioskPage.tsx` | Live directory and search, 3D map with campus/building/floor views, A\* routes, Destination Queue, QR handoff, 60-second idle return |
| `/mobile` | `experience/MobilePage.tsx` | Phone handoff: the kiosk's route as step-by-step directions; arrival is confirmed by hand (BLE is not wired, QA-29) |
| `/auth` | `experience/AuthPage.tsx` | Admin sign-in |
| `/` | `workspaces/Dashboard.tsx` | Live |
| `/map-annotation` | `workspaces/MapAnnotation.tsx` | Live: draws nodes and edges on the real model, edits room details |
| `/assets` | `workspaces/AssetManagement.tsx`, `workspaces/assets/` | Live: upload, validation, 3D viewer, structure detection, activate and restore, activity |
| `/hardware` | `workspaces/HardwareManagement.tsx` | Live |
| `/users` | `workspaces/UsersPage.tsx` | Live (Super Admin) |
| `/analytics` | `workspaces/Analytics.tsx`, `workspaces/reports/ReportsPanel.tsx` | Live, including Reports and exports |
| `/analytics/reports/:id` | `workspaces/reports/ReportPage.tsx` | A report as a printable page (Print or save as PDF), CSV download |
| `/settings` | `workspaces/SettingsPage.tsx` | Live |
| `/help` | `workspaces/HelpPage.tsx` | Static guidance |

Shared pieces:

| Need | File |
| --- | --- |
| Routes and lazy loading | `client/src/App.tsx` |
| Admin shell, navigation, profile, sign-out | `client/src/components/FlowSenseShell.tsx` |
| API client, types, endpoint map | `client/src/lib/api.ts` |
| Admin queries and mutations (TanStack Query), offline demo | `client/src/lib/adminApi.ts`, `demoData.ts` |
| Analytics queries; reports | `client/src/lib/analyticsApi.ts`, `analyticsDemo.ts`, `reportsApi.ts` |
| Map Annotation API | `client/src/lib/annotationApi.ts` |
| Assets API; the live model for the 3D maps | `client/src/lib/assetsApi.ts`, `client/src/lib/liveModel.ts` |
| Kiosk directory, queue order, device identity, QR handoff | `client/src/lib/kioskDirectory.ts`, `kioskQueue.ts`, `kioskDevice.ts`, `handoff.ts` |
| 3D map | `client/src/components/BuildingFloorMap.tsx`, `components/map/` |
| Building configuration (models, floors, starting point) | `client/src/data/` (see its README) |
| Design tokens | `client/src/index.css` (AUF navy `#0B1F3A`, signal gold `#F4C542`) |

## 5. What is still open

The live list is the [QA tracker](../docs/qa/qa-tracker.md) and the roadmap in
[`docs/process/workflow.md`](../docs/process/workflow.md). The large items:

| Open | Why | Owner |
| --- | --- | --- |
| Scheduled reports | Needs a schedules table and a Celery beat task (QA-99) | Backend, then frontend |
| A Building rooms and routes; routes over the overpass | Steps 9b and 9c | Frontend and data |
| Editing floor settings, spatial and kiosk defaults from Asset Management | No floor-edit endpoint or display-name columns in the spec (QA-93) | Team decision |
| Kiosk device authentication (`KioskDeviceToken`) | Kiosk endpoints are open; kiosks identify by device ID | Backend |
| BLE arrival detection on the phone | Needs ESP32 sensors in place (QA-29) | IoT and backend |
| Kiosk Location Details sidebar; Area level | Spec P1 items not built (QA-26) | Frontend |

## 6. How work is done

Read [`docs/process/workflow.md`](../docs/process/workflow.md). In short: each
step is one branch and one pull request. It must pass the frontend gates
(`npm run check`, `npm run lint`, `npm test`, `npm run build`, the browser QA
suites in `e2e/`) and the backend gates (`manage.py check`,
`makemigrations --check`, `manage.py test`). It adds a change record in
`docs/changes/` and a test report in `docs/qa/`, and updates the tracker.

Conventions worth keeping:

- Visitor-facing copy is honest. A button that isn't connected says so; it
  never shows a success message for work that didn't happen.
- Error messages never reveal whether an admin account exists.
- Reuse `components/ui/` (shadcn/ui) and `lucide-react` icons. Don't swap the
  router, CSS framework, or component system without a recorded decision.
- Any timer, listener or Three.js resource needs cleanup. The map renders
  only when something moves.
- The committed building models in `client/public/models/` (Draco-compressed,
  whitelisted in `.gitignore`) are the fallback. A model made live in Asset
  Management replaces them without a code change; see the building-models
  guide, section 8.
