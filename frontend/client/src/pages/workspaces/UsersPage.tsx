/* Civic Signal: operational workspace pages use AUF navy, signal gold, breathable tables, dynamic context panels, and restrained motion. */
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Box,
  Building2,
  Check,
  ChevronRight,
  CircleHelp,
  CloudUpload,
  Cpu,
  Eye,
  FileCheck2,
  Filter,
  Gauge,
  Layers3,
  MapPin,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Signal,
  Trash2,
  Upload,
  Users,
  Wifi,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  PageHeader,
  StatusPill,
  MetricCard,
} from "@/components/FlowSenseShell";
import {
  Device,
  DeviceStatus,
  apiClient,
  endpointMap,
  isApiConfigured,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Canvas } from "@react-three/fiber";

const devices: Device[] = [
  {
    id: "dev-001",
    name: "SensorNode-1",
    type: "Sensor",
    location: "EYA Building · 1F",
    status: "Unregistered",
    lastPing: "Awaiting registration",
    mac: "84:CC:A8:41:2F:11",
  },
  {
    id: "dev-002",
    name: "Main Entrance Kiosk",
    type: "Kiosk",
    location: "EYA Building · Main Entrance",
    status: "Online",
    lastPing: "10:29 AM",
    mac: "84:CC:A8:41:2F:12",
  },
  {
    id: "dev-003",
    name: "EYA Kiosk-1",
    type: "Kiosk",
    location: "EYA Building · 1F",
    status: "Online",
    lastPing: "10:29 AM",
    mac: "84:CC:A8:41:2F:13",
  },
  {
    id: "dev-004",
    name: "Sensor-2",
    type: "Sensor",
    location: "EYA Building · 2F",
    status: "Online",
    lastPing: "10:29 AM",
    mac: "84:CC:A8:41:2F:14",
  },
  {
    id: "dev-005",
    name: "Sensor-3",
    type: "Sensor",
    location: "EYA Building · 3F",
    status: "Offline",
    lastPing: "01:29 AM yesterday",
    mac: "84:CC:A8:41:2F:15",
  },
  {
    id: "dev-006",
    name: "Sensor-4",
    type: "Sensor",
    location: "EYA Building · 1F",
    status: "Disabled",
    lastPing: "1 week ago",
    mac: "84:CC:A8:41:2F:16",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8493a5]">
      {children}
    </p>
  );
}
function MiniBar({
  values,
  gold = false,
}: {
  values: number[];
  gold?: boolean;
}) {
  return (
    <div className="flex h-28 items-end gap-2">
      {values.map((value, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-md bg-[#e8eef5]"
          style={{ height: `${Math.max(value, 8)}%` }}
        >
          <div
            className={cn(
              "h-full rounded-t-md",
              gold ? "bg-[#f4c542]" : "bg-[#345a87]"
            )}
            style={{ opacity: 0.65 + (i / values.length) * 0.35 }}
          />
        </div>
      ))}
    </div>
  );
}

function UserActions({
  name,
  email,
  role,
  status,
  menuId,
  openMenu,
  setOpenMenu,
}: {
  name: string;
  email: string;
  role: string;
  status: string;
  menuId: string;
  openMenu: string | null;
  setOpenMenu: (value: string | null) => void;
}) {
  const open = openMenu === menuId;
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftRole, setDraftRole] = useState(role);
  const startEdit = () => {
    setOpenMenu(null);
    setMenuPosition(null);
    setSaved(false);
    setEditing(true);
  };
  const toggleMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (open) {
      setOpenMenu(null);
      setMenuPosition(null);
      return;
    }
    const menuWidth = 224;
    const menuHeight = 152;
    const left = Math.max(
      8,
      Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth)
    );
    const top =
      rect.top < menuHeight + 24 ? rect.bottom + 8 : rect.top - menuHeight - 8;
    setMenuPosition({ top, left });
    setOpenMenu(menuId);
  };
  return (
    <div className="relative inline-flex">
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Actions for ${email}`}
        aria-expanded={open}
        onClick={toggleMenu}
      >
        <MoreHorizontal size={18} />
      </Button>
      {open && (
        <div
          className="fixed z-[70] w-56 rounded-xl border border-[#dbe3ed] bg-white p-1.5 text-left shadow-[0_14px_32px_rgba(16,44,77,0.14)]"
          style={{ top: menuPosition?.top, left: menuPosition?.left }}
        >
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#17365d] hover:bg-[#f4f7fa]"
            onClick={startEdit}
          >
            Edit administrator
          </button>
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#17365d] hover:bg-[#f4f7fa]"
            onClick={() => {
              setOpenMenu(null);
              setMenuPosition(null);
              setSaved(true);
            }}
          >
            Review access
          </button>
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#b08412] hover:bg-[#fff8da]"
            onClick={() => {
              setOpenMenu(null);
              setMenuPosition(null);
              setSaved(true);
            }}
          >
            {status === "Enabled"
              ? "Disable administrator"
              : "Enable administrator"}
          </button>
        </div>
      )}
      {saved && (
        <span className="absolute right-0 top-10 z-20 whitespace-nowrap rounded-lg border border-[#d8ebdf] bg-[#f2fbf6] px-3 py-2 text-[11px] font-medium text-[#168051] shadow-sm">
          Action saved
        </span>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#07182dcc] p-5">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-left shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b08412]">
                  Administrator profile
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[#17365d]">
                  Edit administrator
                </h2>
                <p className="mt-2 text-sm text-[#718398]">
                  Update access details for this FlowSense operator.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditing(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-semibold text-[#40556d]">
                Full name
                <Input
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  className="mt-2 border-[#dbe3ed]"
                />
              </label>
              <label className="block text-xs font-semibold text-[#40556d]">
                Institutional email
                <Input
                  defaultValue={email}
                  disabled
                  className="mt-2 border-[#dbe3ed] bg-[#f7f9fc]"
                />
              </label>
              <label className="block text-xs font-semibold text-[#40556d]">
                Role
                <select
                  value={draftRole}
                  onChange={e => setDraftRole(e.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-[#dbe3ed] bg-white px-3 text-sm"
                >
                  <option>Admin</option>
                  <option>Super Admin</option>
                </select>
              </label>
            </div>
            <div className="mt-7 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                className="bg-[#17365d] text-white hover:bg-[#102c4d]"
                onClick={() => {
                  setEditing(false);
                  setSaved(true);
                }}
              >
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InviteAdministrator() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Admin");
  const [sent, setSent] = useState(false);
  return (
    <>
      {
        <Button
          className="bg-[#17365d] text-white hover:bg-[#102c4d]"
          onClick={() => {
            setSent(false);
            setOpen(true);
          }}
        >
          <Plus size={15} className="mr-2" />
          Invite administrator
        </Button>
      }
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#07182dcc] p-5">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-left shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b08412]">
                  Administrator invitation
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold text-[#17365d]">
                  Invite an AUF administrator
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#718398]">
                  Send a passwordless invitation to an institutional email
                  address.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </Button>
            </div>
            {sent ? (
              <div className="mt-6 rounded-xl border border-[#d8ebdf] bg-[#f2fbf6] p-4">
                <p className="font-semibold text-[#168051]">
                  Invitation prepared
                </p>
                <p className="mt-1 text-sm text-[#53677d]">
                  A {role} invitation is ready for {email || "the recipient"}.
                  The API can send it when connected.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <label className="block text-xs font-semibold text-[#40556d]">
                  Institutional email
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@auf.edu.ph"
                    className="mt-2 border-[#dbe3ed]"
                  />
                </label>
                <label className="block text-xs font-semibold text-[#40556d]">
                  Profile
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="mt-2 h-10 w-full rounded-lg border border-[#dbe3ed] bg-white px-3 text-sm"
                  >
                    <option>Admin</option>
                    <option>Super Admin</option>
                  </select>
                </label>
              </div>
            )}
            <div className="mt-7 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {sent ? "Close" : "Cancel"}
              </Button>
              {!sent && (
                <Button
                  disabled={!email.includes("@")}
                  className="bg-[#17365d] text-white hover:bg-[#102c4d]"
                  onClick={() => setSent(true)}
                >
                  Send invitation
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function UsersPage() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / User management"
        title="Manage administrator access"
        description="Keep the people who operate FlowSense accountable, current, and assigned to the right level of access."
        action={<InviteAdministrator />}
      />
      <Card className="border-[#dbe3ed]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-lg">
                Administrator directory
              </CardTitle>
              <p className="text-xs text-[#8391a3]">
                Super Admin access is limited to trusted system owners.
              </p>
            </div>
            <Input
              placeholder="Search name or email"
              className="hidden w-64 border-[#dbe3ed] sm:block"
            />
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-[0.14em] text-[#8291a3]">
              <tr>
                <th className="px-5 py-3">Administrator</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last login</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {[
                [
                  "Gene Ross Reyes",
                  "admin@auf.edu.ph",
                  "Super Admin",
                  "Today, 10:02 AM",
                  "Enabled",
                ],
                [
                  "Wendy Calma",
                  "wendycalma@auf.edu.ph",
                  "Admin",
                  "Yesterday, 4:18 PM",
                  "Enabled",
                ],
                [
                  "Marcus Dela Cruz",
                  "marcus@auf.edu.ph",
                  "Admin",
                  "Aug 19, 2026",
                  "Disabled",
                ],
              ].map(([name, email, role, last, status]) => (
                <tr key={email}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-xl bg-[#dce6f2] text-xs font-bold text-[#17365d]">
                        {name
                          .split(" ")
                          .map(x => x[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#17365d]">
                          {name}
                        </p>
                        <p className="text-[11px] text-[#8a98a9]">{email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-medium text-[#53677d]">
                      {role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill
                      status={status}
                      tone={status === "Enabled" ? "green" : "red"}
                    />
                  </td>
                  <td className="px-5 py-4 text-xs text-[#8391a3]">{last}</td>
                  <td className="px-5 py-4 text-right">
                    <UserActions
                      name={name}
                      email={email}
                      role={role}
                      status={status}
                      menuId={email}
                      openMenu={openMenu}
                      setOpenMenu={setOpenMenu}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
