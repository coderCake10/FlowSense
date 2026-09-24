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
python manage.py seed_campus          # EYA Building floors and rooms (safe to re-run)
python manage.py create_admin --email you@auf.edu.ph --name "Your Name" --role "super admin"
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
pnpm install
VITE_API_BASE_URL=/api/v1 pnpm run dev     # Vite forwards /api to 127.0.0.1:8000
```

Without `VITE_API_BASE_URL` the admin pages run as an offline demo, and
sign-in reports that the service isn't connected. Building models are
installed separately; see [building-models.md](building-models.md).
