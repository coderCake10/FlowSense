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

export function SettingsPage() {
  const [alertAfter, setAlertAfter] = useState("24 Hours");
  const [academicYear, setAcademicYear] = useState("2026–2027");
  const [startDate, setStartDate] = useState("20/07/2026");
  const [endDate, setEndDate] = useState("04/20/2027");
  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Settings"
        title="Settings"
        description="Configure alerts, academic periods, and system-wide behavior."
      />
      <div className="space-y-4">
        <Card className="border-2 border-[#17365d] rounded-none">
          <CardHeader className="border-b border-[#17365d]">
            <CardTitle className="font-display text-xl">♟ Alerts</CardTitle>
            <p className="text-xs text-[#718398]">
              Informational alert clear time
            </p>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[1fr_220px]">
            <div>
              <p className="text-sm font-bold text-[#17365d]">
                Automatic clear after
              </p>
              <p className="mt-1 text-xs text-[#718398]">
                Applies to informational alerts only. Critical and warning
                alerts remain until resolved.
              </p>
              <div className="mt-4 border border-[#17365d] bg-[#f3f5f8] p-3 text-xs">
                <p className="font-bold">Current policy</p>
                <p className="mt-1 text-[#718398]">
                  Informational alerts are automatically cleared after{" "}
                  {alertAfter.toLowerCase()}.
                </p>
              </div>
            </div>
            <select
              value={alertAfter}
              onChange={e => setAlertAfter(e.target.value)}
              className="h-11 border border-[#17365d] bg-white px-3 text-sm font-bold"
            >
              <option>24 Hours</option>
              <option>12 Hours</option>
              <option>Never</option>
            </select>
          </CardContent>
        </Card>
        <Card className="border-2 border-[#17365d] rounded-none">
          <CardHeader className="border-b border-[#17365d]">
            <CardTitle className="font-display text-xl">
              ▣ Semester registry
            </CardTitle>
            <p className="text-xs text-[#718398]">
              Define academic year date ranges used by reporting and other
              time-based system functions.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-sm font-bold text-[#17365d]">
                Academic Year
                <select
                  value={academicYear}
                  onChange={e => setAcademicYear(e.target.value)}
                  className="mt-2 h-10 w-full border border-[#17365d] bg-white px-3 text-sm font-normal"
                >
                  <option>2026–2027</option>
                  <option>2027–2028</option>
                </select>
              </label>
              <label className="text-sm font-bold text-[#17365d]">
                Start Year
                <Input
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="mt-2 border-[#17365d] font-normal"
                />
              </label>
              <label className="text-sm font-bold text-[#17365d]">
                End Date
                <Input
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="mt-2 border-[#17365d] font-normal"
                />
              </label>
            </div>
            <div className="mt-5 flex items-center justify-between border border-[#17365d] bg-[#f3f5f8] p-3 text-xs">
              <span>
                <strong>REGISTERED RANGE</strong>
                <br />
                {startDate} – {endDate}
              </span>
              <strong>Active Semester</strong>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => toast.message("Changes reset")}
              >
                Reset Changes
              </Button>
              <Button
                className="bg-[#17365d] text-white hover:bg-[#102c4d]"
                onClick={() => toast.success("Settings saved")}
              >
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
