/* The kiosk's live directory (when the API is configured): every room in
 * the building from the Map API, search through the Search API (each search
 * is logged for Analytics), and routes from the Navigation API. Without an
 * API the kiosk keeps its built-in demo destinations. */
import { useQuery } from "@tanstack/react-query";
import type { BuildingConfig, Destination } from "@/data/navigation";
import { apiClient, endpointMap, isApiConfigured } from "./api";
import { storedToModel } from "./mapCoordinates";
import { splitByFloor } from "./mapView";

/** Room colour on the map (the route line and destination marker). */
const ROUTE_COLOR = "#2563EB";
/** Search API header that credits a search to the visitor's kiosk session. */
const KIOSK_SESSION_HEADER = "X-Kiosk-Session-Id";

interface ApiArea {
  id: number;
  code: string;
}
interface ApiFloor {
  id: number;
  floor_order: number;
  glb_node_name: string | null;
}
export interface ApiRoom {
  id: number;
  floor: number;
  room_code: string;
  room_alias: string;
  is_navigable: boolean;
  node_id: number | null;
}
interface ApiSearchResult {
  result_type: "room" | "personnel";
  room?: ApiRoom;
}
interface ApiRoute {
  segments: { geometry: { coordinates: number[][] } }[];
}

export interface Directory {
  areaId: number;
  /** Floor id → model floor object (`FLOOR_1` …). */
  floorObjects: Map<number, string>;
  /** Every active room, in floor then room-code order. */
  rooms: Destination[];
}

/** A Map/Search API room as a kiosk destination (no route yet). */
export function roomDestination(
  building: BuildingConfig,
  floorObjects: Map<number, string>,
  room: ApiRoom
): Destination {
  const modelFloor = floorObjects.get(room.floor);
  const floor = building.model.floors.find(f => f.object === modelFloor);
  return {
    id: `room-${room.id}`,
    roomId: room.id,
    nodeId: room.is_navigable ? room.node_id : null,
    name: room.room_alias,
    code: room.room_code,
    color: ROUTE_COLOR,
    points: [],
    building: building.name,
    floor: floor?.name ?? "",
    modelFloor,
  };
}

function floorRank(building: BuildingConfig, destination: Destination) {
  const index = building.model.floors.findIndex(
    f => f.object === destination.modelFloor
  );
  return index < 0 ? building.model.floors.length : index;
}

async function loadDirectory(building: BuildingConfig): Promise<Directory> {
  const areas = await apiClient.getPage<ApiArea>(
    `${endpointMap.map.areas}?page_size=100`
  );
  const area = areas.results.find(item => item.code === building.areaCode);
  if (!area) throw new Error(`No area ${building.areaCode} in the Map API.`);
  const floors = await apiClient.get<ApiFloor[]>(
    endpointMap.map.areaFloors(String(area.id))
  );
  const floorObjects = new Map<number, string>();
  for (const floor of floors) {
    const object =
      floor.glb_node_name ??
      building.model.floors[floor.floor_order - 1]?.object;
    if (object) floorObjects.set(floor.id, object);
  }
  const rooms: ApiRoom[] = [];
  for (let page = 1; ; page++) {
    const batch = await apiClient.getPage<ApiRoom>(
      `${endpointMap.map.rooms}?area_id=${area.id}&is_active=true&page_size=100&page=${page}`
    );
    rooms.push(...batch.results);
    if (page >= (batch.meta?.total_pages ?? 1)) break;
  }
  const destinations = rooms
    .map(room => roomDestination(building, floorObjects, room))
    .sort(
      (a, b) =>
        floorRank(building, a) - floorRank(building, b) ||
        a.code.localeCompare(b.code, undefined, { numeric: true })
    );
  return { areaId: area.id, floorObjects, rooms: destinations };
}

/** Every room in the building, loaded once per kiosk visit. */
export function useDirectory(building: BuildingConfig) {
  return useQuery({
    queryKey: ["kiosk-directory", building.id],
    queryFn: () => loadDirectory(building),
    enabled: isApiConfigured(),
    staleTime: 5 * 60_000,
  });
}

/** Rooms matching `query`, best match first (Search API; logged). */
export function useRoomSearch(
  building: BuildingConfig,
  directory: Directory | undefined,
  query: string,
  kioskSessionId: () => string | null
) {
  const q = query.trim();
  return useQuery({
    queryKey: ["kiosk-search", building.id, q],
    enabled: isApiConfigured() && !!directory && q.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const session = kioskSessionId();
      const found = await apiClient.get<{ results: ApiSearchResult[] }>(
        `${endpointMap.search.query}?${new URLSearchParams({
          q,
          result_type: "room",
          area_id: String(directory!.areaId),
          // The best matches; looser ones (typos, descriptions) trail off.
          limit: "20",
        })}`,
        session ? { [KIOSK_SESSION_HEADER]: session } : undefined
      );
      return found.results
        .filter(result => result.room)
        .map(result =>
          roomDestination(building, directory!.floorObjects, result.room!)
        );
    },
  });
}

/** Asks the Navigation API for the walking route from the kiosk to a room,
 * split by floor. Resolves to null when either end isn't on the map yet. */
export async function fetchRoute(
  building: BuildingConfig,
  originNodeId: number | null | undefined,
  destination: Destination
): Promise<Destination | null> {
  if (!originNodeId || !destination.nodeId) return null;
  const route = await apiClient.post<ApiRoute>(endpointMap.navigation.routes, {
    origin_node_id: originNodeId,
    destination_node_ids: [destination.nodeId],
  });
  const points = route.segments.flatMap((segment, index) =>
    segment.geometry.coordinates
      .slice(index === 0 ? 0 : 1)
      .map(coordinate => storedToModel(coordinate))
  );
  if (points.length < 2) return null;
  return {
    ...destination,
    points,
    legs: splitByFloor(building.model.floors, points),
  };
}
