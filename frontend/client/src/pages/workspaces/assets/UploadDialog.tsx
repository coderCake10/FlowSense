/* Upload a building model: a new asset, or a new version of an existing one. */
import { FormEvent, useState } from "react";
import { CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/AdminBits";
import { useBuildings } from "@/lib/adminApi";
import {
  formatBytes,
  useUploadModel,
  type AssetItem,
  type AssetType,
} from "@/lib/assetsApi";

const MAX_BYTES = 500 * 1024 * 1024;

export function UploadDialog({
  asset,
  onClose,
  onUploaded,
}: {
  /** Set to upload a new version of this asset. */
  asset?: AssetItem;
  onClose: () => void;
  onUploaded: (assetId: number) => void;
}) {
  const buildings = useBuildings();
  const upload = useUploadModel();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("building_model");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<number | null>(null);

  const problem = !file
    ? null
    : !file.name.toLowerCase().endsWith(".glb")
      ? "Choose a .glb file (binary glTF 2.0)."
      : file.size > MAX_BYTES
        ? "The file is larger than 500 MB."
        : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!file || problem) return;
    setProgress(0);
    upload.mutate(
      {
        file,
        assetId: asset?.id,
        name: name.trim() || undefined,
        areaId: areaId ? Number(areaId) : null,
        assetType,
        source: source.trim() || undefined,
        notes: notes.trim() || undefined,
        onProgress: setProgress,
      },
      {
        onSuccess: result => {
          onUploaded(asset?.id ?? result.id);
          onClose();
        },
        onSettled: () => setProgress(null),
      }
    );
  };

  return (
    <Dialog open onOpenChange={open => !open && !upload.isPending && onClose()}>
      <DialogContent className="bg-white text-[#102c4d] sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b08412]">
              {asset ? `New version of ${asset.name}` : "New building model"}
            </p>
            <DialogTitle className="font-display text-2xl tracking-[-0.04em]">
              {asset ? "Upload a new version" : "Upload a model"}
            </DialogTitle>
            <DialogDescription>
              A .glb file up to 500 MB. FlowSense reads it, runs its checks, and
              waits for you to activate it; the kiosk keeps the current model
              until then.
            </DialogDescription>
          </DialogHeader>
          <div className="my-6 space-y-4">
            <Field
              label="Model file"
              hint="Export from Blender as glTF Binary with Draco compression (docs/setup/building-models.md)."
            >
              <Input
                type="file"
                accept=".glb,model/gltf-binary"
                aria-label="Model file"
                required
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="border-[#dbe3ed]"
              />
            </Field>
            {file && (
              <p
                className={
                  problem ? "text-xs text-[#b13a36]" : "text-xs text-[#52657a]"
                }
              >
                {problem ?? `${file.name} · ${formatBytes(file.size)}`}
              </p>
            )}
            {!asset && (
              <>
                <Field label="Name" hint="Defaults to the file name.">
                  <Input
                    value={name}
                    maxLength={255}
                    onChange={e => setName(e.target.value)}
                    placeholder="EYA Building model"
                    className="border-[#dbe3ed]"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Building"
                    hint="The kiosk shows this building with it."
                  >
                    <NativeSelect
                      aria-label="Building"
                      value={areaId}
                      onChange={e => setAreaId(e.target.value)}
                    >
                      <option value="">Not linked yet</option>
                      {(buildings.data ?? []).map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Type">
                    <NativeSelect
                      aria-label="Type"
                      value={assetType}
                      onChange={e => setAssetType(e.target.value as AssetType)}
                    >
                      <option value="building_model">
                        Building (with floors)
                      </option>
                      <option value="area_model">Area or campus</option>
                    </NativeSelect>
                  </Field>
                </div>
                <Field label="Source (optional)">
                  <Input
                    value={source}
                    maxLength={255}
                    onChange={e => setSource(e.target.value)}
                    placeholder="Team Blender export"
                    className="border-[#dbe3ed]"
                  />
                </Field>
                <Field label="Notes (optional)">
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="border-[#dbe3ed]"
                  />
                </Field>
              </>
            )}
            {progress !== null && (
              <div role="status" aria-label="Upload progress">
                <div className="h-2 rounded-full bg-[#e7edf3]">
                  <div
                    className="h-2 rounded-full bg-[#f4c542] transition-[width]"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[#52657a]">
                  {progress < 1
                    ? `Uploading… ${Math.round(progress * 100)}%`
                    : "Uploaded. Reading and checking the model…"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={upload.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!file || !!problem || upload.isPending}
              className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            >
              <CloudUpload size={16} className="mr-2" />
              {upload.isPending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
