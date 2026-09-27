# Step 11: Analytics reports

| | |
|---|---|
| Branch | `claude/admiring-heisenberg-gwhi4u` |
| Decided by the team (2026-09-26) | Reports store a **snapshot** of their figures in a new `analytics.reports` table; PDF is the browser's "Save as PDF" of a printable page; CSV is a ZIP. No new library. Scheduled reports come later. |
| Why a snapshot | Analytics figures change after the fact: late sensor readings, renamed rooms, cleaned-up sessions. A report that re-queried when downloaded would show different numbers from one week to the next. A snapshot always reads as it did on the day it was made. |
| Scope | Reports API, Analytics › Reports and exports, the printable report page, a date-range fix |
| Spec | `04 Application/02 Admin/08 Analytics.md` (Reports and Exports: period, section checkboxes, format, Generate), `07 API/00 API Design.md` (`/analytics/reports`) |
| Test report | [step-11-test-report.md](../qa/step-11-test-report.md) |
| Resolves | QA-17, QA-65, QA-97, QA-98 |

## What changed

### Backend (`apps/analytics`)

| Area | Change |
|---|---|
| `analytics.reports` (**new table**) | Title, sections, period, filters, format, status (pending, generating, completed, failed), the snapshot (`data`, JSON), error, who generated it, and when. CHECK constraints on status, format and period. It holds data, not files, so there's nothing to back up beyond the database. Recorded as DB-8 in the conformance review. |
| `reports.py` (**new**) | One builder per section: search, navigation and routes, kiosks, QR handoff, sensors, crowd density, system performance, daily activity. Each reuses the Analytics API's `metrics.py`. A section is a list of self-describing blocks (figures, tables, notes), because the contents vary with the data. A table with no rows says why ("No registered kiosks."). A figure the system doesn't record yet appears as a note, never as zero. A new section only needs a builder here; the page and the CSV draw any block. |
| API | `GET /analytics/reports` lists reports without their snapshots. `POST` validates the dates and sections, records the request in the audit log, and hands generation to Celery (202). `GET /{id}` returns the snapshot; `?download=csv` returns a ZIP with one CSV per block plus `00-summary.csv`, UTF-8 with a byte-order mark so Excel reads it correctly. A `schedule` in the request is refused with "Scheduled reports aren't available yet." |
| Period labels | The server writes the period ("Sep 20, 2026 to Sep 26, 2026") in its own time zone, so a viewer anywhere sees the days the report covers (QA-98). |
| Date-range fix (QA-97) | A custom range ending on a plain date stopped at that day's midnight, so the Analytics page's custom ranges were missing their whole last day. Plain dates are now read as whole local days. |

### Frontend

| Area | Change |
|---|---|
| Analytics › Reports and exports (`reports/ReportsPanel.tsx`) | Controls from the spec: From and To dates (last 7 days by default), a checkbox per section, a format (PDF or CSV), and Generate report. Generate waits until the report is ready, then opens the printable page (PDF) or downloads the ZIP (CSV). Recent reports lists the period, sections, author and status, with PDF and CSV actions. Nothing claims scheduled reports work. |
| Printable page (`/analytics/reports/:id`, `reports/ReportPage.tsx`) | Draws any snapshot: header (title, period, generated time and author, logo), then each section's figures, tables and notes. **Print or save as PDF** opens the browser's print dialog; printing hides the admin sidebar, header and buttons. It also has a CSV button. |
| `lib/reportsApi.ts` (**new**) | Types for the snapshot's blocks, hooks, generate-and-wait, and CSV download (a blob, so the session cookie is sent). |

## Not in this step

- **Scheduled reports** (spec P2: daily, weekly, monthly, semesterly), QA-99. They need a schedules table and a Celery beat task that creates snapshots.
- **Old reports are kept indefinitely.** Add clean-up if the table grows.

## Files

| File | Role |
|---|---|
| `backend/django/apps/analytics/models.py`, `migrations/0003_reports.py` | `analytics.reports` |
| `backend/django/apps/analytics/reports.py` (**new**), `tasks.py`, `serializers.py`, `views.py`, `urls.py` | Reports API |
| `backend/django/apps/analytics/ranges.py` | QA-97 |
| `backend/django/apps/analytics/tests.py`, `apps/map/tests.py`, `config/tests.py` | 7 new tests; the constraint counts include the reports table |
| `frontend/client/src/lib/reportsApi.ts`, `pages/workspaces/reports/*` (**new**) | Panel and printable page |
| `frontend/client/src/App.tsx`, `pages/workspaces/Analytics.tsx`, `components/FlowSenseShell.tsx`, `index.css` | Route, panel, print styles |
| `frontend/e2e/step11.qa.mjs` (**new**), `step6.qa.mjs` | `npm run qa:step11`; step 6's reports check updated |
| `docs/openapi/flowsense-openapi.yaml` | Reports documented, with the PDF deviation |
