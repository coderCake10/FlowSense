/* Asset: the file, its editable metadata, and its version history. */
import { FormEvent, useState } from "react";
import { Download, Eye, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/AdminBits";
import { formatWhen, titleCase, useBuildings } from "@/lib/adminApi";
import {
  formatBytes,
  useAssetVersions,
  useRestoreVersion,
  useUpdateAsset,
  type AssetItem,
  type AssetVersion,
} from "@/lib/assetsApi";
import { cn } from "@/lib/utils";
import { Panel, ResultPill, Row, VersionPill } from "./common";
import { activationBlocker, downloadHref } from "./helpers";

export function AssetTab({
  asset,
  version,
  onSelectVersion,
}: {
  asset: AssetItem;
  version: AssetVersion | null;
  onSelectVersion: (id: number) => void;
}) {
  const versions = useAssetVersions(asset.id);
  const restore = useRestoreVersion();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Selected file">
          {version ? (
            <>
              <Row label="File name">{version.filename}</Row>
              <Row label="Version">v{version.version}</Row>
              <Row label="File size">
                {formatBytes(version.file_size_bytes)}
              </Row>
              <Row label="Format">
                {version.file_format.toUpperCase()} (glTF 2.0)
              </Row>
              <Row label="Uploaded">{formatWhen(version.created_at)}</Row>
              <Row label="Processing">
                {titleCase(version.processing_status)}
              </Row>
              <Row label="Validation">
                <ResultPill result={version.validation?.result} />
              </Row>
              <Row label="Activation">
                <VersionPill asset={asset} version={version} />
              </Row>
              <Row label="Checksum (SHA-256)">
                <span className="font-mono text-[10px]">
                  {version.checksum?.slice(0, 16)}…
                </span>
              </Row>
            </>
          ) : (
            <p className="text-sm text-[#718398]">No versions yet.</p>
          )}
        </Panel>
        <MetadataForm key={asset.id} asset={asset} />
      </div>
      <Panel title="Version history">
        <div className="overflow-x-auto">
          <table className="w-full [&_td]:py-2 [&_td]:pr-3 [&_th]:pr-3 min-w-[640px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-[#8a98a9]">
              <tr>
                <th className="py-2">Version</th>
                <th>File</th>
                <th>Uploaded</th>
                <th>Validation</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(versions.data ?? []).map(row => {
                const blocker = activationBlocker(asset, row);
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-t border-[#edf2f7]",
                      row.id === version?.id && "bg-[#fffaf0]"
                    )}
                  >
                    <td className="py-2 font-bold text-[#17365d]">
                      v{row.version}
                    </td>
                    <td className="max-w-[180px] truncate" title={row.filename}>
                      {row.filename} · {formatBytes(row.file_size_bytes)}
                    </td>
                    <td>{formatWhen(row.created_at)}</td>
                    <td>
                      <ResultPill result={row.validation?.result} />
                    </td>
                    <td>
                      <VersionPill asset={asset} version={row} />
                    </td>
                    <td className="py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`View version ${row.version}`}
                          onClick={() => onSelectVersion(row.id)}
                        >
                          <Eye size={14} />
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a
                            href={downloadHref(row)}
                            download={row.filename}
                            aria-label={`Download version ${row.version}`}
                          >
                            <Download size={14} />
                          </a>
                        </Button>
                        {row.id !== asset.active_version_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!blocker || restore.isPending}
                            title={blocker ?? undefined}
                            onClick={() =>
                              restore.mutate({
                                assetId: asset.id,
                                versionId: row.id,
                              })
                            }
                          >
                            <RotateCcw size={14} className="mr-1" />
                            {asset.active_version_id ? "Restore" : "Activate"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function MetadataForm({ asset }: { asset: AssetItem }) {
  const buildings = useBuildings();
  const update = useUpdateAsset();
  const [form, setForm] = useState({
    name: asset.name,
    description: asset.description ?? "",
    source: asset.source ?? "",
    notes: asset.notes ?? "",
    area_id: asset.area_id ? String(asset.area_id) : "",
  });
  const changed =
    form.name !== asset.name ||
    form.description !== (asset.description ?? "") ||
    form.source !== (asset.source ?? "") ||
    form.notes !== (asset.notes ?? "") ||
    form.area_id !== (asset.area_id ? String(asset.area_id) : "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({
      id: asset.id,
      name: form.name.trim(),
      description: form.description || null,
      source: form.source || null,
      notes: form.notes || null,
      area_id: form.area_id ? Number(form.area_id) : null,
    });
  };
  return (
    <Panel title="Metadata">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Asset name">
          <Input
            required
            maxLength={255}
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="border-[#dbe3ed]"
          />
        </Field>
        <Field label="Building">
          <NativeSelect
            aria-label="Building"
            value={form.area_id}
            onChange={e => setForm({ ...form, area_id: e.target.value })}
          >
            <option value="">Not linked</option>
            {(buildings.data ?? []).map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="min-h-16 border-[#dbe3ed]"
          />
        </Field>
        <Field label="Source">
          <Input
            maxLength={255}
            value={form.source}
            onChange={e => setForm({ ...form, source: e.target.value })}
            className="border-[#dbe3ed]"
          />
        </Field>
        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            className="min-h-16 border-[#dbe3ed]"
          />
        </Field>
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!changed || !form.name.trim() || update.isPending}
            className="bg-[#17365d] text-white hover:bg-[#102c4d]"
          >
            Save details
          </Button>
        </div>
      </form>
    </Panel>
  );
}
