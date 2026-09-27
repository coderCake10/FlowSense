# System audit 1 test report

| | |
|---|---|
| Change record | [audit-01-system-check.md](../changes/audit-01-system-check.md) |
| Result | **All gates pass.** Backend 122/122, frontend 85/85. New `qa:audit1` 11/11. Every regression suite run passes. The admin click-through is recorded in the change record. |

## Gates

| Gate | Result |
|---|---|
| `manage.py check`, `makemigrations --check --dry-run` | No issues, no changes |
| `manage.py test --noinput` | **122 passed** |
| `npm run check`, `npm test` | No errors, 85/85 |
| `npm run lint` | 0 errors. Touched files: no new warnings (Asset Management 35 → 34) |
| `npm run build` | Succeeds |
| Prettier on changed files | Clean |

## Browser suites (each against the server it expects)

| Suite | Result |
|---|---|
| `qa:step1` (offline demo) | 36/36 |
| `qa:step2` | 22/22 |
| `qa:step7a` | 7/7 |
| `qa:step7b` | 13/13 |
| `qa:step6` (live API) | 11/11 |
| `qa:step8a` (live API) | 11/11 |
| `qa:step8b` | 10/10 |
| `qa:step8d` | 8/8 |
| `qa:step8e` | 7/7 |
| `qa:step4a` (live API) | 13/13. A first run failed L2, L5 and L7 because the backend's `FLOWSENSE_ADMIN_BASE_URL` pointed at :3000 while the suite ran on :3002. That was a setup error, now documented, not a code fault. |
| `qa:audit1` (**new**, live API) | **11/11** (A7: 9 of 9 Asset actions answer "isn't available yet", no success toast) |
| `qa:step5b`, `qa:models` | Not run: they need Mosquitto and a :3004 server respectively. This change touches neither the hardware pipeline nor model loading. |

## New checks (`e2e/audit1.qa.mjs`)

| ID | Check |
|---|---|
| A1 | Every Help quick guide opens |
| A2 | A guide's link opens its page |
| A3 | The PDF manual card says it isn't published; there is no button pretending to open it |
| A4 | Asset Management shows "Not connected yet" |
| A5 | It no longer claims the Asset API is connected |
| A6 | Upload says it isn't available |
| A7 | Asset actions say they aren't available; no toast reports success |
| A8 | No request is sent to the missing Assets API |
| A9 | `/map-annotation?node=<id>` selects that node |
| A10 | A node that no longer exists is reported |
| E1 | No uncaught page errors |

## How to re-run

Start the servers listed in
[local development → Browser QA suites](../setup/local-development.md#browser-qa-suites),
then `npm run qa:audit1` with `BACKEND_LOG` pointing at the backend's log.
