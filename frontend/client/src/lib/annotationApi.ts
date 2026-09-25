/* Map Annotation data: the building's floors, rooms and navigation graph
 * (nodes, edges, floor transitions) from the Map and Annotation APIs, and
 * the edits the page saves straight away. Positions are converted between
 * the model's coordinates and stored geometry (lib/mapCoordinates.ts). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Point3 } from "@/data/navigation";
import {
  apiClient,
  describeApiError,
  endpointMap,
  isApiConfigured,
} from "./api";
import { keys } from "./adminApi";
import { modelToStored, storedToModel } from "./mapCoordinates";

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
  area_entrance: "#7c3aed",
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

/** The building's whole graph (every floor), so floor links show too. */
export function useGraph(areaId: number | null) {
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
          position: storedToModel(geometry.coordinates),
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

export function useGraphEdits(areaId: number | null) {
  const addNode = useGraphEdit(areaId, (node: NewNode) =>
    apiClient.post(endpointMap.annotation.nodes, {
      floor: node.floor,
      room: node.room ?? null,
      name: node.name,
      node_type: node.node_type,
      geometry: { type: "Point", coordinates: modelToStored(node.position) },
      connection_mode: node.previousNodeId ? "place_order" : "no_connection",
      previous_node_id: node.previousNodeId ?? null,
    })
  );
  const removeNode = useGraphEdit(areaId, (id: number) =>
    apiClient.delete(endpointMap.annotation.node(String(id)))
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
  return { addNode, removeNode, connect, disconnect, linkFloors, unlinkFloors };
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
