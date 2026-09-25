# Step 5c: The API follows the OpenAPI contract, and kiosks connect to the dashboard

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Decisions | QA-61: "do whatever the docs say", so the OpenAPI contract applies. QA-62: the kiosk heartbeat endpoint is approved. |
| Evidence | [Step 5c test report](../qa/step-05c-test-report.md) |

## 1. Every response uses the contract's envelope (QA-61)

`docs/openapi/flowsense-openapi.yaml` is now what the API returns, for
**every** endpoint (the ones built earlier included):

| Case | Body |
|---|---|
| Success | `{"success": true, "data": …, "message": null}` |
| Paginated list | `{"success": true, "data": [ … ], "meta": {"page", "page_size", "total_count", "total_pages"}}` |
| Error | `{"success": false, "error": {"code": "NOT_FOUND", "message": "…"}}`. Validation errors also carry `"fields": {"name": ["…"]}`. |
| DELETE, logout | **200** with `{"success": true, "data": null, "message": "Deleted."}` (the contract's `SuccessNoData`; previously 204) |

**Error codes:** `VALIDATION_ERROR` (400), `NOT_AUTHENTICATED` (401),
`PERMISSION_DENIED` (403), `NOT_FOUND` (404), `METHOD_NOT_ALLOWED` (405),
`CONFLICT` (409), `RATE_LIMITED` (429), `NOT_IMPLEMENTED` (501), and
`SERVER_ERROR` (5xx). An exception's own code is used when it is more
specific, for example `SELF_LOCKOUT`.

**How:**
- One renderer, `common/renderers.py`, set as `DEFAULT_RENDERER_CLASSES`,
  wraps every response, so views keep returning plain data.
- The session views, which built half an envelope by hand, are normalised by
  the same renderer. Their extra keys, such as `qr_token`, are kept.

**Pagination** now matches the contract's `PageParam`: `?page=` and
`?page_size=` (default 25, maximum 100), plus `meta`. It applies to every
list the contract marks as paged:
- `/hardware/devices`, `/hardware/kiosks`, `/hardware/sensors`, and sensor
  observations
- `/alerts` and `/activity`
- `/users`
- `/map/rooms` and `/map/personnel`

**Also from the contract:** `GET /system/health` is public (`security: []`),
like `/system/status`.

**Frontend:**
- `apiClient.get()` returns `data`.
- The new `apiClient.getPage()` returns `{results, meta}`.
- Error messages come from `error.message`.
- The registry and the user list request `page_size=100`, so they show
  everyone on one page.

## 2. Kiosk heartbeat (QA-62, approved addition)

**`POST /api/v1/hardware/kiosks/heartbeat`** is public and rate-limited to 20
per minute per IP (`THROTTLE_KIOSK_HEARTBEAT`). It's added to the OpenAPI
contract.

- The kiosk web app (the kiosk and attract screens) sends it every
  **30 seconds** with a stable ID it keeps in the browser
  (`kiosk-xxxxxxxxxxxx`). It also sends:
  - screen size and orientation
  - touch support
  - OS (for example, *iPadOS 17.5*)
  - app version
  - when the app started
- **The first heartbeat discovers the kiosk as Unregistered**, as MQTT
  discovery does for ESP32s. The attract screen shows the kiosk ID until an
  admin registers it on the Hardware page.
- **After registration** the kiosk shows **Online**. It becomes Offline, with
  a Device offline alert, after about 90 seconds of silence. The details show
  its screen, touch support, OS, version, uptime, and IP address.
- **Visitor sessions:** on a registered kiosk, the first touch on the kiosk
  screen starts a kiosk session (`POST /sessions/kiosk`). Interactions keep it
  alive, and **Back** (`manual_exit`) or 60 seconds idle (`idle_timeout`)
  ends it. The attract/kiosk loop of an idle kiosk is **not** counted. This
  makes the dashboard's Kiosk sessions, Average session, and 7-day chart real.

**Security note:** the heartbeat identifies a kiosk by its ID only. The
contract's `KioskDeviceToken` (a device credential exchange) is still to be
built (QA-28). An unknown ID only ever creates an *unregistered* entry that
an admin must approve, and heartbeats are rate-limited. This is acceptable on
the closed demo network, but should be closed before the handover.

## 3. Waiting on the ESP32 firmware (team)

| ID | Item | Current behaviour |
|---|---|---|
| QA-63 | Ping and Restart need the firmware's command topic | 501 `NOT_IMPLEMENTED` with "isn't available yet" |
| QA-64 | The scale of `estimated_density` (level thresholds assume 0–1) | Low under 0.34, High from 0.67; confirm against a real message |

## Files

- **Backend:**
  - `common/renderers.py` (new)
  - `common/pagination.py`, `common/throttling.py`, `common/system/views.py`
  - `config/settings.py` (renderer, heartbeat throttle)
  - `hardware/services.py` (`kiosk_heartbeat`)
  - `hardware/views/kiosk_heartbeat.py` (new), `hardware/views/device.py`,
    `hardware/urls.py`
  - pagination on `authentication/views/users.py`, `map/views/rooms.py`, and
    `map/views/personnel.py`
  - tests: `common/testing.py` (`data`, `meta`, `error` helpers); every
    app's tests are updated to the envelope; 6 new heartbeat tests
- **Frontend:**
  - `lib/api.ts` (envelope, `getPage`), `lib/adminApi.ts`, `lib/demoData.ts`
  - `lib/kioskDevice.ts` (new: heartbeat and visitor sessions)
  - `pages/experience/KioskPage.tsx` and `AttractionPage.tsx`
  - tests: `lib/api.test.ts`, `lib/kioskDevice.test.ts`;
    `e2e/step5b.qa.mjs` (+4 kiosk checks)
- **Docs:** `openapi/flowsense-openapi.yaml` (heartbeat path and schemas),
  this record, the test report, the tracker, and the conformance review.
