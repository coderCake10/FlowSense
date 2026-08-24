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

export function HardwareManagement() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Device | null>(null);
  const [registering, setRegistering] = useState<Device | null>(null);
  const filtered = useMemo(
    () =>
      devices.filter(d =>
        `${d.name} ${d.id} ${d.mac}`.toLowerCase().includes(query.toLowerCase())
      ),
    [query]
  );
  const statusTone = (status: DeviceStatus) =>
    status === "Online"
      ? "green"
      : status === "Offline"
        ? "amber"
        : status === "Disabled" || status === "Decommissioned"
          ? "red"
          : "gold";
  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Hardware management"
        title="Hardware registry"
        description="Keep every kiosk and sensor accounted for, assigned, and ready to contribute to campus wayfinding."
        action={
          <Button
            className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            onClick={() =>
              toast.success("Device discovery started", {
                description:
                  "Scanning for registered kiosks and ESP32 sensors.",
              })
            }
          >
            <Cpu size={16} className="mr-2" />
            Discover devices
          </Button>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Total devices"
          value="24"
          detail="18 sensors · 6 kiosks"
          icon={Cpu}
          accent="navy"
        />
        <MetricCard
          label="Online now"
          value="21"
          detail="87.5% fleet availability"
          icon={Wifi}
          accent="green"
        />
        <MetricCard
          label="Needs attention"
          value="3"
          detail="1 unregistered · 2 offline"
          icon={Wrench}
          accent="amber"
        />
      </div>
      <Card className="border-[#dbe3ed] shadow-[0_10px_30px_rgba(16,44,77,0.04)]">
        <CardHeader className="border-b border-[#e7edf3] pb-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="font-display text-lg">
                Device registry
              </CardTitle>
              <p className="mt-1 text-xs text-[#8391a3]">
                Select a row to inspect device details and connection history.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#93a1b1]"
                size={16}
              />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name, ID, MAC"
                className="border-[#dbe3ed] pl-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-[0.14em] text-[#8291a3]">
              <tr>
                <th className="px-5 py-3 font-bold">Name</th>
                <th className="px-5 py-3 font-bold">Type</th>
                <th className="px-5 py-3 font-bold">Location</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold">Last ping</th>
                <th className="px-5 py-3 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {filtered.map(device => (
                <tr
                  key={device.id}
                  className={cn(
                    "transition hover:bg-[#fbfcfe]",
                    selected?.id === device.id && "bg-[#fffaf0]"
                  )}
                  onClick={() => setSelected(device)}
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-[#17365d]">
                      {device.name}
                    </p>
                    <p className="mt-1 text-[11px] text-[#9aa7b5]">
                      {device.id}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-2 text-xs text-[#53677d]">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          device.type === "Sensor"
                            ? "bg-[#5d86af]"
                            : "bg-[#f4c542]"
                        )}
                      />
                      {device.type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-[#60748a]">
                    {device.location}
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill
                      status={device.status}
                      tone={statusTone(device.status)}
                    />
                  </td>
                  <td className="px-5 py-4 text-xs text-[#8291a3]">
                    {device.lastPing}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button
                      size="sm"
                      variant={
                        device.status === "Unregistered" ? "default" : "outline"
                      }
                      className={
                        device.status === "Unregistered"
                          ? "bg-[#f4c542] text-[#17365d] hover:bg-[#e8ba2d]"
                          : "border-[#dbe3ed] text-[#17365d]"
                      }
                      onClick={e => {
                        e.stopPropagation();
                        device.status === "Unregistered"
                          ? setRegistering(device)
                          : setSelected(device);
                      }}
                    >
                      {device.status === "Unregistered" ? "Register" : "Manage"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {selected && (
        <Card className="mt-5 border-[#d6e0eb] bg-[#f4f8fc]">
          <CardHeader className="flex-row items-start justify-between border-b border-[#dbe3ed]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#b08412]">
                Device detail
              </p>
              <CardTitle className="mt-1 font-display text-xl">
                {selected.name}
              </CardTitle>
              <p className="mt-1 text-xs text-[#718398]">
                {selected.id} · {selected.mac}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill
                status={selected.status}
                tone={statusTone(selected.status) as any}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelected(null)}
              >
                <X size={16} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Device type", selected.type],
                ["Assigned location", selected.location],
                ["Last ping", selected.lastPing],
                ["Connection", "MQTT · TLS"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-[#dbe3ed] bg-white p-3"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a98a9]">
                    {label}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#17365d]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
              <div className="rounded-xl border border-[#dbe3ed] bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a98a9]">
                  Hardware
                </p>
                <div className="mt-3 space-y-2 text-xs text-[#53677d]">
                  <p className="flex justify-between">
                    <span>Model</span>
                    <strong>ESP32-WROOM-32</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>Firmware</span>
                    <strong>v1.8.4</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>Signal</span>
                    <strong className="text-[#168051]">-58 dBm</strong>
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-[#dbe3ed] bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a98a9]">
                  Assignment and software
                </p>
                <div className="mt-3 space-y-2 text-xs text-[#53677d]">
                  <p className="flex justify-between">
                    <span>Map node</span>
                    <strong>node-ea-101</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>MQTT topic</span>
                    <strong>flowsense/{selected.type.toLowerCase()}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>Registered</span>
                    <strong>Aug 20, 2026</strong>
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-[#dbe3ed] bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a98a9]">
                  Actions
                </p>
                <div className="mt-3 grid gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.message("Device detail refreshed")}
                  >
                    Refresh status
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.message("Configuration panel ready")}
                  >
                    Edit configuration
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[#b13a36]"
                    onClick={() => toast.message("Decommission flow ready")}
                  >
                    Decommission
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {registering && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#07182dcc] p-5">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b08412]">
                  Device registration
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">
                  Register {registering.name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#718398]">
                  Add this discovered device to the managed FlowSense fleet
                  before assigning it to a map node.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRegistering(null)}
              >
                <X size={18} />
              </Button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-semibold text-[#40556d]">
                Device name
                <Input
                  defaultValue={registering.name}
                  className="mt-2 border-[#dbe3ed]"
                />
              </label>
              <label className="block text-xs font-semibold text-[#40556d]">
                Assign location
                <Input
                  defaultValue={registering.location}
                  className="mt-2 border-[#dbe3ed]"
                />
              </label>
              <label className="block text-xs font-semibold text-[#40556d]">
                Map node reference
                <Input
                  placeholder="Select a node after registration"
                  className="mt-2 border-[#dbe3ed]"
                />
              </label>
            </div>
            <div className="mt-7 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRegistering(null)}>
                Cancel
              </Button>
              <Button
                className="bg-[#17365d] text-white hover:bg-[#102c4d]"
                onClick={() => setRegistering(null)}
              >
                <Check size={15} className="mr-2" />
                Register device
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
