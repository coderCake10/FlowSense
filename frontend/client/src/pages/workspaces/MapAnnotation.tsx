/* Map Annotation: place the navigation graph on the real building model.
 * Room doors, corridor points and kiosks are nodes; connections are edges;
 * stairs and elevators link nodes on different floors. Every change saves
 * straight to the Annotation API, and the kiosk routes over the result. */
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpDown,
  Building2,
  CheckCircle2,
  Circle,
  DoorOpen,
  Footprints,
  Link2,
  Monitor,
  MousePointer2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/FlowSenseShell";
import {
  NativeSelect,
  QueryStatus,
  SectionLabel,
} from "@/components/AdminBits";
import { AnnotationCanvas } from "@/components/map/AnnotationCanvas";
import { buildings } from "@/data/buildings";
import type { Point3 } from "@/data/navigation";
import { isApiConfigured } from "@/lib/api";
import {
  NODE_COLORS,
  useAreaFloors,
  useAreaRooms,
  useBuildingAreas,
  useGraph,
  useGraphEdits,
  type GraphNode,
  type NodeType,
  type TransitionType,
} from "@/lib/annotationApi";
import { cn } from "@/lib/utils";

type Tool =
  | "select"
  | "room"
  | "corridor"
  | "kiosk"
  | "connect"
  | "link"
  | "delete";

const TOOLS: { id: Tool; label: string; icon: typeof Circle; help: string }[] =
  [
    {
      id: "select",
      label: "Select",
      icon: MousePointer2,
      help: "Click a point to see its connections.",
    },
    {
      id: "room",
      label: "Room door",
      icon: DoorOpen,
      help: "Pick a room on the right, then click the corridor side of its door.",
    },
    {
      id: "corridor",
      label: "Corridor point",
      icon: Footprints,
      help: "Click along the middle of the corridor, in walking order. Each point connects to the previous one; click an existing point to continue from it.",
    },
    {
      id: "kiosk",
      label: "Kiosk",
      icon: Monitor,
      help: "Click where the kiosk stands. Routes start here.",
    },
    {
      id: "connect",
      label: "Connect",
      icon: Link2,
      help: "Click two points to connect them.",
    },
    {
      id: "link",
      label: "Stairs / elevator",
      icon: ArrowUpDown,
      help: "Click the stairs point on this floor, switch floors, then click the matching point there.",
    },
    {
      id: "delete",
      label: "Delete",
      icon: Trash2,
      help: "Click a point to delete it and its connections.",
    },
  ];

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  room: "Room door",
  auxiliary: "Corridor point",
  kiosk: "Kiosk",
  sensor: "Sensor",
  area_entrance: "Entrance",
};

/** Nodes sit a little above the walking surface, like the kiosk's routes. */
const ABOVE_FLOOR = 0.09;

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#dbe3ed] bg-white p-4">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}

export function MapAnnotation() {
  const live = isApiConfigured();
  const areas = useBuildingAreas();
  const modelled = (areas.data ?? []).filter(area =>
    buildings.some(b => b.areaCode === area.code)
  );
  const [chosenArea, setChosenArea] = useState<number | null>(null);
  const area = modelled.find(a => a.id === chosenArea) ?? modelled[0] ?? null;
  const building = area
    ? buildings.find(b => b.areaCode === area.code)
    : undefined;
  const floors = [...(useAreaFloors(area?.id ?? null).data ?? [])].sort(
    (a, b) => a.floor_order - b.floor_order
  );
  const rooms = useAreaRooms(area?.id ?? null);
  const graph = useGraph(area?.id ?? null);
  const edits = useGraphEdits(area?.id ?? null);

  const [chosenFloor, setChosenFloor] = useState<number | null>(null);
  const floor = floors.find(f => f.id === chosenFloor) ?? floors[0] ?? null;
  const floorObject =
    floor?.glb_node_name ??
    building?.model.floors[(floor?.floor_order ?? 1) - 1]?.object;
  const modelFloor = building?.model.floors.find(f => f.object === floorObject);
  const elevation =
    floor?.elevation != null
      ? Number(floor.elevation)
      : (modelFloor?.elevation ?? 0);

  const [tool, setTool] = useState<Tool>("select");
  const [topDown, setTopDown] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [roomToPlace, setRoomToPlace] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [previousId, setPreviousId] = useState<number | null>(null);
  const [linkType, setLinkType] = useState<TransitionType>("stairs");
  const [roomFilter, setRoomFilter] = useState("");

  const nodes = useMemo(() => graph.data?.nodes ?? [], [graph.data]);
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const onFloor = nodes.filter(n => n.floor === floor?.id);
  const edgesOnFloor = (graph.data?.edges ?? []).flatMap(edge => {
    const a = byId.get(edge.from_node);
    const b = byId.get(edge.to_node);
    return a && b && a.floor === floor?.id && b.floor === floor?.id
      ? [{ id: edge.id, from: a.position, to: b.position }]
      : [];
  });
  const transitions = graph.data?.transitions ?? [];
  const linked = new Set(
    transitions
      .flatMap(t => [t.from_node, t.to_node])
      .filter((id): id is number => id !== null)
  );
  const floorRooms = (rooms.data ?? [])
    .filter(room => room.floor === floor?.id)
    .filter(room =>
      `${room.room_code} ${room.room_alias}`
        .toLowerCase()
        .includes(roomFilter.toLowerCase())
    );
  const selected = selectedId !== null ? (byId.get(selectedId) ?? null) : null;
  const busy = Object.values(edits).some(edit => edit.isPending);

  const chooseTool = (next: Tool) => {
    setTool(next);
    setPendingId(null);
    if (next !== "corridor" && next !== "kiosk" && next !== "room")
      setPreviousId(null);
    if (next !== "room") setRoomToPlace(null);
  };
  const place = async (
    type: NodeType,
    position: Point3,
    name: string,
    room?: number
  ) => {
    if (!floor) return;
    const created = (await edits.addNode.mutateAsync({
      floor: floor.id,
      room: room ?? null,
      name,
      node_type: type,
      position: [position[0], elevation + ABOVE_FLOOR, position[2]],
      // Corridor points chain on the server (the Auxiliary Node Tool's
      // "place order" mode); doors and kiosks are connected right after.
      previousNodeId: type === "auxiliary" ? previousId : null,
    })) as { id: number };
    if (type !== "auxiliary" && previousId) {
      await edits.connect.mutateAsync({ from: previousId, to: created.id });
    }
    setPreviousId(created.id);
    setSelectedId(created.id);
  };

  const onFloorClick = (point: Point3) => {
    if (busy) return;
    if (tool === "corridor") {
      const count = nodes.filter(n => n.node_type === "auxiliary").length + 1;
      void place(
        "auxiliary",
        point,
        `Corridor ${modelFloor?.label ?? ""} ${count}`.trim()
      );
    } else if (tool === "kiosk") {
      void place("kiosk", point, "Kiosk");
    } else if (tool === "room" && roomToPlace !== null) {
      const room = rooms.data?.find(r => r.id === roomToPlace);
      if (room) void place("room", point, `${room.room_code} door`, room.id);
      setRoomToPlace(null);
    } else {
      setSelectedId(null);
    }
  };

  const onNodeClick = (node: GraphNode) => {
    if (busy) return;
    if (tool === "delete") {
      edits.removeNode.mutate(node.id);
      if (selectedId === node.id) setSelectedId(null);
      if (previousId === node.id) setPreviousId(null);
      return;
    }
    if (tool === "corridor" || tool === "kiosk" || tool === "room") {
      // Continue the chain from an existing point (and join it up).
      if (previousId && previousId !== node.id)
        edits.connect.mutate({ from: previousId, to: node.id });
      setPreviousId(node.id);
      setSelectedId(node.id);
      return;
    }
    if (tool === "connect") {
      if (pendingId === null || pendingId === node.id) {
        setPendingId(node.id);
      } else {
        edits.connect.mutate({ from: pendingId, to: node.id });
        setPendingId(node.id);
      }
      return;
    }
    if (tool === "link") {
      const first = pendingId !== null ? byId.get(pendingId) : undefined;
      if (!first || first.id === node.id) {
        setPendingId(node.id);
      } else if (first.floor === node.floor) {
        setPendingId(node.id);
      } else {
        edits.linkFloors.mutate({
          from: first.id,
          to: node.id,
          type: linkType,
        });
        setPendingId(null);
      }
      return;
    }
    setSelectedId(node.id);
  };

  const help = TOOLS.find(t => t.id === tool)!.help;
  const pendingNode = pendingId !== null ? byId.get(pendingId) : undefined;
  const floorOf = (id: number | null) =>
    floors.find(f => f.id === (id !== null ? byId.get(id)?.floor : undefined));

  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Map annotation"
        title="Map Annotation"
        description="Place room doors, corridor points, kiosks and stairs on the building model. The kiosk finds its routes over these points; every change saves straight away."
        action={
          <span className="rounded-full border border-[#dbe3ed] bg-white px-3 py-1.5 text-xs font-semibold text-[#52657a]">
            {busy ? "Saving…" : "All changes saved"}
          </span>
        }
      />
      {!live ? (
        <p className="rounded-xl border border-[#dbe3ed] bg-white p-6 text-sm text-[#52657a]">
          Map Annotation needs the FlowSense server. Set VITE_API_BASE_URL and
          sign in.
        </p>
      ) : (
        <>
          <QueryStatus
            isLoading={areas.isLoading}
            error={areas.error}
            onRetry={() => areas.refetch()}
            what="buildings"
          />
          {areas.isLoading || areas.error ? null : !area || !building ? (
            <p className="rounded-xl border border-[#dbe3ed] bg-white p-6 text-sm text-[#52657a]">
              No building with a 3D model yet. Run <code>seed_campus</code> and
              add the model (docs/setup/building-models.md).
            </p>
          ) : (
            <div className="rounded-2xl border border-[#dbe3ed] bg-white">
              <div className="flex flex-wrap items-center gap-3 border-b border-[#dbe3ed] p-4 text-xs">
                <label className="flex items-center gap-2 font-semibold text-[#52657a]">
                  <Building2 size={14} /> Building
                  <NativeSelect
                    aria-label="Building"
                    value={area.id}
                    onChange={e => {
                      setChosenArea(Number(e.target.value));
                      setChosenFloor(null);
                      setSelectedId(null);
                      setPreviousId(null);
                    }}
                  >
                    {modelled.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <div role="group" aria-label="Floor" className="flex gap-1">
                  {floors.map(f => {
                    const label =
                      building.model.floors.find(
                        m => m.object === f.glb_node_name
                      )?.label ?? `${f.floor_order}F`;
                    return (
                      <button
                        key={f.id}
                        aria-pressed={f.id === floor?.id}
                        onClick={() => {
                          setChosenFloor(f.id);
                          setSelectedId(null);
                          setPreviousId(null);
                          if (tool !== "link") setPendingId(null);
                        }}
                        className={cn(
                          "rounded-md border border-[#dbe3ed] px-2.5 py-1.5 font-bold text-[#17365d]",
                          f.id === floor?.id &&
                            "border-[#17365d] bg-[#17365d] text-white"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div role="group" aria-label="View" className="flex gap-1">
                  {[
                    [true, "Top down"],
                    [false, "Isometric"],
                  ].map(([value, label]) => (
                    <button
                      key={String(label)}
                      aria-pressed={topDown === value}
                      onClick={() => setTopDown(value as boolean)}
                      className={cn(
                        "rounded-md border border-[#dbe3ed] px-2.5 py-1.5 font-semibold text-[#17365d]",
                        topDown === value &&
                          "border-[#17365d] bg-[#17365d] text-white"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResetKey(k => k + 1)}
                >
                  <RotateCcw size={14} className="mr-1" /> Reset view
                </Button>
              </div>
              {/* Fixed height: panels scroll on their own, so the map never resizes
                  (and re-frames) while someone is annotating. */}
              <div className="grid grid-cols-1 lg:h-[680px] lg:grid-cols-[200px_minmax(0,1fr)_300px]">
                <aside className="space-y-1 border-b border-[#dbe3ed] p-3 lg:overflow-y-auto lg:border-b-0 lg:border-r">
                  <SectionLabel>Tools</SectionLabel>
                  {TOOLS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      aria-pressed={tool === id}
                      onClick={() => chooseTool(id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#17365d] hover:bg-[#f3f6fa]",
                        tool === id && "bg-[#fdf3d0]"
                      )}
                    >
                      <Icon size={15} /> {label}
                    </button>
                  ))}
                  {tool === "link" && (
                    <NativeSelect
                      aria-label="Link type"
                      value={linkType}
                      onChange={e =>
                        setLinkType(e.target.value as TransitionType)
                      }
                    >
                      <option value="stairs">Stairs</option>
                      <option value="elevator">Elevator</option>
                    </NativeSelect>
                  )}
                  {(tool === "corridor" ||
                    tool === "kiosk" ||
                    tool === "room") &&
                    previousId && (
                      <button
                        onClick={() => setPreviousId(null)}
                        className="mt-2 w-full rounded-lg border border-[#dbe3ed] px-3 py-2 text-xs text-[#52657a]"
                      >
                        Start a new line
                      </button>
                    )}
                  <div className="mt-4 space-y-1.5 border-t border-[#dbe3ed] pt-3 text-[11px] text-[#52657a]">
                    {(Object.keys(NODE_TYPE_LABELS) as NodeType[])
                      .filter(
                        type => type !== "sensor" && type !== "area_entrance"
                      )
                      .map(type => (
                        <p key={type} className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ background: NODE_COLORS[type] }}
                          />
                          {NODE_TYPE_LABELS[type]}
                        </p>
                      ))}
                    <p className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full border-2 border-[#7c3aed]" />
                      Linked to another floor
                    </p>
                  </div>
                </aside>
                <div className="relative h-[520px] lg:h-full">
                  {floorObject && (
                    <AnnotationCanvas
                      building={building}
                      floor={floorObject}
                      elevation={elevation}
                      topDown={topDown}
                      nodes={onFloor}
                      edges={edgesOnFloor}
                      linked={linked}
                      selectedId={selectedId}
                      pendingId={pendingId}
                      onFloorClick={onFloorClick}
                      onNodeClick={onNodeClick}
                      resetKey={resetKey}
                    />
                  )}
                  <p
                    role="status"
                    className="absolute bottom-3 left-3 right-3 rounded-lg bg-white/95 px-3 py-2 text-xs text-[#52657a] shadow"
                  >
                    {tool === "room" && roomToPlace !== null
                      ? `Click the corridor side of ${rooms.data?.find(r => r.id === roomToPlace)?.room_code}'s door.`
                      : tool === "link" && pendingNode
                        ? `Linking from ${pendingNode.name} (${building.model.floors.find(m => m.object === floorOf(pendingNode.id)?.glb_node_name)?.label ?? ""}). Switch floors and click the matching point.`
                        : help}
                  </p>
                </div>
                <aside className="space-y-4 border-t border-[#dbe3ed] p-3 lg:overflow-y-auto lg:border-l lg:border-t-0">
                  <Panel title={`Rooms on this floor (${floorRooms.length})`}>
                    <input
                      aria-label="Filter rooms"
                      value={roomFilter}
                      onChange={e => setRoomFilter(e.target.value)}
                      placeholder="Filter by code or name"
                      className="mb-2 h-8 w-full rounded-md border border-[#dbe3ed] px-2 text-xs"
                    />
                    <ul className="max-h-72 space-y-1 overflow-y-auto">
                      {floorRooms.map(room => {
                        const placed = room.node_id !== null;
                        return (
                          <li key={room.id}>
                            <button
                              aria-label={`${room.room_code} ${placed ? "placed" : "not placed"}`}
                              onClick={() => {
                                if (placed) {
                                  chooseTool("select");
                                  setSelectedId(room.node_id);
                                } else {
                                  setTool("room");
                                  setPendingId(null);
                                  setRoomToPlace(room.id);
                                }
                              }}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[#f3f6fa]",
                                roomToPlace === room.id && "bg-[#fdf3d0]"
                              )}
                            >
                              {placed ? (
                                <CheckCircle2
                                  size={14}
                                  className="shrink-0 text-[#168051]"
                                />
                              ) : (
                                <Circle
                                  size={14}
                                  className="shrink-0 text-[#a3b0bf]"
                                />
                              )}
                              <span className="font-bold text-[#17365d]">
                                {room.room_code}
                              </span>
                              <span className="truncate text-[#718398]">
                                {room.room_alias}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </Panel>
                  <Panel title="Selected point">
                    {selected ? (
                      <div className="space-y-2 text-xs text-[#52657a]">
                        <p className="font-bold text-[#17365d]">
                          {selected.name}
                        </p>
                        <p>{NODE_TYPE_LABELS[selected.node_type]}</p>
                        <p>
                          Connected to:{" "}
                          {(graph.data?.edges ?? [])
                            .filter(
                              e =>
                                e.from_node === selected.id ||
                                e.to_node === selected.id
                            )
                            .map(
                              e =>
                                byId.get(
                                  e.from_node === selected.id
                                    ? e.to_node
                                    : e.from_node
                                )?.name
                            )
                            .join(", ") || "nothing yet"}
                        </p>
                        {transitions
                          .filter(
                            t =>
                              t.from_node === selected.id ||
                              t.to_node === selected.id
                          )
                          .map(t => {
                            const other =
                              t.from_node === selected.id
                                ? t.to_node
                                : t.from_node;
                            return (
                              <p
                                key={t.id}
                                className="flex items-center justify-between gap-2"
                              >
                                <span>
                                  {t.transition_type === "elevator"
                                    ? "Elevator"
                                    : "Stairs"}{" "}
                                  to{" "}
                                  {other !== null ? byId.get(other)?.name : "?"}
                                </span>
                                <button
                                  className="underline"
                                  onClick={() =>
                                    edits.unlinkFloors.mutate(t.id)
                                  }
                                >
                                  Remove
                                </button>
                              </p>
                            );
                          })}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[#b42318]"
                          onClick={() => {
                            edits.removeNode.mutate(selected.id);
                            setSelectedId(null);
                          }}
                        >
                          <Trash2 size={14} className="mr-1" /> Delete point
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-[#718398]">
                        Nothing selected.
                      </p>
                    )}
                  </Panel>
                  <Panel title="This building">
                    <dl className="space-y-1 text-xs text-[#52657a]">
                      {[
                        ["Points", nodes.length],
                        ["Connections", graph.data?.edges.length ?? 0],
                        ["Floor links", transitions.length],
                        [
                          "Rooms placed",
                          `${(rooms.data ?? []).filter(r => r.node_id !== null).length} of ${rooms.data?.length ?? 0}`,
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={String(label)}
                          className="flex justify-between"
                        >
                          <dt>{label}</dt>
                          <dd className="font-semibold text-[#17365d]">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </Panel>
                </aside>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
