# Step 5a test report

| | |
|---|---|
| Change record | [step-05a-admin-apis.md](../changes/step-05a-admin-apis.md) |
| Environment | PostgreSQL 16 + PostGIS 3.4, Mosquitto 2.0.18, Django 5.2.17 |
| Result | **All gates pass.** Backend 78/78 (33 new). A live run against a real broker and server works end to end. |

## Gates

| Gate | Result |
|---|---|
| `manage.py check` | No issues |
| `manage.py makemigrations --check` | No changes |
| `manage.py migrate` (development database) | `common.0003` applied |
| `manage.py test --noinput` | **78 passed** |

## New tests

- **Settings:**
  - requires an admin
  - lists the seeded settings
  - rejects an invalid value, then saves a valid one with `updated_by` and an
    audit event
  - an unknown key returns 404
  - semesters: create, edit, delete; an end date before the start date is
    rejected
- **System:**
  - status is public and doesn't expose components
  - maintenance mode wins
  - health is admin-only and lists all 5 components
  - the status rules: degraded versus critical
- **Hardware:**
  - the registry with filters
  - registration: brings a recently seen sensor online; registering twice
    returns 409; audited
  - a sensor needs a sampling interval
  - update name, building, floor, and interval; the location label reads
    "EYA Building · 1F"
  - a map node belongs to one device only
  - the floor must be in the device's building
  - disable stops storing readings and enable resumes
  - an unregistered device can't be enabled
  - ping and restart return 501; an unknown command returns 404
  - delete decommissions, hides the device, and ignores its later messages
  - `PUT` returns 405
  - observations are paginated; statistics give a reliability of 3 of 120,
    which is 2.5%
  - offline detection raises one alert and clears it on recovery
  - the registry shows offline before the scheduled task runs
- **Alerts:**
  - requires an admin
  - acknowledge, then clear, then acknowledging again returns 409
  - duplicate alerts are suppressed
  - a bad filter returns 400
- **Informational auto-clear:** uses the admin's setting and leaves warnings
  alone.
- **Activity:** newest first, with filters and details.
- **Dashboard:**
  - today's counts, including an average session of 240 s and a
    case-insensitive failed search
  - 7-day activity
  - summary: 1 building, 6 floors, 92 rooms
  - admin only
  - density levels

## Live run

Real Mosquitto, `run_mqtt_consumer`, and `runserver`, with sign-in through
the emailed code:

| Step | Result |
|---|---|
| All 10 new `GET` endpoints with the admin cookie | 200 |
| Before any message, the development sensor registered under the old code | Shown **offline**, and the status was then *critical*. This led to the clearer status rule (QA write-up in the change record). |
| `mosquitto_pub` reading from `esp32-eya-lobby-01` | The registry shows **online** at "EYA Building · 1F". The dashboard shows status **operational**, sensors 1/1, and crowd density 0.72 (**high**). |
| `POST …/commands/ping` | 501 |
