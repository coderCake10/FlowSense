/* Small building blocks shared by the connected admin pages: load/error states, form fields, confirmations. */
import { ReactNode, SelectHTMLAttributes } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { describeApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8493a5]">
      {children}
    </p>
  );
}

/** Loading or error placeholder for a query; renders nothing once data is ready. */
export function QueryStatus({
  isLoading,
  error,
  onRetry,
  what,
}: {
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  what: string;
}) {
  if (isLoading) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-[#dbe3ed] bg-white p-6 text-sm text-[#718398]"
      >
        Loading {what}…
      </div>
    );
  }
  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-2xl border border-[#f0c9c7] bg-[#fff6f5] p-5 text-sm text-[#8f2f2b] sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="flex items-center gap-2">
          <AlertTriangle size={16} />
          Couldn't load {what}. {describeApiError(error, "The server didn't respond.")}
        </span>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw size={14} className="mr-2" />
          Try again
        </Button>
      </div>
    );
  }
  return null;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold text-[#40556d]">
      {label}
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1 text-[11px] font-normal text-[#8a98a9]">{hint}</p>}
    </label>
  );
}

export function NativeSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-9 w-full rounded-md border border-[#dbe3ed] bg-white px-3 text-sm text-[#17365d] shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-[#f4c542]/60 disabled:opacity-60",
        className
      )}
    >
      {children}
    </select>
  );
}

/** A confirmation step for destructive actions (spec: "destructive actions require a clear confirmation"). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={next => !next && onCancel()}>
      <AlertDialogContent className="bg-white text-[#102c4d]">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-[#b13a36] text-white hover:bg-[#962f2b]"
            onClick={event => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
