# FlowSense documentation

| Area | Document | Purpose |
|---|---|---|
| Process | [process/workflow.md](process/workflow.md) | How work moves from QA observation to merged change: roles, quality gates, Definition of Done |
| Architecture | [architecture/conformance-review.md](architecture/conformance-review.md) | How the code compares with `architecture-notes-main` (DB schema, API design, auth, kiosk spec, tech stack) |
| QA | [qa/qa-tracker.md](qa/qa-tracker.md) | Every QA observation, its root cause, and its status |
| QA | [qa/step-01-test-report.md](qa/step-01-test-report.md) | Step 1 test plan, results, and how to re-run them |
| Changes | [changes/step-01-kiosk-auth-signout.md](changes/step-01-kiosk-auth-signout.md) | Step 1 change record: what changed, why, and backend handoff |
| Changes | [changes/step-02-qr-handoff.md](changes/step-02-qr-handoff.md) | Step 2 change record: QR handoff and mobile checklist |
| QA | [qa/step-02-test-report.md](qa/step-02-test-report.md) | Step 2 test plan, results, and how to re-run them |
| Setup | [setup/local-development.md](setup/local-development.md) | Running backend and frontend without Docker, and running the tests |
| Changes | [changes/step-04a-platform-and-auth.md](changes/step-04a-platform-and-auth.md) | Step 4a: API layout, security defaults, sign-in |
| QA | [qa/step-04a-test-report.md](qa/step-04a-test-report.md) | Step 4a test report |
| Changes | [changes/step-04b-database-conformance.md](changes/step-04b-database-conformance.md) | Step 4b: schema matches the spec; EYA seed |
| QA | [qa/step-04b-test-report.md](qa/step-04b-test-report.md) | Step 4b test report |
| Setup | [setup/building-models.md](setup/building-models.md) | Installing the building `.glb` models on a machine (not stored in git) |
| Changes | [changes/step-03-local-models.md](changes/step-03-local-models.md) | Step 3 (revised): models moved out of git |
| API | [openapi/flowsense-openapi.yaml](openapi/flowsense-openapi.yaml) | OpenAPI contract (served by Swagger UI at `/docs/`) |

Each delivery step adds one change record under `changes/` and one test report
under `qa/`, and updates the tracker.
