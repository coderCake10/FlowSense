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

function RouteIcon() {
  return (
    <div className="grid size-10 place-items-center rounded-xl bg-[#fff3bd] text-[#8a6500]">
      <MapPin size={18} />
    </div>
  );
}

export function MobilePage() {
  const [modal, setModal] = useState(true);
  const [inRange, setInRange] = useState(true);
  const [bluetoothOn, setBluetoothOn] = useState(true);
  const [completed, setCompleted] = useState(1);
  const steps = [
    "Exit the kiosk and walk toward the EYA Building lobby",
    "Take the stairs to the first floor",
    "Turn right after the main corridor",
    "Your destination is on the left",
  ];
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#102c4d]">
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
        <button
          onClick={() => setBluetoothOn(!bluetoothOn)}
          aria-label="toggle Bluetooth availability"
        >
          <Badge
            className={
              bluetoothOn
                ? "border-[#d5e9dd] bg-[#effaf3] text-[#168051] hover:bg-[#effaf3]"
                : "border-[#e5d7d7] bg-[#fff4f4] text-[#b13a36] hover:bg-[#fff4f4]"
            }
          >
            <Bluetooth size={13} className="mr-1.5" />
            {bluetoothOn ? "BLE active" : "Bluetooth unavailable"}
          </Badge>
        </button>
      </header>
      <main className="mx-auto max-w-xl px-5 py-8">
        <div className="mb-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b08412]">
            EYA Building · First floor
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.06em]">
            To Guidance Office
          </h1>
          <div className="mt-4 flex items-center gap-2 text-xs text-[#718398]">
            <span className="rounded-full bg-[#e7eef6] px-2.5 py-1 font-semibold text-[#17365d]">
              EA-101
            </span>
            <span>·</span>
            <span>4 instruction cards</span>
          </div>
        </div>
        <div className="mb-7 overflow-hidden rounded-2xl bg-[#0b1f3a] p-5 text-white shadow-[0_14px_30px_rgba(11,31,58,0.13)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/50">
                Current progress
              </p>
              <p className="mt-2 font-display text-2xl font-bold">
                {completed} of {steps.length}
              </p>
            </div>
            <div className="grid size-11 place-items-center rounded-xl bg-[#f4c542] text-[#17365d]">
              <LocateFixed size={20} />
            </div>
          </div>
          <div className="mt-5 flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  i < completed ? "bg-[#f4c542]" : "bg-white/15"
                )}
              />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <button
              key={step}
              onClick={() => setCompleted(Math.max(completed, i + 1))}
              className={cn(
                "flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition",
                i < completed
                  ? "border-[#d9ebdf] bg-[#f4fbf6]"
                  : "border-[#dbe3ed] bg-white hover:border-[#b8c9da]"
              )}
            >
              <div
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold",
                  i < completed
                    ? "bg-[#dff5e9] text-[#168051]"
                    : "bg-[#edf2f7] text-[#718398]"
                )}
              >
                {i < completed ? <Check size={17} /> : i + 1}
              </div>
              <div className="flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    i < completed ? "text-[#168051]" : "text-[#17365d]"
                  )}
                >
                  {step}
                </p>
                <p className="mt-1 text-xs text-[#8a98a9]">
                  {i === 0 ? "From Main Entrance" : "Approx. 1 minute"}
                </p>
              </div>
              <ChevronRight size={17} className="mt-1 text-[#a8b4c0]" />
            </button>
          ))}
        </div>
        <div className="mt-7 rounded-2xl border border-[#dbe3ed] bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#17365d]">
                Arrival detection
              </p>
              <p className="mt-1 text-xs text-[#8391a3]">
                Toggle Bluetooth or test the out of range state for the
                prototype.
              </p>
            </div>
            <button
              onClick={() => setInRange(!inRange)}
              className={cn(
                "relative h-6 w-11 rounded-full p-1 transition",
                inRange ? "bg-[#168051]" : "bg-[#c8d3de"
              )}
            >
              <span
                className={cn(
                  "block size-4 rounded-full bg-white shadow transition",
                  inRange ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </main>
      {modal && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#07182d99] p-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="grid size-11 place-items-center rounded-xl bg-[#dff5e9] text-[#168051]">
              <LocateFixed size={22} />
            </div>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b08412]">
              Location detected
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.05em] text-[#17365d]">
              You reached the EYA lobby
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#718398]">
              A nearby FlowSense sensor confirmed your location. Continue to the
              next instruction?
            </p>
            <div className="mt-6 grid gap-2">
              <Button
                className="h-11 bg-[#17365d] text-white hover:bg-[#102c4d]"
                onClick={() => {
                  setModal(false);
                  setCompleted(2);
                }}
              >
                Proceed <ArrowRight size={15} className="ml-2" />
              </Button>
              <Button
                variant="outline"
                className="h-11 border-[#dbe3ed] text-[#53677d]"
                onClick={() => setModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      {!modal && (
        <button
          disabled={!inRange}
          onClick={() => setModal(true)}
          className={cn(
            "fixed bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-xs font-bold shadow-xl transition",
            inRange
              ? "bg-[#f4c542] text-[#17365d] hover:bg-[#e8ba2d]"
              : "bg-[#dbe3ed] text-[#91a0af]"
          )}
        >
          <LocateFixed size={15} />
          Review detected location
        </button>
      )}
    </div>
  );
}
