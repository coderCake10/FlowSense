/* Building model files. Models are not stored in git (they are too large);
 * each machine drops them into the models folder. See
 * docs/setup/building-models.md and `pnpm run models:check`. */

/** Where the browser loads models from. Defaults to the app's /models folder
 * (frontend/client/public/models); override to serve them from elsewhere. */
export const MODELS_BASE_URL = (
  import.meta.env.VITE_MODELS_BASE_URL || "/models"
).replace(/\/+$/, "");

/** Every model file the kiosk needs. `models:check` reads this list. */
export const MODEL_FILES = {
  eyaFloor1: "eya-floor-1.glb",
  aBuilding: "a-building.glb",
} as const;

export function modelUrl(file: string) {
  return `${MODELS_BASE_URL}/${file}`;
}
