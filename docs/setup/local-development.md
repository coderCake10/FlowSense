# Local development without Docker

Docker Compose is the simplest way to run everything: copy `.env.example`
to `.env`, run `docker compose up -d --build`, then run
`docker compose exec backend python manage.py migrate`, then `seed_campus` and `create_admin` the same way. This guide is for running the backend and frontend directly,
which is faster for development and needed to run the test suites.

## Backend (Django + PostGIS)

Requirements: Python 3.11 or newer, PostgreSQL 16 with PostGIS 3.4, and GDAL.

```bash
# Ubuntu/Debian
sudo apt install postgresql-16 postgresql-16-postgis-3 gdal-bin libgdal-dev
# macOS (Homebrew)
brew install postgresql@16 postgis gdal
```

Windows: install PostgreSQL with the PostGIS bundle (Stack Builder) and
OSGeo4W for GDAL. `config/settings.py` points `GDAL_LIBRARY_PATH` at the
OSGeo4W install when running on Windows; adjust the path to your machine.

Create the database. A superuser role lets Django create the test database
and extensions:

```bash
sudo -u postgres psql -c "CREATE USER flowsense WITH PASSWORD 'flowsense_postgres' SUPERUSER;"
sudo -u postgres createdb -O flowsense flowsense
```

Set up and run:

```bash
cd FlowSense/backend/django
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

export POSTGRES_DB=flowsense POSTGRES_USER=flowsense POSTGRES_PASSWORD=flowsense_postgres \
       POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5432
export CELERY_TASK_ALWAYS_EAGER=True            # no Redis/worker needed locally
export ADMIN_SESSION_COOKIE_SECURE=False        # only if you open the site by LAN IP over HTTP
export FLOWSENSE_ADMIN_BASE_URL=http://localhost:3000

python manage.py migrate
python manage.py seed_campus          # EYA and A Buildings' floors and rooms, the walkways (safe to re-run)
python manage.py seed_eya_routes      # EYA routes for every room, generated from the model (safe to re-run)
python manage.py seed_a_routes        # A Building routes, and the walk to it over the overpass (safe to re-run)
python manage.py create_admin --email you@auf.edu.ph --name "Your Name" --role "super admin"
python manage.py seed_assets          # the committed models, in Asset Management (safe to re-run)
python manage.py runserver 127.0.0.1:8000
```

Sign-in emails print in the `runserver` terminal (console email backend).
Copy the 6-digit code from there, or open the link.

Tests:

```bash
python manage.py test --noinput
```

## Frontend

```bash
cd FlowSense/frontend
npm install
VITE_API_BASE_URL=/api/v1 npm run dev     # Vite forwards /api to 127.0.0.1:8000
```

Without `VITE_API_BASE_URL` the admin pages run as an offline demo, and
sign-in reports that the service isn't connected. Building models are
installed separately; see [building-models.md](building-models.md).

## Browser QA suites

The suites in `frontend/e2e/` drive Chromium with Playwright. Each one expects
a particular server, so start these before running them:

| Server | Command (in `frontend/`) | Used by |
|---|---|---|
| Offline demo on :3000 | `npx vite --host 127.0.0.1 --port 3000 --strictPort` | `qa:step1`, `qa:step2`, `qa:step7a`, `qa:step7b` |
| Live API on :3002 | `VITE_API_BASE_URL=/api/v1 npx vite --host 127.0.0.1 --port 3002 --strictPort` | `qa:step8a`, `qa:step8b`, `qa:step8d`, `qa:step8e`, `qa:audit1`, `qa:step10`, `qa:step11`; also the second half of `qa:step1` |
| Missing models on :3004 | `VITE_MODELS_BASE_URL=/no-such-models npx vite --host 127.0.0.1 --port 3004 --strictPort` | `qa:models` |

The suites that sign in (`qa:step4a`, `qa:step5b`, `qa:step6`, `qa:step8b`,
`qa:audit1`, `qa:step10`, `qa:step11`)
also need:

- the backend on :8000, with its output written to a log file that the suite
  reads the sign-in code from: `BACKEND_LOG=/path/to/django.log`
  (default `/tmp/flowsense-django.log`);
- the super admin `head@auf.edu.ph` (`create_admin`), `seed_campus`, and
  `seed_eya_routes` (the generated network: every room has a route); for
  `qa:step13` also `seed_a_routes` and `seed_assets`;
- for `qa:step4a`, `qa:step5b` and `qa:step6`, `BASE_URL=http://127.0.0.1:3002`,
  because their default (:3000) is the offline demo.
- for `qa:step4a`, the backend started with
  `FLOWSENSE_ADMIN_BASE_URL` set to the same address as `BASE_URL`, because the
  suite follows the emailed sign-in link.

The sign-in rate limits apply to the suites too: more than ten sign-ins in an
hour as the same admin get 429. For a long run, restart the backend between
batches (locally the counters live in memory) or set
`THROTTLE_AUTH_VERIFY_EMAIL`, e.g. `100/hour`, for the test backend.

`qa:step5b` also needs Mosquitto, `run_mqtt_consumer`, and a sensor login in
`MQTT_USER` / `MQTT_PASSWORD`. The 3D suites are slow on machines without a
GPU (software rendering); allow several minutes each.
