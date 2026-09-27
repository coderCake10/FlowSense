# Step 12c: Follow on the kiosk, stairs and elevators out of service, QR analytics

| | |
|---|---|
| Branch | `claude/admiring-heisenberg-gwhi4u` |
| Asked by the team (2026-09-27) | 1. Routes stay with A* (no stairs-or-elevator preference), but an elevator under maintenance must send visitors up the stairs, and admins must be able to say so. 2. "Follow on this kiosk" should show the whole route on the kiosk, floor by floor, animated, with the stairs if needed. 3. The iPad couldn't reach the kiosk ("the server stopped responding"). 4. Scanning the QR didn't update "QR scanned" in Analytics. |
| Test report | [step-12c-test-report.md](../qa/step-12c-test-report.md) |
| Resolves | QA-66, QA-30, QA-113, QA-115, QA-116, QA-117, QA-118, QA-119, QA-120 |

## What changed

| Area | Change |
|---|---|
| Map Annotation, **Stairs and elevators** | A switch per staircase and elevator (its floor links grouped by name). Off means out of service: `PATCH /annotations/transitions/{id}` sets `active`, which the Navigation API already skips, so routes go another way at once. `seed_eya_routes` keeps the setting. |
| Navigation API | A route that changes floor carries `notices` (additive), e.g. "The elevator is out of service." |
| Kiosk and phone | The notice shows in the route's step box and above the phone's directions; the steps say "Walk to the stairs". |
| Kiosk, **Follow on this kiosk** | Plays the route: each floor's animated path in turn (5 to 12 s, by length), the floors moving as it changes floor, then again from the start. Pause and Play in the step box; Next, Back or a floor button also pauses it. |
| QR handoff (QA-66, QA-30) | Each QR shown opens a session with the QR Sessions API (`POST /sessions`, counted as "QR shown"); the QR carries it, and the phone reports the scan (`POST /sessions/{id}/scan`, "QR scanned") the first time it opens. The kiosk notices the scan: "Opened on your phone", then closes the queue window. Without the server the QR still works as before. |
| Hardware: deleted devices (QA-118) | A deleted kiosk that reconnects (same iPad, same ID) was ignored and never showed again, with no way back. The status filter has **Deleted** (`?status=decommissioned`), and **Restore** on a deleted row registers it again (`POST /hardware/devices/{id}/register` now accepts a deleted device and brings it back). A deleted kiosk's attract screen says so and how to restore it. Deleted devices stay hidden everywhere else, as the spec says. |
| Hardware: registries over 100 devices (QA-119) | The Hardware page read one page of 100 devices; the rest, including new unregistered ones (unnamed, so sorted last), never showed. It now reads every page. |
| Setup guide 11.2a | Checks for a device that can't reach the laptop: the address with `http://`, same network, Private profile, Docker block rules in Windows Firewall, Docker Desktop vs Docker inside Ubuntu (mirrored networking), the health address. |

## Files

| File | Role |
|---|---|
| `backend/django/apps/navigation/services.py`, `serializers/routes.py`, `management/commands/seed_eya_routes.py`, `tests.py` | Notices; seed keeps in-service setting |
| `frontend/client/src/lib/annotationApi.ts`, `annotationApi.test.ts` (**new**), `pages/workspaces/MapAnnotation.tsx`, `HelpPage.tsx` | Stairs and elevators switches |
| `frontend/client/src/components/BuildingFloorMap.tsx`, `lib/mapView.ts`, `mapView.test.ts`, `pages/experience/KioskPage.tsx`, `MobilePage.tsx`, `lib/kioskDirectory.ts`, `data/navigation.ts` | Playback, notices |
| `frontend/client/src/lib/qrSessions.ts` (**new**), `lib/handoff.ts`, `handoff.test.ts` | QR sessions |
| `frontend/e2e/step8a.qa.mjs`, `step8b.qa.mjs`, `step8d.qa.mjs` | Playback, out of service, QR session and scan |
| `backend/django/apps/hardware/views/device.py`, `services.py`, `tests.py`, `frontend/client/src/pages/workspaces/HardwareManagement.tsx`, `lib/adminApi.ts`, `pages/experience/AttractionPage.tsx`, `frontend/e2e/step5b.qa.mjs` | Deleted devices, paging |
| `docs/openapi/flowsense-openapi.yaml`, `docs/architecture/conformance-review.md`, `docs/setup/map-annotation.md`, `team-local-setup.md` | Docs |
