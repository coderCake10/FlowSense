/* Civic Signal: compact AUF navy shell, FlowSense Signal Gold for active states, Space Grotesk headings, IBM Plex Sans body, breathable workspace composition. */
import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
  CircleHelp,
  Cpu,
  LayoutDashboard,
  Map,
  Menu,
  Settings2,
  ShieldCheck,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  AdminMe,
  AdminProfile,
  ApiError,
  apiClient,
  endpointMap,
  isApiConfigured,
  toAdminProfile,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Map Annotation", href: "/map-annotation", icon: Map },
  { label: "Asset Management", href: "/assets", icon: Boxes },
  { label: "Hardware Management", href: "/hardware", icon: Cpu },
  { label: "User Management", href: "/users", icon: Users },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact && "gap-2")}>
      <img
        src="/img/logo.png"
        alt="FlowSense logo"
        width={40}
        height={40}
        className="size-10 shrink-0 object-contain"
      />
      {!compact && (
        <div>
          <p className="font-display text-base font-bold tracking-[-0.03em] text-white">
            FlowSense
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">
            AUF wayfinding
          </p>
        </div>
      )}
    </div>
  );
}

export function StatusPill({
  status,
  tone,
}: {
  status: string;
  tone?: "green" | "amber" | "red" | "navy" | "gold";
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    navy: "bg-[#e9eef5] text-[#17365d] ring-[#c8d5e5]",
    gold: "bg-[#fff5c8] text-[#8a6500] ring-[#f0d36d]",
  };
  const inferred =
    status.toLowerCase().includes("online") ||
    status.toLowerCase().includes("active") ||
    status.toLowerCase().includes("passed")
      ? "green"
      : status.toLowerCase().includes("offline") ||
          status.toLowerCase().includes("warning") ||
          status.toLowerCase().includes("degraded")
        ? "amber"
        : status.toLowerCase().includes("critical") ||
            status.toLowerCase().includes("error")
          ? "red"
          : "navy";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        tones[tone ?? inferred]
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 border-b border-[#dbe3ed] pb-6 sm:flex-row sm:items-end">
      <div className="border-l-2 border-[#f4c542] pl-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b08412]">
          {eyebrow}
        </p>
        <h1 className="font-display text-3xl font-bold tracking-[-0.045em] text-[#102c4d]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66768a]">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profile, setProfile] = useState<AdminProfile>({
    name: "Admin Admin",
    email: "admin@auf.edu.ph",
    role: "Super Admin",
  });
  // Route guard (QA-18): with an API configured, every admin page first
  // confirms the session via /auth/me (which also loads the profile). No
  // API configured means the offline demo, which keeps the placeholder.
  const [session, setSession] = useState<"checking" | "ready" | "offline">(
    isApiConfigured() ? "checking" : "ready"
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isApiConfigured()) return;
    let cancelled = false;
    apiClient
      .get<AdminMe>(endpointMap.auth.me)
      .then(me => {
        if (cancelled) return;
        setProfile(toAdminProfile(me));
        setSession("ready");
      })
      .catch(error => {
        if (cancelled) return;
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        )
          window.location.assign("/auth");
        else setSession("offline");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  const initials =
    profile.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join("") || "?";
  const signOut = async () => {
    setSigningOut(true);
    if (isApiConfigured()) {
      try {
        await apiClient.post(endpointMap.auth.logout);
      } catch {
        /* Keep local exit behavior even when the API is unavailable. */
      }
    }
    window.location.assign("/auth");
  };
  const active = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);
  if (session !== "ready")
    return (
      <div
        role={session === "offline" ? "alert" : "status"}
        className="grid min-h-screen place-items-center bg-[#f7f9fc] p-6 text-center text-[#102c4d]"
      >
        {session === "checking" ? (
          <p className="text-sm text-[#718398]">Checking your session…</p>
        ) : (
          <div className="max-w-sm">
            <p className="font-display text-xl font-bold">
              Can't reach the FlowSense server
            </p>
            <p className="mt-2 text-sm leading-6 text-[#718398]">
              Check your connection or ask the system administrator whether the
              backend is running.
            </p>
            <Button
              className="mt-5 bg-[#17365d] text-white hover:bg-[#102c4d]"
              onClick={() => {
                setSession("checking");
                setAttempt(value => value + 1);
              }}
            >
              Try again
            </Button>
          </div>
        )}
      </div>
    );
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#102c4d]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[244px] -translate-x-full flex-col bg-[#0b1f3a] px-4 py-5 transition-transform duration-200 lg:translate-x-0",
          open && "translate-x-0"
        )}
      >
        <div className="mb-9 flex items-center justify-between px-2">
          <BrandMark />
          <button
            className="text-white/60 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mb-4 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
          Operations
        </div>
        <nav className="space-y-1">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/60 transition hover:bg-white/8 hover:text-white",
                active(href) &&
                  "border-l-4 border-[#f4c542] bg-[#f4c542] font-semibold text-[#0b1f3a] shadow-[0_8px_20px_rgba(244,197,66,0.18)] hover:bg-[#f4c542] hover:text-[#0b1f3a]"
              )}
            >
              <Icon size={17} strokeWidth={active(href) ? 2.4 : 1.8} />
              <span>{label}</span>
              {label === "Hardware Management" && (
                <Wifi className="ml-auto opacity-50" size={14} />
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/55 transition hover:bg-white/8 hover:text-white"
          >
            <Settings2 size={17} />
            Settings
          </Link>
          <Link
            href="/help"
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/55 transition hover:bg-white/8 hover:text-white"
          >
            <CircleHelp size={17} />
            Help & manual
          </Link>
          <div className="relative mt-4">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              aria-expanded={profileOpen}
              className="flex w-full items-center gap-3 rounded-xl bg-white/6 p-3 text-left hover:bg-white/10"
            >
              <Avatar className="size-8 border border-white/15">
                <AvatarFallback className="bg-[#f4c542] text-xs font-bold text-[#0b1f3a]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">
                  {profile.name}
                </p>
                <p className="truncate text-[11px] text-white/45">
                  {profile.email}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "ml-auto text-white/35 transition",
                  profileOpen && "rotate-180"
                )}
                size={14}
              />
            </button>
            {profileOpen && (
              <div className="absolute bottom-14 left-0 right-0 z-50 rounded-xl border border-white/15 bg-[#102d50] p-2 shadow-2xl">
                <p className="px-3 py-2 text-[10px] uppercase tracking-[.14em] text-white/45">
                  Signed in as {profile.role}
                </p>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    setProfileModalOpen(true);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-white hover:bg-white/10"
                >
                  View profile
                </button>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    setSignOutOpen(true);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#f4c542] hover:bg-white/10"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      <AlertDialog
        open={signOutOpen}
        onOpenChange={next => {
          if (!signingOut) setSignOutOpen(next);
        }}
      >
        <AlertDialogContent className="bg-white text-[#102c4d]">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of FlowSense?</AlertDialogTitle>
            <AlertDialogDescription>
              Your admin session will end and you will return to the sign-in
              screen. Unsaved changes on this page will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut}>
              Stay signed in
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={signingOut}
              onClick={event => {
                // Keep the dialog open while the logout request is in flight.
                event.preventDefault();
                void signOut();
              }}
              className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="lg:pl-[244px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#dbe3ed]/90 bg-[#f7f9fc]/90 px-5 backdrop-blur-md lg:px-9">
          <button
            className="rounded-lg p-2 text-[#17365d] hover:bg-[#e9eef5] lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="hidden items-center gap-2 text-xs text-[#7d8da0] lg:flex">
            <Activity size={15} className="text-[#22a06b]" />
            <span>Systems monitored</span>
            <span className="font-semibold text-[#17365d]">Live</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Badge
              variant="outline"
              className="hidden border-[#ccd8e6] bg-white font-medium text-[#66768a] sm:flex"
            >
              <Building2 size={13} className="mr-1.5" />
              AUF Campus
            </Badge>
            <div className="flex items-center gap-2">
              <Avatar className="size-8">
                <AvatarFallback className="bg-[#dce6f2] text-xs font-bold text-[#17365d]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold">{profile.name}</p>
                <p className="text-[10px] text-[#7b8b9d]">{profile.role}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="p-5 lg:p-9">{children}</main>
      </div>
      {profileModalOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#07182d99] p-5">
          <div className="w-full max-w-md rounded-2xl border border-[#dbe3ed] bg-white p-6 text-[#17365d] shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b08412]">
                  Account profile
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold">
                  {profile.name}
                </h2>
                <p className="mt-1 text-sm text-[#718398]">{profile.email}</p>
              </div>
              <button
                aria-label="Close profile"
                onClick={() => setProfileModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#dbe3ed] bg-[#f7f9fc] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a98a9]">
                  Role
                </p>
                <p className="mt-2 text-sm font-semibold">{profile.role}</p>
              </div>
              <div className="rounded-xl border border-[#dbe3ed] bg-[#f7f9fc] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a98a9]">
                  Session
                </p>
                <p className="mt-2 text-sm font-semibold text-[#168051]">
                  Active
                </p>
              </div>
            </div>
            <Button
              className="mt-6 w-full bg-[#17365d] text-white hover:bg-[#102c4d]"
              onClick={() => setProfileModalOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = "navy",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  accent?: "navy" | "gold" | "green" | "red" | "amber";
}) {
  const accents = {
    navy: "bg-[#e6edf6] text-[#17365d]",
    gold: "bg-[#fff3bd] text-[#8a6500]",
    green: "bg-[#dff5ea] text-[#13734a]",
    red: "bg-[#fee8e7] text-[#b13a36]",
    amber: "bg-[#fff3bd] text-[#946c00]",
  };
  return (
    <div className="rounded-2xl border border-[#dbe3ed] bg-white p-5 shadow-[0_10px_30px_rgba(16,44,77,0.04)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-[#718195]">{label}</p>
          <p className="mt-3 font-display text-3xl font-bold tracking-[-0.06em] text-[#102c4d]">
            {value}
          </p>
        </div>
        <div
          className={cn(
            "grid size-10 place-items-center rounded-xl",
            accents[accent]
          )}
        >
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-4 text-xs text-[#8a98a9]">{detail}</p>
    </div>
  );
}
