/* FlowSense dashboard: operational overview with live API data and safe fallback fixtures. */
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Gauge,
  Plus,
  Route,
  SearchX,
  ServerCog,
  Signal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  DashboardSummary,
  apiClient,
  endpointMap,
  isApiConfigured,
} from "@/lib/api";
import {
  MetricCard,
  PageHeader,
  StatusPill,
} from "@/components/FlowSenseShell";
import { cn } from "@/lib/utils";

type DashboardEnvelope = {
  success?: boolean;
  data?: DashboardSummary | null;
  message?: string | null;
};

type ActivityEvent = {
  id: string | number;
  title: string;
  description?: string | null;
  createdAt: string;
  tone?: "warning" | "info" | "success";
};

const fallbackSummary: DashboardSummary = {
  systemStatus: "Operational",
  onlineKiosks: 4,
  totalKiosks: 4,
  onlineSensors: 18,
  totalSensors: 21,
  kioskSessions: 184,
  navigationQueries: 327,
  successfulSearches: 269,
  failedSearches: 58,
  averageSession: "04:18",
  density: [
    { area: "EYA Main Entrance", value: 72, density: "High" },
    { area: "EYA 1st Floor", value: 48, density: "Moderate" },
    { area: "PS Student Lounge", value: 21, density: "Low" },
  ],
  topDestinations: [],
};

const fallbackActivity: ActivityEvent[] = [
  {
    id: "fallback-1",
    title: "Sensor-3 has been offline",
    description: "Since 01:29 AM · Hardware Management",
    createdAt: "01:29 AM",
    tone: "warning",
  },
  {
    id: "fallback-2",
    title: "New map version published",
    description: "EYA Building v1.4 · Map Annotation",
    createdAt: "10:18 AM",
    tone: "info",
  },
  {
    id: "fallback-3",
    title: "Navigation service operating normally",
    description: "Route requests are being processed normally.",
    createdAt: "10:12 AM",
    tone: "success",
  },
];

const fallbackActivityValues = [42, 65, 51, 76, 88, 64, 96];
const fallbackActivityLabels = ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8493a5]">
      {children}
    </p>
  );
}

function MiniBar({ values }: { values: number[] }) {
  const safeValues = values.length ? values : [0];
  const max = Math.max(...safeValues, 1);

  return (
    <div className="flex h-28 items-end gap-2">
      {safeValues.map((value, index) => (
        <div
          key={`${value}-${index}`}
          className="flex h-full flex-1 items-end rounded-t-md bg-[#edf1f6]"
        >
          <div
            className="w-full rounded-t-md bg-[#f4c542] transition-[height] duration-500"
            style={{ height: `${Math.max((value / max) * 100, 8)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function CurrentDateTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#dbe3ed] bg-white px-3 py-2 shadow-sm">
      <Clock3 size={16} className="text-[#b08412]" />
      <div className="text-right">
        <p className="text-xs font-semibold text-[#17365d]">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <p className="mt-0.5 text-[11px] text-[#8391a3]">
          {now.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function densityTone(density: string) {
  if (density === "High") {
    return {
      text: "text-[#b13a36]",
      bar: "bg-[#d9655f]",
    };
  }

  if (density === "Moderate") {
    return {
      text: "text-[#a07100]",
      bar: "bg-[#e1b839]",
    };
  }

  return {
    text: "text-[#168051]",
    bar: "bg-[#41ad7d]",
  };
}

function systemStatusTone(status: DashboardSummary["systemStatus"]): "green" | "amber" | "red" | "navy" {
  if (status === "Operational") return "green";
  if (status === "Degraded") return "amber";
  if (status === "Critical") return "red";
  return "navy";
}

function activityIcon(tone: ActivityEvent["tone"]) {
  if (tone === "warning") return AlertTriangle;
  if (tone === "success") return Check;
  return Activity;
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type KioskActivityPoint = {
  label: string;
  value: number;
};

function normalizeKioskActivity(payload: unknown): KioskActivityPoint[] {
  const data =
    typeof payload === "object" && payload !== null && "data" in payload
      ? (payload as { data?: unknown }).data
      : payload;

  const rows =
    Array.isArray(data)
      ? data
      : typeof data === "object" && data !== null
        ? ((data as { daily?: unknown; results?: unknown }).daily ??
            (data as { results?: unknown }).results)
        : undefined;

  if (!Array.isArray(rows)) return [];

  return rows
    .map((item, index) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const rawValue =
        row.sessions ?? row.count ?? row.value ?? row.total ?? 0;
      const value = Number(rawValue);
      const rawLabel = row.date ?? row.day ?? row.label ?? `Day ${index + 1}`;

      if (!Number.isFinite(value)) return null;

      const date = new Date(String(rawLabel));
      const label = Number.isNaN(date.getTime())
        ? String(rawLabel)
        : date.toLocaleDateString("en-US", { weekday: "short" });

      return { label, value };
    })
    .filter((point): point is KioskActivityPoint => point !== null)
    .slice(-7);
}

function normalizeActivity(payload: unknown): ActivityEvent[] {
  const data =
    typeof payload === "object" && payload !== null && "data" in payload
      ? (payload as { data?: unknown }).data
      : payload;

  if (!Array.isArray(data)) return [];

  return data.slice(0, 6).map((item, index) => {
    const event = (item ?? {}) as Record<string, unknown>;
    const description =
      typeof event.description === "string" ? event.description : null;
    const createdAt =
      typeof event.created_at === "string"
        ? event.created_at
        : typeof event.createdAt === "string"
          ? event.createdAt
          : "Recent";

    return {
      id:
        typeof event.id === "string" || typeof event.id === "number"
          ? event.id
          : `activity-${index}`,
      title:
        typeof event.description === "string"
          ? event.description
          : typeof event.action === "string"
            ? event.action
            : "System activity recorded",
      description:
        description && description !== event.description
          ? description
          : typeof event.entity_type === "string"
            ? event.entity_type
            : null,
      createdAt,
      tone: "info",
    };
  });
}

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary>(fallbackSummary);
  const [activity, setActivity] = useState<ActivityEvent[]>(fallbackActivity);
  const [kioskActivity, setKioskActivity] = useState<KioskActivityPoint[]>(
    fallbackActivityLabels.map((label, index) => ({
      label,
      value: fallbackActivityValues[index],
    }))
  );
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (!isApiConfigured()) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setApiError(false);

        const [dashboardResult, activityResult, kioskActivityResult] =
          await Promise.allSettled([
            apiClient.get<DashboardEnvelope>(endpointMap.analytics.dashboard),
            apiClient.get<unknown>(endpointMap.activity.all),
            apiClient.get<unknown>(endpointMap.analytics.kiosks),
          ]);

        if (cancelled) return;

        if (dashboardResult.status === "fulfilled" && dashboardResult.value.data) {
          setSummary(current => ({
            ...current,
            ...dashboardResult.value.data,
            density:
              dashboardResult.value.data.density?.length
                ? dashboardResult.value.data.density
                : current.density,
          }));
        }

        if (activityResult.status === "fulfilled") {
          const liveActivity = normalizeActivity(activityResult.value);
          if (liveActivity.length) setActivity(liveActivity);
        }

        if (kioskActivityResult.status === "fulfilled") {
          const liveKioskActivity = normalizeKioskActivity(
            kioskActivityResult.value
          );
          if (liveKioskActivity.length) setKioskActivity(liveKioskActivity);
        }

        if (
          dashboardResult.status === "rejected" ||
          activityResult.status === "rejected" ||
          kioskActivityResult.status === "rejected"
        ) {
          setApiError(true);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load dashboard data:", error);
          setApiError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const activityValues = kioskActivity.map(point => point.value);
  const activityLabels = kioskActivity.map(point => point.label);

  const kioskTotal = summary.totalKiosks ?? null;
  const sensorTotal = summary.totalSensors ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard"
        title="A clear view of campus operations"
        description="Monitor the systems that make AUF wayfinding dependable, from live hardware health to the destinations visitors need most."
        action={
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <CurrentDateTime />
            <Button
              className="bg-[#17365d] text-white hover:bg-[#102c4d]"
              onClick={() => window.location.assign("/map-annotation")}
            >
              <Plus size={16} className="mr-2" />
              New map update
            </Button>
          </div>
        }
      />

      {apiError && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#f0d6d4] bg-[#fff8f7] px-4 py-3 text-xs text-[#8d3935]">
          <AlertTriangle size={15} />
          Live dashboard data is temporarily unavailable. Showing the latest
          available dashboard values.
        </div>
      )}

      {/* System Health */}
      <section aria-labelledby="system-health-heading">
        <SectionLabel>System Health</SectionLabel>
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

            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <Badge className="border-[#f4c542]/30 bg-[#f4c542]/12 text-[#f8d96a]">
                    SYSTEM HEALTH
                  </Badge>
                  <StatusPill
                    status={summary.systemStatus}
                    tone={systemStatusTone(summary.systemStatus)}
                  />
                </div>

                <h2
                  id="system-health-heading"
                  className="max-w-lg font-display text-3xl font-bold leading-tight tracking-[-0.05em] sm:text-4xl"
                >
                  Every route starts with a reliable signal.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/65">
                  Your campus map, devices, and navigation services are being
                  monitored in one operational view.
                </p>
              </div>

              <div className="grid shrink-0 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/8 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/45">
                    Kiosks online
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold">
                    {loading ? "—" : summary.onlineKiosks}
                    {kioskTotal !== null && (
                      <span className="text-sm font-normal text-white/45">
                        {` / ${kioskTotal}`}
                      </span>
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/8 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/45">
                    Sensors online
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold">
                    {loading ? "—" : summary.onlineSensors}
                    {sensorTotal !== null && (
                      <span className="text-sm font-normal text-white/45">
                        {` / ${sensorTotal}`}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* System Summary */}
      <section className="mt-6" aria-labelledby="system-summary-heading">
        <SectionLabel>System Summary</SectionLabel>
        <h2 id="system-summary-heading" className="sr-only">
          System Summary
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Kiosk sessions"
            value={loading ? "—" : summary.kioskSessions}
            detail="Sessions created by visitors"
            icon={Signal}
            accent="gold"
          />
          <MetricCard
            label="Navigation queries"
            value={loading ? "—" : summary.navigationQueries}
            detail="Route requests received"
            icon={Route}
            accent="navy"
          />
          <MetricCard
            label="Successful searches"
            value={loading ? "—" : summary.successfulSearches}
            detail="Searches resolved to a destination"
            icon={Check}
            accent="green"
          />
          <MetricCard
            label="Failed searches"
            value={loading ? "—" : summary.failedSearches}
            detail="Queries requiring content or map review"
            icon={SearchX}
            accent="red"
          />
        </div>
      </section>

      {/* Operations */}
      <section className="mt-6" aria-labelledby="operations-heading">
        <SectionLabel>Operations</SectionLabel>
        <Card className="border-[#dbe3ed] shadow-[0_10px_30px_rgba(16,44,77,0.04)]">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle
                  id="operations-heading"
                  className="font-display text-lg tracking-[-0.03em]"
                >
                  Operational overview
                </CardTitle>
                <p className="mt-1 text-xs text-[#8391a3]">
                  Switch between live system conditions, crowd density, and
                  recent administrative activity.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => window.location.assign("/analytics")}
                className="border-[#dbe3ed] text-[#17365d]"
              >
                Open analytics <ArrowUpRight size={15} className="ml-2" />
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="health" className="w-full">
              <TabsList className="mb-5 grid h-auto w-full grid-cols-3 rounded-xl bg-[#f1f4f8] p-1">
                <TabsTrigger value="health" className="text-xs sm:text-sm">
                  System Health
                </TabsTrigger>
                <TabsTrigger value="density" className="text-xs sm:text-sm">
                  Crowd Density
                </TabsTrigger>
                <TabsTrigger value="activity" className="text-xs sm:text-sm">
                  Recent Activity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="health" className="mt-0">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-[#dbe3ed] bg-[#f9fbfd] p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-lg bg-[#e6edf6] text-[#17365d]">
                        <ServerCog size={17} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#718195]">
                          Overall status
                        </p>
                        <p className="mt-1 text-sm font-bold text-[#17365d]">
                          {summary.systemStatus}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#dbe3ed] bg-[#f9fbfd] p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-lg bg-[#dff5ea] text-[#13734a]">
                        <Signal size={17} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#718195]">
                          Kiosk availability
                        </p>
                        <p className="mt-1 text-sm font-bold text-[#17365d]">
                          {summary.onlineKiosks}
                          {kioskTotal !== null ? ` / ${kioskTotal}` : " online"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#dbe3ed] bg-[#f9fbfd] p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-lg bg-[#fff3bd] text-[#946c00]">
                        <Gauge size={17} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#718195]">
                          Average session
                        </p>
                        <p className="mt-1 text-sm font-bold text-[#17365d]">
                          {summary.averageSession}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="density" className="mt-0">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div>
                    <div className="mb-4">
                      <h3 className="font-display text-base font-bold text-[#17365d]">
                        Current crowd density
                      </h3>
                      <p className="mt-1 text-xs text-[#8391a3]">
                        Estimated by monitored campus zones.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {summary.density.map(item => {
                        const tone = densityTone(item.density);
                        return (
                          <div key={item.area}>
                            <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                              <span className="font-medium text-[#40556d]">
                                {item.area}
                              </span>
                              <span className={cn("font-semibold", tone.text)}>
                                {item.density}
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[#edf1f6]">
                              <div
                                className={cn("h-full rounded-full", tone.bar)}
                                style={{ width: `${Math.min(item.value, 100)}%` }}
                              />
                            </div>
                            <div className="mt-1 flex justify-end">
                              <span className={cn("text-[10px] font-semibold", tone.text)}>
                                {item.value}% estimated occupancy
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#dbe3ed] bg-[#f9fbfd] p-4 lg:min-w-52">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8493a5]">
                      Reading guide
                    </p>
                    <div className="mt-4 space-y-3 text-xs">
                      {[
                        ["Low", "Comfortable visitor volume"],
                        ["Moderate", "Monitor for increasing traffic"],
                        ["High", "Consider congestion response"],
                      ].map(([label, description]) => {
                        const tone = densityTone(label);
                        return (
                          <div key={label} className="flex items-start gap-2">
                            <span
                              className={cn(
                                "mt-0.5 size-2 shrink-0 rounded-full",
                                tone.bar
                              )}
                            />
                            <div>
                              <p className="font-semibold text-[#40556d]">
                                {label}
                              </p>
                              <p className="mt-0.5 text-[#8391a3]">
                                {description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-0">
                <div className="space-y-4">
                  {activity.map((event, index) => {
                    const Icon = activityIcon(event.tone);
                    const iconTone =
                      event.tone === "warning"
                        ? "bg-[#fff3bd] text-[#946c00]"
                        : event.tone === "success"
                          ? "bg-[#dff5ea] text-[#13734a]"
                          : "bg-[#e3effb] text-[#275784]";

                    return (
                      <div key={event.id}>
                        <div className="flex gap-3">
                          <div
                            className={cn(
                              "grid size-9 shrink-0 place-items-center rounded-lg",
                              iconTone
                            )}
                          >
                            <Icon size={15} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-semibold text-[#17365d]">
                                {event.title}
                              </p>
                              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9aa7b6]">
                                {formatActivityDate(event.createdAt)}
                              </span>
                            </div>
                            {event.description && (
                              <p className="mt-1 text-xs text-[#8391a3]">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>
                        {index < activity.length - 1 && <Separator className="mt-4" />}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>

      {/* Activity and actionable events */}
      <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
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
            <MiniBar values={activityValues} />
            <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aa7b6]">
              {activityLabels.map(label => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-[#8391a3]">
              <span className="size-2 rounded-full bg-[#f4c542]" />
              Daily kiosk sessions
              <span className="ml-auto font-semibold text-[#17365d]">
                Avg. {summary.averageSession} session
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="font-display text-lg">
                Actionable events
              </CardTitle>
              <Badge
                variant="outline"
                className="border-[#dbe3ed] text-[#64758a]"
              >
                {activity.length} recent
              </Badge>
            </div>
            <p className="mt-1 text-xs text-[#8391a3]">
              Items that may require administrator attention.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.slice(0, 2).map((event, index) => {
              const Icon = activityIcon(event.tone);
              const iconTone =
                event.tone === "warning"
                  ? "bg-[#fff3bd] text-[#946c00]"
                  : "bg-[#e3effb] text-[#275784]";

              return (
                <div key={event.id}>
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg",
                        iconTone
                      )}
                    >
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#17365d]">
                        {event.title}
                      </p>
                      {event.description && (
                        <p className="mt-1 text-xs text-[#8391a3]">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {index === 0 && <Separator className="mt-4" />}
                </div>
              );
            })}

            <Button
              variant="ghost"
              className="w-full justify-between px-0 text-xs text-[#b08412] hover:bg-transparent hover:text-[#8a6500]"
              onClick={() => window.location.assign("/analytics")}
            >
              View all activity <ChevronRight size={14} />
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
