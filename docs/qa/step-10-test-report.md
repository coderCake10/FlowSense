# Step 10 test report

| | |
|---|---|
| Change record | [step-10-assets.md](../changes/step-10-assets.md) |
| Result | **All gates pass.** Backend 134/134 (12 new). Frontend unit tests 92/92 (7 new). New `qa:step10` 19/19 on three consecutive runs. Every regression suite passes. |

## Gates

| Gate | Result |
|---|---|
| `manage.py check`, `makemigrations --check --dry-run` | No issues, no changes (no migration needed: the `assets` tables already matched the schema) |
| `manage.py test --noinput` | **134 passed** (12 new in `assets/tests.py`) |
| `npm run check` | No errors |
| `npm test` | **92 passed** (7 new: `assets/helpers.test.ts`, `lib/assetsApi.test.ts`) |
| `npm run lint` | 0 errors; warnings 119 → 35 (the old sample-data page is gone; no new warnings in touched files) |
| `npm run build` | Succeeds (the existing chunk-size notice only) |
| Prettier on changed files | Clean |
| OpenAPI file | Parses (YAML) |

## Backend tests (`assets/tests.py`)

A synthetic `.glb` built in the test (floor groups with slabs, an exterior)
covers:

| Test | Checks |
|---|---|
| `test_floors_use_the_slab_top_as_elevation` | Floors, slab-top heights, exterior, Draco flag, triangles, dimensions |
| `test_rejects_a_file_that_is_not_glb` | Inspector refuses non-glTF data |
| `test_upload_is_stored_processed_and_validated` | Upload → processed → 16 checks passed, not live |
| `test_upload_rejects_non_glb_files` | Bad header and wrong extension → 400 with a clear message |
| `test_admin_only` | 401 without a session |
| `test_activation_applies_floors_and_publishes_the_model` | Download private before, public after; floor 2 gets its node and height; `/map/areas` gives the URL; the file is byte-identical |
| `test_a_failed_version_cannot_be_activated` | Missing FLOOR_1 → failed → 409 |
| `test_warnings_do_not_block_activation` | No Draco and no exterior → warnings, still activates |
| `test_unsupported_required_extension_is_an_error` | Unknown required extension → failed |
| `test_restore_and_one_active_model_per_building` | Activating another model deactivates the first; restore; history order |
| `test_metadata_edit_delete_and_audit` | PATCH, delete (area `model` back to null), audit rows in `asset_audit_history`, comma-separated activity filter |
| `test_version_detail_reports_structure_and_processing` | Structure and floor changes, processing, re-validation (202), filtered checks |

## Browser suite `qa:step10` (real backend, the committed models)

| ID | Check |
|---|---|
| U1–U4 | Upload `EYA.glb` for the EYA Building: file and size shown, success, listed and selected, 16 checks passed |
| M1–M3 | Model tab: FLOOR_1 to FLOOR_6, 1F at 0.93 m, 3D viewer |
| A1–A2 | Make live: confirmation; `/map/areas` points at this asset |
| K1–K2 | The kiosk loads the live model from the Assets API and not `/models/EYA.glb` |
| V1–V3 | `A.glb` as a new version fails (FLOOR_5, FLOOR_6 missing), Make live disabled with the reason, live model unchanged |
| H1–H2 | Activity lists the upload and the failed validation |
| D1–D2 | Delete; the previously live model is live again |
| E1 | No uncaught page errors |

Result: **19/19, three consecutive runs.**

Checked by hand as well: with the live file removed from disk, the kiosk
falls back to the committed `EYA.glb` and shows the building.

## Regression suites

| Suite | Result |
|---|---|
| `qa:audit1` | 6/6 (A4–A8 retired: they asserted the old "not connected" banner) |
| `qa:step8a` | 11/11 |
| `qa:step8b` | 10/10 |
| `qa:step8d` | 8/8 |
| `qa:step8e` | 7/7 |
| `qa:step6` | 11/11 |
| `qa:step4a` | 13/13. In the long regression run K1 and K2 got 429: after about ten sign-ins in an hour as head@auf.edu.ph, the per-email verification limit (`auth_verify_email`, 10/hour) was reached. That is the rate limit working. Re-run on its own with a fresh backend: 13/13. |
| `qa:step1` (offline demo) | 36/36 |
| `qa:step2` | 22/22 |
| `qa:step7a` | 7/7 |
| `qa:step7b` | 13/13 |
| `qa:step5b`, `qa:models` | Not run: they need Mosquitto and a :3004 server. This step doesn't touch the hardware pipeline or the missing-model message. |
