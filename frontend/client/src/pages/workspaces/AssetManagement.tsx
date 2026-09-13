/* Civic Signal: AUF navy shell, FlowSense Signal Gold for active operational states, Space Grotesk headings, IBM Plex Sans body, breathable workspace composition, restrained motion. */
import { useEffect, useState } from "react";
import { Box, CloudUpload, Plus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, StatusPill } from "@/components/FlowSenseShell";
import { endpointMap, isApiConfigured } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8493a5]">
      {children}
    </p>
  );
}
export function AssetManagement() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [assetTab, setAssetTab] = useState("overview");
  const [buildingTab, setBuildingTab] = useState("information");
  const [assetAction, setAssetAction] = useState<string | null>(null);
  const [floorEditor, setFloorEditor] = useState<string[] | null>(null);
  const [transitionEditor, setTransitionEditor] = useState<string[] | null>(
    null
  );
  useEffect(() => {
    if (!uploadOpen && !floorEditor && !transitionEditor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (uploadOpen) {
        setSelectedFile(null);
        setIsDraggingFile(false);
        setProcessing(false);
        setUploadOpen(false);
      } else if (floorEditor) {
        setFloorEditor(null);
      } else if (transitionEditor) {
        setTransitionEditor(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [uploadOpen, floorEditor, transitionEditor]);
  const [floors, setFloors] = useState<string[][]>([
    ["01", "GL_1", "GROUND FLOOR", "G", "0.00 m", "YES", "CONFIGURED"],
    ["02", "FLOOR_1", "FIRST FLOOR", "1", "3.80 m", "YES", "CONFIGURED"],
    ["03", "FLOOR_2", "SECOND FLOOR", "2", "7.60 m", "NO", "NEEDS REVIEW"],
    ["04", "FLOOR_3", "THIRD FLOOR", "3", "11.20 m", "NO", "DETECTED"],
  ]);
  const [transitions, setTransitions] = useState<string[][]>([
    ["STAIR A", "GROUND FLOOR", "FIRST FLOOR", "CONFIGURED"],
    ["LIFT", "GROUND FLOOR", "FIRST FLOOR", "CONFIGURED"],
    ["STAIR B", "FIRST FLOOR", "SECOND FLOOR", "NEEDS REVIEW"],
    ["STAIR C", "SECOND FLOOR", "THIRD FLOOR", "NEEDS REVIEW"],
  ]);
  const resetUpload = () => {
    setSelectedFile(null);
    setIsDraggingFile(false);
    setProcessing(false);
    setUploadOpen(false);
  };

  const selectAssetFile = (file: File | undefined) => {
    if (!file) return;

    const isGlb = file.name.toLowerCase().endsWith(".glb");
    const maxSize = 500 * 1024 * 1024;

    if (!isGlb) {
      toast.error("Unsupported file", {
        description: "Please select a GLB (.glb) file.",
      });
      return;
    }

    if (file.size > maxSize) {
      toast.error("File is too large", {
        description: "Asset uploads are limited to 500 MB.",
      });
      return;
    }

    setSelectedFile(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const saveAssetChanges = () => {
    setAssetAction(
      `Building ${buildingTab} saved · PATCH ${endpointMap.assets.all}/asset-001`
    );
    toast.success("Asset changes saved");
  };
  const openValidation = (label: string) => {
    setAssetAction(
      `${label} review opened · GET ${endpointMap.assets.validation("asset-001")}`
    );
    toast.message("Validation item opened", { description: `Review ${label}` });
  };
  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Asset management"
        title="Manage the campus model"
        description="Track the active building assets, inspect validation results, and keep every spatial version ready for deployment."
        action={
          <Button
            className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            onClick={() => setUploadOpen(true)}
          >
            <CloudUpload size={16} className="mr-2" />
            Upload asset
          </Button>
        }
      />
      <Card className="border-[#dbe3ed]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <SectionLabel>Current asset</SectionLabel>
              <CardTitle className="font-display text-2xl tracking-[-0.05em]">
                A Building · v1.4
              </CardTitle>
              <p className="mt-2 text-xs text-[#8391a3]">
                Updated Aug 22, 2026 · GLB with Draco compression
              </p>
            </div>
            <StatusPill status="Active" tone="green" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Objects", "312"],
              ["Meshes", "184"],
              ["Materials", "47"],
              ["Textures", "61"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#f7f9fc] p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a98a9]">
                  {label}
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-[#17365d]">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 h-2 rounded-full bg-[#e7edf3]">
            <div className="h-2 w-[86%] rounded-full bg-[#f4c542]" />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-[#8391a3]">
            <span>Validation passed with warnings</span>
            <span>86%</span>
          </div>
        </CardContent>
      </Card>
      <Card className="mt-5 border-[#dbe3ed]">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="font-display text-lg">
                Asset details
              </CardTitle>
              <p className="text-xs text-[#8391a3]">
                Configure the selected building using the same contexts shown in
                the wireframes.
              </p>
            </div>
            <Tabs value={assetTab} onValueChange={setAssetTab}>
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dbe3ed] bg-[#f7f9fc] p-3 text-xs">
            <span className="font-semibold text-[#17365d]">
              {assetTab === "building"
                ? `Building · ${buildingTab}`
                : `${assetTab.charAt(0).toUpperCase() + assetTab.slice(1)} view`}
            </span>
            <span className="text-[#718398]">
              Asset API · {isApiConfigured() ? "connected" : "fixture adapter"}
            </span>
            {assetAction && (
              <span className="text-[#168051]">{assetAction}</span>
            )}
          </div>
          {assetTab === "building" ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
              <div className="min-w-0">
                <div className="mb-4 flex flex-wrap gap-1 border-b border-[#dbe3ed] bg-[#f7f9fc] p-1">
                  {[
                    ["information", "INFORMATION"],
                    ["floors", "FLOORS"],
                    ["transitions", "TRANSITIONS"],
                    ["spatial", "SPATIAL"],
                    ["defaults", "DEFAULTS"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setBuildingTab(value)}
                      className={cn(
                        "px-4 py-2 text-[10px] font-semibold tracking-[.1em] transition",
                        buildingTab === value
                          ? "border-b-2 border-[#f4c542] bg-white text-[#17365d]"
                          : "text-[#718398] hover:bg-white/70"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {buildingTab === "information" && (
                  <div className="rounded-xl border border-[#dbe3ed] p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#718398]">
                          Selected asset
                        </p>
                        <h3 className="mt-1 font-display text-xl font-bold text-[#17365d]">
                          A Building
                        </h3>
                        <p className="mt-1 text-xs text-[#8391a3]">
                          Configure the building context used by navigation and
                          map annotation.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={saveAssetChanges}
                        className="bg-[#17365d] text-white hover:bg-[#102c4d]"
                      >
                        Save changes
                      </Button>
                    </div>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-[#53677d]">
                        Building name
                        <Input
                          defaultValue="A Building"
                          className="mt-2 border-[#dbe3ed]"
                        />
                      </label>
                      <label className="text-xs font-semibold text-[#53677d]">
                        Building code
                        <Input
                          defaultValue="AB"
                          className="mt-2 border-[#dbe3ed]"
                        />
                      </label>
                      <label className="text-xs font-semibold text-[#53677d]">
                        Description
                        <Input
                          defaultValue="Configure a building for wayfinding."
                          className="mt-2 border-[#dbe3ed]"
                        />
                      </label>
                      <label className="text-xs font-semibold text-[#53677d]">
                        Status
                        <select className="mt-2 h-10 w-full rounded-lg border border-[#dbe3ed] bg-white px-3 text-sm">
                          <option>Active</option>
                          <option>Draft</option>
                          <option>Needs review</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}
                {buildingTab === "floors" && (
                  <div className="rounded-xl border border-[#dbe3ed] p-3">
                    <div className="flex items-center justify-between px-2 py-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#718398]">
                          Building configuration
                        </p>
                        <h3 className="font-display text-lg font-bold text-[#17365d]">
                          Floors
                        </h3>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAssetAction(
                            `Floor draft created · POST ${endpointMap.map.floors}`
                          );
                          toast.success("Floor draft created");
                        }}
                      >
                        <Plus size={14} className="mr-1" />
                        Add floor
                      </Button>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-[11px]">
                        <thead className="border-y border-[#dbe3ed] text-[10px] uppercase tracking-[.1em] text-[#8291a3]">
                          <tr>
                            {[
                              "Order",
                              "GLB node",
                              "Display name",
                              "Short",
                              "Elevation",
                              "Navigable",
                              "Status",
                              "Action",
                            ].map(label => (
                              <th key={label} className="px-3 py-3">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf1f5]">
                          {floors.map(row => (
                            <tr key={row[0]} className="hover:bg-[#fbfcfe]">
                              {row.map((cell, index) => (
                                <td
                                  key={`${row[0]}-${index}`}
                                  className={cn(
                                    "px-3 py-3",
                                    index === 2
                                      ? "font-semibold text-[#17365d]"
                                      : "text-[#53677d]",
                                    index === 6 &&
                                      cell.includes("REVIEW") &&
                                      "text-[#a07100]"
                                  )}
                                >
                                  {cell}
                                </td>
                              ))}
                              <td className="px-3 py-3 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setFloorEditor([...row])}
                                >
                                  Edit
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {buildingTab === "transitions" && (
                  <div className="rounded-xl border border-[#dbe3ed] p-3">
                    <div className="flex items-center justify-between px-2 py-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#718398]">
                          Building configuration
                        </p>
                        <h3 className="font-display text-lg font-bold text-[#17365d]">
                          Transitions
                        </h3>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAssetAction(
                            `Transition draft created · POST ${endpointMap.annotation.transitions}`
                          );
                          toast.success("Transition draft created");
                        }}
                      >
                        <Plus size={14} className="mr-1" />
                        Add transition
                      </Button>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[620px] text-left text-[11px]">
                        <thead className="border-y border-[#dbe3ed] text-[10px] uppercase tracking-[.1em] text-[#8291a3]">
                          <tr>
                            {[
                              "Transition",
                              "From floor",
                              "To floor",
                              "Status",
                              "Action",
                            ].map(label => (
                              <th key={label} className="px-3 py-3">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf1f5]">
                          {transitions.map(row => (
                            <tr key={row[0]} className="hover:bg-[#fbfcfe]">
                              {row.map((cell, index) => (
                                <td
                                  key={`${row[0]}-${index}`}
                                  className={cn(
                                    "px-3 py-3",
                                    index === 0
                                      ? "font-semibold text-[#17365d]"
                                      : "text-[#53677d]",
                                    index === 3 &&
                                      cell.includes("REVIEW") &&
                                      "text-[#a07100]"
                                  )}
                                >
                                  {cell}
                                </td>
                              ))}
                              <td className="px-3 py-3 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setTransitionEditor([...row])}
                                >
                                  Edit
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {buildingTab === "spatial" && (
                  <div className="max-w-xl rounded-xl border border-[#dbe3ed] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#718398]">
                          Building configuration
                        </p>
                        <h3 className="font-display text-lg font-bold text-[#17365d]">
                          Spatial
                        </h3>
                      </div>
                      <Button
                        size="sm"
                        onClick={saveAssetChanges}
                        className="bg-[#17365d] text-white hover:bg-[#102c4d]"
                      >
                        Save changes
                      </Button>
                    </div>
                    <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-[#53677d]">
                        Coordinate system
                        <select className="mt-2 h-10 w-full rounded-lg border border-[#dbe3ed] bg-white px-3 text-sm">
                          <option>FLOWSENSE LOCAL</option>
                          <option>WGS 84</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-[#53677d]">
                        Measurement unit
                        <select className="mt-2 h-10 w-full rounded-lg border border-[#dbe3ed] bg-white px-3 text-sm">
                          <option>METERS</option>
                          <option>FEET</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-[#53677d]">
                        Origin
                        <Input
                          defaultValue="0.00, 0.00"
                          className="mt-2 border-[#dbe3ed]"
                        />
                      </label>
                      <label className="text-xs font-semibold text-[#53677d]">
                        Rotation
                        <Input
                          defaultValue="0° / 0° / 0°"
                          className="mt-2 border-[#dbe3ed]"
                        />
                      </label>
                      <label className="text-xs font-semibold text-[#53677d]">
                        Scale
                        <Input
                          defaultValue="1.000"
                          className="mt-2 border-[#dbe3ed]"
                        />
                      </label>
                    </div>
                  </div>
                )}
                {buildingTab === "defaults" && (
                  <div className="max-w-xl rounded-xl border border-[#dbe3ed] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#718398]">
                          Building configuration
                        </p>
                        <h3 className="font-display text-lg font-bold text-[#17365d]">
                          Defaults
                        </h3>
                      </div>
                      <Button
                        size="sm"
                        onClick={saveAssetChanges}
                        className="bg-[#17365d] text-white hover:bg-[#102c4d]"
                      >
                        Save changes
                      </Button>
                    </div>
                    <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-[#53677d]">
                        Default floor
                        <select className="mt-2 h-10 w-full rounded-lg border border-[#dbe3ed] bg-white px-3 text-sm">
                          <option>GROUND FLOOR</option>
                          <option>FIRST FLOOR</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-[#53677d]">
                        Default map view
                        <select className="mt-2 h-10 w-full rounded-lg border border-[#dbe3ed] bg-white px-3 text-sm">
                          <option>BUILDING OVERVIEW</option>
                          <option>SELECTED FLOOR</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-[#53677d]">
                        Default camera
                        <select className="mt-2 h-10 w-full rounded-lg border border-[#dbe3ed] bg-white px-3 text-sm">
                          <option>NORTH ENTRANCE</option>
                          <option>MAIN KIOSK</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-[#53677d]">
                        Initial kiosk state
                        <select className="mt-2 h-10 w-full rounded-lg border border-[#dbe3ed] bg-white px-3 text-sm">
                          <option>IDLE / ATTRACTION LOOP</option>
                          <option>SEARCH READY</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-[#53677d]">
                        Floor selection
                        <select className="mt-2 h-10 w-full rounded-lg border border-[#dbe3ed] bg-white px-3 text-sm">
                          <option>ENABLED</option>
                          <option>DISABLED</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-[#53677d]">
                        Cross-floor search
                        <select className="mt-2 h-10 w-full rounded-lg border border-[#dbe3ed] bg-white px-3 text-sm">
                          <option>DISABLED</option>
                          <option>ENABLED</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              <aside className="border-l border-[#dbe3ed] bg-[#fbfcfe] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#718398]">
                  Context
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg border border-[#dbe3ed] bg-white">
                    <Box size={18} className="text-[#17365d]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#17365d]">
                      a_building_v14.glb
                    </p>
                    <p className="text-[10px] text-[#8391a3]">
                      CURRENT ASSET · v04
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3 text-[10px]">
                  {[
                    ["File name", "a_building_v14.glb"],
                    ["Version", "v04"],
                    ["Size", "84MB"],
                    ["Format", "GLB"],
                    ["Processing", "COMPLETE"],
                    ["Validation", "2 WARNINGS"],
                    ["Activation", "ACTIVE"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between gap-3 border-b border-[#e8edf3] pb-2"
                    >
                      <span className="uppercase tracking-[.08em] text-[#8291a3]">
                        {label}
                      </span>
                      <strong className="text-right text-[#53677d]">
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAssetAction(
                        `Model opened · GET ${endpointMap.assets.all}/asset-001/versions/1/download`
                      );
                      toast.message("Model preview opened");
                    }}
                  >
                    View model
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAssetAction(
                        `Version history opened · GET ${endpointMap.assets.versions("asset-001")}`
                      );
                      toast.message("Version history opened");
                    }}
                  >
                    View version
                  </Button>
                </div>
              </aside>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_250px]">
              <div className="rounded-xl border border-[#dbe3ed] p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#718398]">
                      {assetTab.toUpperCase()}
                    </p>
                    <h3 className="mt-1 font-display text-xl font-bold text-[#17365d]">
                      {assetTab === "overview"
                        ? "Asset information"
                        : assetTab === "asset"
                          ? "Asset metadata"
                          : assetTab === "model"
                            ? "Model inspection"
                            : "Activity history"}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718398]">
                      {assetTab === "overview"
                        ? "Review validation, processing, and activation before using this building in Map Annotation."
                        : assetTab === "asset"
                          ? "Review the source file, ownership, description, and active version."
                          : assetTab === "model"
                            ? "Inspect the imported GLB structure, meshes, materials, and compatibility warnings."
                            : "Review upload, validation, activation, and restoration events for this asset."}
                    </p>
                  </div>
                  <Badge className="border-[#d5e9dd] bg-[#effaf3] text-[#168051]">
                    Active
                  </Badge>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Validation", "Passed with 2 warnings"],
                    ["Processing", "Complete"],
                    ["Activation", "Active"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-[#f7f9fc] p-4">
                      <p className="text-[10px] uppercase tracking-[.12em] text-[#8a98a9]">
                        {label}
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#17365d]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => openValidation("Validation")}
                  >
                    Review validation
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAssetAction(
                        `Activation requested · POST ${endpointMap.assets.activate("asset-001")}`
                      );
                      toast.success("Asset activation requested");
                    }}
                  >
                    Activate asset
                  </Button>
                </div>
              </div>
              <aside className="rounded-xl border border-[#dbe3ed] bg-[#fbfcfe] p-4">
                <SectionLabel>Context</SectionLabel>
                <p className="text-sm font-bold text-[#17365d]">
                  a_building_v14.glb
                </p>
                <p className="mt-1 text-xs text-[#8391a3]">
                  CURRENT ASSET · v04
                </p>
                <div className="mt-5 border-t border-[#dbe3ed] pt-4 text-xs text-[#53677d]">
                  API boundary:{" "}
                  {isApiConfigured() ? "connected" : "fixture adapter"}
                </div>
              </aside>
            </div>
          )}
        </CardContent>
      </Card>
      {floorEditor && (
        <div className="fixed inset-0 z-[75] bg-[#07182d55]">
          <aside className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto border-l border-[#dbe3ed] bg-white p-5 text-[#17365d] shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#b08412]">
                  Floor configuration
                </p>
                <h2 className="mt-1 font-display text-xl font-bold">
                  Edit {floorEditor[2]}
                </h2>
                <p className="mt-1 text-xs text-[#718398]">
                  Update the floor metadata used by the campus model.
                </p>
              </div>
              <button
                onClick={() => setFloorEditor(null)}
                aria-label="Close floor editor"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              {[
                ["Order", "0"],
                ["GLB node", "1"],
                ["Display name", "2"],
                ["Short name", "3"],
                ["Elevation", "4"],
                ["Navigable", "5"],
                ["Status", "6"],
              ].map(([label, index]) => (
                <label
                  key={label}
                  className="block text-xs font-semibold text-[#53677d]"
                >
                  {label}
                  <Input
                    value={floorEditor[Number(index)]}
                    onChange={e =>
                      setFloorEditor(prev =>
                        prev
                          ? prev.map((value, i) =>
                              i === Number(index) ? e.target.value : value
                            )
                          : prev
                      )
                    }
                    className="mt-2 border-[#dbe3ed]"
                  />
                </label>
              ))}
            </div>
            <div className="mt-7 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setFloorEditor(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#17365d] text-white hover:bg-[#102c4d]"
                onClick={() => {
                  setFloors(prev =>
                    prev.map(row =>
                      row[0] === floorEditor[0] ? floorEditor : row
                    )
                  );
                  setAssetAction(
                    `Floor ${floorEditor[2]} saved · PATCH ${endpointMap.assets.all}/asset-001`
                  );
                  toast.success("Floor changes saved");
                  setFloorEditor(null);
                }}
              >
                Save changes
              </Button>
            </div>
          </aside>
        </div>
      )}
      {transitionEditor && (
        <div className="fixed inset-0 z-[75] bg-[#07182d55]">
          <aside className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto border-l border-[#dbe3ed] bg-white p-5 text-[#17365d] shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#b08412]">
                  Transition configuration
                </p>
                <h2 className="mt-1 font-display text-xl font-bold">
                  Edit {transitionEditor[0]}
                </h2>
                <p className="mt-1 text-xs text-[#718398]">
                  Update the connection between floors and its review status.
                </p>
              </div>
              <button
                onClick={() => setTransitionEditor(null)}
                aria-label="Close transition editor"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              {[
                ["Transition", "0"],
                ["From floor", "1"],
                ["To floor", "2"],
                ["Status", "3"],
              ].map(([label, index]) => (
                <label
                  key={label}
                  className="block text-xs font-semibold text-[#53677d]"
                >
                  {label}
                  <Input
                    value={transitionEditor[Number(index)]}
                    onChange={e =>
                      setTransitionEditor(prev =>
                        prev
                          ? prev.map((value, i) =>
                              i === Number(index) ? e.target.value : value
                            )
                          : prev
                      )
                    }
                    className="mt-2 border-[#dbe3ed]"
                  />
                </label>
              ))}
            </div>
            <div className="mt-7 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setTransitionEditor(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#17365d] text-white hover:bg-[#102c4d]"
                onClick={() => {
                  setTransitions(prev =>
                    prev.map(row =>
                      row[0] === transitionEditor[0] ? transitionEditor : row
                    )
                  );
                  setAssetAction(
                    `Transition ${transitionEditor[0]} saved · PATCH ${endpointMap.annotation.transitions}`
                  );
                  toast.success("Transition changes saved");
                  setTransitionEditor(null);
                }}
              >
                Save changes
              </Button>
            </div>
          </aside>
        </div>
      )}{" "}
      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#07182d99] p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="asset-upload-title"
          onMouseDown={event => {
            if (event.target === event.currentTarget) resetUpload();
          }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#dbe3ed] bg-white text-[#17365d] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#dbe3ed] px-6 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#b08412]">
                  Asset management
                </p>
                <h2 id="asset-upload-title" className="mt-1 font-display text-xl font-bold">
                  Upload a new asset
                </h2>
              </div>
              <button
                type="button"
                onClick={resetUpload}
                aria-label="Close upload dialog"
                className="grid size-9 place-items-center rounded-lg text-[#718398] transition hover:bg-[#f3f6f9] hover:text-[#17365d]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <label
                htmlFor="asset-file"
                className={cn(
                  "flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition",
                  isDraggingFile
                    ? "border-[#f4c542] bg-[#fff9e5]"
                    : "border-[#aebccc] bg-[#fbfcfe] hover:border-[#17365d] hover:bg-[#f7f9fc]"
                )}
                onDragOver={event => {
                  event.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={event => {
                  event.preventDefault();
                  setIsDraggingFile(false);
                  selectAssetFile(event.dataTransfer.files?.[0]);
                }}
              >
                <div className="grid size-12 place-items-center rounded-xl bg-[#edf2f7]">
                  <Upload size={24} className="text-[#17365d]" />
                </div>
                <p className="mt-3 text-sm font-bold">Drop a GLB file here</p>
                <p className="mt-1 text-xs text-[#718398]">
                  or browse from your computer
                </p>
                <p className="mt-4 text-[10px] text-[#8391a3]">
                  Maximum file size 500 MB · GLB only
                </p>
                <input
                  id="asset-file"
                  type="file"
                  accept=".glb,model/gltf-binary"
                  className="sr-only"
                  onChange={event => selectAssetFile(event.target.files?.[0])}
                />
              </label>

              {selectedFile && (
                <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[#d5e9dd] bg-[#effaf3] p-4">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#168051]">
                      {selectedFile.name}
                    </p>
                    <p className="mt-1 text-[11px] text-[#4f7d63]">
                      GLB · {formatFileSize(selectedFile.size)} · Ready for processing
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="shrink-0 text-xs font-semibold text-[#168051] underline underline-offset-2"
                  >
                    Remove
                  </button>
                </div>
              )}

              {processing && (
                <div className="mt-4 rounded-xl border border-[#eadba2] bg-[#fff8df] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-[#946c00]">
                      Processing asset and running validation…
                    </p>
                    <span className="text-[10px] font-bold text-[#946c00]">
                      PROCESSING
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eadfb7]">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-[#f4c542]" />
                  </div>
                </div>
              )}

              <div className="mt-7 flex justify-end gap-2">
                <Button variant="outline" onClick={resetUpload} disabled={processing}>
                  Cancel
                </Button>
                <Button
                  disabled={!selectedFile || processing}
                  className="bg-[#17365d] text-white hover:bg-[#102c4d] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    if (!selectedFile) return;

                    setProcessing(true);
                    setAssetAction(
                      `Validation requested for ${selectedFile.name} · POST ${endpointMap.assets.validation("asset-001")}`
                    );
                    toast.success(
                      isApiConfigured()
                        ? "Asset validation requested from API"
                        : "Asset validation queued in frontend adapter",
                      {
                        description: selectedFile.name,
                      }
                    );
                    window.setTimeout(() => {
                      setProcessing(false);
                      resetUpload();
                    }, 900);
                  }}
                >
                  Begin processing
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
