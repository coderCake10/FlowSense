/* Small pieces shared by the Asset Management tabs. */
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { StatusPill } from "@/components/FlowSenseShell";
import type {
  AssetItem,
  AssetVersion,
  CheckStatus,
  ValidationResult,
} from "@/lib/assetsApi";
import { cn } from "@/lib/utils";
import { versionState } from "./helpers";

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-[#f7f9fc] p-4">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a98a9]">
        {label}
      </p>
      <p className="mt-2 font-display text-xl font-bold text-[#17365d]">
        {value}
      </p>
    </div>
  );
}

export function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#edf2f7] py-2 text-xs last:border-0">
      <span className="text-[#718398]">{label}</span>
      <span className="text-right font-semibold text-[#17365d]">
        {children}
      </span>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[#dbe3ed] bg-white p-4",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#718398]">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function VersionPill({
  asset,
  version,
}: {
  asset: AssetItem;
  version: AssetVersion;
}) {
  const state = versionState(asset, version);
  const tone =
    state === "Active"
      ? "green"
      : state === "Failed"
        ? "red"
        : state === "Processing" || state === "Ready to activate"
          ? "gold"
          : "navy";
  return <StatusPill status={state} tone={tone} />;
}

export function ResultPill({
  result,
}: {
  result: ValidationResult | null | undefined;
}) {
  if (!result) return <StatusPill status="Not validated" tone="navy" />;
  return (
    <StatusPill
      status={
        result === "passed"
          ? "Passed"
          : result === "warning"
            ? "Warnings"
            : "Failed"
      }
      tone={
        result === "passed" ? "green" : result === "warning" ? "amber" : "red"
      }
    />
  );
}

export function CheckIcon({ status }: { status: CheckStatus }) {
  if (status === "passed")
    return (
      <CheckCircle2
        size={15}
        className="shrink-0 text-[#168051]"
        aria-label="Passed"
      />
    );
  if (status === "warning")
    return (
      <AlertTriangle
        size={15}
        className="shrink-0 text-[#b07a00]"
        aria-label="Warning"
      />
    );
  return (
    <XCircle size={15} className="shrink-0 text-[#b13a36]" aria-label="Error" />
  );
}
