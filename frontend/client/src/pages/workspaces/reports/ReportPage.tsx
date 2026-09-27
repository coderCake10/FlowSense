/* A generated report as a printable page ("Save as PDF" in the browser's
 * print dialog). It draws whatever sections and blocks the snapshot holds,
 * so new analytics sections need no change here. */
import { ArrowLeft, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/FlowSenseShell";
import { QueryStatus } from "@/components/AdminBits";
import { describeApiError } from "@/lib/api";
import {
  downloadReportCsv,
  formatValue,
  useReport,
  type ReportBlock,
} from "@/lib/reportsApi";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: "long" });

function Block({ block }: { block: ReportBlock }) {
  if (block.kind === "note") {
    return (
      <p className="rounded-lg border border-dashed border-[#dbe3ed] px-3 py-2 text-xs text-[#66768a] print:border-[#999]">
        Not recorded yet: {block.text}
      </p>
    );
  }
  if (block.kind === "metrics") {
    return (
      <div className="break-inside-avoid">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#718398]">
          {block.title}
        </h3>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 print:grid-cols-3">
          {block.items.map(item => (
            <div
              key={item.label}
              className="rounded-lg bg-[#f7f9fc] px-3 py-2 print:border print:border-[#ccc] print:bg-white"
            >
              <dt className="text-[11px] text-[#718398]">{item.label}</dt>
              <dd className="font-display text-lg font-bold text-[#17365d]">
                {formatValue(item.value, item.unit)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }
  return (
    <div className="break-inside-avoid">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#718398]">
        {block.title}
      </h3>
      {block.rows.length === 0 ? (
        <p className="text-sm text-[#66768a]">
          {block.empty ?? "No data in this period."}
        </p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left text-xs [&_td]:border-t [&_td]:border-[#edf2f7] [&_td]:py-1.5 [&_td]:pr-3 [&_th]:pr-3">
            <thead className="text-[10px] uppercase tracking-[0.1em] text-[#8a98a9]">
              <tr>
                {block.columns.map(c => (
                  <th key={c.key} className="py-1.5">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {block.columns.map(c => (
                    <td key={c.key}>{formatValue(row[c.key], c.unit)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ReportPage({ id }: { id: string }) {
  const report = useReport(Number(id) || null);
  const snapshot = report.data?.data;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="outline" asChild>
          <Link href="/analytics">
            <ArrowLeft size={16} className="mr-2" /> Analytics
          </Link>
        </Button>
        {snapshot && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                downloadReportCsv({ id: Number(id) }).catch(error =>
                  toast.error(
                    describeApiError(error, "The CSV couldn't be downloaded.")
                  )
                )
              }
            >
              <Download size={16} className="mr-2" /> CSV
            </Button>
            <Button
              className="bg-[#17365d] text-white hover:bg-[#102c4d]"
              onClick={() => window.print()}
            >
              <Printer size={16} className="mr-2" /> Print or save as PDF
            </Button>
          </div>
        )}
      </div>

      <QueryStatus
        isLoading={report.isLoading}
        error={report.error}
        onRetry={() => report.refetch()}
        what="the report"
      />
      {report.data && !snapshot && (
        <p role="status" className="text-sm text-[#66768a]">
          {report.data.status === "failed"
            ? `This report couldn't be generated. ${report.data.error ?? ""}`
            : "The report is still being generated…"}
        </p>
      )}

      {snapshot && (
        <article className="rounded-2xl border border-[#dbe3ed] bg-white p-8 text-[#102c4d] print:rounded-none print:border-0 print:p-0">
          <header className="flex items-start justify-between gap-6 border-b border-[#dbe3ed] pb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b08412]">
                FlowSense analytics report
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-[-0.03em]">
                {snapshot.title}
              </h1>
              <p className="mt-2 text-sm text-[#52657a]">
                {snapshot.period.label ??
                  `${day(snapshot.period.start)} to ${day(snapshot.period.end)}`}
              </p>
              <p className="mt-1 text-xs text-[#8391a3]">
                Generated {when(snapshot.generated_at)}
                {snapshot.generated_by ? ` by ${snapshot.generated_by}` : ""}.
                Figures are as of that time.
              </p>
            </div>
            <div className="rounded-xl bg-[#0b1f3a] p-3 print:bg-white">
              <BrandMark compact />
            </div>
          </header>

          {snapshot.sections.map(section => (
            <section key={section.id} className="mt-7 break-inside-avoid-page">
              <h2 className="mb-3 font-display text-lg font-bold">
                {section.title}
              </h2>
              <div className="space-y-4">
                {section.blocks.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </div>
            </section>
          ))}
          {snapshot.sections.length === 0 && (
            <p className="mt-6 text-sm text-[#66768a]">
              This report has no sections.
            </p>
          )}
        </article>
      )}
    </div>
  );
}
