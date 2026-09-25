# Stack decisions and the Settings move to `common`

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Date | 2026-09-24 |
| Trigger | SQA audit: things used that aren't in `architecture-notes-main/01 Technology/00 Tech Stack.md` |
| Resolves | QA-53, QA-54 |

## Why

The team's rule is: use only what's in the tech stack and the architecture
notes, and confirm with the team before adding anything else. An audit found
items that were added without that confirmation. The team reviewed each one
and decided as below.

## Decisions

| Item | Decision | What was done |
|---|---|---|
| `qrcode.react` | Keep | Recorded as an approved addition in the conformance review |
| `paho-mqtt` 2.x | Keep | Recorded as an approved addition |
| Test tools (`playwright`, `jsqr`, `pngjs`, `vitest`) | Keep, dev-only (usual practice) | Confirmed they're `devDependencies`. They don't ship in a production build. |
| Separate `configuration` app | **Move into `common`**, as the API design says ("common/settings") | Done. See below. |
| Arduino IDE | Approved; the team's ESP32 firmware already exists | The untested sample sketch was removed from the setup guide. The guide now only checks that the existing firmware matches what the backend expects. |
| iPad kiosk | Temporary, for the presentation and defense (one kiosk) | The setup guide labels it temporary. HR-01 to HR-06 stay for handover. |

## The Settings move

`Setting` (`operations.settings`) and `Semester` (`operations.semesters`)
moved from `apps/configuration/` to `common/`. The table names, columns, and
constraints are unchanged.

`common/migrations/0001_initial.py` is written to be safe for both kinds of
database:

| Database | What happens |
|---|---|
| Fresh | The tables, the FK to `operations.admin_users`, and the indexes are created |
| One that ran the old `configuration` migrations (a teammate's) | The existing tables and their data are **kept** (`CREATE ... IF NOT EXISTS`). The stale `configuration` rows in `django_migrations` are removed. |

`0002_seed_default_settings` adds `informational_alert_clear_time` only if
it's missing, so a value an admin changed is never overwritten.

**Teammates:** run `python manage.py migrate` after pulling (on Docker,
`docker compose exec backend python manage.py migrate`). Nothing else is
needed.

## Evidence

| Check | Result |
|---|---|
| `manage.py check`, `makemigrations --check` | No issues, no changes |
| Database built with the **previous** code, admin-changed setting (`120`) and a semester added, then migrated with the new code | `common.0001`, `0002` applied. The setting stayed `120`, the semester was kept, the `configuration` rows were removed, and all 24 `chk_*` constraints are present. |
| `migrate common zero`, then `migrate` | The tables are dropped, then re-created and re-seeded (`3600`) |
| `manage.py test --noinput` | **45 passed**. The 3 moved tests now run as `common.tests`. |

## Files

- `common/models.py`, `common/admin.py`, and `common/tests.py` (moved from
  `apps/configuration/`)
- `common/__init__.py`, `common/migrations/0001_initial.py`, and
  `common/migrations/0002_seed_default_settings.py` (new)
- `apps/configuration/` (removed)
- `config/settings.py` and `config/test_runner.py` (removed the `configuration` entry)
- Docs: this record, the conformance review (tech stack section and DB-1),
  a superseded note in the 4b record, and the tracker

## Update 2026-09-25: package manager, deployment, and scope

| Item | Decision | What was done |
|---|---|---|
| Package manager | **npm**, as the stack notes say | `pnpm-lock.yaml` became `package-lock.json`. **Every package is locked to the exact version pnpm had installed** (85 direct dependencies checked one by one), so nothing was upgraded. The Dockerfile uses `npm ci`. The docs and scripts use `npm run …`. The root `FlowSense/package.json`, which only installed pnpm, was removed, along with two stray dev dependencies (`pnpm`, and a package named `add` that nothing imports). |
| Hosting for the defense | One laptop runs everything with Docker Compose. A phone hotspot with mobile data connects the laptop, iPad, ESP32, and phones. | Production setup targets this. At handover, the same Compose setup moves to the client's server. |
| HTTPS | Plain HTTP on the closed demo network. The Nginx HTTPS setup is built now but switched off, and is enabled at handover with AUF's domain and certificate. | Planned (production setup) |
| Phone Bluetooth detection (mobile) | Not demonstrated at the defense (it needs HTTPS and Android Chrome) | The **QR handoff is demonstrated** at the defense; it works over HTTP |
| Sign-in emails | A project Gmail account (`flowsense.capstone@gmail.com`) through Gmail SMTP with an App Password; Django's built-in email, nothing new | `.env.example` has commented placeholders. The real password goes in `.env` only (QA-56). |
| Workflow Engine (enrollment, clearance) | **Out of scope.** It's only an example of why a visitor uses the kiosk. | Recorded in the conformance review |
| Production application server (Gunicorn) | **Deferred.** Still in development, so `runserver` stays for now. Revisit before handover. | QA-55 stays open |

### Evidence (npm)

| Check | Result |
|---|---|
| `npm ci` from `package-lock.json` | Installs; direct dependency versions equal the old pnpm lock |
| `npm run check` | No TypeScript errors |
| `npm test` | 46/46 |
| `npm run build` | Succeeds |
| `npm run models:check` | OK |
| `npm run qa:step1`, `qa:step2`, `qa:models` | 36/36, 22/22, 3/3 |
