/* Small SVG charts for the Analytics page (no chart library).
 *
 * Follows the dataviz method: at most two series, colors validated for
 * colour-vision deficiency and contrast (navy #2f63b0, gold #b7860b on white;
 * scripts/validate_palette.js, all checks pass), 2px lines, >=8px end dots
 * with a 2px surface ring, <=24px columns with a 2px gap and 4px rounded data
 * ends, one hairline grid, one y-axis, a legend for two series, a crosshair
 * tooltip on lines and a per-column tooltip on bars, and a table view so no
 * value is hover-only. Text uses text colors, never the series color. */
import { KeyboardEvent, PointerEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SERIES_COLORS = ["#2f63b0", "#b7860b"] as const;

export interface ChartSeries {
  key: string;
  label: string;
}

export interface ChartPoint {
  label: string;
  values: Record<string, number | null>;
}

const DEFAULT_WIDTH = 640;
const PAD = { top: 16, right: 56, bottom: 28, left: 44 };
const GRID = "#e6ebf1";
const AXIS_TEXT = "#8391a3";

/** Axis top and tick step: steps of 1, 2, or 5 × 10^n (whole numbers for counts), at most 5 ticks. */
function niceScale(value: number, whole = true) {
  if (value <= 0) return { max: whole ? 4 : 1, step: whole ? 1 : 0.25 };
  const raw = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  let step = ([1, 2, 5, 10].find(m => m * magnitude >= raw) ?? 10) * magnitude;
  if (whole) step = Math.max(1, Math.round(step));
  return { max: Math.ceil(value / step) * step, step };
}

/** Width of the chart's container in CSS pixels, so text is drawn at its real size. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const next = Math.round(entries[0].contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const number = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 });
const defaultFormat = (value: number | null) => (value === null ? "—" : number.format(value));

function Legend({ series, kind }: { series: ChartSeries[]; kind: "line" | "bar" }) {
  if (series.length < 2) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-4 text-xs text-[#53677d]" aria-label="Legend">
      {series.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          {kind === "line" ? (
            <span className="h-0.5 w-4 rounded-full" style={{ background: SERIES_COLORS[i] }} />
          ) : (
            <span className="size-2.5 rounded-sm" style={{ background: SERIES_COLORS[i] }} />
          )}
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function Tooltip({
  x,
  title,
  rows,
}: {
  x: number;
  title: string;
  rows: { label: string; value: string; color: string }[];
}) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border border-[#dbe3ed] bg-white px-3 py-2 text-xs shadow-[0_8px_24px_rgba(16,44,77,0.12)]"
      style={{ left: `${x}%`, transform: x > 60 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
    >
      <p className="mb-1 font-semibold text-[#40556d]">{title}</p>
      {rows.map(row => (
        <p key={row.label} className="flex items-center gap-2">
          <span className="h-0.5 w-3 rounded-full" style={{ background: row.color }} />
          <strong className="text-[#102c4d]">{row.value}</strong>
          <span className="text-[#8391a3]">{row.label}</span>
        </p>
      ))}
    </div>
  );
}

/** "Show as table": every plotted value, reachable without hovering. */
export function ChartTable({
  series,
  points,
  firstColumn,
  format = defaultFormat,
}: {
  series: ChartSeries[];
  points: ChartPoint[];
  firstColumn: string;
  format?: (value: number | null) => string;
}) {
  return (
    <details className="mt-3 text-xs text-[#53677d]">
      <summary className="cursor-pointer font-semibold text-[#17365d]">Show as table</summary>
      <div className="mt-2 max-h-64 overflow-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] uppercase tracking-[0.12em] text-[#8291a3]">
            <tr>
              <th className="py-1 pr-3">{firstColumn}</th>
              {series.map(s => (
                <th key={s.key} className="py-1 pr-3 text-right">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1f5]">
            {points.map(p => (
              <tr key={p.label}>
                <td className="py-1 pr-3">{p.label}</td>
                {series.map(s => (
                  <td key={s.key} className="py-1 pr-3 text-right tabular-nums">
                    {format(p.values[s.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function YGrid({ max, step, width, height, format }: { max: number; step: number; width: number; height: number; format: (v: number | null) => string }) {
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const y = (v: number) => PAD.top + (1 - v / max) * (height - PAD.top - PAD.bottom);
  return (
    <g aria-hidden="true">
      {ticks.map(t => (
        <g key={t}>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
          <text x={PAD.left - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill={AXIS_TEXT}>
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Line chart with a crosshair tooltip. For change over time (or over the hours of a day). */
export function LineChart({
  series,
  points,
  height = 220,
  format = defaultFormat,
  max: fixedMax,
  label,
}: {
  series: ChartSeries[];
  points: ChartPoint[];
  height?: number;
  format?: (value: number | null) => string;
  max?: number;
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const [box, width] = useWidth();
  const { max, step } = useMemo(() => {
    if (fixedMax) return { max: fixedMax, step: fixedMax / 4 };
    const values = points.flatMap(p => series.map(s => p.values[s.key] ?? 0));
    return niceScale(Math.max(0, ...values), values.every(v => Number.isInteger(v)));
  }, [fixedMax, points, series]);
  const plotW = width - PAD.left - PAD.right;
  const x = (i: number) => PAD.left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - v / max) * (height - PAD.top - PAD.bottom);
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 56))));

  const pick = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - box.left) / box.width;
    setActive(Math.max(0, Math.min(points.length - 1, Math.round(fraction * (points.length - 1)))));
  };
  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "ArrowRight") setActive(i => Math.min(points.length - 1, (i ?? -1) + 1));
    if (event.key === "ArrowLeft") setActive(i => Math.max(0, (i ?? points.length) - 1));
    if (event.key === "Escape") setActive(null);
  };

  return (
    <div>
      <Legend series={series} kind="line" />
      <div className="relative" ref={box}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="block max-w-full outline-none focus-visible:ring-2 focus-visible:ring-[#f4c542]/60"
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          <title id={titleId}>{label}. Use the arrow keys to read values, or open the table below.</title>
          <YGrid max={max} step={step} width={width} height={height} format={format} />
          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text key={p.label} x={x(i)} y={height - 8} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>
                {p.label}
              </text>
            ) : null
          )}
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={height - PAD.bottom} stroke="#c3cfdd" strokeWidth={1} />
          )}
          {series.map((s, si) => {
            const color = SERIES_COLORS[si];
            const defined = points.map((p, i) => [i, p.values[s.key]] as const).filter(([, v]) => v !== null) as [number, number][];
            if (!defined.length) return null;
            const d = defined.map(([i, v], n) => `${n ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
            const [lastI, lastV] = defined[defined.length - 1];
            return (
              <g key={s.key}>
                <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(lastI)} cy={y(lastV)} r={4} fill={color} stroke="#ffffff" strokeWidth={2} />
                <text x={x(lastI) + 8} y={y(lastV) + 3} fontSize={10} fill="#40556d">
                  {format(lastV)}
                </text>
                {active !== null && points[active].values[s.key] !== null && (
                  <circle cx={x(active)} cy={y(points[active].values[s.key] as number)} r={4} fill={color} stroke="#ffffff" strokeWidth={2} />
                )}
              </g>
            );
          })}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={height - PAD.top - PAD.bottom}
            fill="transparent"
            onPointerMove={pick}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        {active !== null && (
          <Tooltip
            x={(x(active) / width) * 100}
            title={points[active].label}
            rows={series.map((s, i) => ({ label: s.label, value: format(points[active].values[s.key]), color: SERIES_COLORS[i] }))}
          />
        )}
      </div>
    </div>
  );
}

/** Grouped columns (one or two series) with per-column tooltips; scrolls sideways for long ranges. */
export function ColumnChart({
  series,
  points,
  height = 220,
  format = defaultFormat,
  label,
}: {
  series: ChartSeries[];
  points: ChartPoint[];
  height?: number;
  format?: (value: number | null) => string;
  label: string;
}) {
  const [active, setActive] = useState<{ point: number; series: number } | null>(null);
  const titleId = useId();
  const [box, available] = useWidth();
  const values = points.flatMap(p => series.map(s => p.values[s.key] ?? 0));
  const { max, step } = niceScale(Math.max(0, ...values), values.every(v => Number.isInteger(v)));
  const groupW = 44;
  const barW = Math.min(24, (groupW - 12 - 2 * (series.length - 1)) / series.length);
  const width = Math.max(available, PAD.left + PAD.right + points.length * groupW);
  const plotH = height - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + (1 - v / max) * plotH;
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor((width - PAD.left - PAD.right) / 56))));

  // A column with a 4px rounded data end and a square base.
  const column = (x0: number, value: number) => {
    const top = y(value);
    const base = PAD.top + plotH;
    const r = Math.min(4, (base - top) / 2, barW / 2);
    return `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${base} Z`;
  };

  return (
    <div>
      <Legend series={series} kind="bar" />
      <div className="relative overflow-x-auto" ref={box}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="block"
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>{label}. Values are also in the table below.</title>
          <YGrid max={max} step={step} width={width} height={height} format={format} />
          {points.map((p, pi) => {
            const groupX = PAD.left + pi * ((width - PAD.left - PAD.right) / points.length);
            const slot = (width - PAD.left - PAD.right) / points.length;
            const start = groupX + (slot - (barW * series.length + 2 * (series.length - 1))) / 2;
            return (
              <g key={p.label}>
                {series.map((s, si) => {
                  const value = p.values[s.key] ?? 0;
                  const x0 = start + si * (barW + 2);
                  const isActive = active?.point === pi && active.series === si;
                  return (
                    <g key={s.key}>
                      {value > 0 && (
                        <path d={column(x0, value)} fill={SERIES_COLORS[si]} opacity={active && !isActive ? 0.55 : 1} />
                      )}
                      {/* Hit target: the whole column height of the slot, wider than the mark. */}
                      <rect
                        x={x0 - 1}
                        y={PAD.top}
                        width={barW + 2}
                        height={plotH}
                        fill="transparent"
                        tabIndex={0}
                        aria-label={`${p.label}, ${s.label}: ${format(p.values[s.key])}`}
                        onPointerEnter={() => setActive({ point: pi, series: si })}
                        onPointerLeave={() => setActive(null)}
                        onFocus={() => setActive({ point: pi, series: si })}
                        onBlur={() => setActive(null)}
                      />
                    </g>
                  );
                })}
                {(pi % labelEvery === 0 || pi === points.length - 1) && (
                  <text x={groupX + slot / 2} y={height - 8} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {active && (
          <Tooltip
            x={Math.min(95, ((PAD.left + (active.point + 0.5) * ((width - PAD.left - PAD.right) / points.length)) / width) * 100)}
            title={points[active.point].label}
            rows={series.map((s, i) => ({ label: s.label, value: format(points[active.point].values[s.key]), color: SERIES_COLORS[i] }))}
          />
        )}
      </div>
    </div>
  );
}

/** A labelled figure: the form when the data is a single headline number. */
export function Figure({
  label,
  value,
  detail,
  muted = false,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#e3e9f0] bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a98a9]">{label}</p>
      <p className={cn("mt-2 font-display text-2xl font-bold tracking-[-0.04em]", muted ? "text-[#a3afbd]" : "text-[#102c4d]")}>
        {value}
      </p>
      {detail && <p className="mt-1 text-[11px] text-[#8391a3]">{detail}</p>}
    </div>
  );
}
