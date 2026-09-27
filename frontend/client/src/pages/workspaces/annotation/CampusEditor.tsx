/* Map Annotation's Campus view (step 14): the campus model with every
 * building on it. Here admins draw the walks between buildings (points on
 * the campus walkways, joined to the buildings' entrances), place and name
 * the campus view's labels, and put each building's model where it stands
 * (a building added from the admin panel, or one moved). Every change saves
 * straight away, like the building floors. */
import { useMemo, useState, type ReactNode } from "react";
import { Html } from "@react-three/drei";
import {
  Footprints,
  Link2,
  MapPin,
  Move,
  MousePointer2,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/AdminBits";
import { AnnotationCanvas } from "@/components/map/AnnotationCanvas";
import type {
  BuildingConfig,
  BuildingPlacement,
  CampusNeighbour,
  Point3,
} from "@/data/navigation";
import {
  NODE_COLORS,
  useAreaFloors,
  useCampusEdits,
  useCampusLabels,
  useGraph,
  useGraphEdits,
  type GraphNode,
} from "@/lib/annotationApi";
import { LABEL_Z_RANGE } from "@/lib/mapView";
import { cn } from "@/lib/utils";

type Tool = "select" | "walkway" | "connect" | "label" | "place" | "delete";

const TOOLS: { id: Tool; label: string; icon: typeof Tag; help: string }[] = [
  {
    id: "select",
    label: "Select",
    icon: MousePointer2,
    help: "Click a point to see its connections. Drag a point to move it.",
  },
  {
    id: "walkway",
    label: "Walkway point",
    icon: Footprints,
    help: "Click along the walk in order; each point connects to the previous one. Click a building's entrance or kiosk to join the walk to it.",
  },
  {
    id: "connect",
    label: "Connect",
    icon: Link2,
    help: "Click two points to connect them.",
  },
  {
    id: "label",
    label: "Label",
    icon: Tag,
    help: "Type the label's text on the right, then click where it goes.",
  },
  {
    id: "place",
    label: "Place a building",
    icon: Move,
    help: "Pick a building on the right, click where its model goes, turn it, and save. Its points move with it.",
  },
  {
    id: "delete",
    label: "Delete",
    icon: Trash2,
    help: "Click a walkway point, or a line, to delete it. Delete labels on the right.",
  },
];

/** Labels float this far above the spot clicked (m). */
const LABEL_LIFT = 8;
/** Points sit this far above the ground clicked (m), like the routes. */
const ABOVE_GROUND = 0.1;

const degrees = (radians: number) =>
  Math.round(((radians * 180) / Math.PI + 360) % 360);
const radians = (deg: number) => Number(((deg * Math.PI) / 180).toFixed(4));

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#dbe3ed] bg-white p-4">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}

export interface CampusBuildingArea {
  id: number;
  code: string;
  name: string;
}

export function CampusEditor({
  host,
  registry,
  areas,
  walkwaysAreaId,
  topDown,
  resetKey,
}: {
  /** The campus's host building (its model's coordinates are the campus's). */
  host: BuildingConfig;
  registry: readonly BuildingConfig[];
  /** Every building area, with or without a live model. */
  areas: CampusBuildingArea[];
  walkwaysAreaId: number | null;
  topDown: boolean;
  resetKey: number;
}) {
  const graph = useGraph(walkwaysAreaId);
  const edits = useGraphEdits(walkwaysAreaId);
  const walkwayFloor = useAreaFloors(walkwaysAreaId).data?.[0] ?? null;
  const labels = useCampusLabels();
  const campus = useCampusEdits();

  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [previousId, setPreviousId] = useState<number | null>(null);
  const [labelText, setLabelText] = useState("");
  const [movingLabel, setMovingLabel] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(
    null
  );
  /** A building being placed: saved only on Save. */
  const [draft, setDraft] = useState<{
    areaId: number;
    config: BuildingConfig;
    placement: BuildingPlacement | null;
  } | null>(null);

  const busy =
    Object.values(edits).some(edit => edit.isPending) ||
    Object.values(campus).some(edit => edit.isPending);

  const nodes = useMemo(() => graph.data?.nodes ?? [], [graph.data]);
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const edges = (graph.data?.edges ?? []).flatMap(edge => {
    const a = byId.get(edge.from_node);
    const b = byId.get(edge.to_node);
    return a && b ? [{ id: edge.id, from: a.position, to: b.position }] : [];
  });
  const walkwayNode = (node: GraphNode) => node.floor === walkwayFloor?.id;
  const selected = selectedId !== null ? byId.get(selectedId) : undefined;

  // The campus as it will look: the building being placed at its draft spot.
  const shownHost = useMemo((): BuildingConfig => {
    if (!host.campus) return host;
    // The editor draws the labels itself (they're editable here).
    if (!draft?.placement)
      return { ...host, campus: { ...host.campus, landmarks: [] } };
    const { position, rotationY } = draft.placement;
    const others = host.campus.neighbours.filter(
      item => item.areaCode !== draft.config.areaCode
    );
    const moved: CampusNeighbour = {
      name: draft.config.name,
      areaCode: draft.config.areaCode,
      modelUrl: draft.config.modelUrl,
      position,
      rotationY,
      labelAt: [position[0], position[1] + 18, position[2]],
    };
    return {
      ...host,
      campus: { ...host.campus, neighbours: [...others, moved] },
    };
  }, [host, draft]);

  const chooseTool = (next: Tool) => {
    setTool(next);
    setPendingId(null);
    if (next !== "walkway") setPreviousId(null);
    if (next !== "label") setMovingLabel(null);
  };

  const placeWalkwayPoint = async (point: Point3) => {
    if (!walkwayFloor) return;
    const count = nodes.filter(walkwayNode).length + 1;
    const created = (await edits.addNode.mutateAsync({
      floor: walkwayFloor.id,
      name: `Walkway ${count}`,
      node_type: "auxiliary",
      position: [point[0], point[1] + ABOVE_GROUND, point[2]],
      previousNodeId: previousId,
    })) as { id: number };
    setPreviousId(created.id);
    setSelectedId(created.id);
  };

  const onFloorClick = (point: Point3) => {
    if (busy) return;
    if (tool === "walkway") {
      void placeWalkwayPoint(point);
    } else if (tool === "label") {
      const at: Point3 = [point[0], point[1] + LABEL_LIFT, point[2]];
      if (movingLabel !== null) {
        campus.editLabel.mutate({ id: movingLabel, position: at });
        setMovingLabel(null);
      } else if (labelText.trim()) {
        campus.addLabel.mutate(
          { name: labelText.trim(), position: at },
          { onSuccess: () => setLabelText("") }
        );
      } else {
        toast.message("Type the label's text first (on the right).");
      }
    } else if (tool === "place" && draft) {
      setDraft({
        ...draft,
        placement: {
          position: [
            Number(point[0].toFixed(2)),
            Number(point[1].toFixed(2)),
            Number(point[2].toFixed(2)),
          ],
          rotationY: draft.placement?.rotationY ?? 0,
        },
      });
    } else {
      setSelectedId(null);
    }
  };

  const onNodeClick = (node: GraphNode) => {
    if (busy) return;
    if (tool === "delete") {
      if (!walkwayNode(node)) {
        toast.message(
          `${node.name} belongs to its building: delete it on that building's floor.`
        );
        return;
      }
      edits.removeNode.mutate(node.id);
      if (selectedId === node.id) setSelectedId(null);
      if (previousId === node.id) setPreviousId(null);
      return;
    }
    if (tool === "walkway") {
      if (previousId && previousId !== node.id)
        edits.connect.mutate({ from: previousId, to: node.id });
      setPreviousId(node.id);
      setSelectedId(node.id);
      return;
    }
    if (tool === "connect") {
      if (pendingId === null || pendingId === node.id) setPendingId(node.id);
      else {
        edits.connect.mutate({ from: pendingId, to: node.id });
        setPendingId(node.id);
      }
      return;
    }
    setSelectedId(node.id);
  };

  const startPlacing = (config: BuildingConfig, areaId: number) => {
    chooseTool("place");
    setDraft({ areaId, config, placement: config.placement ?? null });
  };
  const savePlacement = () => {
    if (!draft?.placement) return;
    campus.placeBuilding.mutate(
      { areaId: draft.areaId, placement: draft.placement },
      {
        onSuccess: () => {
          toast.success(
            `${draft.config.name} placed. Its points moved with it; the kiosk shows it there from its next load.`
          );
          setDraft(null);
        },
      }
    );
  };

  const help = TOOLS.find(t => t.id === tool)!.help;
  const others = registry.filter(item => item !== host);
  const waiting = areas.filter(
    area =>
      area.code !== host.areaCode &&
      !registry.some(item => item.areaCode === area.code)
  );

  return (
    <div className="grid grid-cols-1 lg:h-[680px] lg:grid-cols-[200px_minmax(0,1fr)_320px]">
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
        {tool === "walkway" && previousId && (
          <button
            onClick={() => setPreviousId(null)}
            className="mt-2 w-full rounded-lg border border-[#dbe3ed] px-3 py-2 text-xs text-[#52657a]"
          >
            Start a new line
          </button>
        )}
        <div className="mt-4 space-y-1.5 border-t border-[#dbe3ed] pt-3 text-[11px] text-[#52657a]">
          <p className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: NODE_COLORS.auxiliary }}
            />
            Walkway point
          </p>
          <p className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: NODE_COLORS.area_entrance }}
            />
            Building entrance
          </p>
          <p className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: NODE_COLORS.kiosk }}
            />
            Kiosk
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={11} className="text-[#b08412]" /> Label
          </p>
        </div>
      </aside>

      <div className="relative h-[520px] lg:h-full">
        <AnnotationCanvas
          building={shownHost}
          floor={host.kioskFloor}
          elevation={-5}
          campus
          topDown={topDown}
          nodes={nodes}
          edges={edges}
          linked={new Set()}
          selectedId={selectedId}
          pendingId={pendingId}
          onFloorClick={onFloorClick}
          onNodeClick={onNodeClick}
          onEdgeClick={
            tool === "delete" ? id => edits.disconnect.mutate(id) : undefined
          }
          dragEnabled={tool === "select"}
          onNodeMove={(node, point) =>
            edits.moveNode.mutate({
              id: node.id,
              position: [point[0], point[1] + ABOVE_GROUND, point[2]],
            })
          }
          resetKey={resetKey}
        >
          {(labels.data ?? []).map(label => (
            <Html
              key={label.id}
              position={label.position}
              center
              zIndexRange={LABEL_Z_RANGE}
              style={{ pointerEvents: "none" }}
            >
              <span
                className={cn(
                  "block whitespace-nowrap rounded-lg border bg-white px-2 py-0.5 text-[11px] font-bold text-[#7a5a00] shadow",
                  movingLabel === label.id && "border-[#f4c542] bg-[#fdf3d0]"
                )}
              >
                {label.name}
              </span>
            </Html>
          ))}
        </AnnotationCanvas>
        <p className="absolute bottom-3 left-3 right-3 rounded-lg bg-white/95 px-3 py-2 text-xs text-[#52657a] shadow">
          {tool === "place" && draft
            ? draft.placement
              ? `${draft.config.name}: click again to move it, turn it on the right, then Save.`
              : `Click where ${draft.config.name} stands (its model's centre).`
            : tool === "label" && movingLabel !== null
              ? "Click where the label goes."
              : help}
        </p>
      </div>

      <aside className="space-y-4 border-t border-[#dbe3ed] p-3 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <Panel title="Buildings on the campus">
          <ul className="space-y-2 text-xs">
            {others.map(config => {
              const area = areas.find(a => a.code === config.areaCode);
              const editing = draft?.config.areaCode === config.areaCode;
              return (
                <li
                  key={config.id}
                  className={cn(
                    "rounded-lg border border-[#dbe3ed] p-2",
                    editing && "border-[#17365d]"
                  )}
                >
                  <p className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#17365d]">
                      {config.name}
                    </span>
                    {!editing && area && (
                      <button
                        onClick={() => startPlacing(config, area.id)}
                        className="rounded-md border border-[#dbe3ed] px-2 py-1 font-semibold text-[#17365d]"
                      >
                        {config.placement ? "Move" : "Place"}
                      </button>
                    )}
                  </p>
                  <p className="text-[#718398]">
                    {config.placement
                      ? `At ${config.placement.position.map(v => v.toFixed(1)).join(", ")} · turned ${degrees(config.placement.rotationY)}°`
                      : "Not on the campus yet"}
                  </p>
                  {editing && (
                    <div className="mt-2 space-y-2">
                      {draft.placement ? (
                        <>
                          <label className="block">
                            <span className="text-[#52657a]">
                              Turn: {degrees(draft.placement.rotationY)}°
                            </span>
                            <input
                              aria-label="Turn (degrees)"
                              type="range"
                              min={0}
                              max={359}
                              value={degrees(draft.placement.rotationY)}
                              onChange={e =>
                                setDraft({
                                  ...draft,
                                  placement: {
                                    ...draft.placement!,
                                    rotationY: radians(Number(e.target.value)),
                                  },
                                })
                              }
                              className="w-full accent-[#17365d]"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-[#52657a]">
                            Ground height (m)
                            <Input
                              aria-label="Ground height (m)"
                              type="number"
                              step={0.1}
                              value={draft.placement.position[1]}
                              onChange={e =>
                                setDraft({
                                  ...draft,
                                  placement: {
                                    ...draft.placement!,
                                    position: [
                                      draft.placement!.position[0],
                                      Number(e.target.value),
                                      draft.placement!.position[2],
                                    ],
                                  },
                                })
                              }
                              className="h-7 w-24 text-xs"
                            />
                          </label>
                        </>
                      ) : (
                        <p className="text-[#52657a]">
                          Click on the map where it stands.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={!draft.placement || busy}
                          onClick={savePlacement}
                          className="bg-[#17365d] text-white"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDraft(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <p className="text-[11px] text-[#718398]">
                        Its route points move with it. Check the walk to its
                        entrance afterwards.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
            {waiting.map(area => (
              <li
                key={area.id}
                className="rounded-lg border border-dashed border-[#dbe3ed] p-2 text-[#718398]"
              >
                <span className="font-bold text-[#17365d]">{area.name}</span>
                <br />
                Upload its model in Asset Management and make it live, then
                place it here.
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Labels">
          <label className="block text-xs text-[#52657a]">
            New label
            <Input
              aria-label="New label"
              value={labelText}
              onChange={e => setLabelText(e.target.value)}
              placeholder="e.g. Chapel"
              className="mt-1 h-8 text-xs"
              onFocus={() => chooseTool("label")}
            />
          </label>
          <p className="mt-1 text-[11px] text-[#718398]">
            Then click on the map where it goes.
          </p>
          <ul className="mt-3 space-y-1.5 text-xs">
            {(labels.data ?? []).map(label => (
              <li key={label.id} className="flex items-center gap-1.5">
                {renaming?.id === label.id ? (
                  <Input
                    aria-label={`Rename ${label.name}`}
                    value={renaming.name}
                    autoFocus
                    onChange={e =>
                      setRenaming({ id: label.id, name: e.target.value })
                    }
                    onKeyDown={e => {
                      if (e.key === "Enter" && renaming.name.trim()) {
                        campus.editLabel.mutate({
                          id: label.id,
                          name: renaming.name.trim(),
                        });
                        setRenaming(null);
                      }
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className="h-7 flex-1 text-xs"
                  />
                ) : (
                  <button
                    onClick={() =>
                      setRenaming({ id: label.id, name: label.name })
                    }
                    title="Rename"
                    className="flex-1 truncate text-left font-semibold text-[#17365d]"
                  >
                    {label.name}
                  </button>
                )}
                <button
                  onClick={() => {
                    chooseTool("label");
                    setMovingLabel(label.id);
                  }}
                  className={cn(
                    "rounded-md border border-[#dbe3ed] px-2 py-0.5",
                    movingLabel === label.id && "bg-[#fdf3d0]"
                  )}
                >
                  Move
                </button>
                <button
                  aria-label={`Delete ${label.name}`}
                  onClick={() => campus.removeLabel.mutate(label.id)}
                  className="rounded-md border border-[#dbe3ed] p-1 text-[#b13a36]"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Selected point">
          {selected ? (
            <div className="space-y-1 text-xs text-[#52657a]">
              <p className="font-bold text-[#17365d]">{selected.name}</p>
              {(graph.data?.edges ?? [])
                .filter(
                  e => e.from_node === selected.id || e.to_node === selected.id
                )
                .map(e => (
                  <p
                    key={e.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>
                      {byId.get(
                        e.from_node === selected.id ? e.to_node : e.from_node
                      )?.name ?? "A point inside a building"}
                    </span>
                    <button
                      onClick={() => edits.disconnect.mutate(e.id)}
                      className="text-[#b13a36] underline"
                    >
                      Remove
                    </button>
                  </p>
                ))}
            </div>
          ) : (
            <p className="text-xs text-[#718398]">Nothing selected.</p>
          )}
        </Panel>

        <Panel title="The campus">
          <p className="text-xs text-[#52657a]">
            {nodes.filter(walkwayNode).length} walkway points · {edges.length}{" "}
            connections · {labels.data?.length ?? 0} labels
          </p>
        </Panel>
      </aside>
    </div>
  );
}
