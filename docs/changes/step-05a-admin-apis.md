# Step 5a: Backend APIs for the admin dashboard

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Spec | `architecture-notes-main/07 API/00 API Design.md` (Hardware, Alerts, Activity, Analytics dashboard, Settings, System), `04 Application/02 Admin/03 Dashboard.md`, `06 Hardware Management.md`, `09 Settings.md` |
| Evidence | [Step 5a test report](../qa/step-05a-test-report.md) |
| Next | Step 5b connects the Dashboard, Hardware, Users, and Settings pages to these endpoints |

## New and completed endpoints

All are admin-only unless marked **public**.

| API | Endpoints | Notes |
|---|---|---|
| **Hardware** | `GET /hardware/devices` (`?device_type=`, `?status=`, `?search=`), `GET/PATCH/DELETE /hardware/devices/{id}`, `POST …/register`, `POST …/commands/{enable,disable,ping,restart}`, `GET /hardware/kiosks[/{id}]`, `GET /hardware/sensors[/{id}]`, `GET /hardware/sensors/{id}/observations` (`?from=&to=`), `GET /hardware/sensors/{id}/statistics` (`?hours=`) | Rebuilt; see "Hardware fixes" |
| **Alerts** | `GET /alerts` (`?state=open\|active\|acknowledged\|cleared\|all`, `?severity=`), `GET /alerts/{id}`, `POST …/acknowledge`, `POST …/clear` | New |
| **Activity** | `GET /activity` (`?event_type=`, `?action=`, `?admin_user=`, `?entity_type=`, `?from=&to=`), `GET /activity/{id}` | New. Admin changes to devices, settings, semesters, and alerts are now recorded. |
| **Analytics** | `GET /analytics/dashboard` | New. Returns every Dashboard panel in one response (see below). The other analytics endpoints come with the Analytics page. |
| **Settings** | `GET /settings`, `GET/PATCH /settings/{key}`, `GET/POST /settings/semesters`, `GET/PATCH/DELETE /settings/semesters/{id}` | New (in `common/settings`, per the API design) |
| **System** | `GET /system/status` (**public**, because kiosks read it), `GET /system/health` | New (in `common/system`) |

Lists use the contract's pagination: `?page=` and `?page_size=` (default 25,
maximum 100). Device lists aren't paginated, since there are only a handful
of devices.

## Behaviour worth knowing

**Device status.** The registry shows the spec's statuses: Unregistered,
Online, Offline, Disabled, and Decommissioned.
- A registered, enabled device is **online** if it reported within 3 of its
  sampling intervals (at least 90 s), otherwise **offline**. The API works
  this out on every read, so it's correct even without the scheduler.
- A scheduled task (`hardware.mark_offline_devices`, every minute) records
  the offline status and raises a **warning alert**. The alert clears itself
  when the device reports again.
- **Disabled** devices are still seen (last ping updates), but their readings
  aren't stored. **Decommissioned** devices are hidden, their map node is
  freed, and their messages are ignored.

**System status** (Admin Dashboard spec):
- **Maintenance:** the new `maintenance_mode` setting is on.
- **Critical:** the database is down, or every kiosk is offline (the kiosk is
  the primary interface, HR-01).
- **Degraded:** anything else is down or partly down. This includes Redis,
  Celery, some kiosks, or the sensors.
- **Operational:** otherwise.

Redis and Celery count as "not used" when tasks run inline
(`CELERY_TASK_ALWAYS_EAGER`, the non-Docker setup).

**Dashboard response:**
- `system`: status, plus kiosks and sensors online out of total
- `today`: kiosk sessions, navigation queries, successful and failed
  searches, average session length
- `kiosk_activity`: sessions per day for the last 7 days
- `crowd_density`: per sensor, the latest reading (under 15 minutes old) with
  a low, moderate, or high level
- `top_destinations` and `failed_searches`: the top 5 over the last 30 days
- `alerts`: open alerts
- `recent_activity`: the last 5 admin actions
- `summary`: counts of buildings, floors, rooms, mapped rooms, assets,
  kiosks, and sensors

**Informational alerts** clear automatically after the
`informational_alert_clear_time` setting (task every 5 minutes).

**Time zone:** `TIME_ZONE` is now `Asia/Manila` (overridable with
`DJANGO_TIME_ZONE`), so "today" on the dashboard is the local day. API
timestamps still carry their offset.

## Hardware fixes found while rebuilding

| ID | Defect | Fix |
|---|---|---|
| QA-57 | `DELETE /hardware/devices/{id}` **permanently deleted** the device row (the old view was a full `ModelViewSet`), and `PUT` could overwrite any field, including `status` | `DELETE` decommissions (soft delete, as the spec says). `PUT` returns 405. |
| QA-58 | Registration set the status to `registered`, which the registry doesn't display, and it stayed that way | Registration sets online or offline (or disabled). The consumer keeps it current. |
| QA-59 | A disabled device's readings were still stored, and the consumer only stored readings for the `registered` status | Disabled: seen but not stored. Online and offline: stored. |
| QA-60 | Kiosk devices discovered over MQTT got no `kiosks` row | Created on discovery, like sensors |

## Waiting on team decisions

| ID | Question | Current behaviour |
|---|---|---|
| QA-61 | **Response envelope.** The OpenAPI contract wraps responses as `{success, data, meta}`. Every endpoint the team built returns plain JSON. | Plain JSON, consistent with the existing endpoints. Either choice can be applied to every endpoint in one place later. |
| QA-62 | **Kiosk connectivity.** The API design has no endpoint for a kiosk (a browser) to announce itself or send "I'm online". Kiosk sessions are visitor interactions, not device health. | Kiosks can't appear in the registry yet. A kiosk announce/heartbeat endpoint needs approval, because it's an addition to the API design. |
| QA-63 | **Ping and Restart commands** need a command topic that the ESP32 firmware subscribes to. The IoT notes don't define one. | They return `501 Not Implemented` with a clear message. Enable and Disable work. |
| QA-64 | **Density scale.** The level thresholds assume `estimated_density` is a 0–1 ratio (low under 0.34, high from 0.67). | Confirm against the firmware's actual values |

## Files

- **Hardware:** `services.py`, `serializers/`, `views/`, `urls.py`,
  `tasks.py` (new), `management/commands/run_mqtt_consumer.py`, `tests.py`
- **Analytics:** `alerts.py`, `audit.py`, `dashboard.py`, `serializers.py`,
  `views.py`, `urls.py`, `alerts_urls.py`, `activity_urls.py`, `tasks.py`,
  `tests.py`
- **Common:** `settings/` and `system/` (new packages), `pagination.py`,
  `testing.py`, `migrations/0003_seed_maintenance_mode.py`, `tests.py`
- **Config:** `urls.py`, and `settings.py` (beat schedule, time zone)
