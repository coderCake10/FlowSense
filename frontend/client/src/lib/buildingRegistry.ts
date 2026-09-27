/* The buildings the kiosk knows (step 14). The ones bundled with the app
 * (client/src/data: EYA, A) are the offline fallback; with the API, each
 * building area adds or updates its entry: where it stands in the campus
 * (placed in Map Annotation), its floors' names, and its live model. A
 * building added from the admin panel needs no code: its entry is built
 * from the API once its model is live. The campus view's neighbours and
 * labels come from the same data. */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildings as bundled } from "@/data/buildings";
import type {
  BuildingConfig,
  BuildingPlacement,
  CampusNeighbour,
  ModelFloor,
  Point3,
} from "@/data/navigation";
import { apiClient, endpointMap, isApiConfigured } from "./api";
import { liveModelUrl } from "./liveModel";
import { storedToModel } from "./mapCoordinates";

export interface ApiBuildingArea {
  id: number;
  code: string;
  name: string;
  area_type: string;
  model: { url: string } | null;
  placement: { position: number[]; rotation_y: number } | null;
  map_settings: {
    exterior?: string[];
    by_height?: string[];
    start?: number[];
    start_label?: string;
  } | null;
}
export interface ApiBuildingFloor {
  id: number;
  floor_order: number;
  glb_node_name: string | null;
  elevation: string | null;
  display_name: string | null;
  short_name: string | null;
}
export interface ApiCampusLabel {
  id: number;
  name: string;
  geometry: { coordinates: number[] };
}
export interface RegistryData {
  areas: ApiBuildingArea[];
  floors: Record<number, ApiBuildingFloor[]>;
  labels: ApiCampusLabel[];
}

const ORDINALS = [
  "First",
  "Second",
  "Third",
  "Fourth",
  "Fifth",
  "Sixth",
  "Seventh",
  "Eighth",
  "Ninth",
  "Tenth",
];
const floorName = (order: number) =>
  ORDINALS[order - 1] ? `${ORDINALS[order - 1]} floor` : `Floor ${order}`;

/** Label height above a placed building's ground, for new buildings. */
const LABEL_HEIGHT = 18;

const toPlacement = (
  placement: ApiBuildingArea["placement"]
): BuildingPlacement | undefined =>
  placement && placement.position.length === 3
    ? {
        position: placement.position as Point3,
        rotationY: placement.rotation_y,
      }
    : undefined;

function floorsFrom(rows: ApiBuildingFloor[]): ModelFloor[] {
  return [...rows]
    .sort((a, b) => a.floor_order - b.floor_order)
    .map(row => ({
      object: row.glb_node_name || `FLOOR_${row.floor_order}`,
      label: row.short_name || `${row.floor_order}F`,
      name: row.display_name || floorName(row.floor_order),
      elevation: row.elevation === null ? 0 : Number(row.elevation),
    }));
}

/** A bundled building with what the API says about it: its placement and
 * its floors' names (the bundled walking heights stay: a model's measured
 * lowest points can sit below the slab). */
function updated(
  config: BuildingConfig,
  area: ApiBuildingArea,
  rows: ApiBuildingFloor[] | undefined
): BuildingConfig {
  const byOrder = new Map((rows ?? []).map(row => [row.floor_order, row]));
  return {
    ...config,
    name: area.name || config.name,
    placement: toPlacement(area.placement) ?? config.placement,
    model: {
      ...config.model,
      floors: config.model.floors.map((floor, index) => {
        const row = byOrder.get(index + 1);
        return {
          ...floor,
          label: row?.short_name || floor.label,
          name: row?.display_name || floor.name,
        };
      }),
    },
  };
}

/** A building added from the admin panel, from its area, floors and live
 * model. Null until it has floors and a live model. */
function built(
  area: ApiBuildingArea,
  rows: ApiBuildingFloor[] | undefined
): BuildingConfig | null {
  if (!area.model?.url || !rows?.length) return null;
  const floors = floorsFrom(rows);
  const settings = area.map_settings ?? {};
  return {
    id: `area-${area.code.toLowerCase()}`,
    name: area.name,
    areaCode: area.code,
    floor: floors[0].name,
    modelUrl: liveModelUrl(area.model.url),
    start: (settings.start?.length === 3
      ? settings.start
      : [0, 0, 0]) as Point3,
    // No entrance placed yet (Map Annotation's Entrance tool sets it): no
    // marker.
    startLabel:
      settings.start?.length === 3 ? settings.start_label || "Entrance" : "",
    placement: toPlacement(area.placement),
    model: {
      exterior: settings.exterior ?? ["EXTERIOR", "ROOF"],
      floors,
      byHeight: settings.by_height,
    },
    kioskFloor: floors[0].object,
    camera: { position: [40, 48, 28], target: [0, 0, 0], near: 0.1, far: 1000 },
    destinations: [],
  };
}

/** The bundled buildings, updated and extended by the API. The campus
 * host's campus view shows every placed building and the API's labels. */
export function mergeRegistry(
  base: readonly BuildingConfig[],
  data: RegistryData | undefined
): BuildingConfig[] {
  if (!data) return [...base];
  const byCode = new Map(data.areas.map(area => [area.code, area]));
  const list: BuildingConfig[] = base.map(config => {
    const area = byCode.get(config.areaCode);
    return area ? updated(config, area, data.floors[area.id]) : config;
  });
  for (const area of data.areas) {
    if (area.area_type !== "building") continue;
    if (base.some(config => config.areaCode === area.code)) continue;
    const config = built(area, data.floors[area.id]);
    if (config) list.push(config);
  }
  const host = list.find(config => config.campus);
  if (!host?.campus) return list;
  const known = new Map(
    host.campus.neighbours.map(item => [item.areaCode ?? item.name, item])
  );
  const neighbours: CampusNeighbour[] = list
    .filter(config => config !== host && config.placement)
    .map(config => {
      const before = known.get(config.areaCode);
      const { position, rotationY } = config.placement!;
      const moved =
        !before ||
        before.position.some((v, i) => v !== position[i]) ||
        before.rotationY !== rotationY;
      return {
        name: config.name,
        areaCode: config.areaCode,
        modelUrl: before?.modelUrl ?? config.modelUrl,
        position,
        rotationY,
        // A building placed or moved in Map Annotation: its name above it.
        labelAt:
          before && !moved
            ? before.labelAt
            : [position[0], position[1] + LABEL_HEIGHT, position[2]],
      };
    });
  const campus = {
    ...host.campus,
    neighbours,
    landmarks: data.labels.map(label => ({
      name: label.name,
      at: storedToModel(label.geometry.coordinates),
    })),
  };
  return list.map(config => (config === host ? { ...host, campus } : config));
}

async function loadRegistry(): Promise<RegistryData> {
  const areas = await apiClient.get<ApiBuildingArea[]>(
    `${endpointMap.map.areas}?page_size=100`
  );
  const buildingAreas = areas.filter(area => area.area_type === "building");
  const floors: Record<number, ApiBuildingFloor[]> = {};
  await Promise.all(
    buildingAreas.map(async area => {
      floors[area.id] = await apiClient.get<ApiBuildingFloor[]>(
        endpointMap.map.areaFloors(String(area.id))
      );
    })
  );
  const labels = await apiClient
    .get<ApiCampusLabel[]>(endpointMap.annotation.labels)
    .catch(() => []);
  return { areas: buildingAreas, floors, labels };
}

export const registryKey = ["building-registry"] as const;

/** Where a floor is: its building and model floor group. */
export interface FloorPlace {
  building: BuildingConfig;
  object: string;
}

/** floor id → its building and model floor, for rooms found by search in
 * any building. */
export function floorIndex(
  list: readonly BuildingConfig[],
  data: RegistryData | undefined
): Map<number, FloorPlace> {
  const index = new Map<number, FloorPlace>();
  for (const area of data?.areas ?? []) {
    const building = list.find(item => item.areaCode === area.code);
    if (!building) continue;
    for (const row of data!.floors[area.id] ?? []) {
      const object =
        row.glb_node_name || building.model.floors[row.floor_order - 1]?.object;
      if (object) index.set(row.id, { building, object });
    }
  }
  return index;
}

/** Every building the kiosk shows (the bundled ones at once, then the
 * API's). `ready`: the API's answer is in (or there's no API). */
export function useBuildingRegistry() {
  const query = useQuery({
    queryKey: registryKey,
    enabled: isApiConfigured(),
    staleTime: 60_000,
    retry: false,
    queryFn: loadRegistry,
  });
  const list = useMemo(() => mergeRegistry(bundled, query.data), [query.data]);
  const floors = useMemo(
    () => floorIndex(list, query.data),
    [list, query.data]
  );
  return {
    buildings: list as [BuildingConfig, ...BuildingConfig[]],
    /** floor id → building and model floor (empty without the API). */
    floors,
    ready: !isApiConfigured() || !query.isPending,
  };
}
