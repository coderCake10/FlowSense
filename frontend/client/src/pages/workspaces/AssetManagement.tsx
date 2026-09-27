/* Asset Management: upload building models, inspect and validate them, and
 * choose which version the kiosk shows (07 API Design, "Assets API";
 * 04 Application/02 Admin/05 Asset Management). */
import { useState } from "react";
import {
  CloudUpload,
  Download,
  Power,
  PowerOff,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/FlowSenseShell";
import { ConfirmDialog, QueryStatus } from "@/components/AdminBits";
import { isApiConfigured } from "@/lib/api";
import { formatWhen } from "@/lib/adminApi";
import {
  formatBytes,
  useActivateVersion,
  useAssetVersions,
  useDeactivateAsset,
  useAssets,
  useDeleteAsset,
  useProcessingWatch,
  type AssetItem,
} from "@/lib/assetsApi";
import { cn } from "@/lib/utils";
import { ActivityTab } from "./assets/ActivityTab";
import { AssetTab } from "./assets/AssetTab";
import { BuildingTab } from "./assets/BuildingTab";
import { ModelTab } from "./assets/ModelTab";
import { OverviewTab } from "./assets/OverviewTab";
import { UploadDialog } from "./assets/UploadDialog";
import { Panel, ResultPill, Row, VersionPill } from "./assets/common";
import { activationBlocker, downloadHref } from "./assets/helpers";

type Tab = "overview" | "asset" | "model" | "building" | "activity";

export function AssetManagement() {
  const live = isApiConfigured();
  const assets = useAssets();
  const list = assets.data ?? [];
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [chosenVersion, setChosenVersion] = useState<{
    asset: number;
    version: number;
  } | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [upload, setUpload] = useState<{ asset?: AssetItem } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmOffline, setConfirmOffline] = useState(false);

  const asset =
    list.find(a => a.id === chosenId) ??
    list.find(a => a.active_version_id !== null) ??
    list[0] ??
    null;
  const versions = useAssetVersions(asset?.id ?? null);
  // The chosen version, else the latest; the list endpoint carries both the
  // active and the latest in full, the versions endpoint the rest.
  const version =
    (chosenVersion?.asset === asset?.id
      ? (versions.data ?? []).find(v => v.id === chosenVersion?.version)
      : undefined) ??
    asset?.latest_version ??
    null;
  useProcessingWatch(asset);
  const activate = useActivateVersion();
  const remove = useDeleteAsset();
  const offline = useDeactivateAsset();
  const blocker = asset
    ? activationBlocker(asset, version)
    : "Upload a model first.";

  const selectVersion = (id: number) => {
    if (asset) setChosenVersion({ asset: asset.id, version: id });
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Asset management"
        title="Manage the campus model"
        description="Upload building models, check them, and choose which version the kiosk shows."
        action={
          <Button
            className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            onClick={() => setUpload({})}
            disabled={!live}
          >
            <CloudUpload size={16} className="mr-2" />
            Upload model
          </Button>
        }
      />

      {!live && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-[#f1d58a] bg-[#fff8df] p-4 text-sm text-[#6b4f00]"
        >
          <p className="font-semibold">Offline demo</p>
          <p className="mt-1">
            Asset Management needs the FlowSense server. Start the app with
            VITE_API_BASE_URL set to manage building models.
          </p>
        </div>
      )}

      <QueryStatus
        isLoading={assets.isLoading}
        error={assets.error}
        onRetry={() => assets.refetch()}
        what="building models"
      />

      {live && !assets.isLoading && !assets.error && list.length === 0 && (
        <Card className="border-[#dbe3ed]">
          <CardContent className="p-8 text-center">
            <p className="font-display text-xl font-bold text-[#17365d]">
              No building models yet
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-[#718398]">
              Until a model is uploaded and activated here, the kiosk uses the
              models bundled with the app. Upload a .glb to check it and make it
              live.
            </p>
            <Button
              className="mt-5 bg-[#17365d] text-white hover:bg-[#102c4d]"
              onClick={() => setUpload({})}
            >
              <CloudUpload size={16} className="mr-2" />
              Upload model
            </Button>
          </CardContent>
        </Card>
      )}

      {asset && (
        <>
          <div
            className="mb-4 flex gap-2 overflow-x-auto pb-1"
            role="list"
            aria-label="Building models"
          >
            {list.map(item => (
              <button
                key={item.id}
                role="listitem"
                aria-current={item.id === asset.id}
                onClick={() => {
                  setChosenId(item.id);
                  setChosenVersion(null);
                }}
                className={cn(
                  "min-w-[200px] rounded-xl border p-3 text-left transition",
                  item.id === asset.id
                    ? "border-[#17365d] bg-white shadow-sm"
                    : "border-[#dbe3ed] bg-[#f7f9fc] hover:bg-white"
                )}
              >
                <p className="truncate text-sm font-bold text-[#17365d]">
                  {item.name}
                </p>
                <p className="mt-1 text-[11px] text-[#718398]">
                  {item.area?.name ??
                    (item.asset_type === "area_model"
                      ? "Area model"
                      : "No building")}{" "}
                  ·{" "}
                  {item.active_version
                    ? `v${item.active_version.version} live`
                    : "not live"}
                </p>
              </button>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <Card className="min-w-0 border-[#dbe3ed]">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-display text-2xl tracking-[-0.05em]">
                      {asset.name}
                      {version && (
                        <span className="text-[#8391a3]">
                          {" "}
                          · v{version.version}
                        </span>
                      )}
                    </CardTitle>
                    <p className="mt-1 text-xs text-[#8391a3]">
                      {asset.area
                        ? asset.area.name
                        : "Not linked to a building"}{" "}
                      · updated {formatWhen(asset.updated_at)}
                    </p>
                  </div>
                  <Tabs
                    value={tab}
                    onValueChange={value => setTab(value as Tab)}
                  >
                    <TabsList className="bg-[#edf2f7]">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="asset">Asset</TabsTrigger>
                      <TabsTrigger value="model">Model</TabsTrigger>
                      <TabsTrigger value="building">Building</TabsTrigger>
                      <TabsTrigger value="activity">Activity</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                {tab === "overview" && (
                  <OverviewTab asset={asset} version={version} />
                )}
                {tab === "asset" && (
                  <AssetTab
                    asset={asset}
                    version={version}
                    onSelectVersion={selectVersion}
                  />
                )}
                {tab === "model" && (
                  <ModelTab asset={asset} version={version} />
                )}
                {tab === "building" && (
                  <BuildingTab asset={asset} version={version} />
                )}
                {tab === "activity" && <ActivityTab />}
              </CardContent>
            </Card>

            <aside className="space-y-4" aria-label="Selected version">
              <Panel title="Selected version">
                {version ? (
                  <>
                    <p
                      className="truncate text-sm font-bold text-[#17365d]"
                      title={version.filename}
                    >
                      {version.filename}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <VersionPill asset={asset} version={version} />
                      <ResultPill result={version.validation?.result} />
                    </div>
                    <div className="mt-3">
                      <Row label="Version">v{version.version}</Row>
                      <Row label="Size">
                        {formatBytes(version.file_size_bytes)}
                      </Row>
                      <Row label="Format">GLB</Row>
                      <Row label="Checks">
                        {version.validation
                          ? `${version.validation.counts.passed} passed · ${version.validation.counts.warnings} warnings · ${version.validation.counts.errors} errors`
                          : "—"}
                      </Row>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[#718398]">No versions yet.</p>
                )}
              </Panel>
              <Panel title="Actions">
                <div className="grid gap-2">
                  <Button
                    className="bg-[#17365d] text-white hover:bg-[#102c4d]"
                    disabled={!!blocker || activate.isPending}
                    onClick={() =>
                      version &&
                      activate.mutate({
                        assetId: asset.id,
                        versionId: version.id,
                      })
                    }
                  >
                    <Power size={16} className="mr-2" />
                    {activate.isPending
                      ? "Activating…"
                      : `Make v${version?.version ?? ""} live`}
                  </Button>
                  {blocker && (
                    <p className="text-[11px] text-[#718398]">{blocker}</p>
                  )}
                  {asset.active_version && (
                    <Button
                      variant="outline"
                      disabled={offline.isPending}
                      onClick={() => setConfirmOffline(true)}
                    >
                      <PowerOff size={16} className="mr-2" />
                      Take v{asset.active_version.version} offline
                    </Button>
                  )}
                  {asset.area && !blocker && (
                    <p className="text-[11px] text-[#718398]">
                      The kiosk shows it from its next load. {asset.area.name}
                      &apos;s floors take their names and heights from the
                      model.
                    </p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setUpload({ asset })}
                  >
                    <Upload size={16} className="mr-2" />
                    Upload a new version
                  </Button>
                  {version && (
                    <Button variant="outline" asChild>
                      <a
                        href={downloadHref(version)}
                        download={version.filename}
                      >
                        <Download size={16} className="mr-2" />
                        Download v{version.version}
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="text-[#b13a36]"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete asset
                  </Button>
                </div>
              </Panel>
            </aside>
          </div>
        </>
      )}

      {upload && (
        <UploadDialog
          asset={upload.asset}
          onClose={() => setUpload(null)}
          onUploaded={id => {
            setChosenId(id);
            setChosenVersion(null);
            setTab("overview");
          }}
        />
      )}
      {asset?.active_version && (
        <ConfirmDialog
          open={confirmOffline}
          title={`Take ${asset.name} offline?`}
          description={`The kiosk, attract screen and phones go back to the model bundled with the app from their next load. v${asset.active_version.version} stays here, and you can make it live again.`}
          confirmLabel="Take offline"
          busy={offline.isPending}
          onCancel={() => setConfirmOffline(false)}
          onConfirm={() =>
            offline.mutate(asset, {
              onSuccess: () => setConfirmOffline(false),
            })
          }
        />
      )}
      {asset && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Delete ${asset.name}?`}
          description={
            asset.active_version_id
              ? `It is ${asset.area?.name ?? "a building"}'s live model. The kiosk will go back to the model bundled with the app.`
              : "Its versions and validation history are removed from Asset Management."
          }
          confirmLabel="Delete asset"
          busy={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            remove.mutate(asset, {
              onSuccess: () => {
                setConfirmDelete(false);
                setChosenId(null);
              },
            })
          }
        />
      )}
    </>
  );
}
