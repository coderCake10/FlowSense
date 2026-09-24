# Installing the building models

The 3D building models (`.glb`) are **not stored in git**. They are too large
for GitHub, and the complete models are larger than the ones used so far. Each
machine that runs the kiosk or the admin map installs them locally.

## 1. Which files

The required files are listed in one place,
`frontend/client/src/data/models.ts`:

```ts
export const MODEL_FILES = {
  eyaFloor1: "eya-floor-1.glb",
  aBuilding: "a-building.glb",
} as const;
```

To add or rename a model, change it here. The kiosk, the building
configurations, and the check script all read this list.

The files must be **binary glTF 2.0** (`.glb`). A `.gltf` with separate
`.bin` and texture files, a `.blend`, or an `.fbx` won't load. Export from
Blender with *File → Export → glTF 2.0*, format *glTF Binary (.glb)*.

## 2. Where to put them

**Default (no configuration):** copy the files into

```
FlowSense/frontend/client/public/models/
```

This works for `pnpm run dev` and for Docker Compose, which mounts
`./frontend` into the frontend container. The folder's contents are
git-ignored, so the models never get committed by accident.

**Keeping them in another folder (for example a USB drive or `/srv`):** with
Docker Compose, set `FLOWSENSE_MODELS_DIR` in `FlowSense/.env`:

```env
FLOWSENSE_MODELS_DIR=/srv/flowsense/models        # Linux/macOS
FLOWSENSE_MODELS_DIR=D:/FlowSense/models          # Windows (Docker Desktop)
```

Compose mounts that folder read-only as the app's `/models`. Then run
`docker compose up -d frontend` again.

**Serving them from another server or CDN:** set `VITE_MODELS_BASE_URL`
(for example `https://files.example.edu/flowsense/models`) in
`frontend/.env.local`. The browser then loads models from there. The server
must allow CORS from the kiosk's origin.

## 3. Check the installation

```bash
cd FlowSense/frontend
pnpm run models:check
# or check another folder:
FLOWSENSE_MODELS_DIR=/srv/flowsense/models pnpm run models:check
```

```
  OK       eya-floor-1.glb (54.9 MB)
  MISSING  a-building.glb
```

The check reports each file as `OK`, `MISSING`, or `INVALID`. `INVALID` means
the file isn't a binary glTF 2.0: it could be a `.gltf`, a Git LFS pointer,
or a download that stopped partway. The command exits with 1 when anything
needs attention, so it can gate a deployment script.

If a model is missing at runtime, the kiosk shows "This building's map isn't
available on this kiosk right now". In development it also shows the exact
missing file.

## 4. After pulling the commit that untracked the models (teammates, read this)

The commit that moved models out of git **deletes the tracked copies of
`eya-floor-1.glb` and `a-building.glb` from your working folder when you
pull**. Your other files are untouched. To get the old versions back from git
history:

```bash
cd FlowSense
git show 35e4bbe:FlowSense/frontend/client/public/models/eya-floor-1.glb > frontend/client/public/models/eya-floor-1.glb
git show 35e4bbe:FlowSense/frontend/client/public/models/a-building.glb  > frontend/client/public/models/a-building.glb
```

Or, better, copy in the new complete models. Keep file names matching
`MODEL_FILES`, or update it.

## 5. Sharing models with the team

Use a shared drive (Google Drive, OneDrive) folder named `FlowSense models`,
with one sub-folder per release (for example `2026-09-complete/`). Note the
file names and sizes in a text file next to them, and run
`pnpm run models:check` after copying.

**Git LFS alternative:** GitHub's LFS allows large files, but the free plan
has 1 GB of storage and 1 GB of monthly bandwidth. Every clone downloads the
models, so a team would exceed that quickly. Use it only with a paid data
pack.

## 6. Reducing model size (recommended before deployment)

The 57 MB EYA model is mostly textures. A smaller model loads faster on the
kiosk:

```bash
npx @gltf-transform/cli optimize eya-floor-1.glb eya-floor-1.opt.glb --compress draco --texture-compress webp
```

Test the optimized file in the kiosk before replacing the original. Draco
decoding also needs the kiosk to load the Draco decoder (drei's `useGLTF`
does this by default from a CDN; for an offline kiosk, host the decoder
locally).
