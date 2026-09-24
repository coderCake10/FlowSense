# Step 4a: Backend platform, API layout, and admin sign-in

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Resolves | QA-18, QA-19, QA-20, QA-21; QA-25 (routing part); new findings QA-34 to QA-41 |
| Spec | `architecture-notes-main`: 07 API (endpoint layout), 02 System Architecture/07 Authentication, 08 Security Architecture |
| Evidence | [Step 4a test report](../qa/step-04a-test-report.md) |

Step 4 (backend and database to spec) is delivered in sub-steps. **4a** is the
platform everything else builds on: routing, security defaults, sign-in, and
tooling. **4b** covers database conformance and the EYA seed. **4c onward**
covers the missing API areas and kiosk device authentication.

## 1. API layout matches the design doc

| Area | Before | After |
|---|---|---|
| Auth and Users | Implemented, **not mounted** (404) | `/api/v1/auth/*`, `/api/v1/users` |
| Map, Navigation, Search | `/api/map/`, `/api/navigation/`, `/api/search/` | `/api/v1/map/`, `/api/v1/navigation/`, `/api/v1/search` |
| Annotation | `/api/annotation/` | `/api/v1/annotations` (plural, as specified) |
| Hardware | `/api/hardware/device/` | `/api/v1/hardware/devices` |
| Sessions | `/api/v1/sessions/` | unchanged |

**Trailing slash is optional.** The spec and the frontend write endpoints
without a trailing slash, while Django routes end in `/`. Django's
`APPEND_SLASH` answers with a redirect, which drops a POST body.
`common.middleware.ApiTrailingSlashMiddleware` appends the slash internally
for `/api/` paths, so both forms reach the view with no redirect. The old
unversioned prefixes are removed; the frontend never used them.

## 2. Secure by default

- **DRF defaults to admin-only**
  (`DEFAULT_PERMISSION_CLASSES = [common.permissions.IsAdminUser]`). Public
  endpoints opt out explicitly.
  - **Fixed:** `/hardware/devices` had no permission class and was **open to
    anyone** (QA-35). It now requires an admin session.
  - The 16 kiosk, navigation, and QR session views are explicitly `AllowAny`,
    because visitors' kiosks and phones call them. Kiosk device
    authentication (QA-28) is still to come.
- **Real 401s.** `common.authentication.AdminSessionCookieAuthentication`
  gives DRF a `WWW-Authenticate: AdminSession` challenge. Without it, DRF
  turns "not signed in" into 403. The challenge is deliberately not `Basic`,
  which would make browsers show a password pop-up.
- **Settings come from the environment:** `DJANGO_DEBUG`, `DJANGO_SECRET_KEY`
  (Django **refuses to start** with the development key when debug is off),
  `DJANGO_ALLOWED_HOSTS`, and `DJANGO_CSRF_TRUSTED_ORIGINS`. Debug accepts
  any host, so kiosks and phones can reach a dev stack by LAN IP.
- **Missing apps registered:** `django.contrib.gis` (the models use PostGIS
  fields) and `django.contrib.postgres`.

## 3. Admin sign-in completed and hardened

| Item | Change |
|---|---|
| Emails were never sent (QA-21) | `services._send_login_challenge_email()` and `create_admin_user()` queue `authentication.tasks` through Celery once the transaction commits. Emails print to the console unless SMTP is configured (`EMAIL_*`). |
| Broker outage | Queuing is fail-fast (`retry=False`, `ignore_result=True`) and a failure is logged, not raised. Login still answers 200 in about 6 s instead of hanging about 20 s. The response is identical either way, so nothing leaks. |
| Rate limiting (QA-20) | `common.throttling`: login at 5/min per IP, verify at 10/min per IP **and** 10/hour per target email across all IPs, so guesses at one admin's code can't be spread over many addresses. Configurable with `THROTTLE_AUTH_*`. The counters use Redis in Docker (`REDIS_CACHE_URL`) so every process shares them. |
| Login link (QA-19) | The emailed link is now `{FLOWSENSE_ADMIN_BASE_URL}/auth?email=…&token=…`. The frontend verifies it automatically and removes the token from the address bar. The old link pointed to a `/login/verify` page that doesn't exist and left out the email that verify needs. |
| Cookie over HTTP | `ADMIN_SESSION_COOKIE_SECURE` (default `True`). Set `False` only for plain-HTTP LAN setups, because browsers drop Secure cookies there. |
| **First administrator** (QA-41) | **New** `manage.py create_admin --email … --name … --role "super admin"`. Before this there was no way to create the first admin: `/users` needs a super-admin session, and sign-in is passwordless. |

## 4. Admin frontend

- **Route guard (QA-18).** With an API configured, every admin page first
  loads `/auth/me`. A 401 or 403 redirects to `/auth`. An unreachable server
  shows "Can't reach the FlowSense server" with **Try again**. The offline
  demo (no `VITE_API_BASE_URL`) is unchanged.
- **Real profile.** The sidebar and header show the signed-in admin's name,
  email, initials, and role. Before, they showed a hardcoded "Admin Admin".
  `toAdminProfile()` maps the backend shape (`full_name`, `"super admin"`) to
  the UI shape. The old code assigned it directly, which would have shown
  blank values (QA-39).
- **Link sign-in** on `/auth`, as described above.
- **Dev proxy:** `vite.config.ts` forwards `/api` to Django
  (`VITE_API_PROXY_TARGET`, default `http://127.0.0.1:8000`), so
  `pnpm run dev` works without nginx. Docker Compose sets
  `VITE_API_BASE_URL=/api/v1` for the frontend.

## 5. Tooling and operations fixes

| Problem | Fix |
|---|---|
| **`manage.py test` crashed:** `hardware/management/commands/test.py` shadowed Django's `test` command, and all it did was print the MQTT credentials (QA-34) | Deleted |
| `manage.py test` found **0 tests**, because `apps/` isn't a package (QA-37) | `config.test_runner.FlowSenseTestRunner` tests every app by default and runs Celery tasks inline |
| `POST /sessions/kiosk` with no kiosk → **500** `KeyError` (QA-36) | The serializer requires `kiosk`, so a missing one is now a 400 |
| Celery beat pointed to modules that don't exist (`apps.qr_sessions…`, `apps.analytics…aggregate_daily_traffic`) | Schedules the tasks that exist: session sweep (hourly, **new** `fs_sessions/tasks.py`), auth challenge cleanup (hourly), admin session cleanup (daily). A test asserts every scheduled task is registered. Analytics aggregation comes with the Analytics API (4c+). |
| MQTT consumer: deprecated paho v1 callbacks; broker host hardcoded | Callback API v2; `MQTT_HOST`/`MQTT_PORT`; requirements `paho-mqtt>=2.0,<3` |
| Docker Compose: `mqtt-consumer` had a `POOSTGRES_PORT` typo, a hardcoded user, and no `.env`; Celery containers lacked `.env` | Fixed. `.env` is shared with backend, workers, and consumer. The backend gets `REDIS_CACHE_URL`. |

## Files

**Backend:**
- `config/settings.py`, `config/urls.py`, `config/test_runner.py` (new),
  `config/tests.py` (new)
- `common/authentication/` (new), `common/middleware/__init__.py`,
  `common/throttling.py` (new)
- `authentication/services.py`, `authentication/tasks.py`,
  `authentication/views/login.py`, `authentication/views/verify.py`,
  `authentication/management/commands/create_admin.py` (new),
  `authentication/tests.py`
- `fs_sessions/views/*.py`, `fs_sessions/serializers/kiosk_sessions.py`,
  `fs_sessions/tasks.py` (new), `fs_sessions/tests.py`
- `hardware/urls.py`, `hardware/management/commands/run_mqtt_consumer.py`,
  `hardware/tests.py`; `hardware/management/commands/test.py` (deleted)
- `requirements.txt`

**Frontend:**
- `components/FlowSenseShell.tsx`, `pages/experience/AuthPage.tsx`,
  `lib/api.ts`, `vite.config.ts`
- `e2e/step4a.qa.mjs` (new); `e2e/step1.qa.mjs` (its mock now answers
  `/auth/me`)

**Ops:** `docker-compose.yml`, `.env.example`,
`docs/setup/local-development.md` (new)

## Known limitations (tracked)

- Six API areas are still unbuilt: assets, analytics, alerts, activity,
  settings, and system (QA-25, step 4c+).
- Kiosk device authentication (QA-28).
- The HTTPS hardening flagged by `check --deploy` (HSTS, SSL redirect, secure
  CSRF and session cookies) belongs with the HTTPS deployment (QA-40).
- OTP codes and link tokens pass through the Celery broker (Redis) as task
  arguments. They're short-lived and single-use, and the broker is internal
  to the Docker network.
