import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Navigation,
  MapPin,
  QrCode,
} from "lucide-react";
import { BrandMark } from "@/components/FlowSenseShell";
import { BuildingFloorMap } from "@/components/BuildingFloorMap";
import { buildings } from "@/data/buildings";
import type { Destination } from "@/data/navigation";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function KioskPage() {
  const [building, setBuilding] = useState(buildings[0]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Destination | null>(null);
  const [active, setActive] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);
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
              setQueueOpen(false);
              setShowQr(false);
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
                <Dialog
                  open={queueOpen}
                  onOpenChange={open => {
                    setQueueOpen(open);
                    setShowQr(false);
                  }}
                >
                  <DialogTrigger asChild>
                    <button className="flex shrink-0 items-center gap-2 rounded-lg border border-[#17365d] px-5 py-3 text-sm font-bold">
                      <QrCode size={17} />
                      {active ? "Destination Queue" : "Add to queue"}
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto bg-white text-[#17365d] sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {showQr
                          ? "Continue on your phone"
                          : "Destination Queue"}
                      </DialogTitle>
                      <DialogDescription>
                        {showQr
                          ? `QR handoff for ${selected.name}.`
                          : "Your selected destination is ready for navigation."}
                      </DialogDescription>
                    </DialogHeader>
                    {showQr ? (
                      <div className="space-y-5 text-center">
                        <QrCode
                          size={180}
                          className="mx-auto"
                          aria-hidden="true"
                        />
                        <p className="text-xs text-[#718398]">
                          QR preview — mobile handoff is not connected yet.
                        </p>
                        <button
                          onClick={() => setShowQr(false)}
                          className="rounded-lg border border-[#17365d] px-5 py-3 text-sm font-bold"
                        >
                          Back to queue
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-6 sm:grid-cols-[1fr_180px]">
                        <div className="rounded border border-[#dbe3ed] p-4">
                          <p className="font-bold">{selected.name}</p>
                          <p className="mt-1 text-xs text-[#718398]">
                            {selected.code} · {selected.building} ·{" "}
                            {selected.floor}
                          </p>
                          <button
                            onClick={() => {
                              setQueueOpen(false);
                              setActive(true);
                            }}
                            className="mt-6 flex items-center gap-2 rounded-lg bg-[#17365d] px-5 py-3 text-sm font-bold text-white"
                          >
                            Start Navigation <ArrowRight size={15} />
                          </button>
                        </div>
                        <button
                          onClick={() => setShowQr(true)}
                          className="grid min-h-40 place-items-center gap-3 rounded border border-[#17365d] bg-[#fbfcfe] p-4 text-center"
                        >
                          <QrCode size={74} aria-hidden="true" />
                          <span className="text-xs font-semibold">
                            Show QR display
                          </span>
                        </button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
                <button
                  className="flex shrink-0 items-center gap-2 rounded-lg bg-[#17365d] px-5 py-3 text-sm font-bold text-white"
                  onClick={() => {
                    if (active) {
                      setSelected(null);
                      setActive(false);
                    } else {
                      setShowQr(false);
                      setQueueOpen(true);
                    }
                  }}
                >
                  <Navigation size={17} />
                  {active ? "End route" : "Navigate"}
                </button>
                <button
                  aria-label="Clear selected destination"
                  onClick={() => {
                    setSelected(null);
                    setActive(false);
                  }}
                  className="rounded-lg border p-3"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <p className="text-sm text-[#718398]">
                Select an office to see the walking route from this kiosk.
              </p>
            )}
          </div>
        </section>
      </main>
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
