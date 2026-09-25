/* Civic Signal: operational workspace pages use AUF navy, signal gold, breathable tables, dynamic context panels, and restrained motion. */
import { ReactNode, useMemo, useState } from "react";
import { AlertTriangle, Check, Info, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/FlowSenseShell";
import { NativeSelect, QueryStatus } from "@/components/AdminBits";
import { ChartTable, ColumnChart, Figure, LineChart } from "@/components/Charts";
import {
  AnalyticsFilters,
  RangeKey,
  filtersReady,
  useAnalytics,
} from "@/lib/analyticsApi";
import {
  AlertItem,
  formatWhen,
  useAlertAction,
  useAlerts,
  useBuildings,
  useDevices,
  useFloors,
  useSemesters,
} from "@/lib/adminApi";
import { cn } from "@/lib/utils";

const RANGES: [RangeKey, string][] = [
  ["today", "Today"],
  ["last_7_days", "Last 7 days"],
  ["last_30_days", "Last 30 days"],
  ["semester", "Semester"],
  ["custom", "Custom range"],
];

const shortDate = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });
const dayLabel = (iso: string) => shortDate.format(new Date(`${iso}T12:00:00`));
const hourLabel = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v}%`);
const num = (v: number | null | undefined, unit = "") =>
  v === null || v === undefined ? "—" : `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 }).format(v)}${unit}`;

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="font-display text-xl font-bold tracking-[-0.03em] text-[#102c4d]">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-[#8391a3]">{subtitle}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="border-[#dbe3ed] shadow-[0_10px_30px_rgba(16,44,77,0.04)]">
      <CardHeader>
        <CardTitle className="font-display text-base">{title}</CardTitle>
        {subtitle && <p className="text-xs text-[#8391a3]">{subtitle}</p>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** A metric the system doesn't record yet: says so and why, instead of a number. */
function NotCollected({ label, reason }: { label: string; reason?: string }) {
  return <Figure label={label} value="Not collected yet" detail={reason} muted />;
}

function SimpleTable({ columns, rows, empty }: { columns: string[]; rows: ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-[#8391a3]">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="text-[10px] uppercase tracking-[0.12em] text-[#8291a3]">
          <tr>
            {columns.map((c, i) => (
              <th key={c} className={cn("py-2 pr-3 font-bold", i > 0 && "text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#edf1f5]">
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={cn("py-2 pr-3 text-[#40556d]", i > 0 && "text-right tabular-nums")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const levelText: Record<string, string> = { low: "Low", moderate: "Moderate", high: "High" };
const levelLabel = (level: string | null, value: number | null) =>
  level ? `${levelText[level]} (${value})` : "—";

function FilterBar({ filters, onChange }: { filters: AnalyticsFilters; onChange: (f: AnalyticsFilters) => void }) {
  const semesters = useSemesters();
  const buildings = useBuildings();
  const floors = useFloors(filters.area_id ? Number(filters.area_id) : null);
  const kiosks = useDevices({ device_type: "kiosk" });
  const years = useMemo(
    () => Array.from(new Set((semesters.data ?? []).map(s => s.academic_year))),
    [semesters.data]
  );
  const [year, setYear] = useState<string>("");
  const chosenYear = year || years[0] || "";
  const set = (patch: Partial<AnalyticsFilters>) => onChange({ ...filters, ...patch });

  return (
    <div
      className="sticky top-0 z-20 -mx-1 mb-2 flex flex-wrap items-end gap-3 border-b border-[#dbe3ed] bg-[#f6f8fb]/95 px-1 py-3 backdrop-blur"
      aria-label="Analytics filters"
      role="group"
    >
      <label className="text-[11px] font-semibold text-[#53677d]">
        Date
        <NativeSelect
          aria-label="Date range"
          className="mt-1 w-40"
          value={filters.range}
          onChange={e => set({ range: e.target.value as RangeKey })}
        >
          {RANGES.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </label>
      {filters.range === "semester" && (
        <>
          <label className="text-[11px] font-semibold text-[#53677d]">
            Academic year
            <NativeSelect aria-label="Academic year" className="mt-1 w-36" value={chosenYear} onChange={e => { setYear(e.target.value); set({ semester_id: undefined }); }}>
              {years.length === 0 && <option value="">No semesters yet</option>}
              {years.map(y => (
                <option key={y} value={y}>
                  AY {y}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="text-[11px] font-semibold text-[#53677d]">
            Semester
            <NativeSelect aria-label="Semester" className="mt-1 w-44" value={filters.semester_id ?? ""} onChange={e => set({ semester_id: e.target.value || undefined })}>
              <option value="">Choose a semester</option>
              {(semesters.data ?? []).filter(s => s.academic_year === chosenYear).map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        </>
      )}
      {filters.range === "custom" && (
        <>
          <label className="text-[11px] font-semibold text-[#53677d]">
            From
            <Input type="date" aria-label="Start date" className="mt-1 h-9 w-40 border-[#dbe3ed] bg-white" value={filters.start_date ?? ""} onChange={e => set({ start_date: e.target.value || undefined })} />
          </label>
          <label className="text-[11px] font-semibold text-[#53677d]">
            To
            <Input type="date" aria-label="End date" className="mt-1 h-9 w-40 border-[#dbe3ed] bg-white" value={filters.end_date ?? ""} min={filters.start_date} onChange={e => set({ end_date: e.target.value || undefined })} />
          </label>
        </>
      )}
      <label className="text-[11px] font-semibold text-[#53677d]">
        Building
        <NativeSelect aria-label="Building" className="mt-1 w-40" value={filters.area_id ?? ""} onChange={e => set({ area_id: e.target.value || undefined, floor_id: undefined })}>
          <option value="">All buildings</option>
          {(buildings.data ?? []).map(b => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="text-[11px] font-semibold text-[#53677d]">
        Floor
        <NativeSelect aria-label="Floor" className="mt-1 w-28" value={filters.floor_id ?? ""} disabled={!filters.area_id} onChange={e => set({ floor_id: e.target.value || undefined })}>
          <option value="">All floors</option>
          {(floors.data ?? []).map(f => (
            <option key={f.id} value={f.id}>
              {f.floor_order}F
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="text-[11px] font-semibold text-[#53677d]">
        Kiosk
        <NativeSelect aria-label="Kiosk" className="mt-1 w-44" value={filters.kiosk_id ?? ""} onChange={e => set({ kiosk_id: e.target.value || undefined })}>
          <option value="">All kiosks</option>
          {(kiosks.data ?? []).filter(k => k.status !== "unregistered").map(k => (
            <option key={k.id} value={k.id}>
              {k.name ?? k.device_id}
            </option>
          ))}
        </NativeSelect>
      </label>
      {!filtersReady(filters) && (
        <p className="pb-2 text-xs font-semibold text-[#a07100]">
          {filters.range === "semester" ? "Choose a semester to update the page." : "Choose a start and end date (end on or after start)."}
        </p>
      )}
    </div>
  );
}

const severityStyle = {
  critical: { icon: ShieldAlert, box: "bg-[#fee8e7] text-[#b13a36]", label: "Critical" },
  warning: { icon: AlertTriangle, box: "bg-[#fff3bd] text-[#946c00]", label: "Warning" },
  informational: { icon: Info, box: "bg-[#e3effb] text-[#275784]", label: "Informational" },
} as const;

function AlertPanel() {
  const { data, isLoading, error, refetch } = useAlerts("open");
  const act = useAlertAction();
  const alerts = [...(data?.results ?? [])].sort(
    (a, b) => ["critical", "warning", "informational"].indexOf(a.severity) - ["critical", "warning", "informational"].indexOf(b.severity)
  );
  return (
    <Panel title="Alert panel" subtitle="What the numbers mean right now. Informational alerts clear themselves; warnings and critical alerts stay until cleared.">
      <QueryStatus isLoading={isLoading} error={error} onRetry={() => refetch()} what="alerts" />
      {data && alerts.length === 0 && <p className="text-sm text-[#8391a3]">Nothing needs attention.</p>}
      <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {alerts.map((alert: AlertItem) => {
          const style = severityStyle[alert.severity];
          const Icon = style.icon;
          return (
            <li key={alert.id} className="flex gap-3">
              <div className={cn("grid size-8 shrink-0 place-items-center rounded-lg", style.box)}>
                <Icon size={15} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#102c4d]">
                  {alert.title} <span className="text-[11px] font-normal text-[#8391a3]">· {style.label}</span>
                </p>
                <p className="mt-0.5 text-xs text-[#66768a]">{alert.message}</p>
                <p className="mt-0.5 text-[11px] text-[#a3afbd]">
                  {formatWhen(alert.created_at)}
                  {alert.state === "acknowledged" && " · Acknowledged"}
                </p>
              </div>
              {alert.state === "active" && (
                <Button size="icon" variant="ghost" aria-label={`Acknowledge ${alert.title}`} onClick={() => act.mutate({ id: alert.id, action: "acknowledge" })}>
                  <Check size={15} />
                </Button>
              )}
              <Button size="icon" variant="ghost" aria-label={`Clear ${alert.title}`} onClick={() => act.mutate({ id: alert.id, action: "clear" })}>
                <X size={15} />
              </Button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function Analytics() {
  const [filters, setFilters] = useState<AnalyticsFilters>({ range: "last_7_days" });
  const search = useAnalytics("search", filters);
  const navigation = useAnalytics("navigation", filters);
  const kiosks = useAnalytics("kiosks", filters);
  const qr = useAnalytics("qr", filters);
  const sensors = useAnalytics("sensors", filters);
  const spatial = useAnalytics("spatial", filters);
  const system = useAnalytics("system", filters);
  const [availabilityPage, setAvailabilityPage] = useState(0);
  const [sensorId, setSensorId] = useState<string>("");
  const all = [search, navigation, kiosks, qr, sensors, spatial, system];
  const loading = all.some(q => q.isLoading);
  const failed = all.find(q => q.error)?.error;
  const refreshing = all.some(q => q.isFetching);
  const isDemo = search.isDemo;

  const s = search.data, n = navigation.data, k = kiosks.data, q = qr.data, se = sensors.data, sp = spatial.data, sy = system.data;
  const availability = k?.availability ?? [];
  const pages = Math.max(1, Math.ceil(availability.length / 5));
  const selectedSensor = se?.sensors.find(x => String(x.device_id) === sensorId) ?? se?.sensors[0];

  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Analytics"
        title="See movement, not just numbers"
        description="Usage, navigation, spatial, and system analytics for decisions about the campus and FlowSense itself."
      />
      <FilterBar filters={filters} onChange={next => { setFilters(next); setAvailabilityPage(0); }} />
      {isDemo && <p className="mt-2 text-xs text-[#a07100]">Demo data: the API isn't connected.</p>}
      <div className="mt-2">
        <QueryStatus isLoading={loading} error={failed} onRetry={() => all.forEach(x => x.refetch())} what="analytics" />
      </div>
      {s && n && k && q && se && sp && sy && (
        <div className={cn("transition-opacity", refreshing && !loading && "opacity-60")} aria-busy={refreshing}>
          <Section title="Overview" subtitle="The headline numbers for the selected period.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Figure label="Total searches" value={num(s.totals.total)} />
              <Figure label="Successful searches" value={num(s.totals.successful)} detail={`${pct(s.totals.success_rate)} of searches`} />
              <Figure label="Failed searches" value={num(s.totals.failed)} />
              <Figure label="QR generated" value={num(q.totals.generated)} />
              <Figure label="QR scanned" value={num(q.totals.scanned)} />
              <Figure label="Scan rate" value={pct(q.totals.scan_rate)} />
              <Figure label="Average QR handoff time" value={num(q.handoff_seconds.average, " s")} detail="Between generating and scanning" />
              <NotCollected label="Average search-to-render" reason={sy.not_collected.search_to_render} />
              <Figure label="Average route · single destination" value={num(n.routes.average_length_m.single_destination, " m")} />
              <Figure label="Average route · multi-destination" value={num(n.routes.average_length_m.multi_destination, " m")} />
              <Figure
                label="Crowd density"
                value={sp.crowd_density.level ? levelText[sp.crowd_density.level] : "—"}
                detail={sp.crowd_density.average !== null ? `Average estimate ${sp.crowd_density.average}` : "No sensor readings in this period"}
              />
            </div>
            <Panel
              title="Kiosk availability"
              subtitle="Share of the period each kiosk was online and reporting, since it was registered."
              action={
                pages > 1 ? (
                  <div className="flex items-center gap-2 text-xs text-[#53677d]">
                    <Button size="sm" variant="outline" disabled={availabilityPage === 0} onClick={() => setAvailabilityPage(p => p - 1)}>
                      Previous
                    </Button>
                    {availabilityPage + 1} / {pages}
                    <Button size="sm" variant="outline" disabled={availabilityPage + 1 >= pages} onClick={() => setAvailabilityPage(p => p + 1)}>
                      Next
                    </Button>
                  </div>
                ) : undefined
              }
            >
              <SimpleTable
                columns={["Kiosk", "Availability"]}
                rows={availability.slice(availabilityPage * 5, availabilityPage * 5 + 5).map(a => [a.name, pct(a.availability_percent)])}
                empty="No registered kiosks yet."
              />
            </Panel>
          </Section>

          <Section title="Navigation analytics">
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Top requested destinations" subtitle="Destinations visitors asked for routes to.">
                <SimpleTable
                  columns={["Rank", "Destination", "Requests"]}
                  rows={n.top_destinations.map(d => [d.rank, d.room_code ? `${d.name} (${d.room_code})` : d.name, num(d.requests)])}
                  empty="No routes requested in this period."
                />
              </Panel>
              <Panel title="Failed searches" subtitle="Queries that found no destination.">
                <SimpleTable
                  columns={["Search query", "Failures", "Last occurrence"]}
                  rows={s.failed_queries.map(f => [`“${f.query}”`, num(f.failures), formatWhen(f.last_occurrence)])}
                  empty="No failed searches in this period."
                />
              </Panel>
            </div>
            <Panel title="Search success and failure trend" subtitle="Searches per day.">
              <LineChart
                label="Successful and failed searches per day"
                series={[{ key: "successful", label: "Successful" }, { key: "failed", label: "Failed" }]}
                points={s.trend.map(t => ({ label: dayLabel(t.date), values: { successful: t.successful, failed: t.failed } }))}
              />
              <ChartTable
                firstColumn="Date"
                series={[{ key: "successful", label: "Successful" }, { key: "failed", label: "Failed" }, { key: "rate", label: "Success rate (%)" }]}
                points={s.trend.map(t => ({ label: dayLabel(t.date), values: { successful: t.successful, failed: t.failed, rate: t.success_rate } }))}
              />
            </Panel>
          </Section>

          <Section title="Spatial analytics" subtitle="From the ESP32 sensors. Density levels assume the firmware's 0–1 scale (waiting on the firmware, QA-64).">
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Busiest monitored locations">
                <SimpleTable
                  columns={["Location", "Average density", "Peak density"]}
                  rows={sp.busiest_locations.map(b => [b.location, levelLabel(b.average_level, b.average_density), levelLabel(b.peak_level, b.peak_density)])}
                  empty="No sensor readings in this period."
                />
              </Panel>
              <NotCollected label="Least-recommended route segments" reason={sp.not_collected.least_recommended_segments} />
            </div>
          </Section>

          <Section title="Kiosk and usage analytics">
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Kiosk usage by hour" subtitle="Visitor sessions and searches in each hour of the day, over the period.">
                <LineChart
                  label="Kiosk sessions and searches by hour of day"
                  series={[{ key: "sessions", label: "Sessions" }, { key: "searches", label: "Searches" }]}
                  points={k.usage_by_hour.map(h => ({ label: hourLabel(h.hour), values: { sessions: h.sessions, searches: h.searches } }))}
                />
                <ChartTable firstColumn="Hour" series={[{ key: "sessions", label: "Sessions" }, { key: "searches", label: "Searches" }]} points={k.usage_by_hour.map(h => ({ label: hourLabel(h.hour), values: { sessions: h.sessions, searches: h.searches } }))} />
              </Panel>
              <Panel title="Kiosk usage over time" subtitle={`${num(k.sessions.total)} sessions · average ${k.sessions.average_seconds !== null ? `${Math.round(k.sessions.average_seconds / 6) / 10} min` : "—"}`}>
                <LineChart
                  label="Kiosk sessions and searches per day"
                  series={[{ key: "sessions", label: "Sessions" }, { key: "searches", label: "Searches" }]}
                  points={k.usage_over_time.map(d => ({ label: dayLabel(d.date), values: { sessions: d.sessions, searches: d.searches } }))}
                />
                <ChartTable firstColumn="Date" series={[{ key: "sessions", label: "Sessions" }, { key: "searches", label: "Searches" }]} points={k.usage_over_time.map(d => ({ label: dayLabel(d.date), values: { sessions: d.sessions, searches: d.searches } }))} />
              </Panel>
              <Panel title="QR handoffs over time" subtitle="Codes generated on kiosks and scanned by phones, per day.">
                <ColumnChart
                  label="QR codes generated and scanned per day"
                  series={[{ key: "generated", label: "Generated" }, { key: "scanned", label: "Scanned" }]}
                  points={q.over_time.map(d => ({ label: dayLabel(d.date), values: { generated: d.generated, scanned: d.scanned } }))}
                />
                <ChartTable firstColumn="Date" series={[{ key: "generated", label: "Generated" }, { key: "scanned", label: "Scanned" }]} points={q.over_time.map(d => ({ label: dayLabel(d.date), values: { generated: d.generated, scanned: d.scanned } }))} />
              </Panel>
              <Panel title="QR scan rate over time" subtitle="Scanned as a share of generated, per day.">
                <LineChart
                  label="QR scan rate per day"
                  max={100}
                  format={v => (v === null ? "—" : `${Math.round(v)}%`)}
                  series={[{ key: "rate", label: "Scan rate" }]}
                  points={q.over_time.map(d => ({ label: dayLabel(d.date), values: { rate: d.scan_rate } }))}
                />
                <ChartTable firstColumn="Date" series={[{ key: "rate", label: "Scan rate (%)" }]} points={q.over_time.map(d => ({ label: dayLabel(d.date), values: { rate: d.scan_rate } }))} />
              </Panel>
              <Panel title="QR handoffs by kiosk">
                <SimpleTable
                  columns={["Kiosk", "Generated", "Scanned", "Scan rate"]}
                  rows={q.by_kiosk.map(b => [b.name, num(b.generated), num(b.scanned), pct(b.scan_rate)])}
                  empty="No QR handoffs from a registered kiosk in this period."
                />
              </Panel>
              <Panel title="QR handoff time" subtitle={`From ${num(q.handoff_seconds.count)} scanned codes.`}>
                <div className="grid grid-cols-3 gap-3">
                  <Figure label="Average" value={num(q.handoff_seconds.average, " s")} />
                  <Figure label="Median" value={num(q.handoff_seconds.median, " s")} />
                  <Figure label="Longest" value={num(q.handoff_seconds.longest, " s")} />
                </div>
              </Panel>
            </div>
          </Section>

          <Section title="Destination queue analytics">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Figure label="Queue usage" value={num(n.queues.queue_usage)} detail={`Of ${num(n.queues.navigation_requests)} navigation requests`} />
              <Figure label="Average queue size" value={num(n.queues.average_queue_size, " destinations")} />
              <Figure label="Single vs multi-destination" value={`${pct(n.queues.single_destination_percent)} / ${pct(n.queues.multi_destination_percent)}`} />
              <Figure label="Route generation success" value={pct(n.queues.route_generation_success_percent)} />
            </div>
            <Panel title="Most common destination sequences">
              <SimpleTable
                columns={["Sequence", "Queues"]}
                rows={n.queues.common_sequences.map(c => [c.sequence.join(" → "), num(c.count)])}
                empty="No multi-destination queues in this period."
              />
            </Panel>
          </Section>

          <Section title="Route analytics">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Figure label="Average route length" value={num(n.routes.average_length_m.all, " m")} />
              <NotCollected label="Average turns" reason={n.not_collected.route_turns} />
              <NotCollected label="Average floors crossed" reason={n.not_collected.floors_crossed} />
              <NotCollected label="Average buildings crossed" reason={n.not_collected.buildings_crossed} />
            </div>
            <Panel title="Most common routes">
              <SimpleTable
                columns={["From", "To", "Routes"]}
                rows={n.routes.most_common.map(r => [r.origin, r.destination, num(r.count)])}
                empty="No routes generated in this period."
              />
            </Panel>
          </Section>

          <Section title="System analytics">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Figure label="Search API latency" value={num(sy.latency_ms.search_api.average, " ms")} detail={`P95 ${num(sy.latency_ms.search_api.p95, " ms")}`} />
              <Figure label="Pathfinding" value={num(sy.latency_ms.pathfinding.average, " ms")} detail={`P95 ${num(sy.latency_ms.pathfinding.p95, " ms")}`} />
              <NotCollected label="Search-to-render" reason={sy.not_collected.search_to_render} />
              <NotCollected label="API request success rate" reason={sy.not_collected.api_success_rate} />
            </div>
            <Panel
              title="Sensor transmission reliability"
              subtitle="Readings received versus expected from the sampling interval."
              action={
                se.sensors.length > 0 ? (
                  <NativeSelect aria-label="Sensor" className="w-48" value={String(selectedSensor?.device_id ?? "")} onChange={e => setSensorId(e.target.value)}>
                    {se.sensors.map(x => (
                      <option key={x.device_id} value={x.device_id}>
                        {x.name}
                      </option>
                    ))}
                  </NativeSelect>
                ) : undefined
              }
            >
              {selectedSensor ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Figure label="Expected" value={num(selectedSensor.expected)} detail={selectedSensor.location} />
                  <Figure label="Received" value={num(selectedSensor.received)} />
                  <Figure label="Reliability" value={pct(selectedSensor.reliability_percent)} detail={`All sensors: ${pct(se.overall.reliability_percent)}`} />
                </div>
              ) : (
                <p className="text-sm text-[#8391a3]">No registered sensors match these filters.</p>
              )}
            </Panel>
          </Section>

          <Section title="Alerts">
            <AlertPanel />
          </Section>

          <Section title="Reports and exports">
            <Panel title="Generate or schedule a report">
              <p className="text-sm text-[#66768a]">
                Not available yet. Saving generated reports needs a place to store them (the database
                schema has no reports table), and PDF output needs a library that isn't in the tech
                stack. Both are waiting on a team decision (QA-65).
              </p>
            </Panel>
          </Section>
        </div>
      )}
    </>
  );
}

