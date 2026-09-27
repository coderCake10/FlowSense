/* Map Annotation data: the building's floors, rooms and navigation graph
 * (nodes, edges, floor transitions) from the Map and Annotation APIs, and
 * the edits the page saves straight away. Positions are converted between
 * the building model's coordinates and stored geometry (campus coordinates;
 * lib/mapCoordinates.ts), using the building's placement in the campus. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BuildingPlacement, Point3 } from "@/data/navigation";
import {
  apiClient,
  describeApiError,
  endpointMap,
  isApiConfigured,
} from "./api";
import { keys } from "./adminApi";
import {
  buildingToCampus,
  campusToBuilding,
  modelToStored,
  storedToModel,
} from "./mapCoordinates";

/** Stored geometry → the building model's coordinates. */
const toModel = (placement: BuildingPlacement | undefined, stored: number[]) =>
  campusToBuilding(placement, storedToModel(stored));
/** The building model's coordinates → stored geometry. */
const toStored = (placement: BuildingPlacement | undefined, point: Point3) =>
  modelToStored(buildingToCampus(placement, point));

export type NodeType =
  | "room"
  | "auxiliary"
  | "kiosk"
  | "sensor"
  | "area_entrance";
export type TransitionType = "stairs" | "elevator" | "escalator" | "other";

/** Node colours on the annotation map and in its legend. */
export const NODE_COLORS: Record<NodeType, string> = {
  room: "#2563EB",
  auxiliary: "#b7860b",
  kiosk: "#17365d",
  sensor: "#16803c",
  // Not purple: that ring marks points linked to another floor.
  area_entrance: "#0f8a8a",
};

export interface AnnotationArea {
  id: number;
  code: string;
  name: string;
  area_type: string;
}
export interface AnnotationFloor {
  id: number;
  floor_order: number;
  glb_node_name: string | null;
  elevation: string | null;
  display_name?: string | null;
  short_name?: string | null;
}
export interface AnnotationRoom {
  id: number;
  floor: number;
  room_code: string;
  room_alias: string;
  node_id: number | null;
}
export interface GraphNode {
  id: number;
  floor: number;
  room: number | null;
  name: string;
  node_type: NodeType;
  /** Model coordinates. */
  position: Point3;
}
export interface GraphEdge {
  id: number;
  from_node: number;
  to_node: number;
}
export interface GraphTransition {
  id: number;
  transition_type: TransitionType;
  from_node: number | null;
  to_node: number | null;
  /** Off: out of service (routes avoid it, and say so). */
  active: boolean;
}
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  transitions: GraphTransition[];
}

interface ApiNode extends Omit<GraphNode, "position"> {
  geometry: { coordinates: number[] };
}
interface ApiScene {
  nodes: ApiNode[];
  edges: GraphEdge[];
  floor_transitions: GraphTransition[];
}

const graphKey = (areaId: number | null) =>
  ["annotation-graph", areaId] as const;
const roomsKey = (areaId: number | null) =>
  ["annotation-rooms", areaId] as const;

export function useBuildingAreas() {
  return useQuery({
    queryKey: ["annotation-areas"],
    enabled: isApiConfigured(),
    queryFn: async () =>
      (
        await apiClient.getPage<AnnotationArea>(
          `${endpointMap.map.areas}?page_size=100`
        )
      ).results.filter(area => area.area_type === "building"),
  });
}

export function useAreaFloors(areaId: number | null) {
  return useQuery({
    queryKey: ["annotation-floors", areaId],
    enabled: isApiConfigured() && areaId !== null,
    queryFn: () =>
      apiClient.get<AnnotationFloor[]>(
        endpointMap.map.areaFloors(String(areaId))
      ),
  });
}

export function useAreaRooms(areaId: number | null) {
  return useQuery({
    queryKey: roomsKey(areaId),
    enabled: isApiConfigured() && areaId !== null,
    queryFn: async () => {
      const rooms: AnnotationRoom[] = [];
      for (let page = 1; ; page++) {
        const batch = await apiClient.getPage<AnnotationRoom>(
          `${endpointMap.map.rooms}?area_id=${areaId}&page_size=100&page=${page}`
        );
        rooms.push(...batch.results);
        if (page >= (batch.meta?.total_pages ?? 1)) break;
      }
      return rooms;
    },
  });
}

/** The building's whole graph (every floor), so floor links show too.
 * `placement`: where the building stands in the campus (none for the
 * kiosk's own building). */
export function useGraph(areaId: number | null, placement?: BuildingPlacement) {
  return useQuery({
    queryKey: graphKey(areaId),
    enabled: isApiConfigured() && areaId !== null,
    queryFn: async (): Promise<Graph> => {
      const scene = await apiClient.get<ApiScene>(
        `${endpointMap.annotation.all}?area_id=${areaId}`
      );
      return {
        nodes: scene.nodes.map(({ geometry, ...node }) => ({
          ...node,
          position: toModel(placement, geometry.coordinates),
        })),
        edges: scene.edges,
        transitions: scene.floor_transitions,
      };
    },
  });
}

export interface NewNode {
  floor: number;
  room?: number | null;
  name: string;
  node_type: NodeType;
  position: Point3;
  /** Connect to the previously placed node (corridor points placed in order). */
  previousNodeId?: number | null;
}

/** One graph edit, saved right away. Afterwards it refreshes the graph, the
 * room list (its `node_id`s), and the Hardware page's node picker. */
function useGraphEdit<Input>(
  areaId: number | null,
  run: (input: Input) => Promise<unknown>
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    // Saved once the request succeeds; the views refresh in the background.
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: graphKey(areaId) });
      void client.invalidateQueries({ queryKey: roomsKey(areaId) });
      void client.invalidateQueries({ queryKey: keys.mapNodes });
    },
    onError: error =>
      toast.error(describeApiError(error, "The change couldn't be saved.")),
  });
}

export function useGraphEdits(
  areaId: number | null,
  placement?: BuildingPlacement
) {
  const addNode = useGraphEdit(areaId, (node: NewNode) =>
    apiClient.post(endpointMap.annotation.nodes, {
      floor: node.floor,
      room: node.room ?? null,
      name: node.name,
      node_type: node.node_type,
      geometry: {
        type: "Point",
        coordinates: toStored(placement, node.position),
      },
      connection_mode: node.previousNodeId ? "place_order" : "no_connection",
      previous_node_id: node.previousNodeId ?? null,
    })
  );
  const removeNode = useGraphEdit(areaId, (id: number) =>
    apiClient.delete(endpointMap.annotation.node(String(id)))
  );
  // Its connections are redrawn by the server (PATCH is additive to the API
  // design: moving a point is the only change it takes).
  const moveNode = useGraphEdit(
    areaId,
    (move: { id: number; position: Point3 }) =>
      apiClient.patch(endpointMap.annotation.node(String(move.id)), {
        geometry: {
          type: "Point",
          coordinates: toStored(placement, move.position),
        },
      })
  );
  const connect = useGraphEdit(areaId, (pair: { from: number; to: number }) =>
    apiClient.post(endpointMap.annotation.edges, {
      from_node: pair.from,
      to_node: pair.to,
    })
  );
  const disconnect = useGraphEdit(areaId, (id: number) =>
    apiClient.delete(endpointMap.annotation.edge(String(id)))
  );
  const linkFloors = useGraphEdit(
    areaId,
    (link: { from: number; to: number; type: TransitionType }) =>
      apiClient.post(endpointMap.annotation.transitions, {
        transition_type: link.type,
        from_node: link.from,
        to_node: link.to,
      })
  );
  const unlinkFloors = useGraphEdit(areaId, (id: number) =>
    apiClient.delete(endpointMap.annotation.transition(String(id)))
  );
  /** Puts stairs or an elevator (all its floor links) in or out of service. */
  const setInService = useGraphEdit(
    areaId,
    (change: { ids: number[]; active: boolean }) =>
      Promise.all(
        change.ids.map(id =>
          apiClient.patch(endpointMap.annotation.transition(String(id)), {
            active: change.active,
          })
        )
      )
  );
  return {
    addNode,
    removeNode,
    moveNode,
    connect,
    disconnect,
    linkFloors,
    unlinkFloors,
    setInService,
  };
}

export interface RoomDetails {
  id: number;
  floor: number;
  room_code: string;
  room_alias: string;
  description: string | null;
}
export interface RoomChanges {
  room_code: string;
  /** Blank: the server names the room "Room <code>". */
  room_alias: string;
  /** What the room is for; blank clears it. */
  description: string;
}

const roomKey = (roomId: number | null) => ["annotation-room", roomId] as const;

/** One room's editable details (the room list leaves out descriptions). */
export function useRoomDetails(roomId: number | null) {
  return useQuery({
    queryKey: roomKey(roomId),
    enabled: isApiConfigured() && roomId !== null,
    queryFn: () =>
      apiClient.get<RoomDetails>(endpointMap.map.room(String(roomId))),
  });
}

/** Saves a room's number, name and purpose. Door points follow a new number,
 * and the kiosk picks the changes up the next time it loads its directory. */
export function useRoomEdit(areaId: number | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...changes }: RoomChanges & { id: number }) =>
      apiClient.patch<RoomDetails>(
        endpointMap.annotation.room(String(id)),
        changes
      ),
    onSuccess: (_saved, { id }) => {
      toast.success("Room details saved.");
      void client.invalidateQueries({ queryKey: roomKey(id) });
      void client.invalidateQueries({ queryKey: roomsKey(areaId) });
      void client.invalidateQueries({ queryKey: graphKey(areaId) });
      void client.invalidateQueries({ queryKey: ["kiosk-directory"] });
    },
    onError: error =>
      toast.error(describeApiError(error, "The room couldn't be saved.")),
  });
}

/** A staircase or elevator as the admin thinks of it: its floor links
 * grouped by name ("Elevator (1F)" and "Elevator (2F)" are one elevator). */
export interface ServiceGroup {
  key: string;
  name: string;
  type: TransitionType;
  ids: number[];
  /** In service when every link is on. */
  active: boolean;
}

export function serviceGroups(
  transitions: readonly GraphTransition[],
  nameOf: (id: number | null) => string | undefined
): ServiceGroup[] {
  const groups = new Map<string, ServiceGroup>();
  for (const link of transitions) {
    const base = (nameOf(link.from_node) ?? "")
      .replace(/\s*\(?\b\d+F\b\)?\s*$/i, "")
      .trim();
    const name =
      base || (link.transition_type === "elevator" ? "Elevator" : "Stairs");
    const key = `${link.transition_type}:${name}`;
    const group = groups.get(key) ?? {
      key,
      name,
      type: link.transition_type,
      ids: [],
      active: true,
    };
    group.ids.push(link.id);
    group.active = group.active && link.active;
    groups.set(key, group);
  }
  return Array.from(groups.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

// ---------------------------------------------------------------- the campus (step 14)

export interface CampusLabel {
  id: number;
  name: string;
  /** Campus coordinates (the kiosk building's model's). */
  position: Point3;
}

const labelsKey = ["campus-labels"] as const;

/** The campus view's names. */
export function useCampusLabels() {
  return useQuery({
    queryKey: labelsKey,
    enabled: isApiConfigured(),
    queryFn: async (): Promise<CampusLabel[]> =>
      (
        await apiClient.get<
          { id: number; name: string; geometry: { coordinates: number[] } }[]
        >(endpointMap.annotation.labels)
      ).map(label => ({
        id: label.id,
        name: label.name,
        position: storedToModel(label.geometry.coordinates),
      })),
  });
}

/** Saves one campus change, then refreshes the labels, the buildings (the
 * kiosk's registry) and the walkways' graph. */
function useCampusEdit<Input>(run: (input: Input) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: labelsKey });
      void client.invalidateQueries({ queryKey: ["building-registry"] });
      void client.invalidateQueries({ queryKey: ["annotation-graph"] });
      void client.invalidateQueries({ queryKey: ["annotation-areas"] });
      void client.invalidateQueries({ queryKey: ["annotation-floors"] });
      void client.invalidateQueries({ queryKey: ["annotation-rooms"] });
      void client.invalidateQueries({ queryKey: ["kiosk-directory"] });
    },
    onError: error =>
      toast.error(describeApiError(error, "The change couldn't be saved.")),
  });
}

const pointGeometry = (position: Point3) => ({
  type: "Point",
  coordinates: modelToStored(position),
});

export function useCampusEdits() {
  const addLabel = useCampusEdit((label: { name: string; position: Point3 }) =>
    apiClient.post(endpointMap.annotation.labels, {
      name: label.name,
      geometry: pointGeometry(label.position),
    })
  );
  const editLabel = useCampusEdit(
    (label: { id: number; name?: string; position?: Point3 }) =>
      apiClient.patch(endpointMap.annotation.label(String(label.id)), {
        ...(label.name !== undefined ? { name: label.name } : {}),
        ...(label.position ? { geometry: pointGeometry(label.position) } : {}),
      })
  );
  const removeLabel = useCampusEdit((id: number) =>
    apiClient.delete(endpointMap.annotation.label(String(id)))
  );
  /** Where a building stands; its navigation points move with it. */
  const placeBuilding = useCampusEdit(
    (move: { areaId: number; placement: BuildingPlacement | null }) =>
      apiClient.patch(endpointMap.map.area(String(move.areaId)), {
        placement: move.placement && {
          position: move.placement.position,
          rotation_y: move.placement.rotationY,
        },
      })
  );
  /** Where routes into a building added from the admin panel arrive (its
   * model's coordinates): the kiosk's entrance marker. */
  const setEntrance = useCampusEdit(
    async (entrance: { areaId: number; start: Point3 }) => {
      const area = await apiClient.get<{
        map_settings: Record<string, unknown> | null;
      }>(endpointMap.map.area(String(entrance.areaId)));
      return apiClient.patch(endpointMap.map.area(String(entrance.areaId)), {
        map_settings: {
          ...(area.map_settings ?? {}),
          start: entrance.start.map(v => Number(v.toFixed(3))),
          start_label: "Entrance",
        },
      });
    }
  );
  const addBuilding = useCampusEdit(
    (building: { code: string; name: string; floors: number }) =>
      apiClient.post<{ id: number; code: string; name: string }>(
        endpointMap.annotation.buildings,
        building
      )
  );
  const editFloor = useCampusEdit(
    (floor: {
      id: number;
      display_name?: string;
      short_name?: string;
      elevation?: number;
    }) => {
      const { id, ...changes } = floor;
      return apiClient.patch(endpointMap.annotation.floor(String(id)), changes);
    }
  );
  const addFloor = useCampusEdit(
    (floor: { area: number; floor_order: number }) =>
      apiClient.post(endpointMap.annotation.floors, floor)
  );
  const addRoom = useCampusEdit(
    (room: {
      floor: number;
      room_code: string;
      room_alias: string;
      description?: string;
    }) => apiClient.post(endpointMap.annotation.roomCreate, room)
  );
  const removeRoom = useCampusEdit((id: number) =>
    apiClient.delete(endpointMap.annotation.roomRemove(String(id)))
  );
  return {
    addLabel,
    editLabel,
    removeLabel,
    placeBuilding,
    setEntrance,
    addBuilding,
    editFloor,
    addFloor,
    addRoom,
    removeRoom,
  };
}

/** Every building area (with a model or not: a new one waits for its
 * model), for the picker and the campus editor. */
export function useAllAreas() {
  return useQuery({
    queryKey: ["annotation-areas", "all"],
    enabled: isApiConfigured(),
    queryFn: async () =>
      (
        await apiClient.getPage<
          AnnotationArea & {
            model: { url: string } | null;
            placement: { position: number[]; rotation_y: number } | null;
          }
        >(`${endpointMap.map.areas}?page_size=100`)
      ).results,
  });
}
