# System audit 1: dead buttons, simulated actions, out-of-date documents

| | |
|---|---|
| Branch | `claude/admiring-heisenberg-gwhi4u` |
| Requested by the team (2026-09-26) | Test the whole system for features and buttons that do nothing or don't work, and bring the out-of-date documents up to date, before the 3D model work. |
| Scope | Documentation; Help, Asset Management and Map Annotation pages; a new browser suite |
| Test report | [audit-01-test-report.md](../qa/audit-01-test-report.md) |
| Resolves | QA-89, QA-90, QA-91, QA-92 |

## How the system was checked

1. Every gate in the [workflow](../process/workflow.md) on a fresh setup
   (PostGIS, seeded EYA, a super admin).
2. Every existing browser suite, each against the server it expects.
3. A click-through of every admin page: each button clicked on a freshly
   loaded page, recording whether it called the API, opened something,
   changed the page, or did nothing.
4. The source of every page, for handlers that only show a message.

## What was found and changed

| ID | Finding | Change |
|---|---|---|
| QA-89 | **Asset Management reported success for work that never happened.** Save, Add floor, Add transition, Activate, View model, View version and Upload all showed "saved", "requested" or "opened". With the API configured it also said "Asset API · connected", although the Assets API isn't built. "Begin processing" only turned a spinner on for 0.9 s. | A "Not connected yet" banner. Every action now says it isn't available yet and that nothing is saved. The status lines say "Sample data · not saved". Nothing pretends to call the API. The page layout is kept for the Assets API work. |
| QA-90 | **Help:** the four "Quick guides" buttons did nothing. "Open PDF manual" showed a toast. The file carried an unused Three.js import and sample device data. | Each guide opens with real steps and a link to its page. The Assets guide says it isn't available yet. The PDF card says the manual isn't published. The unused code is gone. |
| QA-91 | **Hardware → "View on map"** opened `/map-annotation?node=<id>`, but Map Annotation ignored `node`, so it showed the default floor with nothing selected. | Map Annotation reads `?node=`, opens that node's floor and selects it. A node that no longer exists is reported in the Selected point panel. |
| QA-92 | **Out-of-date documents.** `HANDOVER.md` described a frontend-only prototype with no backend and paths on another machine. `TECH_STACK.md` called the app static and TanStack Query unused. The roadmap stopped at "4c+ Planned". The conformance review listed built APIs as missing. The tracker had eight early items still Planned or Blocked after they were fixed. Two empty files (`test.txt`, `test2.txt`) and a stale bug note (`reference_findings.md`). | All rewritten or updated against the code (below). The empty files and stale note are removed. The browser suites' server setup is written down. |

## Documents updated

| Document | Change |
|---|---|
| `frontend/HANDOVER.md` | Rewritten for the current full-stack system: layout, running it, backend apps, page status, open items, conventions |
| `frontend/TECH_STACK.md` | TanStack Query in use, 3D with Draco models, more commands; removed the stale workspace note |
| `docs/process/workflow.md` | Roadmap brought to 9a, with 9b, 9c and the later items |
| `docs/architecture/conformance-review.md` | Refreshed against `main` after 9a: API table (13 of 14 areas built), kiosk and mobile spec rows, stack rows, kiosk device auth |
| `docs/qa/qa-tracker.md` | QA-05, 06, 07, 13, 14, 15, 16, 17 updated; QA-89 to QA-92 added |
| `docs/setup/local-development.md` | New "Browser QA suites" section: which server each suite needs |

## Click-through results (after the fixes)

Every button on every admin page was clicked on a fresh load, signed in as a
super admin against the live API.

| Page | Result |
|---|---|
| Dashboard | Every button leads somewhere: New map update → Map Annotation; the kiosk and sensor tiles → Hardware; Open analytics and View all activity → Analytics |
| Map Annotation | Floor buttons switch floors (1F already selected does nothing, as expected). Top down, Isometric and Reset view move the camera; the step 8b suite checks them. |
| Asset Management | The tabs switch; every action says it isn't available yet (`qa:audit1` A7) |
| Hardware | Refresh reloads; Register opens its dialog (the local database had one unregistered device and no registered ones) |
| Users | Add administrator and each row's Actions menu open |
| Analytics | The filters are drop-downs (date range, building, floor, kiosk); the step 6 suite checks them, 11/11 |
| Settings | Maintenance mode saves through the API; Add semester opens its form |
| Help | All four guides open |

The kiosk, phone handoff and sign-in were checked by their own suites (steps
1, 2, 4a, 7a, 7b, 8a, 8b, 8d and 8e, all passing). The Hardware "Ping" and
"Restart" buttons say they aren't available yet (QA-63), which is honest.

Two things seen during the run are not faults in the code. The console shows
certificate errors for Google Fonts, because the sandbox blocked them
(QA-69: the fonts aren't self-hosted yet). Floor buttons clicked while the
3D map was still redrawing in software took more than 3 s to respond; they
work once the scene settles.

## Still open (not changed here)

- **Assets API** (16 endpoints) and a connected Asset Management page. This
  belongs with the 3D model work.
- **Analytics reports** wait on the team decision in QA-65.
- Kiosk device authentication, BLE arrival, the kiosk Location Details
  sidebar and Area level (see the handover's open items).

## Files

| File | Role |
|---|---|
| `frontend/client/src/pages/workspaces/AssetManagement.tsx` | QA-89 |
| `frontend/client/src/pages/workspaces/HelpPage.tsx` | QA-90 |
| `frontend/client/src/pages/workspaces/MapAnnotation.tsx` | QA-91 |
| `frontend/e2e/audit1.qa.mjs` (**new**), `frontend/package.json` | `npm run qa:audit1` |
| Documents above; `test.txt`, `test2.txt`, `frontend/reference_findings.md` (**removed**) | QA-92 |
