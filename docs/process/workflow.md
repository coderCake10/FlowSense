# Delivery workflow

This is the working agreement for turning QA observations into shipped fixes.
It applies to every step in the roadmap below.

## Roles

| Role | Responsibility |
|---|---|
| SQA | Owns the [QA tracker](../qa/qa-tracker.md). Turns each observation into a testable acceptance criterion, runs the quality gates, and signs off each step with a test report. |
| Senior developer | Implements fixes against the acceptance criteria, keeps diffs scoped, and adds automated tests for new logic. |
| Database / backend specialist | Owns schema, migrations, API wiring, and the backend items each step hands off (listed in each change record's "Backend handoff" section). |

## Flow for each step

1. **Triage.** The QA observation gets an ID (`QA-xx`) in the tracker, a root
   cause with a file reference, and an owner.
2. **Acceptance criteria.** Before code changes, write the checks that prove the
   fix (these become the browser QA checks and unit tests).
3. **Implement** on a feature branch. One step equals one focused change set.
   Do not mix unrelated clean-up into a step.
4. **Quality gates** (all must pass; see below).
5. **Check against the architecture notes.** Any behavior with a spec in
   `architecture-notes-main` must match it. If you deviate on purpose, record
   it in the conformance review.
6. **Document.** Add `docs/changes/step-NN-*.md` (what and why) and
   `docs/qa/step-NN-test-report.md` (evidence), and update the tracker status.
7. **Review and merge** through a pull request that links both documents.

## Quality gates

Run from `frontend/`:

| Gate | Command | Pass condition |
|---|---|---|
| Type check | `npm run check` | Exit code 0 |
| Lint | `npm run lint` | 0 errors. Existing warnings are tolerated, but no new warnings in touched files. |
| Unit tests | `npm test` | All pass |
| Build | `npm run build` | Succeeds |
| Browser QA | `npm run qa:stepN` for this step, plus every earlier step's suite (regression) | All checks pass; this step's suite passes on 3 consecutive runs (flake check) |

Backend gates, run from `backend/django` (setup in
[local development](../setup/local-development.md)):
`python manage.py check`, `python manage.py makemigrations --check --dry-run`,
and `python manage.py test --noinput`. All must pass. Steps that touch sign-in
also run `npm run qa:step4a` end to end against the real backend.

## Definition of Done

- Every acceptance criterion has an automated check that passes.
- No regressions: the gates above pass, and the lint error count did not rise.
- Visitor-facing copy is honest. It never claims a feature works when it is not
  connected yet (for example, the QR placeholder says so plainly).
- Error messages never reveal whether an admin account exists.
- The change record and test report are written, and the tracker is updated.

## Roadmap

| Step | Scope | Status |
|---|---|---|
| 1 | Kiosk flow fixes (aligned to the kiosk spec), label overlap, auth validation, sign-out dialog | Done, see [change record](../changes/step-01-kiosk-auth-signout.md) |
| 2 | Real QR handoff (kiosk to phone), shaped like the spec's QR session contract; mobile Navigation Checklist | Done, see [change record](../changes/step-02-qr-handoff.md) |
| 3 | **Revised:** building models installed locally, not in git (GitHub can't hold the complete models). The original 3D work (isometric view, view-hierarchy Back, floor focus, Draco, A Building coordinates, GLB in Map Annotation) is deferred until the models are installed locally. | Done, see [change record](../changes/step-03-local-models.md) |
| 4a | Backend platform: `/api/v1` layout, secure defaults, sign-in completed (email, rate limits, link), `create_admin`, route guard, test runner | Done, see [change record](../changes/step-04a-platform-and-auth.md) |
| 4b | Database conformance (DB-1 to DB-5) and EYA room seed | Done, see [change record](../changes/step-04b-database-conformance.md) |
| 4c+ | Missing API areas (settings, alerts, activity, system, analytics, assets) and kiosk device auth | Planned |

The source of truth for the database and API is `architecture-notes-main`
(06 Database, 07 API). Deviations are tracked in the
[conformance review](../architecture/conformance-review.md).
