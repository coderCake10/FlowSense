/* Assets API (07 API Design, "Assets API"): building model uploads, versions,
 * validation and activation for the Asset Management page. Without an API
 * the queries return empty data and changes are refused, as on the other
 * admin pages. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  API_BASE_URL,
  ApiError,
  apiClient,
  endpointMap,
  isApiConfigured,
} from "@/lib/api";
import {
  useAdminMutation,
  useAdminQuery,
  type ActivityItem,
  type Page,
} from "@/lib/adminApi";

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";
export type ValidationResult = "passed" | "warning" | "failed";
export type CheckStatus = "passed" | "warning" | "error";
export type AssetType = "building_model" | "area_model";

export interface ValidationRun {
  id: number;
  asset_version_id: number;
  version: number;
  result: ValidationResult;
  summary: string | null;
  counts: { passed: number; warnings: number; errors: number };
  validated_by: number | null;
  created_at: string;
}

export interface ValidationCheck {
  id: number;
  validation_run_id: number;
  category: string;
  check_name: string;
  status: CheckStatus;
  message: string | null;
  created_at: string;
}

export interface AssetVersion {
  id: number;
  asset_id: number;
  version: number;
  filename: string;
  file_format: string;
  file_size_bytes: number | null;
  checksum: string | null;
  processing_status: ProcessingStatus;
  processing_engine: string | null;
  processed_at: string | null;
  object_count: number | null;
  mesh_count: number | null;
  material_count: number | null;
  texture_count: number | null;
  vertices_count: number | null;
  triangles_count: number | null;
  detected_floor_count: number | null;
  potential_floor_count: number | null;
  dimension_x: number | null;
  dimension_y: number | null;
  dimension_z: number | null;
  coordinate_unit: string | null;
  uploaded_by: number | null;
  created_at: string;
  is_active: boolean;
  validation: ValidationRun | null;
  download_url: string;
}

export interface DetectedFloor {
  node: string;
  order: number;
  reason: string;
  confidence: "high" | "medium";
  elevation: number | null;
  top: number | null;
}

export interface FloorChange {
  floor_id: number;
  floor_order: number;
  glb_node_name?: [string | null, string];
  elevation?: [number | null, number];
}

export interface ModelStructure {
  gltf_version: string;
  generator: string;
  floors: DetectedFloor[];
  potential_floors: DetectedFloor[];
  exterior_nodes: string[];
  top_level_nodes: string[];
  extensions_used: string[];
  extensions_required: string[];
  draco: boolean;
  floor_changes: FloorChange[];
}

export interface AssetVersionDetail extends AssetVersion {
  structure: ModelStructure | null;
}

export interface AssetItem {
  id: number;
  area_id: number | null;
  name: string;
  description: string | null;
  source: string | null;
  notes: string | null;
  asset_type: AssetType;
  area: { id: number; code: string; name: string } | null;
  active_version_id: number | null;
  active_version: AssetVersion | null;
  latest_version: AssetVersion | null;
  version_count: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ActivationResult extends AssetItem {
  floors_updated: FloorChange[];
  deactivated_assets: number[];
}

export const CHECK_CATEGORIES: { id: string; label: string }[] = [
  { id: "file_and_format", label: "File and format" },
  { id: "model_and_geometry", label: "Model and geometry" },
  {
    id: "hierarchy_and_floor_structure",
    label: "Hierarchy and floor structure",
  },
  {
    id: "floors_and_spatial_configuration",
    label: "Floors and spatial configuration",
  },
  { id: "flowsense_compatibility", label: "FlowSense compatibility" },
];

/** Entity types the asset audit view covers, plus building floor changes. */
export const ASSET_ACTIVITY_TYPES = "asset,asset_version,asset_validation,area";

const assetKeys = {
  all: ["assets"] as const,
  asset: (id: number) => ["assets", id] as const,
  versions: (id: number) => ["assets", id, "versions"] as const,
  version: (id: number, versionId: number) =>
    ["assets", id, "versions", versionId] as const,
  runs: (id: number, versionId: number) =>
    ["assets", id, "versions", versionId, "runs"] as const,
  checks: (id: number, versionId: number) =>
    ["assets", id, "versions", versionId, "checks"] as const,
  activity: (page: number) => ["assets", "activity", page] as const,
};

export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function formatDimensions(version: AssetVersion | null | undefined) {
  if (!version || version.dimension_x == null) return "—";
  const f = (v: number | null) => (v ?? 0).toFixed(1);
  return `${f(version.dimension_x)} × ${f(version.dimension_y)} × ${f(version.dimension_z)} m`;
}

/* ---------- queries ---------- */

const rows = <T>(path: string) =>
  apiClient.getPage<T>(path).then(page => page.results);

export function useAssets() {
  return useAdminQuery<AssetItem[]>(
    assetKeys.all,
    `${endpointMap.assets.all}?page_size=100`,
    [],
    { fetcher: rows<AssetItem> }
  );
}

export function useAssetVersions(assetId: number | null) {
  return useAdminQuery<AssetVersion[]>(
    assetKeys.versions(assetId ?? 0),
    endpointMap.assets.versions(String(assetId)),
    [],
    { enabled: assetId !== null }
  );
}

/** A version with its model structure (read from the file by the server). */
export function useAssetVersion(
  assetId: number | null,
  versionId: number | null
) {
  return useAdminQuery<AssetVersionDetail | null>(
    assetKeys.version(assetId ?? 0, versionId ?? 0),
    endpointMap.assets.version(String(assetId), String(versionId)),
    null,
    { enabled: assetId !== null && versionId !== null }
  );
}

export function useValidationRuns(
  assetId: number | null,
  versionId: number | null
) {
  return useAdminQuery<ValidationRun[]>(
    assetKeys.runs(assetId ?? 0, versionId ?? 0),
    endpointMap.assets.versionValidation(String(assetId), String(versionId)),
    [],
    { enabled: assetId !== null && versionId !== null }
  );
}

export function useValidationChecks(
  assetId: number | null,
  versionId: number | null
) {
  return useAdminQuery<ValidationCheck[]>(
    assetKeys.checks(assetId ?? 0, versionId ?? 0),
    endpointMap.assets.versionValidationChecks(
      String(assetId),
      String(versionId)
    ),
    [],
    { enabled: assetId !== null && versionId !== null }
  );
}

export function useAssetActivity(page = 1) {
  return useAdminQuery<Page<ActivityItem>>(
    assetKeys.activity(page),
    `${endpointMap.activity.all}?entity_type=${ASSET_ACTIVITY_TYPES}&page=${page}&page_size=15`,
    {
      results: [],
      meta: { page: 1, page_size: 15, total_count: 0, total_pages: 1 },
    },
    { fetcher: path => apiClient.getPage<ActivityItem>(path) }
  );
}

/** Polls an asset while its newest version is still being processed. */
export function useProcessingWatch(asset: AssetItem | null) {
  const client = useQueryClient();
  const pending =
    asset?.latest_version &&
    (asset.latest_version.processing_status === "pending" ||
      asset.latest_version.processing_status === "processing");
  return useQuery({
    queryKey: ["assets", asset?.id ?? 0, "processing"],
    queryFn: async () => {
      const state = await apiClient.get<{ complete: boolean } | null>(
        endpointMap.assets.processing(String(asset!.id))
      );
      if (state?.complete)
        client.invalidateQueries({ queryKey: assetKeys.all });
      return state;
    },
    enabled: isApiConfigured() && !!pending,
    refetchInterval: 2000,
  });
}

/* ---------- uploads ---------- */

export interface UploadInput {
  file: File;
  name?: string;
  areaId?: number | null;
  assetType?: AssetType;
  description?: string;
  source?: string;
  notes?: string;
  /** Upload a new version of this asset instead of creating one. */
  assetId?: number;
  onProgress?: (fraction: number) => void;
}

/** Multipart upload with progress (fetch can't report upload progress). */
export function uploadModel(
  input: UploadInput
): Promise<AssetItem | AssetVersion> {
  const form = new FormData();
  form.append("file", input.file);
  if (input.assetId === undefined) {
    if (input.name) form.append("name", input.name);
    if (input.areaId != null) form.append("area_id", String(input.areaId));
    if (input.assetType) form.append("asset_type", input.assetType);
    if (input.description) form.append("description", input.description);
    if (input.source) form.append("source", input.source);
    if (input.notes) form.append("notes", input.notes);
  }
  const path =
    input.assetId === undefined
      ? endpointMap.assets.all
      : endpointMap.assets.versions(String(input.assetId));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = event => {
      if (event.lengthComputable)
        input.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((body as { data: AssetItem | AssetVersion }).data);
      } else {
        reject(
          new ApiError(
            `POST ${path} failed with ${xhr.status}`,
            xhr.status,
            body
          )
        );
      }
    };
    xhr.onerror = () => reject(new ApiError(`POST ${path} failed`, 0));
    xhr.send(form);
  });
}

export function useUploadModel() {
  return useAdminMutation(uploadModel, [assetKeys.all], (_, input) =>
    input.assetId === undefined
      ? `${input.file.name} uploaded. Checking the model…`
      : `New version uploaded. Checking the model…`
  );
}

/* ---------- changes ---------- */

export interface AssetMetadataInput {
  id: number;
  name?: string;
  description?: string | null;
  source?: string | null;
  notes?: string | null;
  area_id?: number | null;
}

export function useUpdateAsset() {
  return useAdminMutation(
    ({ id, ...fields }: AssetMetadataInput) =>
      apiClient.patch<AssetItem>(endpointMap.assets.asset(String(id)), fields),
    [assetKeys.all],
    () => "Asset details saved."
  );
}

export function useDeleteAsset() {
  return useAdminMutation(
    (asset: AssetItem) =>
      apiClient.delete<null>(endpointMap.assets.asset(String(asset.id))),
    [assetKeys.all],
    (_, asset) => `${asset.name} deleted.`
  );
}

function activationMessage(result: ActivationResult) {
  const floors = result.floors_updated.length;
  return `${result.name} v${result.active_version?.version} is now live${
    floors
      ? `; ${floors} floor${floors === 1 ? "" : "s"} updated from the model`
      : ""
  }.`;
}

export function useActivateVersion() {
  return useAdminMutation(
    ({ assetId, versionId }: { assetId: number; versionId: number }) =>
      apiClient.post<ActivationResult>(
        endpointMap.assets.activate(String(assetId)),
        {
          version_id: versionId,
        }
      ),
    [assetKeys.all, ["buildings"], ["floors"]],
    activationMessage
  );
}

export function useRestoreVersion() {
  return useAdminMutation(
    ({ assetId, versionId }: { assetId: number; versionId: number }) =>
      apiClient.post<ActivationResult>(
        endpointMap.assets.versionRestore(String(assetId), String(versionId))
      ),
    [assetKeys.all, ["buildings"], ["floors"]],
    activationMessage
  );
}

/** Takes a live model offline: the kiosk goes back to its bundled model. */
export function useDeactivateAsset() {
  return useAdminMutation(
    (asset: AssetItem) =>
      apiClient.post<AssetItem>(
        endpointMap.assets.deactivate(String(asset.id))
      ),
    [assetKeys.all, ["buildings"], ["floors"]],
    (_, asset) =>
      `${asset.name} is offline. The kiosk uses the model bundled with the app.`
  );
}

export function useRevalidate() {
  return useAdminMutation(
    ({ assetId, versionId }: { assetId: number; versionId: number }) =>
      apiClient.post<ValidationRun>(
        endpointMap.assets.versionValidation(String(assetId), String(versionId))
      ),
    [assetKeys.all],
    run => `Validation ${run.result}: ${run.summary}`
  );
}
