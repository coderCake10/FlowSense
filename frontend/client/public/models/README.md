# Building models

The kiosk's building models live here. They are the compressed, kiosk-ready
`.glb` files exported from the team's `.blend` sources with
`scripts/blender/export_kiosk_model.py`, and they are committed to git.

Required files are listed in `client/src/data/models.ts` (`MODEL_FILES`).
Check what is installed:

```bash
cd frontend
npm run models:check
```

Only files whitelisted in `frontend/.gitignore` are committed; anything else
dropped in this folder stays local. Full instructions, including exporting a
new model, are in `docs/setup/building-models.md`.
