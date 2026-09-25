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
| Setup | [setup/team-local-setup.md](setup/team-local-setup.md) | **Start here (groupmates):** full Windows + Docker setup, first sign-in, HeidiSQL, devices, troubleshooting |
| Setup | [setup/local-development.md](setup/local-development.md) | Running backend and frontend without Docker, and running the tests |
| Changes | [changes/step-04a-platform-and-auth.md](changes/step-04a-platform-and-auth.md) | Step 4a: API layout, security defaults, sign-in |
| QA | [qa/step-04a-test-report.md](qa/step-04a-test-report.md) | Step 4a test report |
| Changes | [changes/step-04b-database-conformance.md](changes/step-04b-database-conformance.md) | Step 4b: schema matches the spec; EYA seed |
| QA | [qa/step-04b-test-report.md](qa/step-04b-test-report.md) | Step 4b test report |
| Setup | [setup/building-models.md](setup/building-models.md) | The building models: committed kiosk `.glb` files, exporting a new version from Blender, the Draco decoder |
| Changes | [changes/step-03-local-models.md](changes/step-03-local-models.md) | Step 3 (revised): models moved out of git |
| Changes | [changes/step-04-hardware-mqtt-pipeline.md](changes/step-04-hardware-mqtt-pipeline.md) | Step 4 follow-up: ESP32 → MQTT → database pipeline fixes |
| QA | [qa/step-04-hardware-mqtt-pipeline-test-report.md](qa/step-04-hardware-mqtt-pipeline-test-report.md) | Pipeline test report |
| Changes | [changes/step-04-stack-decisions.md](changes/step-04-stack-decisions.md) | Stack decisions; Settings moved to `common` |
| Changes | [changes/step-05a-admin-apis.md](changes/step-05a-admin-apis.md) | Step 5a: Hardware, Alerts, Activity, Dashboard, Settings, and System APIs |
| QA | [qa/step-05a-test-report.md](qa/step-05a-test-report.md) | Step 5a test report |
| Changes | [changes/step-05b-admin-pages.md](changes/step-05b-admin-pages.md) | Step 5b: Dashboard, Hardware, Users, and Settings pages connected |
| QA | [qa/step-05b-test-report.md](qa/step-05b-test-report.md) | Step 5b test report |
| Changes | [changes/step-05c-envelope-and-kiosk.md](changes/step-05c-envelope-and-kiosk.md) | Step 5c: OpenAPI envelope everywhere; kiosk heartbeat and visitor sessions |
| QA | [qa/step-05c-test-report.md](qa/step-05c-test-report.md) | Step 5c test report |
| Changes | [changes/step-06-analytics.md](changes/step-06-analytics.md) | Step 6: Analytics API and page |
| QA | [qa/step-06-test-report.md](qa/step-06-test-report.md) | Step 6 test report |
| Changes | [changes/step-07a-eya-model.md](changes/step-07a-eya-model.md) | Step 7a: the complete EYA model in the kiosk (compressed, committed) |
| QA | [qa/step-07a-test-report.md](qa/step-07a-test-report.md) | Step 7a test report |
| Changes | [changes/step-07b-kiosk-3d-map.md](changes/step-07b-kiosk-3d-map.md) | Step 7b: whole-building view, floors, animated routes, 3D attract preview |
| QA | [qa/step-07b-test-report.md](qa/step-07b-test-report.md) | Step 7b test report |
| Changes | [changes/step-08a-kiosk-live-search.md](changes/step-08a-kiosk-live-search.md) | Step 8a: kiosk search and routes from the APIs; attract screen waits for a tap |
| QA | [qa/step-08a-test-report.md](qa/step-08a-test-report.md) | Step 8a test report |
| Changes | [changes/step-08b-map-annotation.md](changes/step-08b-map-annotation.md) | Step 8b: Map Annotation on the real model; GeoJSON input fix; multi-floor routes |
| QA | [qa/step-08b-test-report.md](qa/step-08b-test-report.md) | Step 8b test report |
| Changes | [changes/step-08c-room-details.md](changes/step-08c-room-details.md) | Step 8c: edit a room's number, name and purpose in Map Annotation |
| QA | [qa/step-08c-test-report.md](qa/step-08c-test-report.md) | Step 8c test report |
| Changes | [changes/step-08d-mobile-directions.md](changes/step-08d-mobile-directions.md) | Step 8d: phone handoff with the kiosk's route, step-by-step directions, loading page (team wireframe) |
| QA | [qa/step-08d-test-report.md](qa/step-08d-test-report.md) | Step 8d test report |
| Setup | [setup/map-annotation.md](setup/map-annotation.md) | How to annotate a floor |
| API | [openapi/flowsense-openapi.yaml](openapi/flowsense-openapi.yaml) | OpenAPI contract (served by Swagger UI at `/docs/`) |

Each delivery step adds one change record under `changes/` and one test report
under `qa/`, and updates the tracker.
