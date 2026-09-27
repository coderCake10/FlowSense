/* Model: a 3D view of the selected version, its statistics, and the floors
 * FlowSense detected in it (structure detection). */
import { lazy, Suspense, useState } from "react";
import { Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAreaFloors } from "@/lib/annotationApi";
import {
  formatDimensions,
  useAssetVersion,
  type AssetItem,
  type AssetVersion,
} from "@/lib/assetsApi";
import { Panel, Row } from "./common";
import { downloadHref, floorLabel } from "./helpers";

const ModelViewer = lazy(() =>
  import("@/components/map/ModelViewer").then(m => ({ default: m.ModelViewer }))
);

export function ModelTab({
  asset,
  version,
}: {
  asset: AssetItem;
  version: AssetVersion | null;
}) {
  const detail = useAssetVersion(asset.id, version?.id ?? null);
  const floors = useAreaFloors(asset.area_id);
  const [grid, setGrid] = useState(true);
  const [axes, setAxes] = useState(false);
  const [fitKey, setFitKey] = useState(0);

  if (!version)
    return <p className="text-sm text-[#718398]">No model uploaded yet.</p>;
  const structure = detail.data?.structure;
  const configured = new Map((floors.data ?? []).map(f => [f.floor_order, f]));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Panel
          title={`Viewer · ${version.filename} (v${version.version})`}
          action={
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#40556d]">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFitKey(k => k + 1)}
              >
                <Maximize size={14} className="mr-1" /> Fit
              </Button>
              <label className="flex items-center gap-1.5">
                <Checkbox
                  checked={grid}
                  onCheckedChange={v => setGrid(v === true)}
                  aria-label="Grid"
                />
                Grid
              </label>
              <label className="flex items-center gap-1.5">
                <Checkbox
                  checked={axes}
                  onCheckedChange={v => setAxes(v === true)}
                  aria-label="Axes"
                />
                Axes
              </label>
            </div>
          }
        >
          <div className="h-[420px] overflow-hidden rounded-lg border border-[#edf2f7]">
            {version.processing_status === "failed" ? (
              <p className="grid h-full place-items-center text-sm text-[#8f2f2b]">
                This file couldn&apos;t be read, so it can&apos;t be shown.
              </p>
            ) : (
              <Suspense
                fallback={
                  <p className="grid h-full place-items-center text-sm text-[#718398]">
                    Loading the viewer…
                  </p>
                }
              >
                <ModelViewer
                  url={downloadHref(version)}
                  grid={grid}
                  axes={axes}
                  fitKey={fitKey}
                />
              </Suspense>
            )}
          </div>
          <p className="mt-2 text-[11px] text-[#8a98a9]">
            Drag to turn, scroll to zoom, right-drag to pan. Y is up; units are
            metres.
          </p>
        </Panel>
        <Panel title="Statistics">
          <Row label="Objects">{version.object_count ?? "—"}</Row>
          <Row label="Meshes">{version.mesh_count ?? "—"}</Row>
          <Row label="Materials">{version.material_count ?? "—"}</Row>
          <Row label="Textures">{version.texture_count ?? "—"}</Row>
          <Row label="Vertices">
            {version.vertices_count?.toLocaleString() ?? "—"}
          </Row>
          <Row label="Triangles">
            {version.triangles_count?.toLocaleString() ?? "—"}
          </Row>
          <Row label="Size (W × H × D)">{formatDimensions(version)}</Row>
          <Row label="Floors detected">
            {version.detected_floor_count ?? "—"}
          </Row>
          <Row label="Draco compression">
            {structure ? (structure.draco ? "Yes" : "No") : "—"}
          </Row>
          <Row label="Exported by">{structure?.generator || "—"}</Row>
        </Panel>
      </div>
      <Panel title="Structure detection">
        {!structure ? (
          <p className="text-sm text-[#718398]">
            {detail.isLoading
              ? "Reading the model…"
              : "The model's structure couldn't be read."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full [&_td]:py-2 [&_td]:pr-3 [&_th]:pr-3 min-w-[640px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.12em] text-[#8a98a9]">
                <tr>
                  <th className="py-2">Detected node</th>
                  <th>Detected as</th>
                  <th>Reason</th>
                  <th>Confidence</th>
                  <th>Walking height</th>
                  <th>FlowSense status</th>
                </tr>
              </thead>
              <tbody>
                {structure.floors.map(floor => {
                  const match = configured.get(floor.order);
                  const status = !asset.area_id
                    ? "No building linked"
                    : !match
                      ? "Not configured (no rooms or routes yet)"
                      : match.glb_node_name === floor.node &&
                          match.elevation !== null &&
                          floor.elevation !== null &&
                          Math.abs(Number(match.elevation) - floor.elevation) <=
                            0.05
                        ? `Configured as ${floorLabel(floor.order)}`
                        : `${floorLabel(floor.order)} will be updated on activation`;
                  return (
                    <tr key={floor.node} className="border-t border-[#edf2f7]">
                      <td className="py-2 font-mono font-semibold text-[#17365d]">
                        {floor.node}
                      </td>
                      <td>Floor {floor.order}</td>
                      <td>{floor.reason}</td>
                      <td>{floor.confidence === "high" ? "High" : "Medium"}</td>
                      <td>
                        {floor.elevation === null
                          ? "—"
                          : `${floor.elevation.toFixed(2)} m`}
                      </td>
                      <td>{status}</td>
                    </tr>
                  );
                })}
                {structure.potential_floors.map(floor => (
                  <tr
                    key={floor.node}
                    className="border-t border-[#edf2f7] text-[#718398]"
                  >
                    <td className="py-2 font-mono">{floor.node}</td>
                    <td>Possible floor</td>
                    <td>{floor.reason}</td>
                    <td>Medium</td>
                    <td>
                      {floor.elevation === null
                        ? "—"
                        : `${floor.elevation.toFixed(2)} m`}
                    </td>
                    <td>Ignored: rename it FLOOR_n to use it</td>
                  </tr>
                ))}
                {structure.exterior_nodes.length > 0 && (
                  <tr className="border-t border-[#edf2f7]">
                    <td className="py-2 font-mono font-semibold text-[#17365d]">
                      {Array.from(new Set(structure.exterior_nodes)).join(", ")}
                    </td>
                    <td>Exterior</td>
                    <td>Named EXTERIOR or ROOF</td>
                    <td>High</td>
                    <td>—</td>
                    <td>Lifts away when a visitor opens a floor</td>
                  </tr>
                )}
              </tbody>
            </table>
            {structure.floors.length === 0 && (
              <p className="mt-3 text-sm text-[#718398]">
                No floor groups found. Name each floor&apos;s group FLOOR_1,
                FLOOR_2, … in Blender.
              </p>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
