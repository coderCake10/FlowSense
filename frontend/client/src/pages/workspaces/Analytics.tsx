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

export function Analytics() {
  const [range, setRange] = useState("Last 7 days");
  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Analytics"
        title="See movement, not just numbers"
        description="Use kiosk activity, search resolution, and monitored zone estimates to make the next campus decision with context."
        action={
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter range"
              value={range}
              onChange={e => {
                setRange(e.target.value);
                toast.success(`Analytics range: ${e.target.value}`);
              }}
              className="h-10 rounded-lg border border-[#dbe3ed] bg-white px-3 text-xs font-semibold text-[#17365d]"
            >
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>This semester</option>
            </select>
            <Button
              variant="outline"
              className="border-[#dbe3ed] text-[#17365d]"
              onClick={() => toast.message(`Analytics filtered: ${range}`)}
            >
              <Filter size={15} className="mr-2" />
              Filter range
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Kiosk sessions"
          value="1,248"
          detail="This month"
          icon={Activity}
          accent="navy"
        />
        <MetricCard
          label="Navigation queries"
          value="2,810"
          detail="+18.4% month on month"
          icon={Route}
          accent="gold"
        />
        <MetricCard
          label="Successful searches"
          value="2,346"
          detail="83.5% resolution rate"
          icon={Check}
          accent="green"
        />
        <MetricCard
          label="Failed searches"
          value="464"
          detail="Requires content review"
          icon={AlertTriangle}
          accent="red"
        />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-[#dbe3ed]">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg">
                Search activity
              </CardTitle>
              <p className="text-xs text-[#8391a3]">
                Queries over the last seven days
              </p>
            </div>
            <Badge variant="outline" className="border-[#dbe3ed]">
              Generated · 10:18 AM
            </Badge>
          </CardHeader>
          <CardContent>
            <MiniBar values={[45, 58, 52, 79, 65, 88, 72]} />
            <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aa7b6]">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Top destinations
            </CardTitle>
            <p className="text-xs text-[#8391a3]">Most searched this month</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Guidance Office",
              "Registrar Office",
              "Lecture Hall 201",
              "Student Lounge",
              "Main Entrance",
            ].map((name, i) => (
              <div key={name} className="flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-lg bg-[#edf2f7] text-xs font-bold text-[#17365d]">
                  0{i + 1}
                </span>
                <p className="flex-1 text-sm font-medium text-[#53677d]">
                  {name}
                </p>
                <span className="text-xs font-bold text-[#17365d]">
                  {184 - i * 21}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Failed searches
            </CardTitle>
            <p className="text-xs text-[#8391a3]">
              Queries that need alias or map review
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Student affairs office",
              "Clinic second floor",
              "Room EA-207",
              "Library entrance",
            ].map((name, i) => (
              <div
                key={name}
                className="flex items-center gap-3 rounded-lg bg-[#fff8f7] p-3"
              >
                <AlertTriangle size={15} className="text-[#c4524b]" />
                <span className="flex-1 text-xs font-medium text-[#53677d]">
                  {name}
                </span>
                <span className="text-xs font-bold text-[#b13a36]">
                  {31 - i * 6}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Crowd density by zone
            </CardTitle>
            <p className="text-xs text-[#8391a3]">
              BLE estimates from active sensors
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ["EYA Main Entrance", 86, "High"],
              ["EYA 1F", 55, "Moderate"],
              ["PS Student Lounge", 22, "Low"],
            ].map(([name, value, label]) => (
              <div key={name}>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="font-semibold text-[#53677d]">{name}</span>
                  <span className="text-[#8391a3]">{label}</span>
                </div>
                <div className="h-2 rounded-full bg-[#edf1f6]">
                  <div
                    className="h-full rounded-full bg-[#17365d]"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Most common destination sequences
            </CardTitle>
            <p className="text-xs text-[#8391a3]">
              Frequently combined searches
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-[#f8fafc] uppercase tracking-[.12em] text-[#8291a3]">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Sequence</th>
                    <th className="p-3">Count</th>
                    <th className="p-3">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {[
                    ["Main Entrance → Guidance Office", 118, "24%"],
                    ["Registrar → Lecture Hall 201", 92, "18%"],
                    ["Student Lounge → Library", 64, "12%"],
                    ["Clinic → Main Entrance", 41, "8%"],
                  ].map(([sequence, count, percentage], i) => (
                    <tr key={sequence}>
                      <td className="p-3 font-bold text-[#17365d]">{i + 1}</td>
                      <td className="p-3 font-medium text-[#53677d]">
                        {sequence}
                      </td>
                      <td className="p-3">{count}</td>
                      <td className="p-3">{percentage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">Alert panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["INFO", "Increased kiosk usage 24%", "#168051"],
              ["WARNING", "High failed search rate 8.2%", "#a07100"],
              ["CRITICAL", "Kiosk unavailable 12 min", "#b13a36"],
            ].map(([level, text, color]) => (
              <div
                key={level}
                className="flex gap-3 rounded-xl border border-[#edf1f5] p-3"
              >
                <AlertTriangle size={17} style={{ color }} />
                <div>
                  <p className="text-[10px] font-bold" style={{ color }}>
                    {level}
                  </p>
                  <p className="mt-1 text-xs text-[#53677d]">{text}</p>
                  <p className="mt-1 text-[10px] text-[#9aa7b6]">11:24 AM</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Kiosk usage by hour
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBar
              values={[12, 18, 25, 36, 52, 68, 84, 96, 76, 54, 32, 18]}
              gold
            />
            <div className="mt-3 flex justify-between text-[10px] uppercase tracking-[.12em] text-[#9aa7b6]">
              <span>12 AM</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
              <span>12 AM</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Kiosk availability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                ["Main Entrance Kiosk", "99.8%"],
                ["EYA Kiosk-1", "98.2%"],
                ["PS Kiosk-1", "96.7%"],
              ].map(([location, availability]) => (
                <div
                  key={location}
                  className="flex items-center justify-between border-b border-[#edf1f5] pb-3 text-xs"
                >
                  <span className="font-semibold text-[#53677d]">
                    {location}
                  </span>
                  <span className="font-bold text-[#168051]">
                    {availability}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-5 border-[#dbe3ed]">
        <CardHeader>
          <CardTitle className="font-display text-lg">
            Reports and exports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_180px]">
            <label className="text-xs font-semibold text-[#53677d]">
              Period start
              <Input
                type="date"
                defaultValue="2026-08-08"
                className="mt-2 border-[#dbe3ed]"
              />
            </label>
            <label className="text-xs font-semibold text-[#53677d]">
              Period end
              <Input
                type="date"
                defaultValue="2026-08-10"
                className="mt-2 border-[#dbe3ed]"
              />
            </label>
            <label className="text-xs font-semibold text-[#53677d]">
              Format
              <select className="mt-2 h-10 w-full rounded-lg border border-[#dbe3ed] bg-white px-3 text-sm">
                <option>PDF / CSV</option>
                <option>PDF</option>
                <option>CSV</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-xs text-[#53677d]">
              {["Overview", "Navigation", "Kiosk", "Route", "System"].map(
                label => (
                  <label key={label} className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked /> {label}
                  </label>
                )
              )}
            </div>
            <Button
              className="bg-[#17365d] text-white hover:bg-[#102c4d]"
              onClick={() => toast.success("Report generated")}
            >
              Generate report
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
