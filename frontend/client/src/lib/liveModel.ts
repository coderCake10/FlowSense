/* The live building model: the version an admin activated in Asset
 * Management (GET /map/areas → `model`), in place of the model bundled with
 * the app. The bundled model stays the fallback: with no API, no active
 * model, or a live file that fails to load. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  API_BASE_URL,
  apiClient,
  endpointMap,
  isApiConfigured,
} from "@/lib/api";

interface AreaWithModel {
  code: string;
  model: { url: string; checksum: string | null } | null;
}

/** API paths come back as /api/v1/…; serve them under this app's API base. */
export function liveModelUrl(path: string) {
  return path.replace(/^\/api\/v1(?=\/)/, API_BASE_URL);
}

/** area code → live model URL. */
export function useLiveModels() {
  return useQuery({
    queryKey: ["live-models"],
    enabled: isApiConfigured(),
    staleTime: 60_000,
    // A kiosk with its server down should show the bundled model at once.
    retry: false,
    queryFn: async () => {
      const areas = await apiClient.get<AreaWithModel[]>(
        `${endpointMap.map.areas}?page_size=100`
      );
      return new Map(
        areas
          .filter(a => a.model?.url)
          .map(a => [a.code, liveModelUrl(a.model!.url)])
      );
    },
  });
}

/** `building` with its live model when one is active, else unchanged.
 * Call `onModelError` when the live file can't be shown: the building falls
 * back to its bundled model for the rest of the visit. */
export function useLiveBuilding<
  B extends { areaCode: string; modelUrl: string },
>(building: B) {
  const models = useLiveModels();
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const url = models.data?.get(building.areaCode);
  const live = !!url && !failed.has(url);
  const resolved = useMemo(
    () => (live ? { ...building, modelUrl: url! } : building),
    [building, live, url]
  );
  const onModelError = useMemo(
    () => (live ? () => setFailed(prev => new Set(prev).add(url!)) : undefined),
    [live, url]
  );
  // Wait for the answer before loading anything, so the kiosk doesn't
  // download the bundled model and then the live one.
  const pending = isApiConfigured() && models.isPending;
  return { building: resolved, live, pending, onModelError };
}
