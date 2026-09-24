# Step 4a test report

| | |
|---|---|
| Change record | [step-04a-platform-and-auth.md](../changes/step-04a-platform-and-auth.md) |
| Environment | Python 3.11, Django 5.2.17, DRF 3.18.1, **PostgreSQL 16 + PostGIS 3.4** (the same major versions as the `postgis/postgis:16-3.4` image), Node 22, Chromium (Playwright 1.56.1) |
| Result | **All gates pass.** Backend 22/22 (the suite could not run before). End-to-end sign-in against the real backend 13/13 on 3 consecutive runs. Regression: step 1 36/36 ×3, step 2 22/22, missing-models 3/3. |

## Backend gates

| Gate | Before 4a | After 4a |
|---|---|---|
| `manage.py check` | No issues | No issues |
| `manage.py makemigrations --check` | No changes | No changes |
| `manage.py migrate` (fresh PostGIS database) | OK | OK |
| `manage.py test --noinput` | **Crashed.** A `test` command in `hardware` shadowed Django's. Even after removing it, **0 tests** were discovered. | **22 passed** in 0.4 s |
| Debug off without `DJANGO_SECRET_KEY` | Started with the published development key | **Refuses to start** |
| `manage.py check --deploy` | n/a | 5 warnings: HTTPS-only settings (HSTS, SSL redirect, secure CSRF and session cookies), plus W009 for the short test key used in the check. Tracked as QA-40. |

## Backend tests (22)

- **Platform** (`config/tests.py`)
  - Public endpoints answer without a session.
  - Admin endpoints return **401 with an `AdminSession` challenge, not
    `Basic`**.
  - The trailing slash is optional, including a POST without the slash.
  - The old unversioned prefixes return 404.
  - DRF defaults to admin-only.
  - **Every Celery beat task is registered.**
- **Authentication** (`authentication/tests.py`)
  - Login emails a 6-digit code **and a link that verifies on its own**.
  - An unknown email gets the identical response and no email
    (anti-enumeration).
  - The full lifecycle works: verify, then an HttpOnly cookie (the raw token
    never appears in the response body), then `/auth/session`, `/auth/me`,
    logout, then 401.
  - A wrong code gets 401, and a code works only once.
  - A disabled admin's existing session gets 403.
  - **Throttling:** login is limited per IP; verify is limited per email
    across 5 different IPs.
  - `/users` requires a super admin (401 anonymous, 403 for an admin).
  - Creating an admin sends a welcome email.
  - `create_admin` creates the first super admin (normalizing the email) and
    rejects duplicates.
- **Sessions** (`fs_sessions/tests.py`)
  - A kiosk session without a kiosk gets **400, not 500**.
  - Session endpoints stay public under the admin-only default.
  - The cleanup task runs.
- **Hardware** (`hardware/tests.py`): the device registry needs an admin.

## End-to-end browser checks (`e2e/step4a.qa.mjs`)

These run against the real stack: Django + PostGIS, then the Vite proxy, then
the browser. Nothing is mocked. The sign-in code and link come from the email
the backend actually printed.

| ID | Check | Result |
|---|---|---|
| G1 | Admin pages redirect to `/auth` without a session | Pass |
| L1 | Requesting a code advances to the code step | Pass |
| L2 | The backend emails a 6-digit code and a link to the admin frontend | Pass |
| L3 | A wrong code is rejected by the real backend | Pass |
| L4 | The right code signs in and opens the dashboard | Pass |
| L5 | The sidebar shows the real admin from `/auth/me`, not "Admin Admin" | Pass |
| L6 | The session cookie is HttpOnly | Pass |
| L7 | The session survives a reload | Pass |
| S1 | After sign-out, admin pages redirect to `/auth` again | Pass |
| K1 | The emailed link signs in with one click | Pass |
| K2 | A used link is refused with a clear message | Pass |
| K3 | The token is removed from the address bar | Pass |
| E1 | No uncaught page errors | Pass |

## Defects found during 4a verification

| ID | Found by | Defect | Fix |
|---|---|---|---|
| QA-34 | Baseline `manage.py test` | The test command crashed (shadowed by the `hardware` command, which printed the MQTT credentials) | Command deleted |
| QA-35 | Route probe | `/api/hardware/device/` open without a session | Admin-only default |
| QA-36 | Route probe | `POST /sessions/kiosk` without a kiosk returned 500 | Serializer requires the field |
| QA-37 | Baseline | 0 tests discovered | Test runner |
| QA-38 | Timing probe with the broker down | Login hung about 20 s while Celery retried the broker and result store | Fail-fast queuing; about 6 s, still 200 |
| QA-39 | Code review | `/auth/me` shape didn't match the UI profile type | `toAdminProfile()` |
| QA-41 | Review | No way to create the first administrator | `create_admin` command |

## Test-harness notes (not app defects)

- **Throttle rates can't be changed with `override_settings`.** DRF copies
  them onto the class at import, so the tests patch
  `SimpleRateThrottle.THROTTLE_RATES` instead.
- **Setting `app.conf.task_always_eager` has no effect** when a
  `CELERY_TASK_ALWAYS_EAGER` Django setting exists (the app reads Django
  settings with the `CELERY` namespace). The runner sets the Django setting.
  This took the suite from about 3 minutes (broker retries) to 0.4 s.
- **Run 3 of the end-to-end suite got HTTP 429 on two checks.** The backend
  log confirmed that the 11th and 12th verify calls within one minute were
  throttled, which is the per-IP limit working. For repeated QA runs, the
  backend is started with `THROTTLE_AUTH_LOGIN=100/min`,
  `THROTTLE_AUTH_VERIFY=100/min`, and `THROTTLE_AUTH_VERIFY_EMAIL=100/hour`.
- **The step 1 suite mocked `/auth/me` as 401**, which the new route guard
  now answers by returning to sign-in (the intended behavior). The mock now
  returns a signed-in profile.

## How to re-run

See [local development](../setup/local-development.md) for the database and
virtual environment setup.

```bash
# Backend tests
cd backend/django && python manage.py test --noinput

# End-to-end (three terminals)
CELERY_TASK_ALWAYS_EAGER=True ADMIN_SESSION_COOKIE_SECURE=False \
FLOWSENSE_ADMIN_BASE_URL=http://127.0.0.1:3000 \
THROTTLE_AUTH_LOGIN=100/min THROTTLE_AUTH_VERIFY=100/min THROTTLE_AUTH_VERIFY_EMAIL=100/hour \
  python manage.py runserver 127.0.0.1:8000 > /tmp/flowsense-django.log 2>&1
python manage.py create_admin --email head@auf.edu.ph --name "Maria Santos" --role "super admin"
cd frontend && VITE_API_BASE_URL=/api/v1 pnpm exec vite --host 127.0.0.1 --port 3000
BACKEND_LOG=/tmp/flowsense-django.log pnpm run qa:step4a

# Regression suites need an unconfigured frontend (no VITE_API_BASE_URL):
pnpm exec vite --host 127.0.0.1 --port 3005
BASE_URL=http://127.0.0.1:3005 pnpm run qa:step1
BASE_URL=http://127.0.0.1:3005 pnpm run qa:step2
```
