# Step 5b test report

| | |
|---|---|
| Change record | [step-05b-admin-pages.md](../changes/step-05b-admin-pages.md) |
| Environment | Chromium (Playwright 1.56.1), Vite dev server proxying to Django, PostgreSQL 16 + PostGIS, Mosquitto 2.0.18 |
| Result | **All gates pass.** New end-to-end suite 19/19 against the real backend and broker. All earlier suites still pass. |

## Gates

| Gate | Result |
|---|---|
| `npm run check` (TypeScript) | No errors |
| `npm test` | 46/46 |
| ESLint on every changed file | Clean |
| Backend `manage.py test --noinput` | 78/78 |
| **`npm run qa:step5b`** (real backend and broker) | **19/19** |
| `npm run qa:step4a` (real backend: sign-in, guard, sign-out) | 13/13 |
| `npm run qa:step1` (demo mode) | 36/36 |
| `npm run qa:step2` | 22/22 |
| `npm run qa:models` | 3/3 |
| Demo mode check: each page shows demo data; saving is refused with a notice; no page errors | Pass |

## `qa:step5b` checks

The run signs in with the emailed code, then publishes an MQTT message as a
brand-new ESP32.

| ID | Check |
|---|---|
| D1 | The dashboard shows the live system status |
| D2 | The system summary counts the 92 seeded rooms |
| D3 | No demo-data notice with the API connected |
| H1 | A sensor that publishes for the first time appears as **Unregistered** |
| H2 | Registering names it, and it shows **Online** (it reported seconds ago) |
| H3 | Device details show the real device ID and the sampling interval |
| H4 | Editing to EYA Building, 1F updates the registry location |
| H5 | Disable, then Enable, updates the status |
| H6 | Ping explains that it isn't available yet |
| H7 | Delete (with confirmation) removes the device from the registry |
| U1–U3 | Add an administrator (listed as Enabled), disable them, delete them |
| S1 | Changing the alert clear time saves the new policy |
| S2 | An end date before the start date is caught before saving |
| S3–S4 | Add a semester, then delete it |
| D4 | The dashboard's recent activity lists these admin actions |
| E1 | No uncaught page errors |

The run cleans up after itself: the device is decommissioned, the admin and
the semester are deleted, and the clear time is restored.

## How to run it

The same setup as step 4a (Django with the console email backend and
`CELERY_TASK_ALWAYS_EAGER=True` and `ADMIN_SESSION_COOKIE_SECURE=False`,
logging to a file; the frontend with `VITE_API_BASE_URL=/api/v1`), plus
`seed_campus`, Mosquitto, `run_mqtt_consumer`, and a sensor login:

```bash
BACKEND_LOG=/path/to/django.log MQTT_USER=<sensor user> MQTT_PASSWORD=<password> npm run qa:step5b
```

## Visual check

Full-page screenshots of the four pages with real data were reviewed. They
found the three layout issues fixed in this step (the card header actions,
the empty 7-day chart, and the MQTT status mismatch).
