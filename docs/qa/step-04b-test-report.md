# Step 4b test report

| | |
|---|---|
| Change record | [step-04b-database-conformance.md](../changes/step-04b-database-conformance.md) |
| Environment | PostgreSQL 16 + PostGIS 3.4, Django 5.2.17 |
| Result | **All gates pass.** Backend 38/38 (16 new, including 3 after the team confirmed the room conventions). Migrations verified in PostgreSQL, reversed, and re-applied. End-to-end sign-in regression 13/13. |

## Gates

| Gate | Result |
|---|---|
| `manage.py check` | No issues |
| `manage.py makemigrations --check` | No changes |
| `manage.py migrate` on the development database | 10 migrations applied |
| Reverse (`configuration zero`, the others back to `0001`) and re-apply | Clean both ways |
| `manage.py test --noinput` | **35 passed** |
| `pnpm run qa:step4a` (real backend, after the new constraints) | 13/13 |

## Verified in PostgreSQL directly

| Check | Result |
|---|---|
| `chk_*` CHECK constraints in `pg_constraint` | **24** (the spec has 24) |
| `idx_rooms_search` | Present, GIN |
| `SELECT … FROM assets.asset_audit_history` | Works (0 rows) |
| `operations.settings` | `informational_alert_clear_time = {"seconds": 3600}` |
| Nullable CHECK (`chk_sensors_mqtt_status`) | `… OR (mqtt_status IS NULL)` |
| After reversing | 1 constraint (the original edge check); settings, view, and index gone |
| After re-applying | 24 again |

## Spec-versus-model comparison (before adding constraints)

A script parsed every `CHECK (col IN (...))` in the schema document and
compared it with the Django field's `choices`. **22 of 22 matched**, so
enforcing them in the database rejects no value the application allows.

## New tests (13)

- **Configuration:** the default setting is seeded; a semester that ends
  before it starts is rejected (`IntegrityError`); a valid semester saves.
- **Database objects:**
  - exactly 24 `chk_*` constraints exist
  - PostgreSQL rejects `area_type = 'spaceship'`
  - the GIN index exists
  - the audit view can be queried
- **Drift:** every one of the 22 `chk_*` value constraints equals its field's
  `choices`.
- **Seed:**
  - AUF, then EYA, then 6 floors, 92 rooms, and 2 exits, with 15/16/16/18/14/13
    rooms per floor
  - EA-110's alias and original label are stored
  - a re-run creates nothing, updates 102 rows, and **keeps an admin-set
    image**
  - **every room code in the kiosk's `eyaNavigation.ts` exists in the seed**
    (skipped when the frontend source isn't present, as in the backend
    container)
  - a seeded room is found through `/api/v1/search`

## Manual API probe after seeding

| Request | Result |
|---|---|
| `GET /api/v1/search?q=EA-110` | EA-110, score 1.0 (room code) |
| `GET /api/v1/search?q=psych` | EA-309 Psychology Laboratory (alias) |
| `GET /api/v1/search?q=dean` | Deans' offices (matched on the document label) |
| `GET /api/v1/search/suggestions?q=hard` | "Hardware Laboratory (EA-613)" |
| `GET /api/v1/search?q=guidanse` | **No results.** Logged as QA-42 (typo tolerance). |

## Test fixes during 4b (not app defects)

- The first version of the kiosk cross-check test used the wrong parent
  directory and would also have failed inside the backend container, which
  mounts only `backend/django`. It now resolves the correct path and skips
  with a stated reason when the frontend isn't present.
- `skipUnless` is imported from `unittest`, not `django.test`.

## Update: confirmed room conventions (QA-43)

After the team confirmed the conventions (lettered rooms keep their letter, as
in `EA-101A`; unnamed rooms are lecture or laboratory rooms), three tests were
added:
- lettered codes use the `EA-101A` form, and no `-A`/`-B` codes remain
- a room seeded as `EA-101-A` is renamed in place on re-seed, keeping its
  image
- unnamed rooms are described as "Lecture or laboratory room"

On the development database, re-seeding renamed the four legacy codes in
place: 92 rooms before and after, with none created.

**Regression:** step 1 36/36 (K19 now checks `EA-101A`) and step 2 22/22.

**Observed while re-running:** replaying the branch onto `main` removed the
local `.glb` files. This is the teammate scenario in
[building-models.md](../setup/building-models.md), section 4. The documented
`git show 35e4bbe:…` restore brought them back, and `models:check` passed.
