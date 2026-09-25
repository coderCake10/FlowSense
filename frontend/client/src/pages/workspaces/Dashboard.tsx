/* Civic Signal: operational workspace pages use AUF navy, signal gold, breathable tables, dynamic context panels, and restrained motion. */
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Check,
  ChevronRight,
  Gauge,
  Plus,
  Route,
  Search,
  Signal,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader, MetricCard } from "@/components/FlowSenseShell";
import { QueryStatus } from "@/components/AdminBits";
import {
  DashboardData,
  formatDuration,
  formatWhen,
  titleCase,
  useAlertAction,
  useDashboard,
} from "@/lib/adminApi";
import { cn } from "@/lib/utils";

const statusCopy: Record<DashboardData["system"]["status"], string> = {
  operational: "Every route starts with a reliable signal.",
  degraded: "Some components need attention.",
  critical: "Wayfinding is disrupted. Act now.",
  maintenance: "FlowSense is in maintenance mode.",
};

const levelTone = {
  high: { text: "text-[#b13a36]", bar: "bg-[#d9655f]" },
  moderate: { text: "text-[#a07100]", bar: "bg-[#e1b839]" },
  low: { text: "text-[#168051]", bar: "bg-[#41ad7d]" },
};

const weekday = new Intl.DateTimeFormat("en-PH", { weekday: "short" });
const longDate = new Intl.DateTimeFormat("en-PH", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

function ActivityBars({ days }: { days: DashboardData["kiosk_activity"] }) {
  const peak = Math.max(1, ...days.map(d => d.sessions));
  if (days.every(day => day.sessions === 0)) {
    return (
      <p className="grid h-28 place-items-center text-sm text-[#8391a3]">
        No kiosk sessions in the last 7 days.
      </p>
    );
  }
  return (
    <>
      <div className="flex h-28 items-end gap-2" aria-label="Kiosk sessions per day">
        {days.map((day, i) => (
          <div
            key={day.date}
            className="flex-1 rounded-t-md bg-[#e8eef5]"
            style={{ height: `${day.sessions ? Math.max((day.sessions / peak) * 100, 8) : 2}%` }}
            title={`${day.date}: ${day.sessions} sessions`}
          >
            <div
              className="h-full rounded-t-md bg-[#f4c542]"
              style={{ opacity: 0.65 + (i / days.length) * 0.35 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aa7b6]">
        {days.map(day => (
          <span key={day.date}>
            {weekday.format(new Date(`${day.date}T12:00:00`))}
          </span>
        ))}
      </div>
    </>
  );
}

export function Dashboard() {
  const { data, isLoading, error, refetch, isDemo } = useDashboard();
  const alertAction = useAlertAction();

  return (
    <>
      <PageHeader
        eyebrow={`Admin dashboard / ${longDate.format(new Date())}`}
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
      <QueryStatus
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        what="the dashboard"
      />
      {data && (
        <>
          {/* System health (P1) */}
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
                  <Badge
                    className={cn(
                      "mb-8",
                      data.system.status === "operational"
                        ? "border-[#f4c542]/30 bg-[#f4c542]/12 text-[#f8d96a]"
                        : "border-[#ff9b94]/40 bg-[#b13a36]/30 text-[#ffd2ce]"
                    )}
                  >
                    SYSTEM HEALTH · {data.system.status.toUpperCase()}
                  </Badge>
                  <h2 className="max-w-lg font-display text-3xl font-bold leading-tight tracking-[-0.05em] sm:text-4xl">
                    {statusCopy[data.system.status]}
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-6 text-white/65">
                    Your campus map, devices, and navigation services are being
                    monitored in one operational view.
                    {isDemo && " (Demo data: the API isn't connected.)"}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    {(
                      [
                        ["Kiosks online", data.system.kiosks],
                        ["Sensors online", data.system.sensors],
                      ] as const
                    ).map(([label, count]) => (
                      <Link
                        key={label}
                        href="/hardware"
                        className="rounded-xl border border-white/10 bg-white/8 px-4 py-3 transition hover:bg-white/15"
                      >
                        <p className="text-[10px] uppercase tracking-[0.15em] text-white/45">
                          {label}
                        </p>
                        <p className="mt-1 font-display text-2xl font-bold">
                          {count.online}{" "}
                          <span className="text-sm font-normal text-white/45">
                            / {count.total}
                          </span>
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Current crowd density (P2) */}
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
                {data.crowd_density.length === 0 && (
                  <p className="text-sm text-[#8391a3]">
                    No sensors are deployed yet.
                  </p>
                )}
                {data.crowd_density.map(item => (
                  <div key={item.device_id}>
                    <div className="mb-2 flex justify-between gap-3 text-xs">
                      <span className="font-medium text-[#40556d]">
                        {item.area}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-semibold",
                          item.level ? levelTone[item.level].text : "text-[#8391a3]"
                        )}
                      >
                        {item.level ? titleCase(item.level) : "No recent reading"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#edf1f6]">
                      {item.level && item.estimated_density !== null && (
                        <div
                          className={cn("h-2 rounded-full", levelTone[item.level].bar)}
                          style={{
                            width: `${Math.min(100, Math.max(4, item.estimated_density * 100))}%`,
                          }}
                        />
                      )}
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

          {/* Today's activity (P2) */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Kiosk sessions"
              value={data.today.kiosk_sessions}
              detail="Started today"
              icon={Signal}
              accent="gold"
            />
            <MetricCard
              label="Navigation queries"
              value={data.today.navigation_queries}
              detail="Routes requested today"
              icon={Route}
              accent="navy"
            />
            <MetricCard
              label="Successful searches"
              value={data.today.successful_searches}
              detail="Resolved to a destination"
              icon={Check}
              accent="green"
            />
            <MetricCard
              label="Failed searches"
              value={data.today.failed_searches}
              detail="Found no destination"
              icon={Search}
              accent="red"
            />
            <MetricCard
              label="Average session"
              value={formatDuration(data.today.average_session_seconds)}
              detail="Minutes : seconds, today"
              icon={Gauge}
              accent="navy"
            />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            {/* Kiosk activity over time (P2) */}
            <Card className="border-[#dbe3ed]">
              <CardHeader>
                <CardTitle className="font-display text-lg">
                  Kiosk activity over time
                </CardTitle>
                <p className="text-xs text-[#8391a3]">Sessions created by day</p>
                <CardAction>
                  <Badge variant="outline" className="border-[#dbe3ed] text-[#64758a]">
                    Last 7 days
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <ActivityBars days={data.kiosk_activity} />
              </CardContent>
            </Card>

            {/* Alerts and recent activity (P2) */}
            <Card className="border-[#dbe3ed]">
              <CardHeader>
                <CardTitle className="font-display text-lg">
                  Actionable events
                </CardTitle>
                <CardAction>
                  <Badge variant="outline" className="border-[#dbe3ed] text-[#64758a]">
                    {data.alerts.open} open alert{data.alerts.open === 1 ? "" : "s"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.alerts.latest.length === 0 && (
                  <p className="text-sm text-[#8391a3]">No alerts need attention.</p>
                )}
                {data.alerts.latest.map(alert => (
                  <div key={alert.id} className="flex gap-3">
                    <div
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg",
                        alert.severity === "critical"
                          ? "bg-[#fee8e7] text-[#b13a36]"
                          : alert.severity === "warning"
                            ? "bg-[#fff3bd] text-[#946c00]"
                            : "bg-[#e3effb] text-[#275784]"
                      )}
                    >
                      <AlertTriangle size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{alert.title}</p>
                      <p className="mt-1 text-xs text-[#8391a3]">{alert.message}</p>
                      <p className="mt-1 text-[11px] text-[#a3afbd]">
                        {formatWhen(alert.created_at)}
                        {alert.state === "acknowledged" && " · Acknowledged"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {alert.state === "active" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Acknowledge ${alert.title}`}
                          title="Acknowledge"
                          onClick={() => alertAction.mutate({ id: alert.id, action: "acknowledge" })}
                        >
                          <Check size={15} />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Clear ${alert.title}`}
                        title="Clear"
                        onClick={() => alertAction.mutate({ id: alert.id, action: "clear" })}
                      >
                        <X size={15} />
                      </Button>
                    </div>
                  </div>
                ))}
                <Separator />
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8493a5]">
                  Recent activity
                </p>
                {data.recent_activity.length === 0 && (
                  <p className="text-sm text-[#8391a3]">No administrator activity yet.</p>
                )}
                {data.recent_activity.map(event => (
                  <div key={event.id} className="flex gap-3">
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e3effb] text-[#275784]">
                      <Activity size={15} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {event.description || `${titleCase(event.action)} ${event.entity_type ?? ""}`}
                      </p>
                      <p className="mt-1 text-xs text-[#8391a3]">
                        {event.admin_user?.full_name ?? "System"} · {formatWhen(event.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
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

          {/* Operational insights (P2) */}
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {(
              [
                ["Top destinations", "Most requested in the last 30 days", data.top_destinations.map(d => ({ key: String(d.node_id), label: d.name, count: d.count })), "No routes requested yet."],
                ["Failed searches", "Top queries that found nothing, last 30 days", data.failed_searches.map(f => ({ key: f.query, label: `“${f.query}”`, count: f.count })), "No failed searches."],
              ] as const
            ).map(([title, subtitle, rows, empty]) => (
              <Card
                key={title}
                className="cursor-pointer border-[#dbe3ed] transition hover:border-[#c9d5e3]"
                onClick={() => window.location.assign("/analytics")}
              >
                <CardHeader>
                  <CardTitle className="font-display text-lg">{title}</CardTitle>
                  <p className="text-xs text-[#8391a3]">{subtitle}</p>
                </CardHeader>
                <CardContent>
                  {rows.length === 0 ? (
                    <p className="text-sm text-[#8391a3]">{empty}</p>
                  ) : (
                    <ol className="divide-y divide-[#edf1f5]">
                      {rows.map((row, i) => (
                        <li key={row.key} className="flex items-center justify-between py-2.5 text-sm">
                          <span className="flex items-center gap-3 text-[#40556d]">
                            <span className="w-4 text-xs font-bold text-[#b08412]">{i + 1}</span>
                            {row.label}
                          </span>
                          <span className="font-semibold text-[#17365d]">{row.count}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* System summary (P2) */}
          <Card className="mt-5 border-[#dbe3ed]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Building2 size={16} className="text-[#b08412]" />
                System summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {(
                  [
                    ["Buildings", data.summary.buildings],
                    ["Floors", data.summary.floors],
                    ["Mapped rooms", `${data.summary.mapped_rooms} / ${data.summary.rooms}`],
                    ["Registered assets", data.summary.assets],
                    ["Kiosks", data.summary.kiosks],
                    ["Sensors", data.summary.sensors],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[#e7edf3] bg-[#fbfcfe] p-3">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a98a9]">
                      {label}
                    </dt>
                    <dd className="mt-2 font-display text-xl font-bold text-[#17365d]">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
