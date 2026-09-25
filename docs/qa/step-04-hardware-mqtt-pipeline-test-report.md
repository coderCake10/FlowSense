# Test report: ESP32 → MQTT → database pipeline

| | |
|---|---|
| Change record | [step-04-hardware-mqtt-pipeline.md](../changes/step-04-hardware-mqtt-pipeline.md) |
| Environment | PostgreSQL 16 + PostGIS 3.4, Mosquitto 2.0.18, paho-mqtt 2, Django 5.2.17 |
| Result | **All gates pass.** Backend 45/45 (7 new hardware tests). Live broker run stores readings. |

## Gates

| Gate | Result |
|---|---|
| `manage.py check` | No issues |
| `manage.py makemigrations --check` | No changes (no schema change) |
| `manage.py test --noinput` | **45 passed** (was 38) |

## Live run (real broker, real consumer, real database)

A simulated ESP32 published to `flowsense/sensors/eya/lobby`:

```json
{"device_id":"esp32-eya-lobby-01","device_type":"sensor","mac_address":"24:6F:28:AA:BB:01",
 "battery_level":85.0,"signal_strength":-59,"signal_count":21,"estimated_density":0.51,
 "observed_at":"2026-09-24T13:07:00+08:00"}
```

| Step | Before the fix | After |
|---|---|---|
| Consumer signs in as `flowsense_backend` / `backend` | **Refused** (`not authorised`) | Connected |
| First message | Device and sensor created, `unregistered` | Same (correct: nothing stored until an admin registers it) |
| `GET /api/v1/hardware/devices` (admin session) | No `id` in the response | Returns `id`, `device_id`, `status` |
| `POST /api/v1/hardware/devices/1/register` | Worked | Worked |
| Next message | **Dropped**: `Field 'id' expected a number but got 'esp32-eya-lobby-01'` | **Stored** in `hardware.sensor_observations`, with battery and signal; `last_transmission_at` set |

## New tests (7, in `apps/hardware/tests.py`)

Each test feeds a message straight into the consumer's `on_message`, so no
broker is needed.

- The device registry requires an admin (this test already existed).
- A first message discovers an unregistered sensor and stores nothing.
- A registered sensor's readings are stored, with the device's `last_data_at`
  set.
- A message without `observed_at` uses the receive time.
- Registration saves the map node (QA-46).
- A sensor assigned to EYA that publishes under another building is dropped.
- Malformed topics and missing identity fields are rejected.
- The registry list exposes `id` and `device_id` (QA-47).

## Not verified

- **Real ESP32 hardware.** The sample sketch in the local setup guide is
  untested: it wasn't compiled here because the Arduino CLI couldn't be
  installed in this environment.
- **Docker build.** Blocked in this environment by registry rate limits,
  the same as in step 4a. The non-Docker path was used.
