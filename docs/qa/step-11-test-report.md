# Step 11 test report

| | |
|---|---|
| Change record | [step-11-reports.md](../changes/step-11-reports.md) |
| Result | **All gates pass.** Backend 141/141 (7 new). Frontend unit tests 92/92. New `qa:step11` 12/12 on three consecutive runs. |

## Gates

| Gate | Result |
|---|---|
| `manage.py check`, `makemigrations --check --dry-run` | No issues; the new migration is `analytics/0003_reports` |
| `manage.py test --noinput` | **141 passed** |
| `npm run check`, `npm test` | No errors, 92/92 |
| `npm run lint` | 0 errors, 35 warnings (unchanged; none in touched files) |
| `npm run build` | Succeeds |
| OpenAPI file | Parses (YAML) |

## Backend tests

| Test | Checks |
|---|---|
| `ReportApiTests.test_generates_the_chosen_sections` | Only the chosen sections, in order; figures and failed searches; unrecorded figures as notes; author; the last day included whole; the server's period label |
| `test_a_report_keeps_its_figures` | A search added after generation doesn't change the report; a new report counts it |
| `test_empty_tables_say_why` | "No registered kiosks." |
| `test_csv_download_is_a_zip_of_sections` | ZIP with `00-summary.csv` and one CSV per block; values present |
| `test_list_omits_snapshots_and_validates_requests` | List without `data`; unknown section, reversed dates and `schedule` refused; audit row |
| `test_csv_of_an_unfinished_report_is_refused` | 409 |
| `test_admin_only` | 401 |
| `DateRangeTests.test_presets_custom_and_errors` | QA-97: a date-only end runs to 23:59 that day. Fails on the old parser, passes on the fix. |
| `SpecDatabaseObjectsTests`, `CheckConstraintDriftTests` | The spec's 24 CHECK constraints, plus the reports table's 3 |

## Browser suite `qa:step11` (real backend; browser in New York time, server in Asia/Manila)

| ID | Check |
|---|---|
| F1–F2 | No sections, or an end before the start: Generate disabled, with the reason |
| P1–P6 | Generating opens the printable page; the title shows the server's days; only the chosen sections, in order; figures; Print or save as PDF; printing hides the sidebar and buttons |
| C1–C2 | CSV from the page, and CSV format from the panel, download a ZIP |
| L1 | Recent reports lists them as ready |
| E1 | No uncaught page errors |

Result: **12/12, three consecutive runs.**

## Regression suites

| Suite | Result |
|---|---|
| `qa:step6` (Analytics page) | 11/11 (A10 now checks for the reports panel instead of the old "not available" notice) |
| `qa:audit1` (admin shell, Help, Map Annotation) | 6/6 |

The kiosk, map and asset suites weren't re-run: this step doesn't touch the
kiosk, maps or Asset Management. The shared admin shell only gained print
styles, and `qa:audit1` and `qa:step6` exercise it.
