/* Civic Signal: visitor-facing experiences use edge anchored wayfinding, AUF navy, signal gold route cues, and clear state transitions. */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Bluetooth,
  Check,
  ChevronRight,
  LocateFixed,
  MapPin,
  Menu,
  QrCode,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BrandMark, StatusPill } from "@/components/FlowSenseShell";
import { cn } from "@/lib/utils";

const destinations = [
  {
    name: "Guidance Office",
    code: "EA-101",
    building: "EYA Building",
    floor: "First floor",
  },
  {
    name: "Registrar Office",
    code: "EA-106",
    building: "EYA Building",
    floor: "First floor",
  },
  {
    name: "Lecture Hall 201",
    code: "EA-201",
    building: "EYA Building",
    floor: "Second floor",
  },
  {
    name: "Student Lounge",
    code: "PS-001",
    building: "PS Building",
    floor: "Ground floor",
  },
  {
    name: "Student Lounge",
    code: "PS-101",
    building: "PS Building",
    floor: "First floor",
  },
] as const;

export function KioskPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<
    (typeof destinations)[number] | null
  >(null);
  const [details, setDetails] = useState<(typeof destinations)[number] | null>(
    null
  );
  const [queue, setQueue] = useState(false);
  const [qr, setQr] = useState(false);
  const [live, setLive] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    let timer = window.setTimeout(
      () => window.location.assign("/attraction"),
      60000
    );
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => window.location.assign("/attraction"),
        60000
      );
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"];
    events.forEach(event =>
      window.addEventListener(event, reset, { passive: true })
    );
    return () => {
      window.clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, reset));
    };
  }, []);
  const shown = destinations.filter(d =>
    `${d.name} ${d.code} ${d.building}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  return (
    <div
      className="min-h-screen bg-white text-[#17365d]"
      onPointerDown={() => {}}
    >
      <header className="flex items-center justify-between border-b border-[#dbe3ed] bg-[#f7f9fc] px-5 py-3 text-[#17365d] shadow-[0_4px_18px_rgba(16,44,77,.05)] lg:px-8">
        <div className="flex items-center gap-3">
          <BrandMark compact />
          <div>
            <p className="font-display text-base font-bold tracking-[-0.03em]">
              FlowSense
            </p>
            <p className="text-[10px] uppercase tracking-[.16em] text-[#8a98a9]">
              AUF wayfinding kiosk
            </p>
          </div>
        </div>
        <div className="text-center text-xs font-medium text-[#718398]">
          Building / Area · Kiosk Name
        </div>
        <div className="text-right">
          <p className="text-sm font-bold">Saturday, Aug 25</p>
          <p className="text-xs text-[#718398]">2:50 AM</p>
        </div>
      </header>
      <main className="grid min-h-[calc(100vh-68px)] grid-cols-[220px_minmax(0,1fr)] bg-[#f7f9fc]">
        <aside className="border-r-2 border-[#f4c542] bg-[#0b1f3a] p-4 text-white shadow-[8px_0_24px_rgba(11,31,58,.16)] [&_select]:text-[#17365d] [&_input]:text-[#17365d]">
          <Button
            variant="outline"
            className="mb-4 w-full justify-start border-white/25 bg-white/10 text-white hover:bg-white/15"
            onClick={() => window.location.assign("/attraction")}
          >
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
          <p className="mb-2 font-display text-sm font-medium italic text-white/78">
            Where do you want to go?
          </p>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-3 text-[#718398]"
            />
            <Input
              value={search}
              onFocus={() => setKeyboard(true)}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search room"
              className="h-9 border-[#17365d] pl-8 text-xs"
            />
          </div>
          <select className="mt-3 h-9 w-full border border-[#17365d] bg-white px-2 text-xs">
            <option>EYA Building</option>
            <option>PS Building</option>
          </select>
          <p className="mt-5 text-[10px] font-medium uppercase tracking-[.1em] text-white/48">
            5 Destinations · sorted by building
          </p>
          <div className="mt-3 space-y-4">
            {["EYA Building", "PS Building"].map(building => (
              <div key={building}>
                <p className="mb-2 font-display text-sm font-medium text-white/82">
                  {building}
                </p>
                <div className="space-y-2">
                  {shown
                    .filter(d => d.building === building)
                    .map(d => (
                      <button
                        key={d.code}
                        onClick={() => {
                          setDetails(d);
                          setSelected(d);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between border-b border-[#dbe3ed] pb-2 text-left text-xs",
                          selected?.code === d.code
                            ? "font-medium text-white"
                            : "font-normal text-white/68"
                        )}
                      >
                        <span>
                          <span className="block font-medium text-white/88">
                            {d.name}
                          </span>
                          <span className="text-[10px] uppercase text-white/48">
                            {d.floor}
                          </span>
                        </span>
                        <span className="text-[10px] text-white/42">
                          {d.code}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
          {keyboard && (
            <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,760px)] -translate-x-1/2 rounded-2xl border-2 border-[#17365d] bg-[#eef3f7] p-4 shadow-[0_18px_45px_rgba(11,31,58,.28)]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#718398]">
                  On-screen keyboard
                </span>
                <button
                  onClick={() => setKeyboard(false)}
                  className="text-[10px] font-bold text-[#17365d]"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-10 gap-2">
                {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(letter => (
                  <button
                    key={letter}
                    onClick={() => setSearch(search + letter)}
                    className="min-h-12 rounded-lg border border-[#cbd8e6] bg-white text-base font-bold text-[#17365d] active:bg-[#f4c542]"
                  >
                    {letter}
                  </button>
                ))}
                <button
                  onClick={() => setSearch(search.slice(0, -1))}
                  className="col-span-3 min-h-12 rounded-lg border border-[#17365d] bg-[#17365d] text-xs font-bold text-white"
                >
                  Backspace
                </button>
                <button
                  onClick={() => setSearch("")}
                  className="col-span-3 min-h-12 rounded-lg border border-[#cbd8e6] bg-white text-xs font-bold text-[#17365d]"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </aside>
        <section
          className="relative min-w-0 overflow-hidden bg-[#fbfcfe]"
          style={{
            backgroundImage: "radial-gradient(#dbe3ed 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
        >
          <div className="absolute right-6 top-5 flex items-center gap-2 rounded-lg border border-[#17365d] bg-white p-2 text-xs">
            <span className="font-bold">AREA</span>
            <span>EYA CAMPUS</span>
            <span>⌄</span>
          </div>
          <div className="absolute left-6 top-5">
            <Badge className="border-[#17365d] bg-white text-[#17365d]">
              3D interactive map
            </Badge>
          </div>
          <div className="absolute inset-0 grid place-items-center p-10">
            <div className="relative h-[68%] w-[72%] min-w-[500px]">
              <div className="absolute left-[35%] top-[5%] h-[30%] w-[28%] border-2 border-[#718398] bg-white/80 p-5 text-center font-display font-bold">
                EYA
                <div className="absolute left-5 top-8 text-[10px]">
                  ⌖ EA-201
                </div>
                <div className="absolute right-5 bottom-8 text-[10px]">
                  ⌖ EA-101
                </div>
              </div>
              <div className="absolute left-[20%] bottom-[15%] h-[28%] w-[26%] border-2 border-[#718398] bg-white/80 p-5 text-center font-display font-bold">
                MAIN
                <div className="absolute left-5 bottom-6 text-[10px]">
                  ⌖ A-101
                </div>
              </div>
              <div className="absolute right-[18%] bottom-[18%] h-[25%] w-[24%] border-2 border-[#718398] bg-white/80 p-5 text-center font-display font-bold">
                PS
                <div className="absolute left-5 bottom-6 text-[10px]">
                  ⌖ PS-101
                </div>
              </div>
              <div className="absolute left-1/2 bottom-[4%] -translate-x-1/2 text-xs font-bold">
                ⌖ YOU ARE HERE
              </div>
              {selected && (
                <div className="absolute left-[45%] top-[48%] h-1 w-[28%] rotate-[-25deg] rounded-full bg-[#f4c542] shadow-[0_0_0_3px_rgba(244,197,66,.2)]" />
              )}
            </div>
          </div>
          <div className="absolute bottom-5 right-6 flex gap-3">
            <div className="flex overflow-hidden rounded-lg border border-[#17365d] bg-white text-[10px] font-bold">
              <button className="bg-[#f4c542] px-3 py-2">CAMPUS</button>
              <button className="px-3 py-2">GROUND</button>
              <button className="px-3 py-2">FIRST</button>
              <button className="px-3 py-2">SECOND</button>
            </div>
            <Button
              disabled={!selected}
              onClick={() => setQueue(true)}
              className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            >
              <ArrowRight size={15} className="mr-2" />
              Navigate
            </Button>
          </div>
        </section>
      </main>
      {details && (
        <div className="fixed inset-0 z-40 bg-[#07182d55]">
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-[#17365d] bg-white p-6 shadow-2xl">
            <button onClick={() => setDetails(null)} className="float-right">
              <X size={20} />
            </button>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#718398]">
              Location Details
            </p>
            <div className="mt-6 h-32 border border-[#17365d] bg-[#f7f9fc] p-4 text-[#718398]">
              <MapPin size={28} />
            </div>
            <Badge className="mt-4 border-[#17365d] bg-white text-[#17365d]">
              EYA · FIRST FLOOR
            </Badge>
            <h2 className="mt-3 font-display text-2xl font-bold">
              {details.name}
            </h2>
            <p className="text-sm text-[#718398]">{details.code}</p>
            <Separator className="my-6" />
            <p className="text-[10px] font-bold uppercase">
              Location information
            </p>
            <p className="mt-2 text-xs leading-5 text-[#718398]">
              Description of the destination and nearby campus landmarks.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-bold">Personnel</p>
                <p className="mt-1 text-[#718398]">Available staff</p>
              </div>
              <div>
                <p className="font-bold">Availability</p>
                <p className="mt-1 text-[#718398]">Mon–Fri · 8:00 AM–4:30 PM</p>
              </div>
            </div>
            <Button
              className="mt-8 w-full bg-[#17365d] text-white"
              onClick={() => {
                setSelected(details);
                setDetails(null);
              }}
            >
              Add to queue
            </Button>
          </aside>
        </div>
      )}
      {queue && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#07182d55] p-5">
          <div className="w-full max-w-2xl border border-[#17365d] bg-white p-6 shadow-2xl">
            <button onClick={() => setQueue(false)} className="float-right">
              <X size={20} />
            </button>
            <p className="text-[10px] font-bold uppercase tracking-[.14em]">
              Your route is ready
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">
              Destination Queue
            </h2>
            <p className="mt-2 text-sm text-[#718398]">
              Your selected destinations are ready for navigation.
            </p>
            <div className="mt-6 grid gap-6 md:grid-cols-[1fr_180px]">
              <div className="rounded border border-[#dbe3ed] p-4">
                <p className="font-bold">{selected?.name}</p>
                <p className="mt-1 text-xs text-[#718398]">
                  {selected?.code} · {selected?.building} · {selected?.floor}
                </p>
                <div className="mt-8 border-t border-[#17365d] pt-4">
                  <Button
                    className="bg-[#17365d] text-white"
                    onClick={() => {
                      setQueue(false);
                      setLive(true);
                    }}
                  >
                    Start Navigation <ArrowRight size={15} className="ml-2" />
                  </Button>
                </div>
              </div>
              <button
                onClick={() => {
                  setQueue(false);
                  setQr(true);
                }}
                className="grid min-h-40 place-items-center border border-[#17365d] bg-[#fbfcfe] p-4 text-center"
              >
                <QrCode size={74} />
                <span className="text-[10px] font-semibold">
                  Scan to hand off
                  <br />
                  Continue the route on your mobile phone.
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      {qr && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#07182d55] p-5">
          <div className="w-full max-w-sm border border-[#17365d] bg-white p-7 text-center shadow-2xl">
            <button onClick={() => setQr(false)} className="float-right">
              <X size={18} />
            </button>
            <QrCode size={180} className="mx-auto mt-5" />
            <h2 className="mt-5 font-display text-xl font-bold">
              Continue on your phone
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#718398]">
              Scan to receive step by step instructions for {selected?.name}.
            </p>
          </div>
        </div>
      )}
      {live && (
        <div className="fixed inset-0 z-[55] bg-white text-[#17365d]">
          <header className="flex items-center justify-between border-b border-[#17365d] px-6 py-4">
            <BrandMark />
            <div className="text-center text-xs font-bold">
              Live Navigation · {selected?.name}
            </div>
            <Button variant="outline" onClick={() => setLive(false)}>
              End route
            </Button>
          </header>
          <div
            className="grid h-[calc(100vh-72px)] place-items-center bg-[#fbfcfe]"
            style={{
              backgroundImage: "radial-gradient(#dbe3ed 1px, transparent 1px)",
              backgroundSize: "14px 14px",
            }}
          >
            <div className="w-full max-w-4xl px-8">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#b08412]">
                    You are here
                  </p>
                  <h2 className="font-display text-3xl font-bold">
                    Follow the highlighted route
                  </h2>
                  <p className="mt-1 text-sm text-[#718398]">
                    {selected?.building} · {selected?.floor} · {selected?.code}
                  </p>
                </div>
                <Badge className="border-[#d5e9dd] bg-[#effaf3] text-[#168051]">
                  Navigation active
                </Badge>
              </div>
              <div className="relative h-[430px] border-2 border-[#17365d] bg-white">
                <div className="absolute left-[12%] top-[15%] h-[28%] w-[25%] border-2 border-[#718398] p-6 text-center font-display font-bold">
                  MAIN
                </div>
                <div className="absolute right-[15%] top-[20%] h-[25%] w-[28%] border-2 border-[#718398] p-6 text-center font-display font-bold">
                  EYA
                </div>
                <div className="absolute left-[20%] bottom-[18%] h-2 w-[58%] rotate-[-16deg] rounded-full bg-[#f4c542] shadow-[0_0_0_4px_rgba(244,197,66,.18)]" />
                <div className="absolute left-[12%] bottom-[12%] grid size-10 place-items-center rounded-full bg-[#17365d] text-white">
                  ⌖
                </div>
                <div className="absolute right-[15%] top-[31%] grid size-10 place-items-center rounded-full bg-[#f4c542] text-[#17365d]">
                  ⌖
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border border-[#17365d] bg-white p-4">
                <div>
                  <p className="font-bold">Next instruction</p>
                  <p className="mt-1 text-sm text-[#718398]">
                    Continue toward {selected?.name}. The kiosk is displaying
                    your active route.
                  </p>
                </div>
                <Button
                  className="bg-[#17365d] text-white"
                  onClick={() => setLive(false)}
                >
                  Back to map
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
