/*
 * FlowSense Map Annotation / Interactive 3D Map
 *
 * Implements the Canva requirements for the interactive map workspace:
 * - Area is a first-class selection.
 * - Toolkit and node tree remain persistent.
 * - Toolkit is icon-first with unique icons.
 * - Camera controls only appear in 3D mode.
 * - 3D viewport uses the real annotation/node data when the API is available.
 * - Location details animate into view.
 * - Contextual configuration changes with the selected node.
 * - Ctrl/Cmd + Z performs undo; there is no visible Undo button.
 * - Node edit/delete actions use the Annotation API contract.
 * - Room details can redirect to Asset Management.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
import {
  Box,
  Building2,
  Check,
  CircleDot,
  DoorOpen,
  Edit3,
  Eraser,
  Eye,
  Layers3,
  MousePointer2,
  Network,
  Save,
  Search,
  Server,
  Settings2,
  Trash2,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/FlowSenseShell";
import { apiClient, endpointMap, isApiConfigured } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type NodeKind = "Room Node" | "Kiosk Node" | "Sensor" | "Auxiliary Node";
type Tool = "Select" | "Location Node" | "Auxiliary Node" | "Edge" | "Delete";
type Representation = "2D View" | "3D View";
type CameraMode = "Top Down" | "Isometric";

type Area = {
  id: string | number;
  code: string;
  name: string;
  area_type?: string;
};

type Floor = {
  id: string | number;
  area: string | number;
  glb_node_name?: string | null;
  floor_order: number;
  elevation?: number | null;
  navigable?: boolean;
  visible_in_kiosk?: boolean;
  active?: boolean;
};

type Geometry = {
  type?: string;
  coordinates?: unknown;
};

type ApiNode = {
  id: string | number;
  floor_id?: string | number;
  floor?: string | number;
  room_id?: string | number | null;
  name: string;
  node_type: "room" | "auxiliary" | "kiosk" | "sensor" | "area_entrance";
  geometry?: Geometry | null;
  active?: boolean;
  navigable?: boolean;
  metadata?: Record<string, unknown>;
};

type ViewNode = {
  id: string;
  apiId: string;
  label: string;
  subtitle: string;
  kind: NodeKind;
  nodeType: ApiNode["node_type"];
  roomId?: string;
  floorId?: string;
  geometry?: Geometry | null;
  metadata?: Record<string, unknown>;
};

type RoomDetail = {
  id: string;
  floor?: string | number;
  area_id?: string | number;
  room_code: string;
  room_alias: string;
  description?: string | null;
  room_type?: string;
  is_searchable?: boolean;
  is_navigable?: boolean;
  is_active?: boolean;
  geometry?: Geometry | null;
  image_path?: string | null;
};

type AnnotationBundle = {
  nodes?: ApiNode[];
  edges?: unknown[];
  transitions?: unknown[];
};

type Snapshot = {
  nodes: ViewNode[];
  selectedId: string | null;
  tool: Tool;
};

const fallbackAreas: Area[] = [
  { id: "eya", code: "EYA", name: "EYA Building", area_type: "building" },
  { id: "ps", code: "PS", name: "PS Building", area_type: "building" },
];

const fallbackFloors: Floor[] = [
  { id: "eya-1", area: "eya", floor_order: 1, glb_node_name: "EYA-1F" },
  { id: "eya-2", area: "eya", floor_order: 2, glb_node_name: "EYA-2F" },
  { id: "ps-1", area: "ps", floor_order: 1, glb_node_name: "PS-1F" },
];

const fallbackNodes: ViewNode[] = [
  {
    id: "room-101",
    apiId: "room-101",
    label: "EA-101",
    subtitle: "Guidance Counselling Center",
    kind: "Room Node",
    nodeType: "room",
    roomId: "101",
    floorId: "eya-1",
  },
  {
    id: "room-102",
    apiId: "room-102",
    label: "EA-102",
    subtitle: "Registrar Office",
    kind: "Room Node",
    nodeType: "room",
    roomId: "102",
    floorId: "eya-1",
  },
  {
    id: "room-201",
    apiId: "room-201",
    label: "EA-201",
    subtitle: "Lecture Hall",
    kind: "Room Node",
    nodeType: "room",
    roomId: "201",
    floorId: "eya-2",
  },
  {
    id: "kiosk-1",
    apiId: "kiosk-1",
    label: "Main Entrance Kiosk",
    subtitle: "Kiosk Node",
    kind: "Kiosk Node",
    nodeType: "kiosk",
    floorId: "eya-1",
  },
  {
    id: "sensor-1",
    apiId: "sensor-1",
    label: "Sensor-1",
    subtitle: "Sensor Node",
    kind: "Sensor",
    nodeType: "sensor",
    floorId: "eya-1",
  },
  {
    id: "aux-1",
    apiId: "aux-1",
    label: "Main Corridor",
    subtitle: "Auxiliary Node",
    kind: "Auxiliary Node",
    nodeType: "auxiliary",
    floorId: "eya-1",
  },
];

const toolMeta: Record<Tool, { label: string; icon: typeof MousePointer2 }> = {
  Select: { label: "Select", icon: MousePointer2 },
  "Location Node": { label: "Location", icon: CircleDot },
  "Auxiliary Node": { label: "Auxiliary", icon: Network },
  Edge: { label: "Connection", icon: Wifi },
  Delete: { label: "Delete", icon: Eraser },
};

function extractData<T>(payload: T | { data?: T }): T | undefined {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data?: T }).data;
  }
  return payload as T;
}

function normalizeNode(node: ApiNode): ViewNode {
  const kindMap: Record<ApiNode["node_type"], NodeKind> = {
    room: "Room Node",
    kiosk: "Kiosk Node",
    sensor: "Sensor",
    auxiliary: "Auxiliary Node",
    area_entrance: "Auxiliary Node",
  };

  return {
    id: String(node.id),
    apiId: String(node.id),
    label: node.name,
    subtitle: kindMap[node.node_type],
    kind: kindMap[node.node_type],
    nodeType: node.node_type,
    roomId: node.room_id == null ? undefined : String(node.room_id),
    floorId: node.floor_id == null ? undefined : String(node.floor_id),
    geometry: node.geometry,
    metadata: node.metadata,
  };
}

function readPoint(geometry?: Geometry | null): [number, number, number] | null {
  if (!geometry || geometry.type !== "Point" || !Array.isArray(geometry.coordinates)) {
    return null;
  }
  const [x, y, z] = geometry.coordinates as number[];
  if (![x, y].every(value => typeof value === "number")) return null;
  return [x / 100, (typeof z === "number" ? z : 0) / 100, y / 100];
}

function BuildingMass({ position, size, highlighted }: {
  position: [number, number, number];
  size: [number, number, number];
  highlighted?: boolean;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={highlighted ? "#f4c542" : "#dbe4ed"}
        roughness={0.8}
      />
    </mesh>
  );
}

function NodeMarker({
  node,
  position,
  selected,
  onClick,
}: {
  node: ViewNode;
  position: [number, number, number];
  selected: boolean;
  onClick: () => void;
}) {
  const color = node.kind === "Room Node"
    ? "#f4c542"
    : node.kind === "Kiosk Node"
      ? "#17365d"
      : node.kind === "Sensor"
        ? "#168051"
        : "#718398";

  return (
    <group position={position} onClick={event => { event.stopPropagation(); onClick(); }}>
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[selected ? 0.18 : 0.13, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 0.35 : 0.08}
        />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.24, 0.3, 32]} />
          <meshBasicMaterial color="#f4c542" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

function Scene({
  nodes,
  selectedId,
  onSelect,
  cameraMode,
}: {
  nodes: ViewNode[];
  selectedId: string | null;
  onSelect: (node: ViewNode) => void;
  cameraMode: CameraMode;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (cameraMode === "Top Down") {
      camera.position.set(0, 8, 0.01);
    } else {
      camera.position.set(6, 5, 7);
    }
    camera.lookAt(0, 0, 0);
  }, [camera, cameraMode]);

  const positions: [number, number, number][] = [
    [-2.3, 0, -0.8],
    [-0.5, 0, -0.8],
    [1.6, 0, -0.8],
    [2.5, 0, 1.1],
    [0.5, 0, 1.25],
    [-1.5, 0, 1.1],
    [-3.1, 0, 1.1],
  ];

  return (
    <>
      <color attach="background" args={["#f7f9fc"]} />
      <ambientLight intensity={1.7} />
      <directionalLight position={[4, 8, 4]} intensity={2} castShadow />
      <gridHelper args={[10, 20, "#cbd8e6", "#e5ebf2"]} position={[0, -0.32, 0]} />
      <BuildingMass position={[-1.7, 0.05, -0.9]} size={[2.2, 0.65, 1.6]} highlighted={selectedId === nodes[0]?.id} />
      <BuildingMass position={[1.1, 0.15, -0.9]} size={[2.5, 0.9, 1.65]} highlighted={selectedId === nodes[2]?.id} />
      <BuildingMass position={[1.9, 0, 1.35]} size={[1.7, 0.55, 1.4]} />
      <BuildingMass position={[-1.5, -0.02, 1.35]} size={[2.3, 0.45, 1.25]} />
      {nodes.map((node, index) => {
        const geometryPosition = readPoint(node.geometry);
        const position = geometryPosition ?? positions[index % positions.length];
        return (
          <NodeMarker
            key={node.id}
            node={node}
            position={position}
            selected={node.id === selectedId}
            onClick={() => onSelect(node)}
          />
        );
      })}
      <OrbitControls enablePan enableZoom enableRotate={!cameraMode || cameraMode === "Isometric"} />
    </>
  );
}

function SpatialViewport({
  representation,
  cameraMode,
  nodes,
  selectedId,
  onSelect,
}: {
  representation: Representation;
  cameraMode: CameraMode;
  nodes: ViewNode[];
  selectedId: string | null;
  onSelect: (node: ViewNode) => void;
}) {
  if (representation === "2D View") {
    return (
      <div
        className="relative h-[590px] w-full overflow-hidden bg-[#f7f9fc]"
        style={{
          backgroundImage: "radial-gradient(#d6dee8 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      >
        <div className="absolute inset-0 grid place-items-center p-10">
          <div className="relative h-[72%] w-[72%] max-w-[760px] min-w-[440px]">
            <div className="absolute left-[10%] bottom-[15%] h-[28%] w-[30%] border-2 border-[#718398] bg-white/90 p-6 text-center font-display font-bold text-[#17365d]">
              MAIN
            </div>
            <div className="absolute left-[35%] top-[5%] h-[32%] w-[30%] border-2 border-[#718398] bg-white/90 p-6 text-center font-display font-bold text-[#17365d]">
              EYA
            </div>
            <div className="absolute right-[10%] bottom-[17%] h-[25%] w-[27%] border-2 border-[#718398] bg-white/90 p-6 text-center font-display font-bold text-[#17365d]">
              PS
            </div>
            {nodes.map((node, index) => {
              const positions = [
                "left-[42%] top-[38%]",
                "left-[50%] top-[49%]",
                "right-[23%] top-[25%]",
                "left-[19%] bottom-[27%]",
                "right-[29%] bottom-[26%]",
                "left-[28%] top-[45%]",
              ];
              return (
                <button
                  key={node.id}
                  onClick={() => onSelect(node)}
                  className={cn(
                    "absolute grid size-9 place-items-center rounded-full border-2 shadow-sm transition",
                    positions[index % positions.length],
                    node.id === selectedId
                      ? "border-[#f4c542] bg-[#f4c542] text-[#17365d] scale-110"
                      : "border-[#17365d] bg-white text-[#17365d]"
                  )}
                  title={node.label}
                >
                  <CircleDot size={15} />
                </button>
              );
            })}
            <div className="absolute left-[46%] bottom-[3%] text-[10px] font-bold text-[#17365d]">
              YOU ARE HERE
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[590px] w-full overflow-hidden">
      <Canvas
        dpr={[1, 1.5]}
        shadows
        camera={{ position: [6, 5, 7], fov: 45 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
      >
        <Scene
          nodes={nodes}
          selectedId={selectedId}
          onSelect={onSelect}
          cameraMode={cameraMode}
        />
      </Canvas>
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-[#dbe3ed] bg-white/90 px-3 py-2 text-[10px] font-semibold text-[#53677d] shadow-sm">
        Interactive 3D viewport · {nodes.length} annotation nodes
      </div>
    </div>
  );
}

export function MapAnnotation() {
  const [tool, setTool] = useState<Tool>("Select");
  const [representation, setRepresentation] = useState<Representation>("3D View");
  const [cameraMode, setCameraMode] = useState<CameraMode>("Isometric");
  const [areas, setAreas] = useState<Area[]>(fallbackAreas);
  const [floors, setFloors] = useState<Floor[]>(fallbackFloors);
  const [areaId, setAreaId] = useState(String(fallbackAreas[0].id));
  const [floorId, setFloorId] = useState(String(fallbackFloors[0].id));
  const [nodes, setNodes] = useState<ViewNode[]>(fallbackNodes);
  const [selectedId, setSelectedId] = useState<string | null>(fallbackNodes[0].id);
  const [detailsNode, setDetailsNode] = useState<ViewNode | null>(null);
  const [editNode, setEditNode] = useState<ViewNode | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftCode, setDraftCode] = useState("");
  const [draftAlias, setDraftAlias] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [createNodeOpen, setCreateNodeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(true);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<ViewNode | null>(null);
  const lastSnapshotRef = useRef<Snapshot | null>(null);

  const selected = nodes.find(node => node.id === selectedId) ?? null;
  const selectedArea = areas.find(area => String(area.id) === areaId) ?? areas[0];
  const visibleFloors = useMemo(
    () => floors.filter(floor => String(floor.area) === String(areaId)),
    [floors, areaId]
  );
  const filteredNodes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return nodes.filter(node => {
      const matchesSearch = !query || `${node.label} ${node.subtitle}`.toLowerCase().includes(query);
      const matchesFloor = !floorId || !node.floorId || String(node.floorId) === String(floorId);
      return matchesSearch && matchesFloor;
    });
  }, [nodes, search, floorId]);

  const pushHistory = useCallback(() => {
    const snapshot: Snapshot = {
      nodes,
      selectedId,
      tool,
    };
    setHistory(current => [...current.slice(-19), snapshot]);
    lastSnapshotRef.current = snapshot;
  }, [nodes, selectedId, tool]);

  const undo = useCallback(() => {
    setHistory(current => {
      const previous = current[current.length - 1];
      if (!previous) {
        toast.message("Nothing to undo");
        return current;
      }
      setNodes(previous.nodes);
      setSelectedId(previous.selectedId);
      setTool(previous.tool);
      setSaved(false);
      toast.success("Last map change undone");
      return current.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
      if (event.key === "Escape") {
        setDetailsNode(null);
        setEditNode(null);
        setDeleteConfirm(null);
        setCreateNodeOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo]);

  useEffect(() => {
    if (representation !== "3D View") setCameraMode("Isometric");
  }, [representation]);

  useEffect(() => {
    if (visibleFloors.length && !visibleFloors.some(floor => String(floor.id) === String(floorId))) {
      setFloorId(String(visibleFloors[0].id));
    }
  }, [visibleFloors, floorId]);

  const loadMapData = useCallback(async () => {
    if (!isApiConfigured()) return;
    setLoading(true);
    try {
      const [areasResponse, floorsResponse, annotationsResponse] = await Promise.all([
        apiClient.get<Area[] | { data: Area[] }>(endpointMap.map.areas),
        apiClient.get<Floor[] | { data: Floor[] }>(endpointMap.map.floors),
        apiClient.get<AnnotationBundle | { data: AnnotationBundle }>(endpointMap.annotation.all),
      ]);

      const nextAreas = extractData(areasResponse);
      const nextFloors = extractData(floorsResponse);
      const bundle = extractData(annotationsResponse);
      const nextNodes = bundle?.nodes?.map(normalizeNode) ?? [];

      if (nextAreas?.length) {
        setAreas(nextAreas);
        setAreaId(current => nextAreas.some(area => String(area.id) === current) ? current : String(nextAreas[0].id));
      }
      if (nextFloors?.length) setFloors(nextFloors);
      if (nextNodes.length) {
        setNodes(nextNodes);
        setSelectedId(current => current && nextNodes.some(node => node.id === current) ? current : nextNodes[0].id);
      }
    } catch (error) {
      console.error(error);
      toast.error("Could not load live map data", {
        description: "Showing the local preview until the API is available.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  const selectNode = useCallback(async (node: ViewNode) => {
    setSelectedId(node.id);

    if (isApiConfigured()) {
      try {
        const response = await apiClient.get<ApiNode | { data: ApiNode }>(
          endpointMap.annotation.node(node.apiId)
        );
        const liveNode = extractData(response);
        if (liveNode) {
          const normalized = normalizeNode(liveNode);
          setNodes(current =>
            current.map(item => item.id === normalized.id ? { ...item, ...normalized } : item)
          );
          setDetailsNode(normalized);
          return;
        }
      } catch (error) {
        console.error(error);
      }
    }

    setDetailsNode(node);
  }, []);

  const openEdit = useCallback(async (node: ViewNode) => {
    setSelectedId(node.id);
    setEditNode(node);
    setDraftName(node.label);
    setDraftCode(node.kind === "Room Node" ? node.label : node.id);
    setDraftAlias(node.kind === "Room Node" ? node.subtitle : node.label);
    setDraftDescription(String(node.metadata?.description ?? ""));

    if (node.kind === "Room Node" && node.roomId && isApiConfigured()) {
      try {
        const response = await apiClient.get<RoomDetail | { data: RoomDetail }>(endpointMap.map.room(node.roomId));
        const detail = extractData(response);
        if (detail) {
          setDraftCode(detail.room_code);
          setDraftAlias(detail.room_alias);
          setDraftDescription(detail.description ?? "");
        }
      } catch (error) {
        console.error(error);
      }
    }
  }, []);

  const saveNode = useCallback(async () => {
    if (!editNode || !draftName.trim()) return;
    pushHistory();

    const updatedNode: ViewNode = {
      ...editNode,
      label: editNode.kind === "Room Node" ? draftCode.trim() : draftName.trim(),
      subtitle: editNode.kind === "Room Node" ? draftAlias.trim() || draftCode.trim() : draftName.trim(),
      metadata: {
        ...editNode.metadata,
        description: draftDescription.trim(),
      },
    };

    setNodes(current => current.map(node => node.id === editNode.id ? updatedNode : node));
    setEditNode(null);
    setSaved(false);

    try {
      if (isApiConfigured()) {
        if (editNode.kind === "Room Node" && editNode.roomId) {
          await apiClient.patch(endpointMap.annotation.room(editNode.roomId), {
            room_code: draftCode.trim(),
            room_alias: draftAlias.trim(),
            description: draftDescription.trim(),
          });
        } else {
          await apiClient.patch(endpointMap.annotation.node(editNode.apiId), {
            name: draftName.trim(),
            metadata: {
              ...editNode.metadata,
              description: draftDescription.trim(),
            },
          });
        }
      }
      toast.success("Annotation updated");
    } catch (error) {
      console.error(error);
      toast.error("Saved locally, but the API update failed");
    }
  }, [draftAlias, draftCode, draftDescription, draftName, editNode, pushHistory]);

  const deleteNode = useCallback(async (node: ViewNode) => {
    pushHistory();
    setNodes(current => current.filter(item => item.id !== node.id));
    setSelectedId(current => current === node.id ? null : current);
    setDetailsNode(null);
    setDeleteConfirm(null);
    setSaved(false);

    try {
      if (isApiConfigured()) {
        await apiClient.delete(endpointMap.annotation.node(node.apiId));
      }
      toast.success(`${node.label} deleted`);
    } catch (error) {
      console.error(error);
      toast.error("Removed from the preview, but the API delete failed");
    }
  }, [pushHistory]);

  const createNode = useCallback(() => {
    const name = window.prompt("Location node name", "New Location");
    if (!name?.trim()) return;
    pushHistory();
    const id = `local-${Date.now()}`;
    const newNode: ViewNode = {
      id,
      apiId: id,
      label: name.trim(),
      subtitle: tool === "Auxiliary Node" ? "Auxiliary Node" : "Room Node",
      kind: tool === "Auxiliary Node" ? "Auxiliary Node" : "Room Node",
      nodeType: tool === "Auxiliary Node" ? "auxiliary" : "room",
      floorId,
    };
    setNodes(current => [...current, newNode]);
    setSelectedId(id);
    setSaved(false);
    setCreateNodeOpen(false);
    toast.success("Location node added to the workspace");
  }, [floorId, pushHistory, tool]);

  const saveChanges = async () => {
    setSaved(true);
    toast.success("Map changes saved");
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Map Annotation"
        title="Interactive 3D Map"
        description="Configure areas, floors, annotation nodes, and spatial relationships that power FlowSense wayfinding."
        action={
          <Button
            className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            onClick={saveChanges}
          >
            <Save size={15} className="mr-2" />
            Save changes
          </Button>
        }
      />

      <Card className="overflow-hidden border-[#dbe3ed]">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#dbe3ed] bg-white p-3">
          <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#718398]">
            Area
            <select
              value={areaId}
              onChange={event => {
                setAreaId(event.target.value);
                setSaved(false);
              }}
              className="ml-2 h-9 rounded-md border border-[#cbd8e6] bg-white px-3 text-[11px] font-medium normal-case tracking-normal text-[#17365d]"
            >
              {areas.map(area => (
                <option key={String(area.id)} value={String(area.id)}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#718398]">
            Floor
            <select
              value={floorId}
              onChange={event => setFloorId(event.target.value)}
              className="ml-2 h-9 rounded-md border border-[#cbd8e6] bg-white px-3 text-[11px] font-medium normal-case tracking-normal text-[#17365d]"
            >
              {visibleFloors.map(floor => (
                <option key={String(floor.id)} value={String(floor.id)}>
                  {floor.glb_node_name || `Floor ${floor.floor_order}`}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#718398]">
            Representation
            <select
              value={representation}
              onChange={event => setRepresentation(event.target.value as Representation)}
              className="ml-2 h-9 rounded-md border border-[#cbd8e6] bg-white px-3 text-[11px] font-medium normal-case tracking-normal text-[#17365d]"
            >
              <option>2D View</option>
              <option>3D View</option>
            </select>
          </label>

          {representation === "3D View" && (
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#718398]">
              Camera
              <select
                value={cameraMode}
                onChange={event => setCameraMode(event.target.value as CameraMode)}
                className="ml-2 h-9 rounded-md border border-[#cbd8e6] bg-white px-3 text-[11px] font-medium normal-case tracking-normal text-[#17365d]"
              >
                <option>Top Down</option>
                <option>Isometric</option>
              </select>
            </label>
          )}

          <div className="ml-auto flex items-center gap-2">
            {loading && <span className="text-[10px] font-semibold text-[#8391a3]">Loading map…</span>}
            <Badge className={saved ? "border-[#d5e9dd] bg-[#effaf3] text-[#168051]" : "border-[#f2ddb0] bg-[#fff8df] text-[#946c00]"}>
              {saved ? "Saved" : "Unsaved"}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => window.location.assign("/assets")}>
              Asset Management
            </Button>
          </div>
        </div>

        <div className="grid min-h-[650px] lg:grid-cols-[76px_minmax(0,1fr)_280px]">
          {/* Persistent icon toolkit */}
          <aside className="border-r border-[#dbe3ed] bg-[#fbfcfe] p-2">
            <div className="flex flex-col items-center gap-2">
              {Object.entries(toolMeta).map(([key, meta]) => {
                const toolKey = key as Tool;
                const Icon = meta.icon;
                return (
                  <button
                    key={toolKey}
                    title={meta.label}
                    aria-label={meta.label}
                    onClick={() => {
                      setTool(toolKey);
                      if (toolKey === "Location Node" || toolKey === "Auxiliary Node") {
                        setCreateNodeOpen(true);
                      }
                    }}
                    className={cn(
                      "grid size-11 place-items-center rounded-xl border transition",
                      tool === toolKey
                        ? "border-[#f4c542] bg-[#fff8df] text-[#17365d] shadow-sm"
                        : "border-transparent text-[#718398] hover:border-[#dbe3ed] hover:bg-white hover:text-[#17365d]"
                    )}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>
            <div className="mt-5 border-t border-[#dbe3ed] pt-4 text-center">
              <Layers3 size={16} className="mx-auto text-[#8391a3]" />
              <p className="mt-2 text-[8px] font-bold uppercase tracking-[0.08em] text-[#9aa7b6]">Tools</p>
            </div>
          </aside>

          <section className="relative min-w-0 bg-[#f7f9fc]">
            <div className="flex items-center justify-between border-b border-[#e8edf3] bg-white px-4 py-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8391a3]">3D Viewport</p>
                <p className="mt-1 text-xs font-semibold text-[#17365d]">
                  {selectedArea?.name ?? "Area"} · {visibleFloors.find(floor => String(floor.id) === String(floorId))?.glb_node_name ?? "Floor"}
                </p>
              </div>
              <Badge className="border-[#dbe3ed] bg-white text-[#718398]">
                {representation === "3D View" ? "3D" : "2D"}
              </Badge>
            </div>

            <SpatialViewport
              representation={representation}
              cameraMode={cameraMode}
              nodes={filteredNodes}
              selectedId={selectedId}
              onSelect={selectNode}
            />
          </section>

          {/* Persistent node tree / contextual configuration */}
          <aside className="flex min-h-0 flex-col border-l border-[#dbe3ed] bg-white">
            <div className="border-b border-[#dbe3ed] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#718398]">Node Tree</p>
                  <p className="mt-1 text-[10px] text-[#9aa7b6]">Persistent workspace panel</p>
                </div>
                <Building2 size={17} className="text-[#8391a3]" />
              </div>
              <div className="relative mt-3">
                <Search size={14} className="absolute left-3 top-3 text-[#8391a3]" />
                <Input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Find a node"
                  className="h-9 border-[#cbd8e6] pl-8 text-xs"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {(["Room Node", "Kiosk Node", "Sensor", "Auxiliary Node"] as NodeKind[]).map(kind => {
                const group = filteredNodes.filter(node => node.kind === kind);
                if (!group.length) return null;
                return (
                  <div key={kind} className="mb-4">
                    <p className="mb-1 border-b border-[#edf1f5] pb-2 text-[9px] font-bold uppercase tracking-[0.13em] text-[#8391a3]">
                      {kind === "Room Node" ? "Rooms" : kind === "Kiosk Node" ? "Kiosk" : kind === "Sensor" ? "Sensors" : "Auxiliary"}
                    </p>
                    {group.map(node => (
                      <div
                        key={node.id}
                        className={cn(
                          "group flex items-center gap-2 rounded-lg px-2 py-2",
                          node.id === selectedId && "bg-[#fff8df]"
                        )}
                      >
                        <button onClick={() => selectNode(node)} className="min-w-0 flex-1 text-left">
                          <p className="truncate text-xs font-semibold text-[#17365d]">{node.label}</p>
                          <p className="truncate text-[9px] text-[#8a98a9]">{node.subtitle}</p>
                        </button>
                        <button
                          onClick={() => openEdit(node)}
                          className="grid size-7 place-items-center rounded-md text-[#b08412] opacity-0 transition group-hover:opacity-100 hover:bg-white"
                          aria-label={`Edit ${node.label}`}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(node)}
                          className="grid size-7 place-items-center rounded-md text-[#a45b5b] opacity-0 transition group-hover:opacity-100 hover:bg-[#fff1f1]"
                          aria-label={`Delete ${node.label}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {selected && (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.18 }}
                  className="border-t border-[#dbe3ed] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8391a3]">Selected</p>
                      <p className="mt-1 text-sm font-bold text-[#17365d]">{selected.label}</p>
                      <p className="text-[9px] text-[#8a98a9]">{selected.kind}</p>
                    </div>
                    <button onClick={() => setSelectedId(null)} className="text-[#8391a3]" aria-label="Clear selection">
                      <X size={15} />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDetailsNode(selected)}>
                      <Eye size={13} className="mr-1.5" /> More info
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(selected)}>
                      <Settings2 size={13} className="mr-1.5" /> Configure
                    </Button>
                  </div>

                  {selected.kind === "Room Node" && (
                    <Button
                      size="sm"
                      className="mt-2 w-full bg-[#17365d] text-white hover:bg-[#102c4d]"
                      onClick={() => window.location.assign("/assets")}
                    >
                      <Box size={13} className="mr-1.5" /> Asset Management
                    </Button>
                  )}

                  {selected.kind === "Room Node" && selected.subtitle.toLowerCase().includes("office") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={() => toast.message("Administrative processes", { description: `${selected.label} office workflows` })}
                    >
                      <Users size={13} className="mr-1.5" /> Administrative processes
                    </Button>
                  )}

                  {selected.kind === "Kiosk Node" && (
                    <div className="mt-3 rounded-lg border border-[#dbe3ed] bg-[#f7f9fc] p-3 text-[10px] text-[#718398]">
                      <div className="flex items-center gap-2 font-semibold text-[#17365d]"><Server size={13} /> Hardware linkage</div>
                      <p className="mt-1">Assign or inspect the kiosk from Hardware Management.</p>
                    </div>
                  )}

                  {selected.kind === "Sensor" && (
                    <div className="mt-3 rounded-lg border border-[#dbe3ed] bg-[#f7f9fc] p-3 text-[10px] text-[#718398]">
                      <div className="flex items-center gap-2 font-semibold text-[#17365d]"><Wifi size={13} /> Sensor linkage</div>
                      <p className="mt-1">Sensor placement and hardware assignment are contextual to this node.</p>
                    </div>
                  )}

                  {selected.kind === "Auxiliary Node" && (
                    <div className="mt-3 rounded-lg border border-[#dbe3ed] bg-[#f7f9fc] p-3 text-[10px] text-[#718398]">
                      <div className="flex items-center gap-2 font-semibold text-[#17365d]"><Network size={13} /> Connection mode</div>
                      <select className="mt-2 h-8 w-full rounded border border-[#cbd8e6] bg-white px-2 text-xs text-[#17365d]">
                        <option>Bidirectional</option>
                        <option>Forward</option>
                        <option>Reverse</option>
                      </select>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </aside>
        </div>
      </Card>

      <AnimatePresence>
        {detailsNode && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-[#07182d99] p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDetailsNode(null)}
          >
            <motion.div
              className="w-full max-w-lg border border-[#17365d] bg-white p-6 text-[#17365d] shadow-2xl"
              initial={{ opacity: 0, y: 22, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8391a3]">Location Details</p>
                  <h2 className="mt-2 font-display text-2xl font-bold">{detailsNode.label}</h2>
                  <p className="mt-1 text-xs text-[#718398]">{detailsNode.subtitle}</p>
                </div>
                <button onClick={() => setDetailsNode(null)} aria-label="Close location details">
                  <X size={18} />
                </button>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#dbe3ed] bg-[#f7f9fc] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8391a3]">Node type</p>
                  <p className="mt-1 text-sm font-semibold">{detailsNode.kind}</p>
                </div>
                <div className="rounded-lg border border-[#dbe3ed] bg-[#f7f9fc] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8391a3]">Area</p>
                  <p className="mt-1 text-sm font-semibold">{selectedArea?.name}</p>
                </div>
              </div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.12em]">Location information</p>
              <p className="mt-2 text-xs leading-5 text-[#718398]">
                {String(detailsNode.metadata?.description ?? "Spatial annotation for FlowSense campus wayfinding.")}
              </p>
              <div className="mt-6 flex justify-end gap-2">
                {detailsNode.kind === "Room Node" && (
                  <Button variant="outline" onClick={() => window.location.assign("/assets")}>
                    Asset Management
                  </Button>
                )}
                <Button className="bg-[#17365d] text-white" onClick={() => openEdit(detailsNode)}>
                  <Edit3 size={14} className="mr-2" /> Edit
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editNode && (
          <motion.div
            className="fixed inset-0 z-[60] grid place-items-center bg-[#07182d99] p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-lg border border-[#17365d] bg-white p-6 text-[#17365d] shadow-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8391a3]">Contextual Configuration</p>
                  <h2 className="mt-2 font-display text-xl font-bold">Edit {editNode.kind}</h2>
                </div>
                <button onClick={() => { setEditNode(null); }} aria-label="Close editor">
                  <X size={18} />
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {editNode.kind === "Room Node" ? (
                  <>
                    <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#718398]">
                      Room Code
                      <Input value={draftCode} onChange={event => setDraftCode(event.target.value)} className="mt-2 h-11" />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#718398]">
                      Room Alias
                      <Input value={draftAlias} onChange={event => setDraftAlias(event.target.value)} className="mt-2 h-11" />
                    </label>
                  </>
                ) : (
                  <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#718398]">
                    Node Name
                    <Input value={draftName} onChange={event => setDraftName(event.target.value)} className="mt-2 h-11" />
                  </label>
                )}
                <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#718398]">
                  Description
                  <textarea value={draftDescription} onChange={event => setDraftDescription(event.target.value)} className="mt-2 min-h-28 w-full rounded-md border border-[#cbd8e6] p-3 text-sm outline-none" />
                </label>
              </div>

              <div className="mt-6 flex justify-between gap-2">
                <Button variant="outline" className="text-[#a45b5b]" onClick={() => setDeleteConfirm(editNode)}>
                  <Trash2 size={14} className="mr-2" /> Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setEditNode(null); }}>Cancel</Button>
                  <Button className="bg-[#17365d] text-white" onClick={saveNode}>
                    <Check size={14} className="mr-2" /> Save
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm && (
          <motion.div className="fixed inset-0 z-[70] grid place-items-center bg-[#07182d99] p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-sm border border-[#17365d] bg-white p-6 text-[#17365d] shadow-2xl" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a45b5b]">Delete annotation</p>
              <h2 className="mt-2 font-display text-xl font-bold">Delete {deleteConfirm.label}?</h2>
              <p className="mt-2 text-xs leading-5 text-[#718398]">
                This removes the node from the current workspace and requests deletion from the Annotation API. Connected edges are handled by the backend contract.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <Button className="bg-[#a45b5b] text-white hover:bg-[#8d4b4b]" onClick={() => deleteNode(deleteConfirm)}>
                  <Trash2 size={14} className="mr-2" /> Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createNodeOpen && (
          <motion.div className="fixed inset-0 z-[65] grid place-items-center bg-[#07182d99] p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-md border border-[#17365d] bg-white p-6 text-[#17365d] shadow-2xl" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b08412]">{tool}</p>
                  <h2 className="mt-2 font-display text-xl font-bold">Place a node</h2>
                  <p className="mt-2 text-xs text-[#8391a3]">The new node will be associated with {selectedArea?.name} and the selected floor.</p>
                </div>
                <button onClick={() => setCreateNodeOpen(false)} aria-label="Close node creator"><X size={18} /></button>
              </div>
              <div className="mt-6 rounded-lg border border-[#dbe3ed] bg-[#f7f9fc] p-4 text-xs">
                <div className="flex items-center gap-2 font-semibold"><DoorOpen size={14} /> Placement context</div>
                <p className="mt-2 text-[#718398]">{selectedArea?.name} · {visibleFloors.find(f => String(f.id) === String(floorId))?.glb_node_name ?? "Selected floor"}</p>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateNodeOpen(false)}>Cancel</Button>
                <Button className="bg-[#17365d] text-white" onClick={createNode}>Add node</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
