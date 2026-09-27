/* Plain helpers for the Asset Management tabs (kept apart from the
 * components so React Fast Refresh works). */
import { API_BASE_URL } from "@/lib/api";
import type { AssetItem, AssetVersion } from "@/lib/assetsApi";

/** Active, Ready, Processing, Failed or Archived for one version. */
export function versionState(asset: AssetItem, version: AssetVersion) {
  if (version.id === asset.active_version_id) return "Active";
  if (
    version.processing_status === "pending" ||
    version.processing_status === "processing"
  )
    return "Processing";
  if (
    version.processing_status === "failed" ||
    version.validation?.result === "failed"
  )
    return "Failed";
  if (version.id === asset.latest_version?.id) return "Ready to activate";
  return "Archived";
}

/** Why a version can't be activated, or null when it can. */
export function activationBlocker(
  asset: AssetItem,
  version: AssetVersion | null
) {
  if (!version) return "Upload a model first.";
  if (version.id === asset.active_version_id)
    return "This version is already live.";
  if (version.processing_status !== "completed")
    return "The model is still being checked.";
  if (!version.validation) return "Run validation first.";
  if (version.validation.result === "failed")
    return "Validation failed. Fix the errors and upload a new version.";
  return null;
}

export function floorLabel(order: number) {
  return `${order}F`;
}

/** The download link for a version (the path the API returns, under our API base). */
export function downloadHref(version: AssetVersion) {
  return version.download_url.replace(/^\/api\/v1/, API_BASE_URL);
}
