# Step 8c: Room details in Map Annotation

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Requested by the team (2026-09-25) | Administrators should be able to edit a room's number, alias (optional), and purpose (what is usually done in the room) in Map Annotation. |
| Scope | Map Annotation page (new Room details panel), `PATCH /annotations/rooms/{id}` validation, `seed_campus` keeping edits |
| Guide | [Annotating a floor](../setup/map-annotation.md#room-details) |
| Test report | [step-08c-test-report.md](../qa/step-08c-test-report.md) |

The architecture already specifies this endpoint (07 API, Annotation API:
"`PATCH /api/v1/annotations/rooms/{id}`: updates metadata for a room node,
such as changing the Room Code, Alias, Description, or Image"), and the
backend already had it. The page had no way to use it. No schema change:
the fields are `campus.rooms.room_code`, `room_alias` and `description`.

## What changed

| Area | Change |
|---|---|
| Map Annotation page | A **Room details** panel under the room list. Pick a room in the list, or click a room's door point, to edit its **room number**, **name** (the alias; optional) and **purpose** (the description; optional). Save sends one PATCH. The room list, the door point's name, and the kiosk's directory refresh after a save. |
| API: `PATCH /annotations/rooms/{id}` | Still admin-only and audit-logged. Now also validates its input: <br>• The room number is trimmed and must not be blank. <br>• The number must be unique on its floor. This returns 400 "EA-111 is already used on this floor." Before, it failed with a database error (500). <br>• A blank alias is stored as "Room <number>", because `room_alias` is NOT NULL. This is the same name `seed_campus` gives unnamed rooms. <br>• An unnamed room's alias follows a new number. <br>• A blank description is stored as NULL. <br>• When the number changes, the room's door points ("EA-110 door") are renamed to match. |
| **Fix: `seed_campus` overwrote edits** | Re-running the seed reset every room's name and description to the built-in values (`update_or_create`). It now only adds rooms that are missing (`get_or_create`), so edits made in Map Annotation are kept. Its summary now reads "N created, M already there". |

## Things to know

- **Search covers the purpose.** Kiosk search already ranks over room code, alias and description, so a purpose like "enrollment advising" makes the room findable by those words.
- **Renaming a room number:**
  - `seed_eya_routes` finds its three demo rooms by number (EA-101A, EA-110, EA-111). If one is renumbered, that seed no longer finds it.
  - The kiosk's built-in fallback routes also go by number, so a renumbered room loses its built-in route.
  - Re-running `seed_campus` adds the original number back as a new, unplaced room.
- **Out of scope:** the image field. It's in the endpoint, but there's no upload flow yet.

## Files

| File | Role |
|---|---|
| `backend/django/apps/annotation/serializers/rooms.py` | Validation: number, optional alias and description |
| `backend/django/apps/annotation/views/rooms.py`, `services.py` | Rename door points when the number changes |
| `backend/django/apps/map/management/commands/seed_campus.py` | Keeps edited rooms |
| `backend/django/apps/annotation/tests.py`, `apps/map/tests.py` | 6 new tests; seed summary wording |
| `frontend/client/src/lib/annotationApi.ts` | `useRoomDetails`, `useRoomEdit` |
| `frontend/client/src/pages/workspaces/MapAnnotation.tsx` | Room details panel |
| `frontend/e2e/step8b.qa.mjs` | Checks A8 and A9 (edit a room, then restore it) |
| `docs/openapi/flowsense-openapi.yaml` | Endpoint description |
