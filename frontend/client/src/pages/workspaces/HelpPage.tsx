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

export function HelpPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Help"
        title="FlowSense operations manual"
        description="Find the guidance needed to annotate maps, manage devices, and keep campus wayfinding dependable."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">Quick guides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Annotate a floor and validate route connections",
              "Register an ESP32 sensor or kiosk",
              "Review alerts and hardware health",
              "Publish a verified building asset",
            ].map((item, i) => (
              <button
                key={item}
                className="flex w-full items-center justify-between rounded-xl border border-[#e5ebf2] p-4 text-left text-sm font-semibold text-[#17365d] hover:bg-[#fffaf0]"
              >
                <span>
                  {i + 1}. {item}
                </span>
                <ChevronRight size={16} className="text-[#b08412]" />
              </button>
            ))}
          </CardContent>
        </Card>
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Need technical help?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-[#718398]">
              Use the system manual for administrator procedures, MQTT device
              topics, sensor placement, and troubleshooting guidance.
            </p>
            <Button
              className="mt-5 bg-[#17365d] text-white hover:bg-[#102c4d]"
              onClick={() =>
                toast.message("Manual download", {
                  description:
                    "The PDF manual will be available after deployment.",
                })
              }
            >
              Open PDF manual
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
