# Step 10: Assets API, Asset Management, and the live building model

| | |
|---|---|
| Branch | `claude/admiring-heisenberg-gwhi4u` |
| Requested by the team (2026-09-26) | Build Asset Management's backend as part of the 3D model work, so finished models (the EYA and A Building exports) can be brought in properly. |
| Scope | Assets API (all 16 endpoints), the Asset Management page, the kiosk, the attract screen and Map Annotation loading the model that's live |
| Spec | `07 API/00 API Design.md` (Assets API), `04 Application/02 Admin/05 Asset Management.md`, `06 Database` (`assets.*`) |
| Test report | [step-10-test-report.md](../qa/step-10-test-report.md) |
| Resolves | QA-14, QA-89 (superseded), QA-96 |

## What changed

### Backend (`apps/assets`)

| Area | Change |
|---|---|
| Storage | Uploads (.glb, up to 500 MB) are stored under `MEDIA_ROOT/assets/<asset>/v<n>/` with their size and SHA-256. `MEDIA_ROOT` defaults to `backend/django/media/` (ignored by git), which the Docker backend and Celery worker share. nginx accepts 510 MB request bodies. |
| Reading a model (`glb.py`) | Reads only the file's JSON chunk, so Draco models work and a 17 MB file takes under 0.1 s. It records objects, meshes, materials, textures, vertices, triangles and dimensions. It finds the floors: each `FLOOR_n` group, whose walking height is the top of the slab mesh with the same name. For EYA that gives 0.93, 4.42, 8.00, 11.52, 15.08 and 18.53 m, which are exactly the heights the kiosk configuration set by hand. It also finds the exterior objects (`EXTERIOR`, `ROOF`). |
| Processing | A Celery task reads the model, stores its statistics and validates it. It runs inline where `CELERY_TASK_ALWAYS_EAGER` is set. |
| Validation | 16 checks in the schema's five categories. **Errors** block activation: not a glTF 2.0 binary, no meshes, no floor groups, a floor FlowSense has configured missing from the model, or a required extension the kiosk can't load. **Warnings** don't block: no Draco compression, over 100 MB, over 3 million triangles, an odd size (a unit-scale mistake), floor gaps or an out-of-order floor, no exterior, no linked building, or floors in the model that FlowSense hasn't configured. |
| Activation and restore | Only a processed version whose latest validation didn't fail can go live. Activating deactivates the building's other model, then sets each configured floor's GLB node and height from the model and reports what changed. Restore re-activates an earlier version. |
| Download | The live version's download is public, because the kiosk and phones load it; other versions need an admin session. Responses carry an ETag (the checksum). |
| The kiosk's link | `GET /map/areas` (and `/map/areas/{id}`) gains `model`: the live model's URL, or null. It's additive, like `node_id` on rooms. |
| Audit | Every upload, edit, validation (automatic ones too), activation, restore, deactivation and delete is recorded. The spec's `assets.asset_audit_history` view now has rows. The Activity API accepts comma-separated filters (QA-96). |
| `import_asset` | `manage.py import_asset <file> [--area EYA] [--activate]` registers a model from disk the same way; the Docker backend mounts the committed models at `/models`. |
| Contract | Follows `flowsense-openapi.yaml`, including `area_id`, `active_version_id`, `dimension_x/y/z`, `validation_run_id`, 202 for a validation run, and the `category`/`status` filters on checks. Additive fields are documented there. |

### Frontend

| Area | Change |
|---|---|
| Asset Management (`pages/workspaces/AssetManagement.tsx`, `assets/`) | Rebuilt on the API, following the spec's layout. The five tabs are below; a sidebar shows the selected version and its actions (make live, upload a new version, download, delete). With no API configured the page says it needs the server; it no longer shows sample data. |
| Asset Management tabs | **Overview:** the current asset, the model summary, the building summary, and every validation check grouped by category, with "Run validation again". **Asset:** file details, editable metadata (name, building, description, source, notes), and version history with view, download and restore. **Model:** a 3D viewer (Fit, Grid, Axes), statistics, and structure detection that says, for each floor found, whether it matches FlowSense or will be updated. **Building:** configured floors against the model's, transitions (from Map Annotation), spatial settings and kiosk defaults (read-only, QA-93). **Activity:** the asset audit log. |
| Upload dialog | Checks the file type and the 500 MB limit before sending, shows upload progress, links the model to a building, and sets its type (building, or area/campus). |
| The live model (`lib/liveModel.ts`) | The kiosk map, the attract preview and Map Annotation load the building's live model when one is set. They wait for that answer first, so the 17 MB model isn't downloaded twice. They fall back to the committed model when there's no API, no live model, the server doesn't answer, or the live file fails to load. |
| Help | The "Publish a verified building asset" guide now has real steps. |

## Checked on the real model

- Uploading the committed `EYA.glb` passes all 16 checks; the kiosk then loads it from `/api/v1/assets/…/download` and never requests `/models/EYA.glb`.
- Uploading `A.glb` as a new EYA version fails ("Missing from the model: FLOOR_5, FLOOR_6.") and can't be made live; the kiosk keeps the good version.
- With the live file removed from disk, the kiosk falls back to the committed model and still shows the building.

## Not in this step

- **Editing floor settings, spatial settings and kiosk defaults** from Asset Management (QA-93). This needs a team decision on schema columns and a floor-edit endpoint.
- **The kiosk's building configuration** (`client/src/data/`) still names floors and heights by hand (QA-94).
- **The campus and A Building models** stay the committed files until they're linked to buildings in step 9b (QA-95).
- **Server-side Draco compression.** Validation only warns about uncompressed models; the Blender export script compresses them.

## Files

| File | Role |
|---|---|
| `backend/django/apps/assets/glb.py`, `services.py`, `serializers.py`, `views.py`, `urls.py`, `tasks.py` (**new**) | The Assets API |
| `backend/django/apps/assets/management/commands/import_asset.py` (**new**) | Register a model from disk |
| `backend/django/apps/assets/tests.py` | 12 tests |
| `backend/django/apps/map/serializers/areas.py`, `views/areas.py` | `model` on areas |
| `backend/django/apps/analytics/audit.py`, `views.py` | Explicit entity types; comma-separated filters |
| `backend/django/config/settings.py`, `urls.py`; `backend/nginx/nginx.conf`; `docker-compose.yml`; `.gitignore` | Media storage, route, upload size, `/models` mount |
| `frontend/client/src/lib/assetsApi.ts`, `liveModel.ts` (**new**) | API client and hooks; live model |
| `frontend/client/src/pages/workspaces/AssetManagement.tsx`, `assets/*` (**new**) | The page |
| `frontend/client/src/components/map/ModelViewer.tsx` (**new**) | The Model tab's viewer |
| `frontend/client/src/components/BuildingFloorMap.tsx`, `map/AttractPreview.tsx`, `map/AnnotationCanvas.tsx`, `map/BuildingScene.tsx` | Load the live model, with a fallback |
| `frontend/client/src/pages/workspaces/HelpPage.tsx` | Asset guide |
| `frontend/e2e/step10.qa.mjs` (**new**), `audit1.qa.mjs` | `npm run qa:step10`; audit 1's Asset checks retired |
| `docs/openapi/flowsense-openapi.yaml`, `docs/setup/building-models.md` (section 8), `team-local-setup.md`, `local-development.md` | Contract and guides |
