/* Activity: uploads, validations, activations and floor changes from the
 * audit log (the assets.asset_audit_history entries plus building floor
 * updates). */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QueryStatus } from "@/components/AdminBits";
import { StatusPill } from "@/components/FlowSenseShell";
import { formatWhen, titleCase } from "@/lib/adminApi";
import { useAssetActivity } from "@/lib/assetsApi";
import { Panel } from "./common";

const CATEGORY: Record<string, string> = {
  asset: "Asset",
  validation: "Validation",
  configuration: "Configuration",
  administrative: "Administrative",
};

export function ActivityTab() {
  const [page, setPage] = useState(1);
  const activity = useAssetActivity(page);
  const rows = activity.data?.results ?? [];
  const meta = activity.data?.meta;
  return (
    <Panel title="Activity">
      <QueryStatus
        isLoading={activity.isLoading}
        error={activity.error}
        onRetry={() => activity.refetch()}
        what="asset activity"
      />
      {!activity.isLoading && !activity.error && rows.length === 0 && (
        <p className="text-sm text-[#718398]">Nothing recorded yet.</p>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full [&_td]:py-2 [&_td]:pr-3 [&_th]:pr-3 min-w-[640px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-[#8a98a9]">
              <tr>
                <th className="py-2">Date</th>
                <th>User</th>
                <th>Category</th>
                <th>Action</th>
                <th>Details</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const failed =
                  row.action === "validate" &&
                  /: failed$/.test(row.description ?? "");
                const warned =
                  row.action === "validate" &&
                  /: warning$/.test(row.description ?? "");
                return (
                  <tr key={row.id} className="border-t border-[#edf2f7]">
                    <td className="py-2 whitespace-nowrap">
                      {formatWhen(row.created_at)}
                    </td>
                    <td>{row.admin_user?.full_name ?? "System"}</td>
                    <td>
                      {CATEGORY[row.event_type] ?? titleCase(row.event_type)}
                    </td>
                    <td>{titleCase(row.action)}</td>
                    <td className="max-w-[320px]">{row.description}</td>
                    <td>
                      <StatusPill
                        status={
                          failed ? "Failed" : warned ? "Warnings" : "Succeeded"
                        }
                        tone={failed ? "red" : warned ? "amber" : "green"}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {meta && meta.total_pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-[#718398]">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          Page {meta.page} of {meta.total_pages}
          <Button
            size="sm"
            variant="outline"
            disabled={page >= meta.total_pages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </Panel>
  );
}
