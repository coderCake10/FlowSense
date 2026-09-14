# FlowSense Frontend Handover

**Project:** FlowSense Frontend  
**Institution:** Angeles University Foundation  
**Current checkpoint:** `63da136d`  
**Project path:** `/home/ubuntu/flowsense-frontend`  
**Frontend status:** High-fidelity static React prototype with API-aligned request boundaries and fixture data  
**Last verified:** TypeScript compilation, production build, Asset Management rendering, and responsive route checks

## 1. Purpose of this document

This document is intended for the developer who will continue FlowSense after the current frontend prototyping phase. It explains what has already been built, where each feature is implemented, which files should be edited for particular changes, and which responsibilities still belong to the Django backend, database, MQTT infrastructure, BLE sensors, or ESP32 firmware.

The most important distinction is that the current project is **frontend-only**. It contains UI flows, local state, fixture records, request-boundary messages, and an endpoint map prepared for the supplied API design. It does not yet provide a production Django API, PostgreSQL/PostGIS persistence, MQTT communication, real BLE detection, or server-generated reports.

> Treat this project as the frontend contract and interaction prototype. Do not silently move backend, database, firmware, or infrastructure behavior into the React application.

## 2. Technology and architectural boundaries

| Area                 | Current implementation                                                                                | Boundary for the next developer                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| UI                   | React 19 with TypeScript                                                                              | Continue building page and component behavior in `client/src/`                                                  |
| Build and dev server | Vite 7 with the project scripts in `package.json`                                                     | Use the existing scripts; do not replace the managed WebDev setup                                               |
| Styling              | Tailwind CSS 4, CSS variables, shadcn/ui primitives                                                   | Preserve `client/src/index.css` tokens and the AUF Civic Signal visual language                                 |
| Routing              | Wouter                                                                                                | Add routes in `client/src/App.tsx` and preserve escape routes                                                   |
| Local state          | React `useState`, `useEffect`, `useMemo`                                                              | Use local state for prototypes; use API/query state when live services are connected                            |
| Shared visual shell  | `FlowSenseShell.tsx`                                                                                  | Reuse `BrandMark`, `PageHeader`, `StatusPill`, `MetricCard`, and `AdminLayout`                                  |
| Icons                | `lucide-react`                                                                                        | Use existing icon style instead of adding another icon library                                                  |
| Admin data boundary  | `client/src/lib/api.ts`                                                                               | Replace fixture adapters with calls to the Django API without changing page contracts unnecessarily             |
| 3D preview           | React Three Fiber is available; Map Annotation currently uses a bounded low-resource preview approach | Keep rendering bounded and dispose Three.js resources if a real scene is reintroduced                           |
| Backend              | Not implemented in this repository                                                                    | Django REST Framework, PostgreSQL/PostGIS, MQTT, BLE, and file processing remain backend or infrastructure work |

The static template includes `server/` and `shared/` compatibility placeholders. They should not be mistaken for a completed backend. The project remains a static frontend application.

## 3. Route map

| Route             | Page component                                                               | Purpose                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `/auth`           | `AuthPage` in `client/src/pages/experience/AuthPage.tsx`                     | Passwordless email or code authentication prototype                                                                                 |
| `/attraction`     | `AttractionPage` in `client/src/pages/experience/AttractionPage.tsx`         | Kiosk attraction loop with FlowSense branding, time, motion preview, and automatic entry to the kiosk                               |
| `/kiosk`          | `KioskPage` in `client/src/pages/experience/KioskPage.tsx`                   | Visitor destination search, location details, queue, live route, QR handoff, on-screen keyboard, and one-minute inactivity return   |
| `/mobile`         | `MobilePage` in `client/src/pages/experience/MobilePage.tsx`                 | Mobile handoff instruction cards, BLE arrival simulation, confirmation modal, sticky review action, and Bluetooth unavailable state |
| `/`               | `Dashboard` in `client/src/pages/workspaces/Dashboard.tsx`                   | Authenticated admin landing page and system overview                                                                                |
| `/map-annotation` | `MapAnnotation` in `client/src/pages/workspaces/MapAnnotation.tsx`           | Location-node, room, kiosk, sensor, route, and map annotation workspace                                                             |
| `/assets`         | `AssetManagement` in `client/src/pages/workspaces/AssetManagement.tsx`       | Model asset overview, upload flow, building configuration, validation, activation, and edit drawers                                 |
| `/hardware`       | `HardwareManagement` in `client/src/pages/workspaces/HardwareManagement.tsx` | Device registry, discovery, registration, selected-device detail, and lifecycle action prototype                                    |
| `/users`          | `UsersPage` in `client/src/pages/workspaces/UsersPage.tsx`                   | Administrator directory, action menus, invitation flow, administrator controls, and profile-related states                          |
| `/analytics`      | `Analytics` in `client/src/pages/workspaces/Analytics.tsx`                   | Kiosk sessions, navigation queries, search performance, destinations, failures, monitored locations, and report request UI          |
| `/settings`       | `SettingsPage` in `client/src/pages/workspaces/SettingsPage.tsx`             | Site-wide settings, alerts, semester registry, save/reset behavior                                                                  |
| `/help`           | `HelpPage` in `client/src/pages/workspaces/HelpPage.tsx`                     | Help and user-manual entry point                                                                                                    |

`AdminRouter` in `client/src/App.tsx` wraps all admin routes in `AdminLayout`. Public visitor routes are kept outside the admin shell.

## 4. Exact edit locations by feature

### 4.1 Shared branding, navigation, profile, and sign-out

Edit `client/src/components/FlowSenseShell.tsx` for the following items:

| Need                                                     | Location                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| FlowSense logo and Great Dane-inspired mark              | `BrandMark`                                                                              |
| Status badge colors                                      | `StatusPill`                                                                             |
| Page title, eyebrow, description, and page action layout | `PageHeader`                                                                             |
| Admin sidebar routes and labels                          | `navItems` and `AdminLayout`                                                             |
| AUF navy/gold sidebar styling                            | `AdminLayout` class names                                                                |
| Administrator profile dropdown                           | `profileOpen` block inside `AdminLayout`                                                 |
| View Profile modal                                       | `profileModalOpen` block inside `AdminLayout`                                            |
| Live profile loading                                     | `useEffect` in `AdminLayout`, currently calls `GET /auth/me` when an API base URL exists |
| Sign-out confirmation and redirect                       | `signOut`, currently calls `POST /auth/logout` when configured and redirects to `/auth`  |
| Reusable dashboard metric cards                          | `MetricCard`                                                                             |

The shared visual language is AUF navy, `#0B1F3A`, with FlowSense Signal Gold, `#F4C542`. The admin shell uses a light content surface, navy navigation rail, muted slate text, white cards, and gold active states.

### 4.2 Admin dashboard

Edit `Dashboard` in `client/src/pages/workspaces/Dashboard.tsx`. The dashboard currently contains system health, kiosk and sensor availability, current crowd density, activity metrics, kiosk activity over time, actionable events, and navigation to Analytics and Map Annotation.

The dashboard values are currently embedded fixture values. Replace them with a typed `DashboardSummary` request when the API is available. The corresponding endpoint is `endpointMap.analytics.overview` or the dashboard endpoint agreed upon in the backend contract.

### 4.3 Map Annotation

Edit `MapAnnotation` in `client/src/pages/workspaces/MapAnnotation.tsx`. This page currently contains:

- A three-zone layout for Tool Kit, Annotation Workspace, and Node Tree.
- Building and floor selection.
- Camera and representation controls.
- Undo and save-state feedback.
- A bounded low-resource spatial preview rather than an unbounded infinite workspace.
- Room, kiosk, and sensor node selection.
- Edit dialogs for room, kiosk, and sensor information.
- Room fields for room code, optional room alias, and description.
- Registered hardware selection for kiosk and sensor editing.
- Location Node creation workflow.
- Asset Management entry point.

When modifying the map editor, avoid recreating Three.js objects, animation loops, geometries, materials, or canvases on every render. If a real React Three Fiber scene is restored, use stable references, bounded camera controls, and cleanup for subscriptions and render resources. Do not introduce an infinite canvas or continuously moving camera without a user interaction requirement.

Relevant API groups are `endpointMap.map`, `endpointMap.annotation`, `endpointMap.navigation`, and `endpointMap.assets` in `client/src/lib/api.ts`.

### 4.4 Asset Management

Edit `AssetManagement` in `client/src/pages/workspaces/AssetManagement.tsx`. This is currently the most detailed wireframe-aligned admin page. The main areas are:

| Area                      | Current behavior                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Upload asset              | Opens a modal, accepts `.glb`, shows selected file, 500 MB guidance, processing state, and validation request-boundary feedback    |
| Overview tab              | Shows asset information, validation, processing, activation, and review controls                                                   |
| Asset tab                 | Shows source and metadata-oriented content                                                                                         |
| Model tab                 | Shows model inspection-oriented content and context actions                                                                        |
| Building tab              | Opens the wireframe contexts below                                                                                                 |
| Activity tab              | Shows asset history-oriented content                                                                                               |
| Building / Information    | Editable building name, code, description, status, and Save changes feedback                                                       |
| Building / Floors         | Floor table with order, GLB node, display name, short name, elevation, navigability, status, Add floor, and row-level Edit actions |
| Building / Transitions    | Transition table with transition name, from floor, to floor, status, Add transition, and row-level Edit actions                    |
| Building / Spatial        | Coordinate system, measurement unit, origin, rotation, scale, and Save changes                                                     |
| Building / Defaults       | Default floor, default map view, default camera, initial kiosk state, floor selection, cross-floor search, and Save changes        |
| Context rail              | File name, version, size, format, processing, validation, activation, View model, and View version actions                         |
| Validation and activation | Visible feedback plus API endpoint status messages                                                                                 |

The Floor and Transition Edit buttons open compact right-side drawers. The floor drawer edits order, GLB node, display name, short name, elevation, navigability, and status. The transition drawer edits transition name, from floor, to floor, and status. Save updates local state and displays an API-aligned request status. It does not yet persist to Django.

Asset endpoint references are in `endpointMap.assets`: `/assets`, `/assets/:id/versions`, `/assets/:id/validation`, `/assets/:id/processing`, and `/assets/:id/activate`. Building-specific map and annotation endpoints are also available in `endpointMap.map` and `endpointMap.annotation`.

When adding a new Asset Management action, it should do one of two things. It should either perform a local state transition that is clearly appropriate for the prototype, or call a function in the API boundary and show loading, success, and error states. Avoid buttons that only look interactive.

### 4.5 Hardware Management

Edit `HardwareManagement` in `client/src/pages/workspaces/HardwareManagement.tsx`. It currently includes:

- Device registry fixture records for sensors and kiosks.
- Search by device name, ID, or MAC address.
- Device status pills for Online, Offline, Unregistered, Disabled, and Decommissioned.
- Discover devices action with a frontend feedback state.
- Register modal for unregistered devices.
- Manage action for registered devices.
- Selected-device detail section.
- Connection, hardware, firmware, assignment, MQTT topic, registration date, refresh, configuration, and decommission action states.

The typed device structures are in `client/src/lib/api.ts`. The related endpoint group is `endpointMap.hardware`. Actual ESP32 discovery, MQTT status, firmware updates, and decommission persistence are not implemented in the frontend.

### 4.6 User Management

Edit `UsersPage` in `client/src/pages/workspaces/UsersPage.tsx`. It currently contains the administrator directory, search, role/status display, one-open action menu behavior, viewport-aware fixed menu positioning, administrator review/edit controls, enable/disable feedback, and the Invite Administrator modal.

The shared signed-in profile and View Profile modal are in `FlowSenseShell.tsx`, not `UsersPage.tsx`. The user API endpoint group is `endpointMap.users`, with authentication profile endpoints under `endpointMap.auth`.

The frontend currently represents the two API roles as `Admin` and `Super Admin`. User Management is intended to be restricted to Super Admin users, but that access decision must ultimately be enforced by the backend.

### 4.7 Analytics

Edit `Analytics` in `client/src/pages/workspaces/Analytics.tsx`. It currently includes range filtering, metric cards, search activity visualization, top destinations, failed searches, monitored locations, kiosk usage and availability details, and report-related UI.

The Generate Report button is a valid frontend responsibility when it starts a request, shows progress, handles errors, and presents a download or report result returned by the backend. The actual aggregation, authorization, file generation, and downloadable report creation belong to the backend. The endpoint group is `endpointMap.analytics.reports`.

### 4.8 Settings and Help

Edit `SettingsPage.tsx` and `HelpPage.tsx` in `client/src/pages/workspaces/`. Settings currently follows the supplied Alerts and Semester Registry structure with editable alert timing, academic year, start date, end date, reset, and save feedback. Help remains an admin-shell route intended to open or link to the user manual.

If a real PDF user manual is added, follow the static project asset rule: keep large assets outside the project’s public/source directories and reference the managed uploaded asset URL. Small configuration files may remain in `client/public/`.

### 4.9 Attraction, Kiosk, and Mobile

Edit the relevant module in `client/src/pages/experience/`.

| Component        | Edit here                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthPage`       | Email/code authentication UI and request states                                                                                                   |
| `AttractionPage` | Idle attraction loop, live time, motion preview, branding, and entry timeout                                                                      |
| `KioskPage`      | Search, destination list, map surface, details panel, route queue, live navigation, QR handoff, keyboard, navigation rail, and one-minute timeout |
| `MobilePage`     | Instruction cards, progress, BLE simulation, arrival modal, sticky review action, and Bluetooth unavailable state                                 |

`KioskPage` currently starts a 60-second inactivity timer and resets it for pointer, keyboard, touch, and wheel activity. It returns to `/attraction` after one minute. If changing this behavior, keep the cleanup function so timers and event listeners do not accumulate on remount.

The kiosk uses a navy navigation rail with lighter text hierarchy, an AUF gold active control, and a light map workspace. The on-screen keyboard is a fixed lower-screen/floating control designed for touch targets rather than a physical keyboard.

The mobile page simulates BLE arrival behavior in the UI. Real BLE advertisement detection from ESP32 devices remains outside the frontend.

## 5. API boundary and integration procedure

The authoritative API design supplied for this project is located outside the repository at:

`/home/ubuntu/upload/00APIDesign.md`

The frontend endpoint and type boundary is:

`client/src/lib/api.ts`

This file contains:

- `API_BASE_URL`, defaulting to `VITE_API_BASE_URL` or `/api/v1`.
- Typed records such as `AdminProfile`, `Device`, `Destination`, `DensityPoint`, and `DashboardSummary`.
- `ApiClient` with `get`, `post`, `patch`, and `delete` methods.
- Credentialed fetch behavior using `credentials: "include"`.
- `endpointMap` for authentication, maps, navigation, search, sessions, annotations, hardware, assets, analytics, alerts, activity, users, settings, and system health, including delete and version-restore paths.
- `isApiConfigured()` to distinguish configured API mode from the fixture adapter mode.

Recommended integration sequence:

1. Confirm the Django base URL and set `VITE_API_BASE_URL` through the project’s environment configuration.
2. Compare the response shapes in the Django API with the TypeScript interfaces in `api.ts`.
3. Add or refine interfaces before wiring pages to avoid untyped response assumptions.
4. Add loading, empty, success, and error states to each page.
5. Replace fixture arrays gradually, starting with authentication and dashboard data, followed by devices, assets, annotations, and analytics.
6. Keep API calls in `api.ts` or dedicated hooks rather than scattering raw `fetch` calls throughout JSX.
7. Preserve the current local fallback only if it is explicitly useful for offline prototyping.

The current frontend does not prove that an API request succeeds merely because it displays an endpoint string. Those messages are request-boundary indicators for the prototype and should be replaced with real response handling once the backend is available.

## 6. What is not implemented

The incoming developer should not assume that these are complete:

| Not yet implemented                                               | Correct owner                                      |
| ----------------------------------------------------------------- | -------------------------------------------------- |
| Django REST Framework endpoints                                   | Backend developer                                  |
| PostgreSQL/PostGIS schema and persistence                         | Backend/database developer                         |
| Real authentication, token/session policy, and role enforcement   | Backend/authentication developer                   |
| Real GLB storage, validation, processing, and version persistence | Backend/file-processing developer                  |
| MQTT broker, topics, retained state, and device telemetry         | IoT/backend developer                              |
| ESP32 firmware and sensor placement                               | Firmware/IoT team                                  |
| Actual BLE advertisement detection                                | Mobile/native or device-integration developer      |
| Server-side crowd-density calculation                             | Backend/analytics developer                        |
| Report aggregation, file creation, and download response          | Backend/analytics developer                        |
| Production 3D asset rendering and optimization pipeline           | Frontend plus backend/asset pipeline collaboration |

## 7. Validation commands

Run these commands from `/home/ubuntu/flowsense-frontend`:

```bash
pnpm exec tsc --noEmit
pnpm run build
pnpm run dev
```

The available package scripts are:

| Command           | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `pnpm run dev`    | Start the Vite development server                  |
| `pnpm run build`  | Build the frontend and compatibility server bundle |
| `pnpm run start`  | Start the production bundle after building         |
| `pnpm run check`  | Run TypeScript checking                            |
| `pnpm run format` | Format project files with Prettier                 |

The build currently completes successfully. Vite reports a chunk-size warning because the generated JavaScript bundle is larger than 500 kB after minification. This is a performance follow-up, not a compilation failure. Dynamic imports or route-level code splitting can address it later.

For visual verification, use the managed project preview and inspect at least:

- `/`
- `/map-annotation`
- `/assets`
- `/hardware`
- `/users`
- `/analytics`
- `/kiosk`
- `/mobile`

For Asset Management specifically, verify `Building > Floors`, `Building > Transitions`, `Building > Spatial`, and `Building > Defaults`, including row edit drawers and save/cancel behavior.

## 8. Working conventions

Use the existing shadcn/ui primitives in `client/src/components/ui/` before creating new primitives. Keep page-specific composition in `client/src/pages/` and shared patterns in `client/src/components/`. Preserve visible focus states, adequate touch targets, responsive overflow behavior, and clear escape routes.

Avoid creating objects, arrays, timers, or event subscriptions inside render when they are used as unstable query or effect inputs. Stabilize them with state or memoization where needed. Any timer or global event listener must have a cleanup function.

Do not store large images, videos, PDFs, GLB files, or other deployment assets in `client/public/` or `client/src/assets/`. Use the managed web asset upload workflow and reference the returned storage URL.

Do not introduce fake customer reviews, ratings, or testimonials. FlowSense’s operational metrics are currently fixture values and must be labeled or replaced with real API data before being presented as production measurements.

## 9. Repository housekeeping

Historical patch and diagnostic scripts were removed after their changes were incorporated into the reviewed source modules. They are not application runtime dependencies. Keep future maintenance changes in the focused page modules and shared components, and review them directly before committing.

## 10. Stable handover state

The stable frontend checkpoint for this handover is:

This checkpoint includes the completed Asset Management wireframe states and the compact floor and transition edit drawers. It also includes the previously completed admin shell, Map Annotation, Hardware Management, User Management, Analytics, Settings, attraction, kiosk, and mobile flows.

The safest continuation strategy is to make one feature change at a time, run TypeScript checking and the production build, inspect the affected route visually, and save a new checkpoint after a stable milestone.

## 11. Recommended next development sequence

The most practical next sequence is to connect authentication and profile loading first, then connect Asset Management reads and writes, followed by Hardware Management device status, Map Annotation persistence, and Analytics data. After those integrations, add automated interaction tests for the first-row user action menu, invitation modal, View Profile, asset upload and validation, floor and transition drawers, and the kiosk inactivity timeout.

The frontend is ready to receive the Django API, but the backend response schemas and authentication behavior should be confirmed before replacing the current fixture adapters wholesale.
