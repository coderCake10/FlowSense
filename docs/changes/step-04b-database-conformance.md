# Step 4b: Database matches the spec, and the EYA Building is seeded

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Resolves | QA-23 (DB-1 to DB-3), QA-24 (DB-4), DB-5; the EYA room data from the "EYA LABELS" document |
| Spec | `architecture-notes-main/06 Database/01 Final Database Schema.md` |
| Evidence | [Step 4b test report](../qa/step-04b-test-report.md) |

## Summary

The database now contains every table, view, index, and CHECK constraint in
the final schema. The EYA Building's 6 floors and 92 rooms from the labels
document load with one idempotent command.

## Schema changes

| Spec item | Before | After | Migration |
|---|---|---|---|
| **DB-1** `operations.settings`, seeded with `informational_alert_clear_time = {"seconds": 3600}` | Missing | **New** `configuration` app, `Setting` model; seed as a data migration that never overwrites a value an admin changed | `configuration/0001`, `0002` |
| **DB-2** `operations.semesters` with `CHECK (start_date <= end_date)` | Missing | `Semester` model with `chk_semesters_date_range` | `configuration/0001` |
| **DB-3** `assets.asset_audit_history` view | The unmanaged model existed, but **no migration created the view** (queries failed) | Created exactly as specified | `assets/0003` |
| **DB-4** 24 `CHECK` constraints | Only `chk_edge_nodes_different` existed; the rest were Django `choices`, which the database doesn't enforce | **All 24 enforced by PostgreSQL** | `0002_spec_check_constraints` in map, hardware, authentication, fs_sessions, analytics, assets |
| **DB-5** `idx_rooms_search` GIN full-text index | Missing | Created with the spec's expression, which is the same expression `search.services` builds | `map/0003` |

> **Superseded on 2026-09-24:** at the team's request these models moved into
> `common`, which is where the API design places Settings. The tables didn't
> change. See [step-04-stack-decisions.md](step-04-stack-decisions.md).

**Why a `configuration` app?** The API design places Settings under
"common/settings", but `common` holds shared code, not models. `configuration`
owns both tables and will host the Settings and System APIs (step 4c).

**How the CHECK constraints are defined.** Before adding them, each of the
spec's 22 value-list CHECKs was compared with the matching Django field's
`choices`. **All 22 matched**, so enforcing them rejects no valid value. Each
model's `Meta` declares them with `common.db.choice_check()`. Nullable fields
(`sensors.mqtt_status`, `kiosk_sessions.end_reason`) explicitly allow NULL.
The allowed values are written out in each `Meta` because a nested `Meta`
class can't see the model's `CHOICES` constants. A unit test asserts that
every `chk_*` constraint equals its field's choices, so the two can't drift.

**Existing databases:** the migration adds the constraints to existing
tables. If any row holds a value outside the spec, the migration fails and
names the constraint. Fix the row, then migrate again.

**Reversible:** every new migration was rolled back and re-applied. Rolling
back leaves only the original edge constraint and removes the table, view,
and index; re-applying restores all 24 constraints.

**The spec error remains** (noted in the conformance review):
`operations.alerts.alert_type` allows the severity values
(`informational`/`warning`/`critical`) because the spec says so. Change it in
the spec first, then in the model and a migration.

## EYA Building seed

`python manage.py seed_campus` loads `map/seed_data/eya.py`, which is
transcribed from Tab 1 of the "EYA LABELS" document:

| | Count |
|---|---|
| Campus area | `AUF`, Angeles University Foundation |
| Building | `EYA`, EYA Building (child of AUF) |
| Floors | 6 (floor order 1–6) |
| Rooms | 92: 15 / 16 / 16 / 18 / 14 / 13 per floor |
| Entrances | 2 first-floor exits (near EA-109 and EA-106; the document marks them as "Exit" between those rooms) |

**Normalization decisions (confirmed by the team, QA-43):**
- **Room codes** are `EA-` + the room number, and a room's letter stays part of
  its number: `EA-110`, `EA-101A`, `EA-101B`, `EA-210A`, `EA-210B`. The
  document mixes `101A`, `EA - 201`, and `EA301`. The kiosk's EA-101A
  destination was updated to match (its internal ID is unchanged, so QR links
  already issued still work). Rows seeded with the earlier `EA-101-A` style are
  renamed in place by `seed_campus`, keeping any annotations.
- **Aliases** expand abbreviations so search works: "FC" becomes "Faculty
  Center", "Dept. of Psych" becomes "Faculty Department of Psychology",
  "Comm" becomes "Communication", and "Lab" becomes "Laboratory". The
  document's exact wording is kept in each room's `description` and is also
  searchable.
- **CAS** is "College of Arts and Sciences" (confirmed).
- **Rooms with no name** in the document are lecture or laboratory rooms
  (confirmed). They're called "Room EA-###" (the alias column is `NOT NULL`)
  and described as "Lecture or laboratory room". The document doesn't say
  which are labs, so none is guessed. "Open" rooms 505, 506, and 510 are
  "Open Room EA-5##".
- **Room types:** offices and faculty rooms are `office`; labs and studios are
  `laboratory`; the clinic, canteen, and resource center are `facility`;
  supply rooms are `service`; unnamed rooms are `room`.

**Safe to re-run:** rows are matched by natural key (area code, floor order,
room code per floor, entrance name) and updated in place. Geometry, images,
and personnel are never touched, so annotations made in the admin survive a
re-seed.

**Not seeded:** room geometry and navigation nodes (they come from Map
Annotation on the complete models, which is deferred), personnel (not in the
document), and the A Building (not in the document).

## Files

**Backend:**
- `common/db.py` (new)
- `apps/configuration/` (new app: models, admin, 2 migrations, tests)
- Models (constraints): `map`, `hardware`, `authentication`, `fs_sessions`,
  `analytics`, `assets`
- 6 `0002_spec_check_constraints` migrations, `map/0003_rooms_search_index`,
  `assets/0003_asset_audit_history_view`
- `map/seed_data/eya.py`, `map/management/commands/seed_campus.py` (new)
- Tests: `map/tests.py`, `configuration/tests.py`, `config/tests.py` (drift
  test)
- `config/settings.py` and `config/test_runner.py` (register `configuration`)

**Docs:** this record, the test report, the tracker, the conformance review,
and the local development guide.

## Found during 4b

**QA-42.** Typo tolerance in search is weak for long room names. `guidanse`
finds nothing, because trigram similarity is measured against the whole
alias "Guidance and Counseling Center (Extension Office)". Suggested fix:
`TrigramWordSimilarity` (pg_trgm `word_similarity`) for aliases. This belongs
to the Search API and is logged, not changed here.
