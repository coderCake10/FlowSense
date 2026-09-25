# Step 8c test report

| | |
|---|---|
| Change record | [step-08c-room-details.md](../changes/step-08c-room-details.md) |
| Result | **All gates pass.** Backend 119/119 (6 new). Frontend unit tests 73/73. Map Annotation browser suite 10/10 (2 new checks). |

## Gates

| Gate | Result |
|---|---|
| `manage.py test --noinput` | **119 passed** |
| `npm run check`, `npm test` | No errors, 73/73 |
| ESLint and Prettier on changed files | Clean |
| **`npm run qa:step8b`** (real backend) | **10/10** |

## New backend tests (`annotation/tests.py`, `RoomDetailsTests`)

1. Editing a room needs an admin (401/403).
2. An admin changes the number, name and purpose:
   - input is trimmed;
   - the door point is renamed "EA-110X door";
   - `GET /map/rooms/{id}` returns the new purpose.
3. A blank name becomes "Room EA-110", and a blank purpose is cleared (NULL).
4. An unnamed room ("Room EA-305") keeps following its number when renumbered.
5. A number already used on the floor, or a blank number, is rejected (400), and nothing changes.
6. Running `seed_campus` again keeps the edited name and purpose.

## New browser checks (`qa:step8b`)

| ID | Check |
|---|---|
| A8 | On 3F, pick EA-306, enter a name and purpose, and save. The room list shows the new name. |
| A9 | Restore the original values. The cleared name falls back to "Room EA-306". |

The suite restores the room it edits, so it can be re-run.
