/* Analytics › Reports and exports: choose a period, the sections and a
 * format, generate, then open (PDF) or download (CSV); past reports below. */
import { FormEvent, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/FlowSenseShell";
import { Field } from "@/components/AdminBits";
import { describeApiError, isApiConfigured } from "@/lib/api";
import { formatWhen } from "@/lib/adminApi";
import {
  REPORT_SECTIONS,
  downloadReportCsv,
  useGenerateReport,
  useReports,
  type ReportFormat,
  type ReportItem,
} from "@/lib/reportsApi";

/** yyyy-mm-dd in the browser's own time zone. */
function localDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function download(report: Pick<ReportItem, "id">) {
  try {
    await downloadReportCsv(report);
  } catch (error) {
    toast.error(describeApiError(error, "The CSV couldn't be downloaded."));
  }
}

export function ReportsPanel() {
  const live = isApiConfigured();
  const [start, setStart] = useState(localDay(-6));
  const [end, setEnd] = useState(localDay());
  const [sections, setSections] = useState(REPORT_SECTIONS.map(s => s.id));
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [, navigate] = useLocation();
  const generate = useGenerateReport();
  const reports = useReports();

  const invalid = !start || !end || start > end || sections.length === 0;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    generate.mutate(
      { start_date: start, end_date: end, sections, format },
      {
        // Ready: open the printable page (PDF) or save the ZIP (CSV).
        onSuccess: report =>
          format === "csv"
            ? void download(report)
            : navigate(`/analytics/reports/${report.id}`),
      }
    );
  };
  const toggle = (id: string, on: boolean) =>
    setSections(current =>
      on
        ? REPORT_SECTIONS.map(s => s.id).filter(
            s => s === id || current.includes(s)
          )
        : current.filter(s => s !== id)
    );
  const busy = generate.isPending;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card className="border-[#dbe3ed] shadow-[0_10px_30px_rgba(16,44,77,0.04)]">
        <CardHeader>
          <CardTitle className="font-display text-base">
            Generate a report
          </CardTitle>
          <p className="text-xs text-[#8391a3]">
            A report keeps the figures of the day it&apos;s made, so it reads
            the same every time it&apos;s opened.
          </p>
        </CardHeader>
        <CardContent>
          {!live ? (
            <p className="text-sm text-[#66768a]">
              Reports need the FlowSense server.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From">
                  <Input
                    type="date"
                    aria-label="From"
                    value={start}
                    max={end}
                    onChange={e => setStart(e.target.value)}
                    className="border-[#dbe3ed]"
                  />
                </Field>
                <Field label="To">
                  <Input
                    type="date"
                    aria-label="To"
                    value={end}
                    min={start}
                    onChange={e => setEnd(e.target.value)}
                    className="border-[#dbe3ed]"
                  />
                </Field>
              </div>
              <fieldset>
                <legend className="text-xs font-semibold text-[#40556d]">
                  Sections
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {REPORT_SECTIONS.map(section => (
                    <label
                      key={section.id}
                      className="flex items-center gap-2 text-sm text-[#40556d]"
                    >
                      <Checkbox
                        aria-label={section.label}
                        checked={sections.includes(section.id)}
                        onCheckedChange={value =>
                          toggle(section.id, value === true)
                        }
                      />
                      {section.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold text-[#40556d]">
                  Format
                </legend>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-[#40556d]">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="report-format"
                      checked={format === "pdf"}
                      onChange={() => setFormat("pdf")}
                    />
                    PDF (opens a printable page)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="report-format"
                      checked={format === "csv"}
                      onChange={() => setFormat("csv")}
                    />
                    CSV (a ZIP, one file per table)
                  </label>
                </div>
              </fieldset>
              {start > end && (
                <p className="text-xs text-[#b13a36]">
                  The end can&apos;t be before the start.
                </p>
              )}
              {sections.length === 0 && (
                <p className="text-xs text-[#b13a36]">
                  Choose at least one section.
                </p>
              )}
              <Button
                type="submit"
                disabled={invalid || busy}
                className="bg-[#17365d] text-white hover:bg-[#102c4d]"
              >
                {busy ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <FileText size={16} className="mr-2" />
                )}
                {busy ? "Generating…" : "Generate report"}
              </Button>
              <p className="text-[11px] text-[#8a98a9]">
                Scheduled reports aren&apos;t available yet.
              </p>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#dbe3ed] shadow-[0_10px_30px_rgba(16,44,77,0.04)]">
        <CardHeader>
          <CardTitle className="font-display text-base">
            Recent reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(reports.data?.results ?? []).length === 0 ? (
            <p className="text-sm text-[#66768a]">
              {reports.isLoading ? "Loading…" : "No reports yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs [&_td]:py-2 [&_td]:pr-3 [&_th]:pr-3">
                <thead className="text-[10px] uppercase tracking-[0.12em] text-[#8a98a9]">
                  <tr>
                    <th className="py-2">Period</th>
                    <th>Sections</th>
                    <th>Made</th>
                    <th>Status</th>
                    <th className="text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.data!.results.map(report => (
                    <tr key={report.id} className="border-t border-[#edf2f7]">
                      <td className="whitespace-nowrap">
                        {report.period_label}
                      </td>
                      <td
                        className="max-w-[220px] truncate"
                        title={report.section_titles.join(", ")}
                      >
                        {report.section_titles.join(", ")}
                      </td>
                      <td className="whitespace-nowrap">
                        {formatWhen(report.created_at)}
                        {report.generated_by
                          ? ` · ${report.generated_by.full_name}`
                          : ""}
                      </td>
                      <td>
                        <StatusPill
                          status={
                            report.status === "completed"
                              ? "Ready"
                              : report.status === "failed"
                                ? "Failed"
                                : "Generating"
                          }
                          tone={
                            report.status === "completed"
                              ? "green"
                              : report.status === "failed"
                                ? "red"
                                : "gold"
                          }
                        />
                      </td>
                      <td className="text-right">
                        {report.status === "completed" && (
                          <div className="inline-flex gap-1">
                            <Button size="sm" variant="outline" asChild>
                              <Link
                                href={`/analytics/reports/${report.id}`}
                                aria-label={`Open report ${report.id}`}
                              >
                                <FileText size={14} className="mr-1" /> PDF
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Download CSV of report ${report.id}`}
                              onClick={() => void download(report)}
                            >
                              <Download size={14} className="mr-1" /> CSV
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
