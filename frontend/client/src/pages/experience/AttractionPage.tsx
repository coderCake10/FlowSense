/* Civic Signal: visitor-facing experiences use edge anchored wayfinding, AUF navy, signal gold route cues, and clear state transitions. */
import { useCallback, useEffect, useState } from "react";
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
import { useKioskHeartbeat } from "@/lib/kioskDevice";
import { buildings } from "@/data/buildings";
import { AttractPreview } from "@/components/map/AttractPreview";

export function AttractionPage() {
  const [now, setNow] = useState(new Date());
  const kiosk = useKioskHeartbeat();
  const [modelShown, setModelShown] = useState(false);
  const showModel = useCallback(() => setModelShown(true), []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const enter = () => window.location.assign("/kiosk");
  return (
    <main
      onClick={enter}
      className="relative min-h-screen cursor-pointer overflow-hidden bg-[#07182d] text-white"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 70% 20%, rgba(244,197,66,.28), transparent 30%), linear-gradient(120deg, transparent 0 48%, rgba(244,197,66,.55) 48.2% 48.7%, transparent 49%), linear-gradient(30deg, transparent 0 58%, rgba(255,255,255,.12) 58.2% 58.6%, transparent 58.8%)",
          backgroundSize: "auto, 420px 260px, 320px 220px",
        }}
      />
      <header className="relative flex items-center justify-between border-b border-white/10 px-8 py-5 lg:px-14">
        <BrandMark />
        <div className="text-right">
          <p className="font-display text-lg font-bold">
            {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
            {now.toLocaleDateString([], {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </header>
      <section className="relative mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-12 px-8 py-12 lg:grid-cols-[.8fr_1.2fr] lg:px-14">
        <div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.24em] text-[#f4c542]">
            AUF campus wayfinding
          </p>
          <h1 className="max-w-xl font-display text-6xl font-bold leading-[.96] tracking-[-.08em] sm:text-8xl">
            Find your way with FlowSense.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/54">
            Interactive 3D directions for every destination at Angeles
            University Foundation.
          </p>
          <div className="mt-9 inline-flex items-center gap-3 rounded-full border border-[#f4c542]/40 bg-[#f4c542]/10 px-5 py-3 text-sm font-bold text-[#f8d96a]">
            <span className="size-2 animate-pulse rounded-full bg-[#f4c542]" />
            Tap anywhere to begin
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-4 shadow-2xl backdrop-blur">
          <div
            className="relative aspect-video overflow-hidden rounded-2xl bg-[#102d50]"
            aria-label="FlowSense sneak peek: the EYA Building in 3D"
          >
            <div className="absolute inset-0">
              <AttractPreview building={buildings[0]} onReady={showModel} />
            </div>
            {!modelShown && (
              // Motion placeholder until the model has loaded (or if it can't).
              <div aria-hidden="true">
                <div
                  className="absolute inset-0 opacity-50"
                  style={{
                    backgroundImage:
                      "linear-gradient(120deg, transparent 0 48%, rgba(244,197,66,.55) 48.3% 49%, transparent 49.3%), linear-gradient(30deg, transparent 0 62%, rgba(255,255,255,.12) 62.2% 62.7%, transparent 62.9%)",
                    backgroundSize: "260px 180px, 300px 220px",
                  }}
                />
                <div className="absolute left-[18%] top-[52%] grid size-12 animate-bounce place-items-center rounded-full bg-[#f4c542] text-[#17365d] shadow-[0_0_0_10px_rgba(244,197,66,.12)]">
                  <MapPin size={20} />
                </div>
                <div className="absolute left-[27%] top-[58%] h-1 w-[46%] origin-left rotate-[-23deg] animate-pulse rounded-full bg-[#f4c542]" />
                <div className="absolute right-[18%] top-[25%] grid size-10 place-items-center rounded-full border-2 border-[#f4c542] text-[#f4c542]">
                  <LocateFixed size={18} />
                </div>
              </div>
            )}
            <div className="absolute bottom-5 left-5 rounded-lg bg-[#07182dcc] px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#f4c542]">
                Sneak peek
              </p>
              <p className="mt-1 text-xs text-white/70">
                {modelShown
                  ? "Tap to open the building and find your route."
                  : "A route that moves with your campus."}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between px-2 pt-4 text-[10px] uppercase tracking-[0.14em] text-white/45">
            <span>FlowSense interactive kiosk</span>
            <span>Motion preview</span>
          </div>
        </div>
      </section>
      {kiosk?.status === "unregistered" && (
        // Shown only until an admin registers this kiosk, so they can match
        // it to the Unregistered row on the Hardware page.
        <p className="absolute bottom-3 right-4 text-[11px] text-white/45">
          Kiosk ID {kiosk.device_id} · waiting for registration in Hardware
          Management
        </p>
      )}
    </main>
  );
}
