# Step 5b: Dashboard, Hardware, Users, and Settings pages use real data

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Builds on | [Step 5a](step-05a-admin-apis.md) (the APIs) |
| Spec | `04 Application/02 Admin/03 Dashboard.md`, `06 Hardware Management.md`, `07 User Management.md`, `09 Settings.md` |
| Evidence | [Step 5b test report](../qa/step-05b-test-report.md) |
| Resolves | QA-49 (there was no screen for registering devices) |

## What each page does now

| Page | Reads | Can change |
|---|---|---|
| **Dashboard** | `/analytics/dashboard`, refreshed every 30 s: system status; kiosks and sensors online (click through to Hardware); crowd density per sensor; today's 5 metrics; 7-day kiosk activity; top destinations and failed searches; open alerts; recent admin activity; system summary | Acknowledge or clear an alert |
| **Hardware** | `/hardware/devices`, refreshed every 15 s, with type, status, and search filters. Device details are grouped as the spec lists them (Identity, Assignment, Connection, Sensor or Kiosk, Firmware) plus the sensor's last 24 hours (readings received versus expected, reliability, averages and peaks) | **Register** (name, map node, enabled, sampling interval); **Edit** (name, building, floor, map node, sampling interval); Enable/Disable; Ping and Restart (explain they're not available yet, QA-63); View on map (once a map node is set); **Delete** (with confirmation) |
| **Users** | `/users`, with search | Add (name, email, role), Edit, Enable/Disable, Delete (with confirmation). The backend's protections show as messages: you can't disable or delete yourself, and the last super admin can't be removed. |
| **Settings** | `/settings`, `/settings/semesters` | Informational alert clear time (15 minutes to 7 days); **maintenance mode** on/off; semesters: add, edit, delete, with the end date checked before saving |

When the page is offline or the server fails, every page shows a
"Couldn't load… Try again" message instead of mock numbers. The error
messages come from the server (for example, "Map node already attached to
Lobby Sensor").

## How it's built

- **TanStack Query** (in the stack; it was installed but unused) for loading,
  caching, background refresh, and refreshing after each change.
  `client/src/lib/adminApi.ts` holds the response types (mirroring the
  Django serializers) and one hook per endpoint.
- **Demo mode is kept.** With `VITE_API_BASE_URL` unset, the pages show the
  demo data they showed before (`client/src/lib/demoData.ts`), and saving
  shows "Demo mode: connect the API to save changes." The step 1 and step 2
  suites run in this mode.
- `client/src/lib/api.ts`:
  - errors keep the server's JSON body, and `describeApiError()` turns it
    into a readable message
  - if the backend adopts the contract's `{success, data}` envelope (QA-61),
    the client unwraps it, so the pages don't change
- `client/src/components/AdminBits.tsx`: shared load/error states, form
  fields, a native select, and a confirm dialog for destructive actions.

## Fixed along the way

- Card headers: the shadcn `CardHeader` is a grid, so `flex-row` did nothing,
  and buttons and badges fell under the title. They now use `CardAction`.
- The 7-day chart drew equal bars when there were no sessions (its minimum
  bar height). It now says "No kiosk sessions in the last 7 days."
- The device details showed MQTT status "Online" next to status "Offline"
  between runs of the scheduled check. MQTT status now follows the last ping,
  like the status.

## Not in this step

- **Analytics, Map Annotation, and Asset Management** pages. Analytics needs
  the remaining analytics endpoints. Map Annotation and Assets come last,
  with the 3D models.
- **Kiosks in the registry** wait on QA-62 (a kiosk announce/heartbeat
  endpoint needs approval).

## Files

- **New:** `client/src/lib/adminApi.ts`, `client/src/lib/demoData.ts`,
  `client/src/components/AdminBits.tsx`, `e2e/step5b.qa.mjs`
- **Changed:** `App.tsx` (QueryClientProvider), `lib/api.ts`, the pages
  `Dashboard.tsx`, `HardwareManagement.tsx`, `UsersPage.tsx`, and
  `SettingsPage.tsx`, and `package.json` (`qa:step5b`)
- **Backend:** `hardware/serializers/device.py` (MQTT status follows the last
  ping), `hardware/tests.py`
