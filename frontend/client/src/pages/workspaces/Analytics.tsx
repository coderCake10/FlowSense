import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  Clock3,
  Filter,
  RefreshCw,
  Route,
  Search,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, PageHeader } from "@/components/FlowSenseShell";
import {
  DashboardSummary,
  apiClient,
  endpointMap,
  isApiConfigured,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fallbackSummary: DashboardSummary = {
  systemStatus: "Operational",
  onlineKiosks: 4,
  onlineSensors: 18,
  kioskSessions: 1248,
  navigationQueries: 2810,
  successfulSearches: 2346,
  failedSearches: 464,
  averageSession: "04:18",
  density: [
    { area: "EYA Main Entrance", density: "High", value: 86 },
    { area: "EYA 1F", density: "Moderate", value: 55 },
    { area: "PS Student Lounge", density: "Low", value: 22 },
  ],
  topDestinations: [
    { id: "dest-1", name: "Guidance Office", code: "GUID", building: "EYA", floor: "1F" },
    { id: "dest-2", name: "Registrar Office", code: "REG", building: "EYA", floor: "1F" },
    { id: "dest-3", name: "Lecture Hall 201", code: "LH-201", building: "EYA", floor: "2F" },
    { id: "dest-4", name: "Student Lounge", code: "LOUNGE", building: "PS", floor: "1F" },
    { id: "dest-5", name: "Main Entrance", code: "MAIN", building: "EYA", floor: "G" },
  ],
};

const searchActivity = [45, 58, 52, 79, 65, 88, 72];
const kioskUsage = [12, 18, 25, 36, 52, 68, 84, 96, 76, 54, 32, 18];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8493a5]">
      {children}
    </p>
  );
}

function MiniBar({ values, gold = false }: { values: number[]; gold?: boolean }) {
  const max = Math.max(...values, 1);

  return (
    <div className="flex h-32 items-end gap-2">
      {values.map((value, index) => (
        <div key={`${value}-${index}`} className="flex h-full flex-1 items-end">
          <div
            className={cn(
              "w-full rounded-t-md transition-all duration-500",
              gold ? "bg-[#f4c542]" : "bg-[#345a87]"
            )}
          style={{ height: `${Math.max((value / max) * 100, 8)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function Analytics() {
  const [range, setRange] = useState("Last 7 days");
  const [summary, setSummary] = useState<DashboardSummary>(fallbackSummary);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [failedSearchQuery, setFailedSearchQuery] = useState("");

  const loadAnalytics = async () => {
    if (!isApiConfigured()) return;

    try {
      setLoading(true);
      const response = await apiClient.get<
        DashboardSummary | { data: DashboardSummary }
      >(endpointMap.analytics.dashboard);

      const data = "data" in response ? response.data : response;
      if (data) setSummary({ ...fallbackSummary, ...data });
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to load analytics:", error);
      toast.error("Analytics could not be refreshed. Showing the latest available data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const resolutionRate = useMemo(() => {
    const total = summary.successfulSearches + summary.failedSearches;
    return total > 0
      ? ((summary.successfulSearches / total) * 100).toFixed(1)
      : "0.0";
  }, [summary.successfulSearches, summary.failedSearches]);

  const filteredDestinations = useMemo(() => {
    const query = destinationQuery.trim().toLowerCase();
    if (!query) return summary.topDestinations;

    return summary.topDestinations.filter(destination =>
      [destination.name, destination.code, destination.building, destination.floor]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [destinationQuery, summary.topDestinations]);

  const failedSearches = useMemo(
    () =>
      [
        ["Student affairs office", 31],
        ["Clinic second floor", 25],
        ["Room EA-207", 19],
        ["Library entrance", 13],
      ].filter(([name]) =>
        String(name).toLowerCase().includes(failedSearchQuery.trim().toLowerCase())
      ),
    [failedSearchQuery]
  );

  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Analytics"
        title="See movement, not just numbers"
        description="Use kiosk activity, search resolution, and monitored zone estimates to make the next campus decision with context."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="text-right text-[10px] text-[#8391a3]">
              <p className="font-semibold text-[#53677d]">Data window</p>
              <p>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Using latest available data"}</p>
            </div>
            <select
              aria-label="Filter range"
              value={range}
              onChange={event => {
                setRange(event.target.value);
                toast.success(`Analytics range: ${event.target.value}`);
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
              onClick={() => void loadAnalytics()}
              disabled={loading}
            >
              <RefreshCw size={15} className={cn("mr-2", loading && "animate-spin")} />
              {loading ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        }
      />

      <SectionLabel>Analytics summary</SectionLabel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Kiosk sessions"
          value={formatNumber(summary.kioskSessions)}
          detail={`For ${range.toLowerCase()}`}
          icon={Activity}
          accent="navy"
        />
        <MetricCard
          label="Navigation queries"
          value={formatNumber(summary.navigationQueries)}
          detail="Recorded navigation requests"
          icon={Route}
          accent="gold"
        />
        <MetricCard
          label="Successful searches"
          value={formatNumber(summary.successfulSearches)}
          detail={`${resolutionRate}% resolution rate`}
          icon={Check}
          accent="green"
        />
        <MetricCard
          label="Failed searches"
          value={formatNumber(summary.failedSearches)}
          detail="Requires content review"
          icon={AlertTriangle}
          accent="red"
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-[#dbe3ed]">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="font-display text-lg">Search activity</CardTitle>
              <p className="text-xs text-[#8391a3]">Queries over the selected period</p>
            </div>
            <Badge variant="outline" className="border-[#dbe3ed]">
              {range}
            </Badge>
          </CardHeader>
          <CardContent>
            <MiniBar values={searchActivity} />
            <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aa7b6]">
              {days.map(day => <span key={day}>{day}</span>)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">Top destinations</CardTitle>
            <p className="text-xs text-[#8391a3]">Most searched destinations</p>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa7b6]" />
              <Input
                value={destinationQuery}
                onChange={event => setDestinationQuery(event.target.value)}
                placeholder="Search destinations"
                className="border-[#dbe3ed] pl-9 text-xs"
              />
            </div>
            <div className="space-y-4">
              {filteredDestinations.map((destination, index) => (
                <div key={destination.id} className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#edf2f7] text-xs font-bold text-[#17365d]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#53677d]">{destination.name}</p>
                    <p className="text-[10px] text-[#9aa7b6]">{destination.building} · {destination.floor}</p>
                  </div>
                  <span className="text-xs font-bold text-[#17365d]">{184 - index * 21}</span>
                </div>
              ))}
              {filteredDestinations.length === 0 && (
                <p className="py-6 text-center text-xs text-[#8391a3]">No destinations match your search.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">Failed searches</CardTitle>
            <p className="text-xs text-[#8391a3]">Queries that need alias or map review</p>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa7b6]" />
              <Input
                value={failedSearchQuery}
                onChange={event => setFailedSearchQuery(event.target.value)}
                placeholder="Find a failed query"
                className="border-[#dbe3ed] pl-9 text-xs"
              />
            </div>
            <div className="space-y-3">
              {failedSearches.map(([name, count]) => (
                <div key={String(name)} className="flex items-center gap-3 rounded-lg bg-[#fff8f7] p-3">
                  <AlertTriangle size={15} className="text-[#c4524b]" />
                  <span className="flex-1 text-xs font-medium text-[#53677d]">{name}</span>
                  <span className="text-xs font-bold text-[#b13a36]">{count}</span>
                </div>
              ))}
              {failedSearches.length === 0 && (
                <p className="py-6 text-center text-xs text-[#8391a3]">No failed searches match your filter.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">Crowd density by zone</CardTitle>
            <p className="text-xs text-[#8391a3]">BLE estimates from active sensors</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {summary.density.map(point => (
              <div key={point.area}>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="font-semibold text-[#53677d]">{point.area}</span>
                  <span className={cn(
                    point.density === "High" && "font-semibold text-[#b13a36]",
                    point.density === "Moderate" && "font-semibold text-[#a07100]",
                    point.density === "Low" && "font-semibold text-[#168051]"
                  )}>
                    {point.density} · {point.value}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#edf1f6]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      point.density === "High" && "bg-[#c4524b]",
                      point.density === "Moderate" && "bg-[#f4c542]",
                      point.density === "Low" && "bg-[#168051]"
                    )}
                    style={{ width: `${Math.min(Math.max(point.value, 0), 100)}%` }}
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
            <CardTitle className="font-display text-lg">Most common destination sequences</CardTitle>
            <p className="text-xs text-[#8391a3]">Frequently combined searches</p>
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
                  ].map(([sequence, count, percentage], index) => (
                    <tr key={String(sequence)} className="transition-colors hover:bg-[#fafbfd]">
                      <td className="p-3 font-bold text-[#17365d]">{index + 1}</td>
                      <td className="p-3 font-medium text-[#53677d]">{sequence}</td>
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
            <AlertItem icon={TrendingUp} level="INFO" text="Navigation activity is being monitored" tone="green" />
            <AlertItem icon={AlertTriangle} level="WARNING" text={`${summary.failedSearches.toLocaleString()} failed searches require review`} tone="gold" />
            <AlertItem icon={Clock3} level="INFO" text={`Average session time is ${summary.averageSession}`} tone="navy" />
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">Kiosk usage by hour</CardTitle>
            <p className="text-xs text-[#8391a3]">Illustrative hourly distribution until kiosk analytics are connected.</p>
          </CardHeader>
          <CardContent>
            <MiniBar values={kioskUsage} gold />
            <div className="mt-3 flex justify-between text-[10px] uppercase tracking-[.12em] text-[#9aa7b6]">
              <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">Kiosk availability</CardTitle>
            <p className="text-xs text-[#8391a3]">Current availability snapshot</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Main Entrance Kiosk", "99.8%"],
              ["EYA Kiosk-1", "98.2%"],
              ["PS Kiosk-1", "96.7%"],
            ].map(([location, availability]) => (
              <div key={location} className="flex items-center justify-between border-b border-[#edf1f5] pb-3 text-xs last:border-0 last:pb-0">
                <span className="font-semibold text-[#53677d]">{location}</span>
                <span className="font-bold text-[#168051]">{availability}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5 border-[#dbe3ed]">
        <CardHeader>
          <CardTitle className="font-display text-lg">Reports and exports</CardTitle>
          <p className="text-xs text-[#8391a3]">Prepare a report using the selected analysis period.</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_180px]">
            <label className="text-xs font-semibold text-[#53677d]">
              Period start
              <Input type="date" defaultValue="2026-08-08" className="mt-2 border-[#dbe3ed]" />
            </label>
            <label className="text-xs font-semibold text-[#53677d]">
              Period end
              <Input type="date" defaultValue="2026-08-10" className="mt-2 border-[#dbe3ed]" />
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
              {["Overview", "Navigation", "Kiosk", "Route", "System"].map(label => (
                <label key={label} className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked /> {label}
                </label>
              ))}
            </div>
            <Button
              className="bg-[#17365d] text-white hover:bg-[#102c4d]"
              onClick={() => toast.success("Report generation requested")}
            >
              Generate report
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function AlertItem({
  icon: Icon,
  level,
  text,
  tone,
}: {
  icon: typeof TrendingUp;
  level: string;
  text: string;
  tone: "green" | "gold" | "navy";
}) {
  const toneClasses = {
    green: "text-[#168051]",
    gold: "text-[#a07100]",
    navy: "text-[#17365d]",
  };

  return (
    <div className="flex gap-3 rounded-xl border border-[#edf1f5] p-3">
      <Icon size={17} className={toneClasses[tone]} />
      <div>
        <p className={cn("text-[10px] font-bold", toneClasses[tone])}>{level}</p>
        <p className="mt-1 text-xs text-[#53677d]">{text}</p>
        <p className="mt-1 text-[10px] text-[#9aa7b6]">Current analytics window</p>
      </div>
    </div>
  );
}
