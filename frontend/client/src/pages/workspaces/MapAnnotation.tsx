/* Civic Signal: operational workspace pages use AUF navy, signal gold, breathable tables, dynamic context panels, and restrained motion. */
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Box,
  Building2,
  Check,
  ChevronRight,
  CircleHelp,
  CloudUpload,
  Cpu,
  Eye,
  FileCheck2,
  Filter,
  Gauge,
  Layers3,
  MapPin,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Signal,
  Trash2,
  Upload,
  Users,
  Wifi,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  PageHeader,
  StatusPill,
  MetricCard,
} from "@/components/FlowSenseShell";
import {
  Device,
  DeviceStatus,
  apiClient,
  endpointMap,
  isApiConfigured,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Canvas } from "@react-three/fiber";

const devices: Device[] = [
  {
    id: "dev-001",
    name: "SensorNode-1",
    type: "Sensor",
    location: "EYA Building · 1F",
    status: "Unregistered",
    lastPing: "Awaiting registration",
    mac: "84:CC:A8:41:2F:11",
  },
  {
    id: "dev-002",
    name: "Main Entrance Kiosk",
    type: "Kiosk",
    location: "EYA Building · Main Entrance",
    status: "Online",
    lastPing: "10:29 AM",
    mac: "84:CC:A8:41:2F:12",
  },
  {
    id: "dev-003",
    name: "EYA Kiosk-1",
    type: "Kiosk",
    location: "EYA Building · 1F",
    status: "Online",
    lastPing: "10:29 AM",
    mac: "84:CC:A8:41:2F:13",
  },
  {
    id: "dev-004",
    name: "Sensor-2",
    type: "Sensor",
    location: "EYA Building · 2F",
    status: "Online",
    lastPing: "10:29 AM",
    mac: "84:CC:A8:41:2F:14",
  },
  {
    id: "dev-005",
    name: "Sensor-3",
    type: "Sensor",
    location: "EYA Building · 3F",
    status: "Offline",
    lastPing: "01:29 AM yesterday",
    mac: "84:CC:A8:41:2F:15",
  },
  {
    id: "dev-006",
    name: "Sensor-4",
    type: "Sensor",
    location: "EYA Building · 1F",
    status: "Disabled",
    lastPing: "1 week ago",
    mac: "84:CC:A8:41:2F:16",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8493a5]">
      {children}
    </p>
  );
}
function MiniBar({
  values,
  gold = false,
}: {
  values: number[];
  gold?: boolean;
}) {
  return (
    <div className="flex h-28 items-end gap-2">
      {values.map((value, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-md bg-[#e8eef5]"
          style={{ height: `${Math.max(value, 8)}%` }}
        >
          <div
            className={cn(
              "h-full rounded-t-md",
              gold ? "bg-[#f4c542]" : "bg-[#345a87]"
            )}
            style={{ opacity: 0.65 + (i / values.length) * 0.35 }}
          />
        </div>
      ))}
    </div>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={1.6} />
      <directionalLight position={[3, 5, 2]} intensity={2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 6]} />
        <meshStandardMaterial color="#eef3f7" />
      </mesh>
      {[
        [0, 0, 0.3],
        [1.8, 0, 0.5],
        [-1.7, 0, -0.7],
        [0.4, 0, -1.1],
      ].map(([x, , z], i) => (
        <mesh key={i} position={[x as number, 0.18, z as number]}>
          <boxGeometry
            args={[i === 1 ? 2.5 : 1.7, 0.35, i === 2 ? 1.1 : 1.4]}
          />
          <meshStandardMaterial color={i === 1 ? "#17365d" : "#d8e3ee"} />
        </mesh>
      ))}
      <mesh position={[-1, 0.35, 0.1]}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial
          color="#f4c542"
          emissive="#f4c542"
          emissiveIntensity={0.25}
        />
      </mesh>
    </>
  );
}
function SpatialPreview({
  view,
  representation,
}: {
  view: string;
  representation: string;
}) {
  const preview = (
    <div
      className="relative h-[520px] w-full overflow-hidden bg-[#f7f9fc]"
      style={{
        backgroundImage: "radial-gradient(#d6dee8 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
    >
      <div className="absolute left-5 top-5 z-10 flex overflow-hidden rounded-lg border border-[#dbe3ed] bg-white shadow-sm">
        <button
          onClick={() =>
            toast.message("Camera view", { description: "Top Down selected" })
          }
          className={cn(
            "px-3 py-2 text-[10px] font-bold",
            view === "Top Down" ? "bg-[#17365d] text-white" : "text-[#718398]"
          )}
        >
          Top Down
        </button>
        <button
          onClick={() =>
            toast.message("Camera view", { description: "Isometric selected" })
          }
          className={cn(
            "px-3 py-2 text-[10px] font-bold",
            view === "Isometric" ? "bg-[#17365d] text-white" : "text-[#718398]"
          )}
        >
          Isometric
        </button>
      </div>
      <div className="absolute inset-0 grid place-items-center p-10">
        <div className="relative h-[72%] w-[72%] max-w-[680px] min-w-[360px]">
          <div className="absolute left-[34%] top-[5%] h-[30%] w-[30%] border-2 border-[#718398] bg-white/90 p-5 text-center font-display font-bold text-[#17365d]">
            EYA<div className="absolute left-5 top-8 text-[10px]">⌖ EA-201</div>
            <div className="absolute right-5 bottom-8 text-[10px]">
              ⌖ EA-101
            </div>
          </div>
          <div className="absolute left-[18%] bottom-[14%] h-[28%] w-[28%] border-2 border-[#718398] bg-white/90 p-5 text-center font-display font-bold text-[#17365d]">
            MAIN
            <div className="absolute left-5 bottom-6 text-[10px]">⌖ A-101</div>
          </div>
          <div className="absolute right-[14%] bottom-[17%] h-[25%] w-[25%] border-2 border-[#718398] bg-white/90 p-5 text-center font-display font-bold text-[#17365d]">
            PS
            <div className="absolute left-5 bottom-6 text-[10px]">⌖ PS-101</div>
          </div>
          <div className="absolute left-[38%] top-[47%] h-1 w-[30%] rotate-[-22deg] rounded-full bg-[#f4c542] shadow-[0_0_0_3px_rgba(244,197,66,.2)]" />
          <div className="absolute left-1/2 bottom-[4%] -translate-x-1/2 text-xs font-bold text-[#17365d]">
            ⌖ YOU ARE HERE
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/40 to-transparent" />
      <div className="absolute bottom-5 left-5 rounded-lg border border-white/80 bg-white/90 px-3 py-2 text-[10px] font-semibold text-[#53677d] shadow-sm">
        Annotation workspace · bounded preview · {representation}
      </div>
    </div>
  );
  if (representation !== "3D View") return preview;
  return (
    <div className="h-[520px] w-full overflow-hidden bg-[#f7f9fc]">
      <Canvas
        frameloop="demand"
        dpr={[1, 1]}
        gl={{
          antialias: false,
          powerPreference: "low-power",
          preserveDrawingBuffer: false,
        }}
        camera={{ position: [5, 4, 6], fov: 45 }}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[4, 8, 5]} intensity={1.6} />
        <mesh position={[0, -0.35, 0]}>
          <boxGeometry args={[5.8, 0.25, 4.4]} />
          <meshStandardMaterial color="#dbe4ed" />
        </mesh>
        <mesh position={[-1.6, 0.08, 0.6]}>
          <boxGeometry args={[1.8, 0.7, 1.25]} />
          <meshStandardMaterial color="#17365d" />
        </mesh>
        <mesh position={[1.15, 0.05, 0.4]}>
          <boxGeometry args={[1.75, 0.55, 1.15]} />
          <meshStandardMaterial color="#d6dee8" />
        </mesh>
        <mesh position={[0.25, 0.02, -1.25]}>
          <boxGeometry args={[2.1, 0.4, 0.9]} />
          <meshStandardMaterial color="#c7d3df" />
        </mesh>
        <mesh position={[-0.15, 0.42, 0.18]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color="#f4c542" />
        </mesh>
      </Canvas>
    </div>
  );
}

const annotationNodes = [
  { id: "room-101", label: "EA-101", subtitle: "Room Node", kind: "Room Node" },
  { id: "room-102", label: "EA-102", subtitle: "Room Node", kind: "Room Node" },
  { id: "room-103", label: "EA-103", subtitle: "Room Node", kind: "Room Node" },
  { id: "room-104", label: "EA-104", subtitle: "Room Node", kind: "Room Node" },
  {
    id: "kiosk-1",
    label: "Main Entrance Kiosk",
    subtitle: "Kiosk Node",
    kind: "Kiosk Node",
  },
  { id: "sensor-1", label: "Sensor-1", subtitle: "Sensor", kind: "Sensor" },
  { id: "sensor-2", label: "Sensor-2", subtitle: "Sensor", kind: "Sensor" },
];

export function MapAnnotation() {
  const [tool, setTool] = useState("Select");
  const [camera, setCamera] = useState("Top Down");
  const [representation, setRepresentation] = useState("2D View");
  const [selected, setSelected] = useState(annotationNodes[0]);
  const [editNode, setEditNode] = useState<
    (typeof annotationNodes)[number] | null
  >(null);
  const [focus, setFocus] = useState(false);
  const [saved, setSaved] = useState(true);
  const [building, setBuilding] = useState("EYA Building");
  const [floor, setFloor] = useState("1st Floor");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftCode, setDraftCode] = useState("");
  const [draftAlias, setDraftAlias] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftHardware, setDraftHardware] = useState("");
  const [createNodeOpen, setCreateNodeOpen] = useState(false);
  const [newNodeName, setNewNodeName] = useState("");
  const tools = ["Select", "Location Node", "Auxiliary Node", "Edge", "Delete"];
  const showToolKit = !focus;
  const showNodeTree = !focus;
  function openEdit(node: (typeof annotationNodes)[number]) {
    setSelected(node);
    setDraftLabel(node.label);
    setDraftCode(node.kind === "Room Node" ? node.label : node.id);
    setDraftAlias(
      node.kind === "Room Node"
        ? node.label === "EA-101"
          ? "Guidance Counselling Center"
          : ""
        : node.label
    );
    setDraftDescription(
      node.kind === "Sensor"
        ? "Passive BLE detection sensor"
        : "Campus wayfinding location"
    );
    setDraftHardware(
      node.kind === "Sensor" ? "Sensor-1" : "Main Entrance Kiosk"
    );
    setEditNode(node);
  }
  function saveNode() {
    if (draftLabel.trim())
      setSelected({ ...selected, label: draftLabel.trim() });
    setEditNode(null);
    setSaved(false);
    toast.success("Node information updated");
  }
  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Map Annotation"
        title="Map Annotation"
        description="Place logical objects, connect routes, and validate the spatial structure that powers every destination search."
        action={
          <Button
            className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            onClick={() => {
              setSaved(true);
              toast.success("Map changes saved");
            }}
          >
            <Check size={15} className="mr-2" />
            Save changes
          </Button>
        }
      />
      <Card className="overflow-hidden border-[#dbe3ed]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#dbe3ed] bg-white p-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#718398]">
          <label>
            Area
            <select
              value={building}
              onChange={e => setBuilding(e.target.value)}
              className="ml-2 rounded-md border border-[#cbd8e6] bg-white px-2 py-2 text-[10px] normal-case tracking-normal text-[#17365d]"
            >
              <option>EYA Building</option>
              <option>PS Building</option>
            </select>
          </label>
          <label>
            Level
            <select
              value={floor}
              onChange={e => setFloor(e.target.value)}
              className="ml-2 rounded-md border border-[#cbd8e6] bg-white px-2 py-2 text-[10px] normal-case tracking-normal text-[#17365d]"
            >
              <option>1st Floor</option>
              <option>2nd Floor</option>
              <option>Ground Floor</option>
            </select>
          </label>
          <label>
            Camera View
            <select
              value={camera}
              onChange={e => setCamera(e.target.value)}
              className="ml-2 rounded-md border border-[#cbd8e6] bg-white px-2 py-2 text-[10px] normal-case tracking-normal text-[#17365d]"
            >
              <option>Top Down</option>
              <option>Isometric</option>
            </select>
          </label>
          <label>
            Representation View
            <select
              value={representation}
              onChange={e => setRepresentation(e.target.value)}
              className="ml-2 rounded-md border border-[#cbd8e6] bg-white px-2 py-2 text-[10px] normal-case tracking-normal text-[#17365d]"
            >
              <option>2D View</option>
              <option>3D View</option>
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                toast.message("Undo", {
                  description: "Last annotation change reverted",
                })
              }
            >
              <span className="mr-1">↶</span>Undo
            </Button>
            <Badge
              className={
                saved
                  ? "border-[#d5e9dd] bg-[#effaf3] text-[#168051]"
                  : "border-[#f2ddb0] bg-[#fff8df] text-[#946c00]"
              }
            >
              {saved ? "Saved" : "Unsaved"}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.assign("/assets")}
            >
              Asset Management
            </Button>
          </div>
        </div>
        <div
          className={cn(
            "grid min-h-[590px]",
            focus ? "grid-cols-1" : "lg:grid-cols-[180px_minmax(0,1fr)_260px]"
          )}
        >
          {showToolKit && (
            <aside className="border-r border-[#dbe3ed] bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#718398]">
                  Tool Kit
                </p>
                <button
                  aria-label="collapse toolkit"
                  onClick={() => setFocus(true)}
                  className="text-[#8b9aab]"
                >
                  ⌘
                </button>
              </div>
              <div className="space-y-1">
                {tools.map(item => (
                  <button
                    key={item}
                    onClick={() => {
                      if (item === "Location Node") {
                        setTool(item);
                        setCreateNodeOpen(true);
                      } else {
                        setTool(item);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-semibold",
                      tool === item
                        ? "bg-[#fff3bd] text-[#17365d]"
                        : "text-[#718398] hover:bg-[#f7f9fc]"
                    )}
                  >
                    {item === "Delete" ? (
                      <Trash2 size={14} />
                    ) : item === "Edge" ? (
                      <Network size={14} />
                    ) : item === "Select" ? (
                      <MapPin size={14} />
                    ) : (
                      <Plus size={14} />
                    )}
                    <span>{item}</span>
                  </button>
                ))}
              </div>
              {tool === "Auxiliary Node" && (
                <div className="mt-5 border-t border-[#dbe3ed] pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#718398]">
                    Auxiliary Node
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-[#8391a3]">
                    A non destination anchor used to hold wayfinding
                    connections.
                  </p>
                  <label className="mt-3 block text-[10px] font-bold text-[#53677d]">
                    Connection mode
                    <select className="mt-1 h-8 w-full rounded border border-[#cbd8e6] bg-white px-2 text-xs">
                      <option>Room Node</option>
                      <option>Kiosk Node</option>
                    </select>
                  </label>
                  <label className="mt-3 block text-[10px] font-bold text-[#53677d]">
                    Direction
                    <select className="mt-1 h-8 w-full rounded border border-[#cbd8e6] bg-white px-2 text-xs">
                      <option>Room Node</option>
                      <option>Sensor Node</option>
                    </select>
                  </label>
                </div>
              )}
            </aside>
          )}
          <section className="relative min-w-0 border-r border-[#dbe3ed] bg-[#f7f9fc]">
            <div className="border-b border-[#e8edf3] bg-white px-4 py-3 text-xs text-[#718398]">
              Annotation Workspace <span className="mx-2">›</span>
              <strong className="text-[#17365d]">
                {building} · {floor}
              </strong>
            </div>
            <SpatialPreview view={camera} representation={representation} />
            <button
              onClick={() => setFocus(!focus)}
              className="absolute right-4 top-3 rounded-md border border-[#dbe3ed] bg-white px-3 py-2 text-xs font-bold text-[#17365d]"
            >
              {focus ? "Show panels" : "Focus canvas"}
            </button>
          </section>
          {showNodeTree && (
            <aside className="bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#718398]">
                  Node Tree
                </p>
                <button
                  onClick={() => setFocus(true)}
                  className="text-[#8b9aab]"
                  aria-label="collapse node tree"
                >
                  ⌘
                </button>
              </div>
              <div className="mt-3 space-y-1">
                <p className="border-b border-[#edf1f5] pb-2 text-[10px] font-bold text-[#718398]">
                  ⌄ Rooms
                </p>
                {annotationNodes.slice(0, 4).map(node => (
                  <div
                    key={node.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-2",
                      selected.id === node.id && "bg-[#fff8df]"
                    )}
                  >
                    <button
                      onClick={() => setSelected(node)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-xs font-semibold text-[#17365d]">
                        {node.label}
                      </p>
                      <p className="text-[10px] text-[#8a98a9]">
                        {node.subtitle}
                      </p>
                    </button>
                    <button
                      onClick={() => openEdit(node)}
                      aria-label={`edit ${node.label}`}
                      className="text-[#b08412] hover:text-[#17365d]"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                ))}
                <p className="border-b border-[#edf1f5] pb-2 pt-3 text-[10px] font-bold text-[#718398]">
                  ⌄ Kiosk
                </p>
                {annotationNodes.slice(4, 5).map(node => (
                  <div
                    key={node.id}
                    className="flex items-center gap-2 rounded-md px-2 py-2"
                  >
                    <button
                      onClick={() => setSelected(node)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-xs font-semibold text-[#17365d]">
                        {node.label}
                      </p>
                      <p className="text-[10px] text-[#8a98a9]">
                        {node.subtitle}
                      </p>
                    </button>
                    <button
                      onClick={() => openEdit(node)}
                      className="text-[#b08412]"
                      aria-label="edit kiosk"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                ))}
                <p className="border-b border-[#edf1f5] pb-2 pt-3 text-[10px] font-bold text-[#718398]">
                  ⌄ Sensors
                </p>
                {annotationNodes.slice(5).map(node => (
                  <div
                    key={node.id}
                    className="flex items-center gap-2 rounded-md px-2 py-2"
                  >
                    <button
                      onClick={() => setSelected(node)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-xs font-semibold text-[#17365d]">
                        {node.label}
                      </p>
                      <p className="text-[10px] text-[#8a98a9]">
                        {node.subtitle}
                      </p>
                    </button>
                    <button
                      onClick={() => openEdit(node)}
                      className="text-[#b08412]"
                      aria-label={`edit ${node.label}`}
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-[#dbe3ed] pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#718398]">
                  Selected Node
                </p>
                <p className="mt-2 text-sm font-bold text-[#17365d]">
                  {selected.label}
                </p>
                <p className="text-[10px] text-[#8a98a9]">
                  {selected.kind} · {selected.id}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toast.message("Node focused", {
                        description: selected.label,
                      })
                    }
                  >
                    Focus
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(selected)}
                  >
                    Inspect
                  </Button>
                </div>
              </div>
            </aside>
          )}
        </div>
      </Card>
      {editNode && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#07182d99] p-5">
          <div className="w-full max-w-lg border border-[#17365d] bg-white p-6 text-[#17365d] shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8391a3]">
                  {editNode.kind} · {editNode.label}
                </p>
                <h2 className="mt-2 font-display text-xl font-bold">
                  Edit {editNode.kind} Information
                </h2>
                <p className="mt-2 text-xs text-[#8391a3]">
                  Update the destination details shown to users in the kiosk and
                  mobile handoff.
                </p>
              </div>
              <button onClick={() => setEditNode(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              {editNode.kind === "Room Node" ? (
                <>
                  <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#718398]">
                    Room Code
                    <Input
                      value={draftCode}
                      onChange={e => setDraftCode(e.target.value)}
                      className="mt-2 h-11 border-[#718398] text-sm normal-case tracking-normal"
                    />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#718398]">
                    Room Alias{" "}
                    <span className="font-normal normal-case tracking-normal">
                      (optional)
                    </span>
                    <Input
                      value={draftAlias}
                      onChange={e => setDraftAlias(e.target.value)}
                      placeholder="Leave blank for numbered rooms"
                      className="mt-2 h-11 border-[#718398] text-sm normal-case tracking-normal"
                    />
                  </label>
                </>
              ) : (
                <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#718398]">
                  {editNode.kind === "Sensor" ? "Sensor Name" : "Kiosk Name"}
                  <Input
                    value={draftLabel}
                    onChange={e => setDraftLabel(e.target.value)}
                    className="mt-2 h-11 border-[#718398] text-sm normal-case tracking-normal"
                  />
                </label>
              )}
              {(editNode.kind === "Sensor" ||
                editNode.kind === "Kiosk Node") && (
                <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#718398]">
                  Registered Hardware
                  <select
                    value={draftHardware}
                    onChange={e => setDraftHardware(e.target.value)}
                    className="mt-2 h-11 w-full border border-[#718398] bg-white px-3 text-sm normal-case tracking-normal"
                  >
                    <option>Main Entrance Kiosk</option>
                    <option>Sensor-1</option>
                    <option>Sensor-2</option>
                    <option>Unassigned</option>
                  </select>
                </label>
              )}
              <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#718398]">
                Description
                <textarea
                  value={draftDescription}
                  onChange={e => setDraftDescription(e.target.value)}
                  className="mt-2 min-h-24 w-full border border-[#718398] p-3 text-sm normal-case tracking-normal outline-none"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditNode(null)}>
                Cancel
              </Button>
              <Button
                className="bg-[#17365d] text-white hover:bg-[#102c4d]"
                onClick={saveNode}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
      {createNodeOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#07182d99] p-5">
          <div className="w-full max-w-md border border-[#17365d] bg-white p-6 text-[#17365d] shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b08412]">
                  Annotation workspace
                </p>
                <h2 className="mt-2 font-display text-xl font-bold">
                  Add Location Node
                </h2>
                <p className="mt-2 text-xs text-[#8391a3]">
                  Place a new destination node on the selected floor.
                </p>
              </div>
              <button onClick={() => setCreateNodeOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <label className="mt-6 block text-xs font-bold uppercase tracking-[0.12em] text-[#718398]">
              Room or location name
              <Input
                value={newNodeName}
                onChange={e => setNewNodeName(e.target.value)}
                placeholder="e.g. Faculty Office"
                className="mt-2 h-11 border-[#718398] text-sm normal-case tracking-normal"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCreateNodeOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#17365d] text-white hover:bg-[#102c4d]"
                onClick={() => {
                  setCreateNodeOpen(false);
                  setSaved(false);
                  toast.success(
                    newNodeName.trim()
                      ? `Location node “${newNodeName.trim()}” added`
                      : "Location node draft created"
                  );
                  setNewNodeName("");
                }}
              >
                Add node
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
