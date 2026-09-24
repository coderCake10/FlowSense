# Step 3 (revised): Building models installed locally, not in git

| | |
|---|---|
| Branch | `claude/compassionate-fermat-1fj2l5` |
| Decision | The original step 3 (3D work on the complete models) is **deferred**. GitHub can't hold the complete `.glb` files, so models now live on each machine instead of in the repository. |
| Scope | Frontend configuration, Docker Compose, tooling, docs |
| Guide | [Installing the building models](../setup/building-models.md) |

## What changed

| Area | Change |
|---|---|
| Model registry | **New** `client/src/data/models.ts`: `MODEL_FILES` is the single list of required files; `modelUrl()` builds URLs from `VITE_MODELS_BASE_URL` (default `/models`). The EYA and A Building configurations use it instead of hardcoded paths. |
| Git | `eya-floor-1.glb` and `a-building.glb` are **untracked** (`git rm --cached`; local copies kept). `frontend/client/public/models/*` is ignored, except a tracked `README.md` explaining what goes there. |
| Check tool | **New** `pnpm run models:check` (`scripts/check-models.mjs`). Reports each required file as OK, MISSING, or INVALID by checking the binary glTF 2.0 header and the declared length, which catches `.gltf` files, Git LFS pointers, and truncated downloads. Exits 1 on problems. `FLOWSENSE_MODELS_DIR` checks another folder. |
| Docker | The frontend service mounts `${FLOWSENSE_MODELS_DIR:-./frontend/client/public/models}` read-only at `/app/client/public/models`, so models can live anywhere on the host. Documented in `.env.example`. |
| Kiosk | A missing or unreadable model now shows "This building's map isn't available on this kiosk right now". Development builds also name the missing file and the fix. The rest of the kiosk keeps working. |
| Lint | Node globals for `scripts/**/*.mjs` |

## Consequences

- **A fresh clone has no models.** Run `models:check`, then copy the files in (see the guide).
- **Teammates who pull this commit lose their tracked copies** of the two
  models from their working folder. The guide shows how to restore them from
  history (`git show 35e4bbe:…`) or install the new ones.
- The old models stay in git history (57 MB), so clone size doesn't shrink.
  Rewriting history to remove them is possible but disruptive for everyone.
  Not done.
- A production build copies the models present at build time into
  `dist/public/models`. Build on a machine that has them, or serve them with
  `VITE_MODELS_BASE_URL`.

## Deferred from the original step 3

QA-26 (fixed isometric view, the Area → Building → Floor → Destination Back
button, the Location Details panel) and QA-27 (Draco compression) wait until
the complete models are installed locally. The guide includes the compression
command to use then.

## Verification

| Check | Result |
|---|---|
| `pnpm run models:check`: all present | OK/OK, exit 0 |
| Same, with a Git LFS pointer and a truncated file | INVALID/INVALID with reasons, exit 1 |
| Same, with a file missing | MISSING, exit 1 |
| `pnpm run qa:models` (dev server with `VITE_MODELS_BASE_URL=/no-such-models`) | 3/3: clear message, the missing file is named in development, and the kiosk list and route panel still work |
| `qa:step1` / `qa:step2` with models installed | 36/36, 22/22 (no regressions) |
| `check` / `lint` / `test` / `build` | Pass; 0 lint errors, 372 warnings (unchanged); 46 tests |
