/* Civic Signal: visitor-facing experiences use edge anchored wayfinding, AUF navy, signal gold route cues, and clear state transitions. */
import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Bluetooth,
  Check,
  Clock,
  CornerUpLeft,
  CornerUpRight,
  LocateFixed,
  MapPin,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrandMark } from "@/components/FlowSenseShell";
import { RouteSketch } from "@/components/RouteSketch";
import { buildings } from "@/data/buildings";
import {
  HANDOFF_QUERY_PARAM,
  currentStopIndex,
  resolveHandoff,
  type HandoffResolution,
  type HandoffSession,
} from "@/lib/handoff";
import { isApiConfigured } from "@/lib/api";
import { fetchSavedRoute } from "@/lib/kioskDirectory";
import { routeSteps, type StepKind } from "@/lib/routeSteps";
import { cn } from "@/lib/utils";

/* Per-phone progress, keyed by handoff session. Storage can be unavailable
 * (private mode, blocked site data); the checklist still works without it. */
const progressKey = (sessionId: string) => `flowsense:handoff:${sessionId}`;

function loadProgress(sessionId: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(progressKey(sessionId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed)
      ? parsed.filter(id => typeof id === "string")
      : null;
  } catch {
    return null;
  }
}

function saveProgress(sessionId: string, reached: string[]) {
  try {
    window.localStorage.setItem(
      progressKey(sessionId),
      JSON.stringify(reached)
    );
  } catch {
    /* Progress just won't survive a reload. */
  }
}

function readHandoff(): HandoffResolution {
  const token = new URLSearchParams(window.location.search).get(
    HANDOFF_QUERY_PARAM
  );
  return resolveHandoff(
    token,
    buildings,
    Date.now(),
    id => loadProgress(id) !== null
  );
}

function MobileHeader() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#dbe3ed] bg-white/90 px-5 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <BrandMark compact />
        <div>
          <p className="font-display text-sm font-bold">FlowSense</p>
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a98a9]">
            Mobile route
          </p>
        </div>
      </div>
    </header>
  );
}

const PROBLEMS = {
  missing: {
    title: "No route to show",
    body: "Scan the QR code on a FlowSense kiosk to bring your route to this phone.",
  },
  invalid: {
    title: "This QR code couldn't be read",
    body: "The link is incomplete or out of date. Scan the QR code on the kiosk again.",
  },
  expired: {
    title: "This route link has expired",
    body: "Route links last 15 minutes. Scan the QR code on the kiosk again to get a fresh one.",
  },
} as const;

export function MobilePage() {
  const [resolution] = useState(readHandoff);
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#102c4d]">
      <MobileHeader />
      {resolution.status === "ok" ? (
        <RoutedChecklist session={resolution.session} />
      ) : (
        <main className="mx-auto max-w-xl px-5 py-16 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e7eef6] text-[#17365d]">
            <QrCode size={26} />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold tracking-[-0.05em]">
            {PROBLEMS[resolution.status].title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#718398]">
            {PROBLEMS[resolution.status].body}
          </p>
        </main>
      )}
    </div>
  );
}

/** Loads the routes the kiosk requested for each stop (read only), then
 * shows the checklist. A route that can't be loaded keeps the stop's
 * built-in route, or none. */
function RoutedChecklist({ session }: { session: HandoffSession }) {
  const routed = isApiConfigured()
    ? session.destinations.filter(item => item.routeId)
    : [];
  const routes = useQueries({
    queries: routed.map(item => ({
      queryKey: ["handoff-route", item.routeId],
      queryFn: () => fetchSavedRoute(session.building, item.routeId!, item),
      staleTime: Infinity,
      retry: 1,
    })),
  });
  const loaded = routes.filter(route => !route.isPending).length;
  if (loaded < routed.length)
    return <Preparing loaded={loaded} total={routed.length} />;
  const byId = new Map(
    routes.flatMap(route => (route.data ? [[route.data.id, route.data]] : []))
  );
  return (
    <Checklist
      session={{
        ...session,
        destinations: session.destinations.map(
          item => byId.get(item.id) ?? item
        ),
      }}
    />
  );
}

function Preparing({ loaded, total }: { loaded: number; total: number }) {
  const percent = Math.round(((loaded + 1) / (total + 1)) * 100);
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-5 py-16">
      <h1 className="font-display text-3xl font-bold tracking-[-0.06em]">
        Preparing your route
      </h1>
      <p className="mt-3 text-sm leading-6 text-[#718398]">
        Loading directions for your{" "}
        {total === 1 ? "destination" : `${total} stops`}.
      </p>
      <div
        className="mt-8 h-2 overflow-hidden rounded-full bg-[#e7eef6]"
        role="progressbar"
        aria-label="Loading your route"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-[#f4c542] transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 flex justify-between text-[11px] font-semibold text-[#8a98a9]">
        <span>Loading route</span>
        <span>{percent}%</span>
      </p>
    </main>
  );
}

const STEP_ICONS: Record<StepKind, typeof ArrowUp> = {
  start: ArrowUp,
  left: CornerUpLeft,
  right: CornerUpRight,
  floor: ArrowUpDown,
  arrive: MapPin,
};

function Checklist({ session }: { session: HandoffSession }) {
  const { building, destinations } = session;
  const [reached, setReached] = useState<string[]>(
    () => loadProgress(session.id) ?? []
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Spec (Navigation Checklist, P2): the sticky re-open button appears only
   * after the visitor cancels the arrival confirmation. */
  const [dismissed, setDismissed] = useState(false);
  const current = currentStopIndex(destinations, reached);
  const done = current === -1;
  const stop = done ? null : destinations[current];

  // Record that this phone started the session, so a reload after the QR's
  // 15 minutes still opens the checklist.
  useEffect(() => {
    if (loadProgress(session.id) === null) saveProgress(session.id, []);
  }, [session.id]);

  const confirmArrival = () => {
    if (!stop) return;
    const next = [...reached, stop.id];
    setReached(next);
    saveProgress(session.id, next);
    setConfirmOpen(false);
    setDismissed(false);
  };

  return (
    <main className="mx-auto max-w-xl px-5 pb-28 pt-8">
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b08412]">
          {building.name} · {building.floor}
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.06em]">
          {done ? "You've reached every stop" : `To ${stop?.name}`}
        </h1>
        <p className="mt-3 text-xs text-[#718398]">
          Starting from the {building.startLabel.toLowerCase()} ·{" "}
          {destinations.length} {destinations.length === 1 ? "stop" : "stops"}
        </p>
      </div>

      <div className="mb-6 rounded-2xl bg-[#0b1f3a] p-5 text-white shadow-[0_14px_30px_rgba(11,31,58,0.13)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/50">
              Progress
            </p>
            <p className="mt-2 font-display text-2xl font-bold">
              {reached.length} of {destinations.length} reached
            </p>
          </div>
          <div className="grid size-11 place-items-center rounded-xl bg-[#f4c542] text-[#17365d]">
            <LocateFixed size={20} />
          </div>
        </div>
        <div
          className="mt-5 flex gap-1.5"
          role="progressbar"
          aria-label="Stops reached"
          aria-valuemin={0}
          aria-valuemax={destinations.length}
          aria-valuenow={reached.length}
        >
          {destinations.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                index < reached.length ? "bg-[#f4c542]" : "bg-white/15"
              )}
            />
          ))}
        </div>
      </div>

      {!done && (
        <div
          role="status"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-[#dbe3ed] bg-white p-4"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf2f7] text-[#8a98a9]">
            <Bluetooth size={16} />
          </span>
          <span className="text-xs leading-5">
            <span className="block font-semibold text-[#17365d]">
              Confirm each stop yourself
            </span>
            <span className="block text-[#718398]">
              Sensor arrival detection isn't available on phones yet. Tap "I've
              arrived" when you get there.
            </span>
          </span>
        </div>
      )}

      <ol aria-label="Your stops" className="space-y-3">
        {destinations.map((item, index) => {
          const isDone = reached.includes(item.id);
          const isCurrent = index === current;
          return (
            <li
              key={item.id}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "rounded-2xl border p-5",
                isDone
                  ? "border-[#d9ebdf] bg-[#f4fbf6]"
                  : isCurrent
                    ? "border-[#17365d] bg-white shadow-sm"
                    : "border-[#dbe3ed] bg-white"
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold",
                    isDone
                      ? "bg-[#dff5e9] text-[#168051]"
                      : isCurrent
                        ? "bg-[#17365d] text-white"
                        : "bg-[#edf2f7] text-[#718398]"
                  )}
                >
                  {isDone ? <Check size={17} /> : index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isDone ? "text-[#168051]" : "text-[#17365d]"
                    )}
                  >
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs text-[#8a98a9]">
                    {item.code} · {item.floor}
                    {isDone ? " · Reached" : isCurrent ? " · Next stop" : ""}
                  </p>
                </div>
              </div>
              {isCurrent && (
                <div className="mt-4 space-y-3">
                  <RouteSketch building={building} destination={item} />
                  {item.points.length >= 2 && (
                    <p className="flex items-center gap-2 text-[11px] text-[#718398]">
                      <span className="size-2.5 rounded-full bg-[#17365d]" />
                      {building.startLabel}
                      <span
                        className="ml-2 size-2.5 rounded-full"
                        style={{ background: item.color }}
                      />
                      {item.code}
                    </p>
                  )}
                  {(() => {
                    const steps = routeSteps(building, item);
                    return steps.length ? (
                      <ol
                        aria-label={`Directions to ${item.code}`}
                        className="divide-y divide-[#edf2f7] rounded-xl border border-[#dbe3ed]"
                      >
                        {steps.map((step, stepIndex) => {
                          const Icon = STEP_ICONS[step.kind];
                          return (
                            <li
                              key={stepIndex}
                              className="flex items-center gap-3 px-3 py-2.5"
                            >
                              <span
                                className={cn(
                                  "grid size-8 shrink-0 place-items-center rounded-lg",
                                  step.kind === "arrive"
                                    ? "bg-[#17365d] text-white"
                                    : step.kind === "floor"
                                      ? "bg-[#fdf3d0] text-[#8a6500]"
                                      : "bg-[#edf2f7] text-[#17365d]"
                                )}
                              >
                                <Icon size={15} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs font-semibold text-[#17365d]">
                                  {step.title}
                                </span>
                                <span className="block text-[11px] text-[#718398]">
                                  {step.detail}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    ) : null;
                  })()}
                  <Button
                    className="h-11 w-full bg-[#17365d] text-white hover:bg-[#102c4d]"
                    onClick={() => setConfirmOpen(true)}
                  >
                    I've arrived <ArrowRight size={15} className="ml-2" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {done && (
        <p className="mt-6 flex items-center gap-2 text-sm text-[#168051]">
          <Check size={16} />
          All stops reached. You can close this page.
        </p>
      )}
      {!done && (
        <p className="mt-4 flex items-center gap-2 text-[11px] text-[#96a4b3]">
          <Clock size={12} />
          Your progress is saved on this phone.
        </p>
      )}

      {stop && dismissed && !confirmOpen && (
        <button
          onClick={() => setConfirmOpen(true)}
          className="fixed bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[#f4c542] px-5 py-3 text-xs font-bold text-[#17365d] shadow-xl hover:bg-[#e8ba2d]"
        >
          <LocateFixed size={15} />
          Confirm arrival at {stop.code}
        </button>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={open => {
          setConfirmOpen(open);
          if (!open) setDismissed(true);
        }}
      >
        <DialogContent className="max-w-sm bg-white text-[#17365d]">
          <DialogHeader>
            <DialogTitle>Have you reached {stop?.name}?</DialogTitle>
            <DialogDescription>
              {current < destinations.length - 1
                ? "Confirm to mark this stop as reached and continue to your next stop."
                : "Confirm to mark your last stop as reached."}
            </DialogDescription>
          </DialogHeader>
          <p className="flex items-center gap-3 rounded-xl border border-[#dbe3ed] bg-[#f7f9fc] px-4 py-3 text-sm font-semibold">
            <MapPin size={16} className="shrink-0" />
            {stop?.code} · {stop?.floor}
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-11 border-[#dbe3ed] text-[#53677d]"
              onClick={() => {
                setConfirmOpen(false);
                setDismissed(true);
              }}
            >
              Not yet
            </Button>
            <Button
              className="h-11 bg-[#17365d] text-white hover:bg-[#102c4d]"
              onClick={confirmArrival}
            >
              {current < destinations.length - 1
                ? "Yes, continue"
                : "Yes, finish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
