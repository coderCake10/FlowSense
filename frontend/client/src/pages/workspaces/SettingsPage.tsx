/* Civic Signal: operational workspace pages use AUF navy, signal gold, breathable tables, dynamic context panels, and restrained motion. */
import { FormEvent, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusPill } from "@/components/FlowSenseShell";
import {
  ConfirmDialog,
  Field,
  NativeSelect,
  QueryStatus,
} from "@/components/AdminBits";
import {
  SemesterInput,
  SemesterItem,
  formatWhen,
  useDeleteSemester,
  useSaveSemester,
  useSemesters,
  useSettings,
  useUpdateSetting,
} from "@/lib/adminApi";

const CLEAR_TIMES: [number, string][] = [
  [15 * 60, "15 minutes"],
  [30 * 60, "30 minutes"],
  [3600, "1 hour"],
  [6 * 3600, "6 hours"],
  [12 * 3600, "12 hours"],
  [24 * 3600, "24 hours"],
  [7 * 24 * 3600, "7 days"],
];

const clearTimeLabel = (seconds: number) =>
  CLEAR_TIMES.find(([s]) => s === seconds)?.[1] ??
  `${Math.round(seconds / 60)} minutes`;

const dateFormat = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T12:00:00`));

const emptySemester: SemesterInput = {
  academic_year: "",
  name: "",
  start_date: "",
  end_date: "",
  is_active: true,
};

function SemesterForm({
  semester,
  onDone,
}: {
  semester: SemesterItem | null;
  onDone: () => void;
}) {
  const save = useSaveSemester();
  const [form, setForm] = useState<SemesterInput>(
    semester ? { ...semester } : emptySemester
  );
  const invalidRange = Boolean(form.start_date && form.end_date && form.start_date > form.end_date);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ id: semester?.id, body: form }, { onSuccess: onDone });
  };
  return (
    <form onSubmit={submit} className="mt-5 border border-[#17365d] bg-[#f3f5f8] p-4" aria-label="Semester form">
      <p className="mb-4 text-sm font-bold text-[#17365d]">
        {semester ? `Edit ${semester.academic_year} ${semester.name}` : "Add a semester"}
      </p>
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Academic year">
          <Input
            required
            maxLength={20}
            placeholder="2026-2027"
            value={form.academic_year}
            onChange={e => setForm({ ...form, academic_year: e.target.value })}
            className="border-[#17365d] bg-white"
          />
        </Field>
        <Field label="Semester">
          <Input
            required
            maxLength={100}
            placeholder="First Semester"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="border-[#17365d] bg-white"
          />
        </Field>
        <Field label="Start date">
          <Input
            required
            type="date"
            value={form.start_date}
            onChange={e => setForm({ ...form, start_date: e.target.value })}
            className="border-[#17365d] bg-white"
          />
        </Field>
        <Field label="End date">
          <Input
            required
            type="date"
            value={form.end_date}
            min={form.start_date || undefined}
            onChange={e => setForm({ ...form, end_date: e.target.value })}
            className="border-[#17365d] bg-white"
            aria-invalid={invalidRange}
          />
        </Field>
      </div>
      {invalidRange && (
        <p role="alert" className="mt-2 text-xs font-semibold text-[#b13a36]">
          The end date can't be before the start date.
        </p>
      )}
      <label className="mt-4 flex items-center gap-3 text-sm text-[#40556d]">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={e => setForm({ ...form, is_active: e.target.checked })}
          className="size-4 accent-[#17365d]"
        />
        Active
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={save.isPending || invalidRange}
          className="bg-[#17365d] text-white hover:bg-[#102c4d]"
        >
          Save semester
        </Button>
      </div>
    </form>
  );
}

export function SettingsPage() {
  const settings = useSettings();
  const semesters = useSemesters();
  const updateSetting = useUpdateSetting();
  const removeSemester = useDeleteSemester();
  const [editing, setEditing] = useState<{ semester: SemesterItem | null } | null>(null);
  const [deleting, setDeleting] = useState<SemesterItem | null>(null);

  const clearTime = settings.data?.find(s => s.key === "informational_alert_clear_time");
  const maintenance = settings.data?.find(s => s.key === "maintenance_mode");
  const clearSeconds = Number(clearTime?.value.seconds ?? 3600);
  const maintenanceOn = Boolean(maintenance?.value.enabled);

  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Settings"
        title="Settings"
        description="Configure alerts, academic periods, and system-wide behavior."
      />
      <div className="space-y-4">
        <QueryStatus
          isLoading={settings.isLoading}
          error={settings.error}
          onRetry={() => settings.refetch()}
          what="settings"
        />
        {clearTime && (
          <Card className="rounded-none border-2 border-[#17365d]">
            <CardHeader className="border-b border-[#17365d]">
              <CardTitle className="font-display text-xl">Alerts</CardTitle>
              <p className="text-xs text-[#718398]">Informational alert clear time</p>
            </CardHeader>
            <CardContent className="grid gap-5 pt-5 md:grid-cols-[1fr_220px]">
              <div>
                <p className="text-sm font-bold text-[#17365d]">Automatic clear after</p>
                <p className="mt-1 text-xs text-[#718398]">
                  Applies to informational alerts only. Warning and critical
                  alerts remain until resolved.
                </p>
                <div className="mt-4 border border-[#17365d] bg-[#f3f5f8] p-3 text-xs">
                  <p className="font-bold">Current policy</p>
                  <p className="mt-1 text-[#718398]">
                    Informational alerts are automatically cleared after{" "}
                    {clearTimeLabel(clearSeconds)}.
                    {clearTime.updated_by &&
                      ` Last changed by ${clearTime.updated_by.full_name}, ${formatWhen(clearTime.updated_at)}.`}
                  </p>
                </div>
              </div>
              <NativeSelect
                aria-label="Informational alert clear time"
                className="h-11 rounded-none border-[#17365d] font-bold"
                value={clearSeconds}
                disabled={updateSetting.isPending}
                onChange={e =>
                  updateSetting.mutate({
                    key: "informational_alert_clear_time",
                    value: { seconds: Number(e.target.value) },
                  })
                }
              >
                {!CLEAR_TIMES.some(([s]) => s === clearSeconds) && (
                  <option value={clearSeconds}>{clearTimeLabel(clearSeconds)}</option>
                )}
                {CLEAR_TIMES.map(([seconds, label]) => (
                  <option key={seconds} value={seconds}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </CardContent>
          </Card>
        )}
        {maintenance && (
          <Card className="rounded-none border-2 border-[#17365d]">
            <CardHeader className="border-b border-[#17365d]">
              <CardTitle className="font-display text-xl">System status</CardTitle>
              <p className="text-xs text-[#718398]">Maintenance mode</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-[#17365d]">
                  Maintenance mode is {maintenanceOn ? "on" : "off"}
                </p>
                <p className="mt-1 max-w-xl text-xs text-[#718398]">
                  While it's on, the system status reads Maintenance, which
                  tells everyone FlowSense isn't available for use.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={maintenanceOn ? "Maintenance" : "Available"} tone={maintenanceOn ? "amber" : "green"} />
                <Button
                  variant="outline"
                  disabled={updateSetting.isPending}
                  onClick={() =>
                    updateSetting.mutate({
                      key: "maintenance_mode",
                      value: { enabled: !maintenanceOn },
                    })
                  }
                >
                  {maintenanceOn ? "Turn off" : "Turn on"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="rounded-none border-2 border-[#17365d]">
          <CardHeader className="border-b border-[#17365d]">
            <CardTitle className="font-display text-xl">Semester registry</CardTitle>
            <p className="text-xs text-[#718398]">
              Define academic year date ranges used by reporting and other
              time-based system functions.
            </p>
            {!editing && (
              <CardAction>
                <Button
                  className="bg-[#17365d] text-white hover:bg-[#102c4d]"
                  onClick={() => setEditing({ semester: null })}
                >
                  <Plus size={15} className="mr-2" />
                  Add semester
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="pt-5">
            <QueryStatus
              isLoading={semesters.isLoading}
              error={semesters.error}
              onRetry={() => semesters.refetch()}
              what="semesters"
            />
            {semesters.data && semesters.data.length === 0 && !editing && (
              <p className="text-sm text-[#718398]">No semesters yet.</p>
            )}
            {semesters.data && semesters.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-[0.14em] text-[#8291a3]">
                    <tr>
                      <th className="py-2">Academic year</th>
                      <th className="py-2">Semester</th>
                      <th className="py-2">Date range</th>
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3e9f0]">
                    {semesters.data.map(semester => (
                      <tr key={semester.id}>
                        <td className="py-3 font-semibold text-[#17365d]">{semester.academic_year}</td>
                        <td className="py-3 text-[#40556d]">{semester.name}</td>
                        <td className="py-3 text-[#40556d]">
                          {formatDate(semester.start_date)} – {formatDate(semester.end_date)}
                        </td>
                        <td className="py-3">
                          <StatusPill status={semester.is_active ? "Active" : "Inactive"} tone={semester.is_active ? "green" : "navy"} />
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${semester.academic_year} ${semester.name}`}
                            onClick={() => setEditing({ semester })}
                          >
                            <Pencil size={15} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-[#b13a36]"
                            aria-label={`Delete ${semester.academic_year} ${semester.name}`}
                            onClick={() => setDeleting(semester)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {editing && (
              <SemesterForm
                key={editing.semester?.id ?? "new"}
                semester={editing.semester}
                onDone={() => setEditing(null)}
              />
            )}
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.academic_year ?? ""} ${deleting?.name ?? ""}?`}
        description="The semester is removed from the registry. Analytics grouped by it will no longer show this period."
        confirmLabel="Delete semester"
        busy={removeSemester.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting && removeSemester.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </>
  );
}
