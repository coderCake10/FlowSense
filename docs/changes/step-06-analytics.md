# Step 6: Analytics API and the Analytics page

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Spec | `07 API/00 API Design.md` (Analytics API), `04 Application/02 Admin/08 Analytics.md`, `docs/openapi/flowsense-openapi.yaml` |
| Evidence | [Step 6 test report](../qa/step-06-test-report.md) |

## Endpoints

All are admin-only and take the contract's date filter: `?range=today`,
`last_7_days` (the default), `last_30_days`, `semester&semester_id=`, or
`custom&start_date=&end_date=` (dates or date-times, at most 366 days).
"Days" are local days (Asia/Manila).

| Endpoint | Returns |
|---|---|
| `GET /analytics/search` | Total, successful, and failed searches and the success rate; the daily trend; failed queries (frequency and last occurrence, case- and space-insensitive); Search API latency (average, P95) |
| `GET /analytics/navigation` (`?area_id=`, `?floor_id=`) | Top requested destinations; queue usage, average queue size, single versus multi-destination, route generation success, common destination sequences; average route length (overall, single, multi); most common routes |
| `GET /analytics/kiosks` (`?kiosk_id=`) | Sessions and average length; usage by hour of day and per day (sessions and searches); **availability** per kiosk |
| `GET /analytics/qr`, `GET /analytics/qr/events` (paginated) | Generated, scanned, and scan rate; handoff time (average, median, longest); per day; per kiosk |
| `GET /analytics/sensors` (`?area_id=`, `?floor_id=`) | Per sensor, expected versus received readings and transmission reliability, average and peak density; the overall figure |
| `GET /analytics/spatial` (`?area_id=`, `?floor_id=`) | Busiest monitored locations (average and peak density with a level); campus crowd density |
| `GET /analytics/system` | Search API and pathfinding latency (average, P95); sensor reliability |
| `GET /analytics/activity` | Per day: sessions, searches, navigation requests, queues, QR generated and scanned, admin actions |

**How the harder numbers are worked out:**

- **Kiosk availability** comes from the kiosk's *Device offline* alerts. The
  offline periods run from each alert's start to its clear time; availability
  is 1 minus that downtime, over the period since registration. A kiosk that
  is offline right now, before the scheduled check has raised an alert,
  counts from its last ping. No new table is needed.
- **Sensor reliability** is readings received ÷ (time since registration in
  the range ÷ sampling interval).
- **QR handoff time** is the navigation session's `scanned_at − created_at`.

**Not collected yet:** a metric the system doesn't record is `null`, with a
reason in `not_collected`. The page shows **"Not collected yet"** with that
reason, never an estimate.

| Metric | Why |
|---|---|
| Search-to-render time | The kiosk doesn't report render times |
| API request success rate | No table stores API requests (it isn't in the schema) |
| Route turns, floors crossed, buildings crossed, least-recommended segments | Routes aren't stored with their path yet. This comes with navigation on the annotated 3D models. |

**Contract note:** the contract defines `AreaIdFilter` and `FloorIdFilter`
but attached them only to `/analytics/navigation` (area only). The Analytics
spec's Building and Floor filters need them on navigation, sensors, and
spatial as well, so they were added there and in `flowsense-openapi.yaml`.

## Alert Panel

- **Offline kiosks are now critical** (the spec's "Kiosk Unavailable"
  example). Sensors stay at warning.
- A new hourly task, `analytics.evaluate_trends`, raises two alerts:
  - **High failed-search rate** (warning): the last 24 hours are at least
    5% and at least double the previous 7 days' rate, with at least 20
    searches.
  - **Increased kiosk usage** (informational): sessions this week are at
    least 20% above last week, with at least 20 sessions. Informational
    alerts clear themselves after the admin setting.

## Analytics page

- **Sticky filter bar** (always visible): Date (Today, Last 7 days, Last 30
  days, Semester with Academic year and Semester dropdowns, Custom range with
  two date pickers), plus Building, Floor, and Kiosk. Every section follows
  it. While data reloads, the page keeps its previous numbers, faded.
- **Sections** in spec order: Overview (figures and kiosk availability, 5 per
  page), Navigation, Spatial, Kiosk and usage (usage by hour, usage over time,
  QR handoffs over time, QR scan rate, QR by kiosk, handoff time), Destination
  queue, Route, System (latency; sensor reliability with a sensor picker),
  the Alert panel (sorted by severity, scrollable, with acknowledge and
  clear), and Reports.
- **Charts** (`components/Charts.tsx`) are plain SVG; no chart library was
  added. They follow the dataviz method:
  - The series colors, navy `#2f63b0` and gold `#b7860b`, were **validated**
    for colour-blind separation and contrast on white. All checks pass. The
    app's first navy failed the chroma check and its gold failed contrast, so
    both were re-stepped.
  - Lines are 2px, with a crosshair tooltip that lists every series. The
    arrow keys read the values too.
  - Columns are at most 24px wide, with a 2px gap, rounded data ends, a
    per-column tooltip, keyboard focus, and sideways scrolling for long
    ranges.
  - Every chart has one axis with whole-number ticks for counts and a legend
    for two series.
  - **"Show as table"** makes every value reachable without hovering.
  - Charts are drawn at their real width, so text stays 10px in half-width
    cards.
- **Reports** show a notice. Generated reports need somewhere to be stored
  (the schema has no reports table), and PDF output needs a library that
  isn't in the stack (QA-65).

## Waiting on the kiosk connection (next step)

Most analytics count kiosk events. Today the kiosk searches its own built-in
data, draws hand-placed routes, and builds the QR link in the browser, so it
doesn't yet create search, navigation, or QR events. Search, QR, and route
numbers stay at zero from the real kiosk until it uses the Search, Navigation,
and QR Session APIs. The API design lists the kiosk as a consumer of all
three (QA-66).

## Files

- **Backend:**
  - `analytics/ranges.py` and `analytics/metrics.py` (new)
  - `analytics/views.py`, `analytics/urls.py`, `analytics/alerts.py`
    (trend alerts), `analytics/tasks.py`, `analytics/tests.py`
  - `hardware/services.py` (kiosk offline alerts are critical)
  - `config/settings.py` (hourly trend task)
- **Frontend:**
  - `components/Charts.tsx`, `lib/analyticsApi.ts`, `lib/analyticsDemo.ts`
    (new)
  - `pages/workspaces/Analytics.tsx` (rewritten)
  - `e2e/step6.qa.mjs`, `package.json` (`qa:step6`)
- **Docs:** `openapi/flowsense-openapi.yaml` (area and floor filters), this
  record, the test report, and the tracker.
