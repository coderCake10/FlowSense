/* Analytics reports (/api/v1/analytics/reports): snapshots of chosen
 * analytics sections, drawn as a printable page or exported as CSV. The
 * contents vary with the data, so a report is a list of self-describing
 * blocks (backend: analytics/reports.py). */
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL, ApiError, apiClient, isApiConfigured } from "@/lib/api";
import { useAdminMutation } from "@/lib/adminApi";

export type ReportStatus = "pending" | "generating" | "completed" | "failed";
export type ReportFormat = "pdf" | "csv";

export interface MetricsBlock {
  kind: "metrics";
  title: string;
  items: {
    label: string;
    value: number | string | null;
    unit: string | null;
  }[];
}
export interface TableBlock {
  kind: "table";
  title: string;
  columns: { key: string; label: string; unit: string | null }[];
  rows: Record<string, unknown>[];
  /** Why the table has no rows. */
  empty?: string;
}
export interface NoteBlock {
  kind: "note";
  text: string;
}
export type ReportBlock = MetricsBlock | TableBlock | NoteBlock;

export interface ReportSnapshot {
  format_version: number;
  title: string;
  /** `label` is in the server's time zone, e.g. "Sep 20, 2026 to Sep 26, 2026". */
  period: { start: string; end: string; label?: string };
  generated_at: string;
  generated_by: string | null;
  sections: { id: string; title: string; blocks: ReportBlock[] }[];
}

export interface ReportItem {
  id: number;
  title: string;
  sections: string[];
  section_titles: string[];
  period_start: string;
  period_end: string;
  period_label: string;
  format: ReportFormat;
  status: ReportStatus;
  error: string | null;
  generated_by: { id: number; full_name: string } | null;
  created_at: string;
  completed_at: string | null;
}

export interface ReportDetail extends ReportItem {
  data: ReportSnapshot | null;
}

/** The sections a report can include, in report order (backend SECTIONS). */
export const REPORT_SECTIONS: { id: string; label: string }[] = [
  { id: "search", label: "Search" },
  { id: "navigation", label: "Navigation and routes" },
  { id: "kiosks", label: "Kiosks" },
  { id: "qr", label: "QR handoff" },
  { id: "sensors", label: "Sensors" },
  { id: "spatial", label: "Crowd density" },
  { id: "system", label: "System performance" },
  { id: "activity", label: "Daily activity" },
];

const PATH = "/analytics/reports";
const unfinished = (status?: ReportStatus) =>
  status === "pending" || status === "generating";

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    enabled: isApiConfigured(),
    queryFn: () => apiClient.getPage<ReportItem>(`${PATH}?page_size=10`),
    // Keep refreshing while a report is still being generated.
    refetchInterval: query =>
      query.state.data?.results.some(r => unfinished(r.status)) ? 2000 : false,
  });
}

export function useReport(id: number | null) {
  return useQuery({
    queryKey: ["reports", id],
    enabled: isApiConfigured() && id !== null,
    queryFn: () => apiClient.get<ReportDetail>(`${PATH}/${id}`),
    refetchInterval: query =>
      unfinished(query.state.data?.status) ? 1500 : false,
  });
}

export interface ReportRequest {
  start_date: string;
  end_date: string;
  sections: string[];
  format: ReportFormat;
}

/** Requests a report and resolves once it's generated (or failed). */
async function generateAndWait(request: ReportRequest): Promise<ReportItem> {
  let report = await apiClient.post<ReportItem>(PATH, {
    range: "custom",
    ...request,
  });
  for (let tries = 0; unfinished(report.status) && tries < 120; tries++) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    report = await apiClient.get<ReportItem>(`${PATH}/${report.id}`);
  }
  // As ApiErrors, so the page's error toast shows these messages.
  const fail = (detail: string) => new ApiError(detail, 0, { detail });
  if (report.status === "failed")
    throw fail(
      `The report couldn't be generated. ${report.error ?? ""}`.trim()
    );
  if (unfinished(report.status))
    throw fail(
      "The report is taking longer than expected; it will appear under Recent reports."
    );
  return report;
}

export function useGenerateReport() {
  return useAdminMutation(generateAndWait, [["reports"]]);
}

/** Saves the report's CSV files (a ZIP) through the browser. */
export async function downloadReportCsv(report: Pick<ReportItem, "id">) {
  const response = await fetch(
    `${API_BASE_URL}${PATH}/${report.id}?download=csv`,
    {
      credentials: "include",
    }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new ApiError(
      `CSV download failed with ${response.status}`,
      response.status,
      body
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `flowsense-report-${report.id}.zip`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A block value as text: numbers get their unit, missing values a dash. */
export function formatValue(value: unknown, unit: string | null = null) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    const text = Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
    return unit ? `${text}${unit === "%" ? "%" : ` ${unit}`}` : text;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  return String(value);
}
