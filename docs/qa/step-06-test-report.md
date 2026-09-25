# Step 6 test report

| | |
|---|---|
| Change record | [step-06-analytics.md](../changes/step-06-analytics.md) |
| Result | **All gates pass.** Backend 96/96 (12 new). New end-to-end suite 11/11. All earlier suites pass. |

## Gates

| Gate | Result |
|---|---|
| `manage.py check`, `makemigrations --check` | No issues, no changes (no schema change) |
| `manage.py test --noinput` | **96 passed** |
| `npm run check`, `npm test` | No errors, 52/52 |
| ESLint on the new and changed files | Clean |
| Colour validator (`validate_palette.js "#2f63b0,#b7860b" --mode light`) | All checks pass |
| **`npm run qa:step6`** (real backend) | **11/11** |
| `qa:step5b`, `qa:step4a` | 23/23, 13/13 |
| `qa:step1`, `qa:step2`, `qa:models` (demo mode) | 36/36, 22/22, 3/3 |
| The Analytics page in demo mode | Demo data and 5 charts, no page errors |

## Backend tests: known data in, exact numbers out

The fixture has:
- a kiosk registered 10 hours ago that was offline for 1 of them
- two sessions of 2 and 4 minutes
- 5 searches (3 successful; "guidanse" failed twice, once with different
  case and spacing)
- 3 navigation requests: 100 m single, 300 m queue of two, and one failure
- 2 QR codes, one scanned 8 seconds later
- a sensor registered 1 hour ago that sends every 60 s, with 30 readings

| Test | Expected result |
|---|---|
| Search | Totals 5 / 3 / 2 and a 60% success rate; "guidanse" ×2 heads the failed queries; latency 80 ms |
| Navigation | Library and Registrar 2 requests each; 1 queue out of 3 requests (33.3% multi); route success 66.7%; sequence Registrar → Library; lengths 200 / 100 / 300 m; turns not collected |
| Kiosks | 2 sessions averaging 180 s; 5 searches across the 24 hours; availability **90.0%** |
| QR | 2 generated, 1 scanned (50%); handoff 8.0 s; per-kiosk row; `qr/events` paginated (3 total, page of 2) |
| Sensors, spatial | 30 received of 60 expected (50%); average density 0.5 (moderate), peak 0.8 (high), at "EYA Building · 1F" |
| System, activity | Pathfinding average 100 ms; search-to-render and API success rate listed as not collected; activity totals across days |
| Filters | Building and floor filters narrow sensors and navigation |
| Errors | A bad range is a `VALIDATION_ERROR`; admin only |
| Date ranges | Presets, custom, semester, and invalid inputs |
| Trend alerts | Both alerts raised with the right severity; none on too little data |

The tests use a fixed 24-hour window ending just after the data, so they
don't depend on the time of day (an earlier "today" version would have failed
just after midnight).

## `qa:step6`

| ID | Check |
|---|---|
| A1 | Real analytics load (no demo notice) |
| A2 | "Total searches" equals `GET /analytics/search` for the last 7 days |
| A3 | Choosing Today re-fetches all 7 sections with `range=today` |
| A4, A5 | A custom range waits for both dates, then sends them |
| A6 | Building and floor reach navigation, sensors, and spatial (not search) |
| A7 | At least 5 "Not collected yet" cards, with reasons |
| A8 | The trend chart's "Show as table" lists 7 days |
| A9 | Charts are labelled images, with a legend |
| A10 | The alert panel and the reports notice are shown |
| E1 | No page errors |

## Visual check

Full-page screenshots with sample data were reviewed. They found:
- chart text scaling with the card width, fixed by drawing at the real width
- fractional ticks on count axes (7.5, 22.5), fixed with whole-number steps
