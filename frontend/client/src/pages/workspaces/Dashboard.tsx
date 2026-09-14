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

export function Dashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Monday, August 25"
        title="A clear view of campus operations"
        description="Monitor the systems that make AUF wayfinding dependable, from live hardware health to the destinations visitors need most."
        action={
          <Button
            className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            onClick={() => window.location.assign("/map-annotation")}
          >
            <Plus size={16} className="mr-2" />
            New map update
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden border-0 bg-[#0b1f3a] text-white shadow-[0_18px_45px_rgba(11,31,58,0.16)]">
          <CardContent className="relative p-6 sm:p-8">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(120deg, rgba(244,197,66,.18) 1px, transparent 1px), linear-gradient(30deg, rgba(255,255,255,.07) 1px, transparent 1px)",
                backgroundSize: "38px 38px",
              }}
            />
            <div className="relative max-w-xl">
              <Badge className="mb-8 border-[#f4c542]/30 bg-[#f4c542]/12 text-[#f8d96a]">
                SYSTEM HEALTH · OPERATIONAL
              </Badge>
              <h2 className="max-w-lg font-display text-3xl font-bold leading-tight tracking-[-0.05em] sm:text-4xl">
                Every route starts with a reliable signal.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/65">
                Your campus map, devices, and navigation services are being
                monitored in one operational view.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <div className="rounded-xl border border-white/10 bg-white/8 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/45">
                    Kiosks online
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold">
                    4{" "}
                    <span className="text-sm font-normal text-white/45">
                      / 4
                    </span>
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/8 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/45">
                    Sensors online
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold">
                    18{" "}
                    <span className="text-sm font-normal text-white/45">
                      / 21
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#dbe3ed] shadow-[0_10px_30px_rgba(16,44,77,0.04)]">
          <CardHeader>
            <CardTitle className="font-display text-lg tracking-[-0.03em]">
              Current crowd density
            </CardTitle>
            <p className="text-xs text-[#8391a3]">
              Estimated by monitored campus zones
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "EYA Main Entrance", value: 72, label: "High" },
              { name: "EYA 1st Floor", value: 48, label: "Moderate" },
              { name: "PS Student Lounge", value: 21, label: "Low" },
            ].map(item => (
              <div key={item.name}>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="font-medium text-[#40556d]">
                    {item.name}
                  </span>
                  <span
                    className={cn(
                      "font-semibold",
                      item.label === "High"
                        ? "text-[#b13a36]"
                        : item.label === "Moderate"
                          ? "text-[#a07100]"
                          : "text-[#168051]"
                    )}
                  >
                    {item.label}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#edf1f6]">
                  <div
                    className={cn(
                      "h-2 rounded-full",
                      item.label === "High"
                        ? "bg-[#d9655f]"
                        : item.label === "Moderate"
                          ? "bg-[#e1b839]"
                          : "bg-[#41ad7d]"
                    )}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => window.location.assign("/analytics")}
              className="mt-2 w-full border-[#dbe3ed] text-[#17365d]"
            >
              Open analytics <ArrowUpRight size={15} className="ml-auto" />
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Kiosk sessions"
          value="184"
          detail="+12% compared with last Monday"
          icon={Signal}
          accent="gold"
        />
        <MetricCard
          label="Navigation queries"
          value="327"
          detail="82% resolved successfully"
          icon={Route}
          accent="navy"
        />
        <MetricCard
          label="Successful searches"
          value="269"
          detail="Search resolution is trending up"
          icon={Check}
          accent="green"
        />
        <MetricCard
          label="Average session"
          value="04:18"
          detail="Across active kiosk sessions"
          icon={Gauge}
          accent="navy"
        />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-[#dbe3ed]">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display text-lg">
                Kiosk activity over time
              </CardTitle>
              <p className="mt-1 text-xs text-[#8391a3]">
                Sessions created by day
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-[#dbe3ed] text-[#64758a]"
            >
              Last 7 days
            </Badge>
          </CardHeader>
          <CardContent>
            <MiniBar values={[42, 65, 51, 76, 88, 64, 96]} gold />
            <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aa7b6]">
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
              <span>Mon</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Actionable events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#fff3bd] text-[#946c00]">
                <AlertTriangle size={15} />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  Sensor-3 has been offline
                </p>
                <p className="mt-1 text-xs text-[#8391a3]">
                  Since 01:29 AM · Hardware Management
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e3effb] text-[#275784]">
                <Activity size={15} />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  New map version published
                </p>
                <p className="mt-1 text-xs text-[#8391a3]">
                  EYA Building v1.4 · 10:18 AM
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-between px-0 text-xs text-[#b08412] hover:bg-transparent hover:text-[#8a6500]"
            >
              View all activity <ChevronRight size={14} />
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
