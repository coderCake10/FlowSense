/* Building: the linked building's floors next to the model's, its floor
 * transitions, and its spatial and kiosk defaults. Floors change through
 * activation (names and heights from the model); transitions through Map
 * Annotation; the kiosk defaults live in the building configuration
 * (client/src/data). */
import { useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import { useBuildingRegistry } from "@/lib/buildingRegistry";
import {
  useAreaFloors,
  useGraph,
  type AnnotationFloor,
} from "@/lib/annotationApi";
import { titleCase } from "@/lib/adminApi";
import {
  useAssetVersion,
  type AssetItem,
  type AssetVersion,
} from "@/lib/assetsApi";
import { cn } from "@/lib/utils";
import { Panel, Row } from "./common";
import { floorLabel } from "./helpers";

type FloorRow = AnnotationFloor & {
  navigable: boolean;
  visible_in_kiosk: boolean;
  active: boolean;
};

const SECTIONS = [
  "information",
  "floors",
  "transitions",
  "spatial",
  "defaults",
] as const;
type Section = (typeof SECTIONS)[number];

export function BuildingTab({
  asset,
  version,
}: {
  asset: AssetItem;
  version: AssetVersion | null;
}) {
  const [section, setSection] = useState<Section>("information");
  if (!asset.area) {
    return (
      <p className="text-sm text-[#718398]">
        This asset isn&apos;t linked to a building. Choose one under Metadata on
        the Asset tab.
      </p>
    );
  }
  return (
    <div>
      <div
        className="mb-4 flex flex-wrap gap-1 border-b border-[#dbe3ed] bg-[#f7f9fc] p-1"
        role="tablist"
      >
        {SECTIONS.map(value => (
          <button
            key={value}
            role="tab"
            aria-selected={section === value}
            onClick={() => setSection(value)}
            className={cn(
              "px-4 py-2 text-[10px] font-semibold uppercase tracking-[.1em] transition",
              section === value
                ? "border-b-2 border-[#f4c542] bg-white text-[#17365d]"
                : "text-[#718398] hover:bg-white/70"
            )}
          >
            {value}
          </button>
        ))}
      </div>
      {section === "information" && <Information asset={asset} />}
      {section === "floors" && <Floors asset={asset} version={version} />}
      {section === "transitions" && <Transitions areaId={asset.area.id} />}
      {section === "spatial" && <Spatial />}
      {section === "defaults" && <Defaults code={asset.area.code} />}
    </div>
  );
}

function Information({ asset }: { asset: AssetItem }) {
  const floors = useAreaFloors(asset.area_id);
  return (
    <Panel title="Information">
      <Row label="Building">{asset.area!.name}</Row>
      <Row label="Code">{asset.area!.code}</Row>
      <Row label="Floors configured">{floors.data?.length ?? "—"}</Row>
      <Row label="Live model">
        {asset.active_version
          ? `${asset.name} v${asset.active_version.version}`
          : "None: the kiosk uses the model bundled with the app"}
      </Row>
    </Panel>
  );
}

function Floors({
  asset,
  version,
}: {
  asset: AssetItem;
  version: AssetVersion | null;
}) {
  const floors = useAreaFloors(asset.area_id);
  const detail = useAssetVersion(asset.id, version?.id ?? null);
  const structure = detail.data?.structure;
  const byOrder = new Map((structure?.floors ?? []).map(f => [f.order, f]));
  const changes = new Map(
    (structure?.floor_changes ?? []).map(c => [c.floor_order, c])
  );
  const rows = (floors.data ?? []) as FloorRow[];
  const unconfigured = (structure?.floors ?? []).filter(
    f => !rows.some(r => r.floor_order === f.order)
  );
  return (
    <Panel title={`Floors · compared with v${version?.version ?? "—"}`}>
      <div className="overflow-x-auto">
        <table className="w-full [&_td]:py-2 [&_td]:pr-3 [&_th]:pr-3 min-w-[720px] text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.12em] text-[#8a98a9]">
            <tr>
              <th className="py-2">Order</th>
              <th>Short name</th>
              <th>Display name</th>
              <th>GLB node</th>
              <th>Height</th>
              <th>In the model</th>
              <th>Navigable</th>
              <th>On kiosk</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(floor => {
              const model = byOrder.get(floor.floor_order);
              const change = changes.get(floor.floor_order);
              const status = !model
                ? "Not in this model"
                : change
                  ? "Updates on activation"
                  : "Matches the model";
              return (
                <tr key={floor.id} className="border-t border-[#edf2f7]">
                  <td className="py-2 font-bold text-[#17365d]">
                    {floor.floor_order}
                  </td>
                  <td>{floorLabel(floor.floor_order)}</td>
                  <td>Floor {floor.floor_order}</td>
                  <td className="font-mono">{floor.glb_node_name ?? "—"}</td>
                  <td>
                    {floor.elevation === null
                      ? "—"
                      : `${Number(floor.elevation).toFixed(2)} m`}
                  </td>
                  <td>
                    {model
                      ? `${model.node} · ${model.elevation === null ? "—" : `${model.elevation.toFixed(2)} m`}`
                      : "—"}
                  </td>
                  <td>{floor.navigable ? "Yes" : "No"}</td>
                  <td>{floor.visible_in_kiosk ? "Yes" : "No"}</td>
                  <td
                    className={cn(
                      !model
                        ? "text-[#b13a36]"
                        : change
                          ? "text-[#946c00]"
                          : "text-[#168051]"
                    )}
                  >
                    {status}
                  </td>
                </tr>
              );
            })}
            {unconfigured.map(floor => (
              <tr
                key={floor.node}
                className="border-t border-[#edf2f7] text-[#718398]"
              >
                <td className="py-2">{floor.order}</td>
                <td>{floorLabel(floor.order)}</td>
                <td>—</td>
                <td className="font-mono">{floor.node}</td>
                <td>—</td>
                <td>
                  {floor.elevation === null
                    ? "—"
                    : `${floor.elevation.toFixed(2)} m`}
                </td>
                <td colSpan={2}>—</td>
                <td>In the model only: add it to the campus seed to use it</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-[#8a98a9]">
        Activating a model sets each floor&apos;s GLB node and walking height
        from the model. Rooms and routes are added in Map Annotation.
      </p>
    </Panel>
  );
}

function Transitions({ areaId }: { areaId: number }) {
  const graph = useGraph(areaId);
  const floors = useAreaFloors(areaId);
  const orderOf = new Map((floors.data ?? []).map(f => [f.id, f.floor_order]));
  const nodeFloor = new Map(
    (graph.data?.nodes ?? []).map(n => [n.id, orderOf.get(n.floor)])
  );
  const rows = graph.data?.transitions ?? [];
  return (
    <Panel
      title="Transitions"
      action={
        <Link
          href="/map-annotation"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#17365d] hover:underline"
        >
          Edit in Map Annotation <ArrowUpRight size={12} />
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-[#718398]">
          No stairs or elevators are linked between floors yet. Link them with
          the Stairs / elevator tool in Map Annotation.
        </p>
      ) : (
        <table className="w-full [&_td]:py-2 [&_td]:pr-3 [&_th]:pr-3 text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.12em] text-[#8a98a9]">
            <tr>
              <th className="py-2">Transition</th>
              <th>From floor</th>
              <th>To floor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => {
              const from = t.from_node ? nodeFloor.get(t.from_node) : undefined;
              const to = t.to_node ? nodeFloor.get(t.to_node) : undefined;
              return (
                <tr key={t.id} className="border-t border-[#edf2f7]">
                  <td className="py-2">
                    {titleCase(t.transition_type)} #{t.id}
                  </td>
                  <td>{from ? floorLabel(from) : "—"}</td>
                  <td>{to ? floorLabel(to) : "—"}</td>
                  <td>{from && to ? "Linked" : "Incomplete"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function Spatial() {
  return (
    <Panel title="Spatial">
      <Row label="Coordinate system">glTF model space, Y up</Row>
      <Row label="Measurement unit">Metres</Row>
      <Row label="Origin">The model&apos;s origin as exported from Blender</Row>
      <Row label="Rotation">None applied</Row>
      <Row label="Scale">1 : 1</Row>
      <p className="mt-3 text-[11px] text-[#8a98a9]">
        FlowSense stores points in the model&apos;s own coordinates, so a new
        export must keep the same origin and orientation or the walkways drawn
        in Map Annotation will be misplaced.
      </p>
    </Panel>
  );
}

function Defaults({ code }: { code: string }) {
  const { buildings } = useBuildingRegistry();
  const config = buildings.find(b => b.areaCode === code);
  if (!config)
    return (
      <Panel title="Defaults">
        <p className="text-sm text-[#718398]">
          The kiosk shows this building once its model is live. Then place it on
          the campus in Map Annotation.
        </p>
      </Panel>
    );
  const kioskFloor = config.model.floors.find(
    f => f.object === config.kioskFloor
  );
  return (
    <Panel title="Defaults">
      <Row label="Default floor">
        {kioskFloor
          ? `${kioskFloor.label} (the kiosk's floor)`
          : config.kioskFloor}
      </Row>
      <Row label="Default map view">Whole building, isometric</Row>
      <Row label="Initial kiosk state">Attract screen until a visitor taps</Row>
      <Row label="Floor selection">
        Allowed ({config.model.floors.map(f => f.label).join(", ")})
      </Row>
      <Row label="Cross-floor search">Allowed</Row>
      <p className="mt-3 text-[11px] text-[#8a98a9]">
        Set in the kiosk&apos;s building configuration (client/src/data), not
        from this page.
      </p>
    </Panel>
  );
}
