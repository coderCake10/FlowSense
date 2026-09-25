/* Building model files. The compressed kiosk models are committed in the
 * models folder; see docs/setup/building-models.md and `npm run models:check`. */

/** Where the browser loads models from. Defaults to the app's /models folder
 * (frontend/client/public/models); override to serve them from elsewhere. */
export const MODELS_BASE_URL = (
  import.meta.env.VITE_MODELS_BASE_URL || "/models"
).replace(/\/+$/, "");

/** Draco decoder for compressed models, served by this app (client/public/draco)
 * instead of drei's default CDN, so an offline kiosk can still load models. */
export const DRACO_DECODER_PATH = `${import.meta.env.BASE_URL}draco/`;

/** Every model file the kiosk needs. `models:check` reads this list. */
export const MODEL_FILES = {
  eya: "EYA.glb",
} as const;

export function modelUrl(file: string) {
  return `${MODELS_BASE_URL}/${file}`;
}
