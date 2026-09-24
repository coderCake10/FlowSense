import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ListPlus,
  ListOrdered,
  Search,
  Navigation,
  MapPin,
  RotateCcw,
  Smartphone,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { BrandMark } from "@/components/FlowSenseShell";
import { BuildingFloorMap } from "@/components/BuildingFloorMap";
import { buildings } from "@/data/buildings";
import type { Destination } from "@/data/navigation";
import {
  activateQueue,
  addToQueue,
  isQueued,
  nextStop,
  removeFromQueue,
} from "@/lib/kioskQueue";
import {
  createHandoff,
  handoffUrl,
  newSessionId,
  publicBaseUrl,
} from "@/lib/handoff";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function KioskPage() {
  const [building, setBuilding] = useState(buildings[0]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Destination | null>(null);
  const [active, setActive] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [queue, setQueue] = useState<Destination[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  /** Handoff session for the open queue modal; issued when the modal opens. */
  const [handoff, setHandoff] = useState<{
    id: string;
    issuedAt: number;
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => window.location.assign("/attraction"), 60000);
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"];
    reset();
    events.forEach(event =>
      window.addEventListener(event, reset, { passive: true })
    );
    return () => {
      clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, reset));
    };
  }, []);
  const shown = building.destinations.filter(d =>
    `${d.name} ${d.code}`.toLowerCase().includes(search.toLowerCase())
  );
  const upNext = nextStop(queue, selected?.id ?? null);
  const handoffLink =
    handoff && queue.length
      ? (() => {
          const payload = createHandoff(
            building,
            queue,
            handoff.issuedAt,
            handoff.id
          );
          return {
            url: handoffUrl(payload, publicBaseUrl()),
            expiresAt: new Date(payload.exp * 1000).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            }),
          };
        })()
      : null;

  const startNavigation = (destination: Destination) => {
    setSelected(destination);
    setActive(true);
    setKeyboard(false);
    setQueueOpen(false);
  };
  /** Clears the current pick so the visitor can choose again. */
  const changeDestination = () => {
    setSelected(null);
    setActive(false);
    searchRef.current?.focus();
  };
  /** Finishing a route also removes it from the queue. */
  const endRoute = () => {
    if (selected) setQueue(q => removeFromQueue(q, selected.id));
    setSelected(null);
    setActive(false);
  };
  const goToNextStop = () => {
    if (!upNext) return;
    if (selected) setQueue(q => removeFromQueue(q, selected.id));
    startNavigation(upNext);
  };
  const queueSelected = () => {
    if (!selected || isQueued(queue, selected.id)) return;
    setQueue(q => addToQueue(q, selected));
    toast.success(`${selected.code} added to your queue`);
  };
  /** Navigate (per the kiosk spec): activate the queue, start the first stop,
   * and open the queue modal with the stop list and the phone handoff QR. */
  const navigate = () => {
    const next = activateQueue(queue, selected);
    if (!next.length) return;
    setQueue(next);
    setSelected(next[0]);
    setActive(true);
    setKeyboard(false);
    showQueue();
  };
  /** Opens the queue modal with a fresh handoff session (new QR, new expiry). */
  const showQueue = () => {
    setHandoff({ id: newSessionId(), issuedAt: Date.now() });
    setQueueOpen(true);
  };
  const openQueue = showQueue;
  /** Removing the stop being navigated also ends that route. */
  const removeStop = (id: string) => {
    setQueue(q => removeFromQueue(q, id));
    if (active && selected?.id === id) {
      setSelected(null);
      setActive(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#17365d]">
      <header className="flex min-h-[72px] items-center justify-between gap-4 border-b border-[#dbe3ed] bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <BrandMark compact />
          <div>
            <p className="font-display font-bold">FlowSense</p>
            <p className="text-xs text-[#718398]">AUF wayfinding kiosk</p>
          </div>
        </div>
        <p className="text-right text-sm">
          {building.name}{" "}
          <span className="block text-xs text-[#718398]">
            {building.floor} · {building.startLabel}
          </span>
        </p>
      </header>
      <main className="grid min-h-[calc(100vh-72px)] md:h-[calc(100vh-72px)] md:min-h-0 grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
        <aside className="overflow-y-auto border-r-2 border-[#f4c542] bg-[#0b1f3a] p-4 text-white shadow-[8px_0_24px_rgba(11,31,58,.16)]">
          <button
            onClick={() => window.location.assign("/attraction")}
            className="mb-4 flex w-full items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <h1 className="mb-2 font-display text-sm font-medium italic text-white/78">
            Where do you want to go?
          </h1>
          <label className="relative block">
            <Search
              size={18}
              className="absolute left-3 top-3 text-slate-500"
            />
            <input
              ref={searchRef}
              aria-label="Search destinations"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or room code"
              className="h-9 w-full rounded-md border border-[#17365d] bg-white pl-10 pr-3 text-xs text-[#17365d]"
            />
          </label>
          <button
            onClick={() => setKeyboard(v => !v)}
            className="mt-2 text-xs text-white/70 underline"
          >
            On-screen keyboard
          </button>
          <select
            aria-label="Building"
            value={building.id}
            onChange={event => {
              const next = buildings.find(
                item => item.id === event.target.value
              );
              if (!next) return;
              setBuilding(next);
              setSearch("");
              setSelected(null);
              setActive(false);
              setKeyboard(false);
              setQueue([]);
              setQueueOpen(false);
            }}
            className="mt-3 h-9 w-full border border-[#17365d] bg-white px-2 text-xs text-[#17365d]"
          >
            {buildings.map(item => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.floor}
              </option>
            ))}
          </select>
          <p className="mt-5 text-[10px] font-medium uppercase tracking-[.1em] text-white/48">
            {shown.length} Destinations · sorted by building
          </p>
          <p className="mb-2 mt-3 font-display text-sm font-medium text-white/82">
            {building.name}
          </p>
          <div className="space-y-2">
            {shown.map(d => (
              <button
                key={d.id}
                aria-pressed={selected?.id === d.id}
                onClick={() => {
                  setSelected(d);
                  setActive(false);
                  setKeyboard(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-4 border-b border-[#dbe3ed] py-3 text-left text-xs transition-colors",
                  selected?.id === d.id
                    ? "font-medium text-white bg-white/5"
                    : "font-normal text-white/68 hover:bg-white/5"
                )}
              >
                <span className="min-w-0">
                  <span className="block font-medium leading-5 text-white/88">
                    {d.name}
                  </span>
                  <span className="text-[10px] uppercase text-white/48">
                    {d.floor}
                    {isQueued(queue, d.id) && " · In queue"}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs text-white/65">
                  {d.code}
                </span>
              </button>
            ))}
            {!shown.length && (
              <p role="status" className="py-4 text-sm text-white/70">
                No matching destinations. Try a room code or office name.
              </p>
            )}
          </div>
          <div className="mt-6 border-t border-white/20 pt-5 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <MapPin size={16} />
              Starting point
            </p>
            <p className="mt-2 text-white/65">
              {building.startLabel} · {building.floor}
            </p>
          </div>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="relative h-[480px] min-h-0 flex-1 md:h-auto">
            <BuildingFloorMap
              key={building.id}
              building={building}
              destination={selected}
            />
          </div>
          <div
            className="shrink-0 border-t border-[#dbe3ed] bg-white p-5"
            aria-live="polite"
          >
            {selected ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: selected.color }}
                  >
                    {active ? "Follow the highlighted route" : "Route preview"}{" "}
                    · {selected.code}
                  </p>
                  <h2 className="mt-1 text-lg font-bold">{selected.name}</h2>
                  <p className="mt-1 text-sm text-[#718398]">
                    From {building.startLabel} to the destination ·{" "}
                    {building.floor}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={changeDestination}
                    className="flex shrink-0 items-center gap-2 rounded-lg border border-[#dbe3ed] px-4 py-3 text-sm font-semibold text-[#52657a] hover:border-[#17365d] hover:text-[#17365d]"
                  >
                    <RotateCcw size={16} />
                    Change destination
                  </button>
                  {!active && (
                    <button
                      onClick={queueSelected}
                      disabled={isQueued(queue, selected.id)}
                      className="flex shrink-0 items-center gap-2 rounded-lg border border-[#17365d] px-4 py-3 text-sm font-bold disabled:border-[#cfe3d8] disabled:text-[#168051]"
                    >
                      {isQueued(queue, selected.id) ? (
                        <>
                          <Check size={16} />
                          In queue
                        </>
                      ) : (
                        <>
                          <ListPlus size={16} />
                          Add to queue
                        </>
                      )}
                    </button>
                  )}
                  {queue.length > 0 && (
                    <QueueButton count={queue.length} onClick={openQueue} />
                  )}
                  {active && upNext && (
                    <button
                      onClick={goToNextStop}
                      className="flex shrink-0 items-center gap-2 rounded-lg border border-[#17365d] px-4 py-3 text-sm font-bold"
                    >
                      Next stop · {upNext.code}
                      <ArrowRight size={16} />
                    </button>
                  )}
                  <button
                    className="flex shrink-0 items-center gap-2 rounded-lg bg-[#17365d] px-5 py-3 text-sm font-bold text-white"
                    onClick={active ? endRoute : navigate}
                  >
                    {active ? <Square size={15} /> : <Navigation size={17} />}
                    {active ? "End route" : "Navigate"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-[#718398]">
                  Select an office to see the walking route from this kiosk.
                </p>
                {queue.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <QueueButton count={queue.length} onClick={openQueue} />
                    <button
                      onClick={navigate}
                      className="flex shrink-0 items-center gap-2 rounded-lg bg-[#17365d] px-5 py-3 text-sm font-bold text-white"
                    >
                      <Navigation size={17} />
                      Navigate
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
      <Dialog open={queueOpen} onOpenChange={setQueueOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-white text-[#17365d] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Destination queue</DialogTitle>
            <DialogDescription>
              {active
                ? "Follow the highlighted route on the map, or scan the code to continue on your phone."
                : "Stops are visited in order. Press Navigate to start."}
            </DialogDescription>
          </DialogHeader>
          {queue.length === 0 ? (
            <p
              role="status"
              className="py-6 text-center text-sm text-[#718398]"
            >
              Your queue is empty. Select a destination and choose "Add to
              queue" or "Navigate".
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_220px]">
              <ol
                aria-label="Queued stops"
                className="divide-y divide-[#dbe3ed] self-start rounded-lg border border-[#dbe3ed]"
              >
                {queue.map((item, index) => {
                  const current = active && selected?.id === item.id;
                  return (
                    <li key={item.id} className="flex items-center gap-3 p-3">
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                          current ? "bg-[#17365d] text-white" : "bg-[#eef3f7]"
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {item.name}
                        </span>
                        <span className="text-xs text-[#718398]">
                          {item.code} · {item.floor}
                          {current && " · Navigating now"}
                        </span>
                      </span>
                      {!current && (
                        <button
                          onClick={() => startNavigation(item)}
                          className="flex items-center gap-1.5 rounded-lg bg-[#17365d] px-3 py-2 text-xs font-bold text-white"
                        >
                          <Navigation size={13} />
                          Go
                        </button>
                      )}
                      <button
                        aria-label={`Remove ${item.code} from queue`}
                        onClick={() => removeStop(item.id)}
                        className="rounded-lg border border-[#dbe3ed] p-2 text-[#52657a] hover:text-[#b13a36]"
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  );
                })}
              </ol>
              <section
                aria-label="Continue on your phone"
                className="rounded-lg border border-[#dbe3ed] bg-[#fbfcfe] p-4 text-center"
              >
                <p className="flex items-center justify-center gap-2 text-sm font-semibold">
                  <Smartphone size={16} />
                  Continue on your phone
                </p>
                {handoffLink && (
                  <>
                    <div className="mx-auto mt-3 w-fit rounded-xl bg-white p-2">
                      <QRCodeSVG
                        value={handoffLink.url}
                        size={152}
                        level="M"
                        title="QR code to continue this route on your phone"
                        data-handoff-url={handoffLink.url}
                      />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[#718398]">
                      Scan with your phone camera to get this checklist of{" "}
                      {queue.length} {queue.length === 1 ? "stop" : "stops"}.
                      Valid until {handoffLink.expiresAt}.
                    </p>
                  </>
                )}
              </section>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {active ? (
              <button
                onClick={() => setQueueOpen(false)}
                className="flex items-center gap-2 rounded-lg bg-[#17365d] px-5 py-3 text-sm font-bold text-white"
              >
                Follow on this kiosk
                <ArrowRight size={16} />
              </button>
            ) : (
              queue.length > 0 && (
                <button
                  onClick={navigate}
                  className="flex items-center gap-2 rounded-lg bg-[#17365d] px-5 py-3 text-sm font-bold text-white"
                >
                  <Navigation size={16} />
                  Navigate
                </button>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
      {keyboard && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,760px)] -translate-x-1/2 rounded-2xl border bg-[#eef3f7] p-4 shadow-2xl">
          <div className="mb-3 flex justify-between">
            <span className="text-sm font-bold">Search keyboard</span>
            <button onClick={() => setKeyboard(false)}>Close</button>
          </div>
          <div className="grid grid-cols-10 gap-2">
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-".split("").map(letter => (
              <button
                key={letter}
                onClick={() => setSearch(v => v + letter)}
                className="min-h-11 rounded border bg-white font-bold"
              >
                {letter}
              </button>
            ))}
            <button
              onClick={() => setSearch(v => v + " ")}
              className="col-span-3 min-h-11 rounded border bg-white"
            >
              Space
            </button>
            <button
              onClick={() => setSearch(v => v.slice(0, -1))}
              className="col-span-3 min-h-11 rounded bg-[#17365d] text-white"
            >
              Backspace
            </button>
            <button
              onClick={() => setSearch("")}
              className="col-span-3 min-h-11 rounded border bg-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QueueButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-2 rounded-lg border border-[#17365d] px-4 py-3 text-sm font-bold"
    >
      <ListOrdered size={16} />
      Queue ({count})
    </button>
  );
}
