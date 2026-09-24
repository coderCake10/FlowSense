# Building models (not stored in git)

Copy the building `.glb` files into this folder. They are too large for
GitHub, so each machine installs them locally.

Required files are listed in `client/src/data/models.ts` (`MODEL_FILES`).
Check what is installed:

```bash
cd frontend
pnpm run models:check
```

Full instructions, including using a folder elsewhere on the machine, are in
`docs/setup/building-models.md`.
