/* Overview: the current asset, its model summary, its building, and what
 * needs attention (validation warnings and errors, floor differences). */
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/adminApi";
import { useAreaFloors } from "@/lib/annotationApi";
import {
  CHECK_CATEGORIES,
  formatBytes,
  formatDimensions,
  useRevalidate,
  useValidationChecks,
  type AssetItem,
  type AssetVersion,
} from "@/lib/assetsApi";
import { CheckIcon, Panel, ResultPill, Row, Stat, VersionPill } from "./common";

export function OverviewTab({
  asset,
  version,
}: {
  asset: AssetItem;
  version: AssetVersion | null;
}) {
  const floors = useAreaFloors(asset.area_id);
  const configured = floors.data ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Current asset">
          <Row label="Asset name">{asset.name}</Row>
          <Row label="Live version">
            {asset.active_version
              ? `v${asset.active_version.version}`
              : "None yet"}
          </Row>
          <Row label="Selected version">
            {version ? (
              <span className="inline-flex items-center gap-2">
                v{version.version}{" "}
                <VersionPill asset={asset} version={version} />
              </span>
            ) : (
              "—"
            )}
          </Row>
          <Row label="File size">{formatBytes(version?.file_size_bytes)}</Row>
          <Row label="Building">{asset.area?.name ?? "Not linked"}</Row>
          <Row label="Last updated">{formatWhen(asset.updated_at)}</Row>
        </Panel>
        <Panel title="Building summary">
          {asset.area ? (
            <>
              <Row label="Building">{asset.area.name}</Row>
              <Row label="Code">{asset.area.code}</Row>
              <Row label="Configured floors">{configured.length}</Row>
              <Row label="Floors in the model">
                {version?.detected_floor_count ?? "—"}
              </Row>
              <Row label="Configuration">
                {configured.length &&
                version?.detected_floor_count === configured.length
                  ? "Floors match the model"
                  : "Floors differ from the model (see Building)"}
              </Row>
            </>
          ) : (
            <p className="text-sm text-[#718398]">
              {asset.asset_type === "area_model"
                ? "An area or campus model; it isn't tied to one building."
                : "Link this asset to a building on the Asset tab so FlowSense can compare its floors."}
            </p>
          )}
        </Panel>
      </div>
      <Panel title="Asset summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Objects" value={version?.object_count ?? "—"} />
          <Stat label="Meshes" value={version?.mesh_count ?? "—"} />
          <Stat label="Materials" value={version?.material_count ?? "—"} />
          <Stat label="Textures" value={version?.texture_count ?? "—"} />
          <Stat
            label="Floors detected"
            value={version?.detected_floor_count ?? "—"}
          />
          <Stat
            label="Size (W×H×D)"
            value={<span className="text-sm">{formatDimensions(version)}</span>}
          />
        </div>
      </Panel>
      {version && <ValidationSection asset={asset} version={version} />}
    </div>
  );
}

/** Every check of the version's latest validation run, grouped as in the spec. */
export function ValidationSection({
  asset,
  version,
}: {
  asset: AssetItem;
  version: AssetVersion;
}) {
  const checks = useValidationChecks(asset.id, version.id);
  const revalidate = useRevalidate();
  const rows = checks.data ?? [];
  const issues = rows.filter(c => c.status !== "passed");
  return (
    <Panel
      title={`Validation · v${version.version}`}
      action={
        <div className="flex items-center gap-2">
          <ResultPill result={version.validation?.result} />
          <Button
            size="sm"
            variant="outline"
            disabled={
              version.processing_status !== "completed" || revalidate.isPending
            }
            onClick={() =>
              revalidate.mutate({ assetId: asset.id, versionId: version.id })
            }
          >
            <RefreshCw size={14} className="mr-2" />
            Run validation again
          </Button>
        </div>
      }
    >
      {version.processing_status !== "completed" ? (
        <p className="text-sm text-[#718398]">
          {version.processing_status === "failed"
            ? "The file couldn't be read, so it wasn't validated."
            : "Reading the model… Validation runs as soon as it's done."}
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-[#52657a]">
            {version.validation?.summary ?? "Not validated yet."}
            {issues.length > 0 && " Issues are listed first."}
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {CHECK_CATEGORIES.map(category => {
              const inCategory = rows
                .filter(c => c.category === category.id)
                .sort(
                  (a, b) =>
                    Number(a.status === "passed") -
                    Number(b.status === "passed")
                );
              if (!inCategory.length) return null;
              return (
                <div key={category.id} className="rounded-lg bg-[#f7f9fc] p-3">
                  <p className="mb-2 text-xs font-bold text-[#17365d]">
                    {category.label}
                  </p>
                  <ul className="space-y-2">
                    {inCategory.map(check => (
                      <li
                        key={check.id}
                        className="flex gap-2 text-xs text-[#40556d]"
                      >
                        <CheckIcon status={check.status} />
                        <span>
                          <b className="font-semibold text-[#17365d]">
                            {check.check_name}.
                          </b>{" "}
                          {check.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
