# Step 4 follow-up: the ESP32 → MQTT → database pipeline works end to end

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Resolves | QA-44 to QA-48, QA-52 |
| Logs | QA-49 to QA-51 (planned for step 4c) |
| Spec | `architecture-notes-main` IoT notes (topic `flowsense/sensors/<building>/<zone>`), `06 Database/01 Final Database Schema.md` |
| Evidence | [Test report](../qa/step-04-hardware-mqtt-pipeline-test-report.md) |

## Why this was done

The team asked for instructions on connecting the ESP32 sensors. Before
writing them, the pipeline was run for real: Mosquitto broker, then
`run_mqtt_consumer`, then the database and the admin API. A simulated ESP32
publisher was used because no hardware is available in the build environment.
The run showed that **a registered sensor's readings were never saved**, and
that the documented backend MQTT password was wrong. Instructions for a path
that doesn't work would waste the team's time, so the defects were fixed
first.

## What changed

| ID | Defect | Fix |
|---|---|---|
| QA-44 | The backend couldn't sign in to Mosquitto. The committed `backend/mosquitto/config/passwd` hash for `flowsense_backend` didn't match the password `backend` in `.env.example`, so the consumer was refused (`not authorised`). | Regenerated that one entry with `mosquitto_passwd` (the `flowsense_sensor_01` entry is unchanged). Verified: a broker using the committed file accepts `flowsense_backend` / `backend`. |
| QA-45 | Readings from a **registered** sensor were dropped. `validate_mqtt_topic` looked the sensor up with `Sensor.objects.get(device_id=<"esp32-…">)`, but `Sensor.device_id` is the numeric foreign key, so every lookup raised `Field 'id' expected a number`. It also compared the topic's zone to the area's *name*, so an assigned sensor would have been rejected anyway. | The lookup is `device__device_id` (the ESP32's own ID). The topic's `<building>` segment is compared to the assigned area's **code** (`eya`), case-insensitive. An unknown device is rejected (it used to be accepted). A sensor not yet assigned to a building is accepted. |
| QA-46 | Registering a sensor didn't save its map node: `sensor.map_node_Id` (capital I) set an unused attribute. | `sensor.map_node_id`. |
| QA-47 | `GET /api/v1/hardware/devices` didn't return an `id`, but registering needs `POST /devices/{id}/register`. `last_ping` was always empty (the model field is `last_ping_at`). | The list returns `id` and `device_id`; `last_ping` reads `last_ping_at`. |
| QA-48 | Telemetry didn't update health fields and failed when `observed_at` was missing (`parse_datetime(None)`). | The consumer stamps `sensors.last_transmission_at` and `devices.last_data_at`, stores `battery_level` / `signal_strength` on the observation, and uses the receive time when `observed_at` is absent. |
| QA-52 | `.env.example` used `KEY = value` with spaces for the PostgreSQL and MQTT lines, unlike the rest of the file. | Normalized to `KEY=value`. |

## Files

- `backend/django/apps/hardware/services.py`
- `backend/django/apps/hardware/management/commands/run_mqtt_consumer.py`
- `backend/django/apps/hardware/serializers/device.py`
- `backend/django/apps/hardware/tests.py` (1 test → 8)
- `backend/mosquitto/config/passwd` (the `flowsense_backend` entry only)
- `.env.example`

## Found and logged, not changed here

| ID | Finding | Why it waits |
|---|---|---|
| QA-49 | There's no screen for registering devices. The admin **Hardware** page shows mock data, and `hardware/admin.py` is empty. Registration works only through the API (`curl`). | Step 4c connects the dashboard pages to the API. |
| QA-50 | The web app manifest's `start_url` is `/mobile`. "Add to Home Screen" on the kiosk iPad would open the phone page, not the kiosk. | The setup guide uses Safari with Guided Access instead. A separate kiosk manifest can come with 4c. |
| QA-51 | The kiosk (iPad) isn't linked to the admin dashboard. The kiosk screen never calls the kiosk session or heartbeat APIs, a kiosk device can only be created through MQTT discovery, and device authentication (QA-28) isn't built. | Step 4c (Kiosk and Devices APIs). |
