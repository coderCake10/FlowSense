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

export function AuthPage() {
  const [mode, setMode] = useState<"email" | "code">("email");
  const [sent, setSent] = useState(false);
  return (
    <div className="grid min-h-screen bg-[#f6f8fb] lg:grid-cols-[0.85fr_1.15fr]">
      <div className="relative hidden overflow-hidden bg-[#0b1f3a] p-10 lg:block">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(244,197,66,.2) 1px, transparent 1px), linear-gradient(45deg, rgba(255,255,255,.08) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />
        <div className="relative flex h-full flex-col justify-between">
          <BrandMark />
          <div className="max-w-md pb-12">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#f4c542]">
              AUF operations
            </p>
            <h1 className="font-display text-5xl font-bold leading-[1.04] tracking-[-0.07em] text-white">
              Make every destination feel closer.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/54">
              FlowSense gives the campus team one dependable view of maps,
              movement, and the signals behind each route.
            </p>
          </div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
            Angeles University Foundation · 2026
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <BrandMark />
          </div>
          <div className="mb-8">
            <Badge className="border-[#dbe3ed] bg-white text-[#b08412] hover:bg-white">
              <ShieldCheck size={13} className="mr-1.5" />
              Authentication required
            </Badge>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-[-0.06em] text-[#102c4d]">
              Log in to access Admin Dashboard
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#718398]">
              Use your institutional email to receive a one time sign in method.
            </p>
          </div>
          {sent ? (
            <div className="rounded-2xl border border-[#d8ebdf] bg-[#f2fbf6] p-6">
              <div className="grid size-11 place-items-center rounded-xl bg-[#dff5e9] text-[#168051]">
                <Check size={22} />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-[#17365d]">
                Check your inbox
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#718398]">
                A secure {mode === "email" ? "login link" : "verification code"}{" "}
                was sent to your institutional email. This demo state is ready
                to connect to{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs">
                  POST /auth/{mode === "email" ? "login" : "verify"}
                </code>
                .
              </p>
              <Button
                variant="outline"
                className="mt-6 border-[#cfe3d8] text-[#168051]"
                onClick={() => setSent(false)}
              >
                Use another email
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <label className="block text-sm font-semibold text-[#40556d]">
                Email address
                <Input
                  placeholder="admin@auf.edu.ph"
                  type="email"
                  className="mt-2 h-12 border-[#dbe3ed] bg-white"
                />
              </label>
              {mode === "email" ? (
                <Button
                  className="h-12 w-full bg-[#17365d] text-white hover:bg-[#102c4d]"
                  onClick={() => setSent(true)}
                >
                  Request login link <ArrowRight size={16} className="ml-2" />
                </Button>
              ) : (
                <label className="block text-sm font-semibold text-[#40556d]">
                  Authentication code
                  <Input
                    placeholder="Enter the code from your email"
                    inputMode="numeric"
                    className="mt-2 h-12 border-[#dbe3ed] bg-white"
                  />
                  <Button
                    className="mt-4 h-12 w-full bg-[#17365d] text-white hover:bg-[#102c4d]"
                    onClick={() => setSent(true)}
                  >
                    Submit code <ArrowRight size={16} className="ml-2" />
                  </Button>
                </label>
              )}
              <button
                className="flex w-full items-center justify-center gap-2 text-xs font-medium text-[#b08412] hover:text-[#8a6500]"
                onClick={() => setMode(mode === "email" ? "code" : "email")}
              >
                {mode === "email"
                  ? "Having trouble? Send code instead"
                  : "Use email login link instead"}
              </button>
            </div>
          )}
          <p className="mt-10 text-center text-xs text-[#96a4b3]">
            FlowSense admin access is limited to authorized AUF administrators.
          </p>
        </div>
      </div>
    </div>
  );
}

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
];
