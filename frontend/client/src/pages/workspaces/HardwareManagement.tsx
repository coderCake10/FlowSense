/* Civic Signal: operational workspace pages use AUF navy, signal gold, breathable tables, dynamic context panels, and restrained motion. */
import { FormEvent, useMemo, useState } from "react";
import {
  Check,
  Cpu,
  MapPin,
  Pencil,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Wifi,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader, StatusPill, MetricCard } from "@/components/FlowSenseShell";
import {
  ConfirmDialog,
  Field,
  NativeSelect,
  QueryStatus,
} from "@/components/AdminBits";
import {
  DeviceDetail,
  DeviceFilters,
  DeviceRow,
  DeviceStatusValue,
  formatWhen,
  titleCase,
  useBuildings,
  useDecommissionDevice,
  useDevice,
  useDeviceCommand,
  useDevices,
  useFloors,
  useMapNodes,
  useRegisterDevice,
  useSensorStatistics,
  useUpdateDevice,
} from "@/lib/adminApi";
import { cn } from "@/lib/utils";

const statusTone = (status: DeviceStatusValue) =>
  status === "online"
    ? "green"
    : status === "offline"
      ? "amber"
      : status === "disabled" || status === "decommissioned"
        ? "red"
        : "gold";

const deviceLabel = (device: { name: string | null; device_id: string }) =>
  device.name || device.device_id;

function formatUptime(seconds: number | null) {
  if (!seconds) return "—";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  return days ? `${days}d ${hours}h` : `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function InfoList({
  title,
  rows,
}: {
  title: string;
  rows: [string, string | number | null | undefined][];
}) {
  return (
    <div className="rounded-xl border border-[#dbe3ed] bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a98a9]">
        {title}
      </p>
      <dl className="mt-3 space-y-2 text-xs text-[#53677d]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt>{label}</dt>
            <dd className="text-right font-semibold text-[#17365d]">
              {value === null || value === undefined || value === "" ? "—" : value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MapNodeSelect({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const { nodes } = useMapNodes();
  return (
    <NativeSelect
      aria-label="Map node"
      value={value ?? ""}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">
        {nodes.length ? "No map node" : "No map nodes yet (add them in Map Annotation)"}
      </option>
      {nodes.map(node => (
        <option key={node.id} value={node.id}>
          {node.name} ({node.node_type})
        </option>
      ))}
    </NativeSelect>
  );
}

function RegisterDialog({
  device,
  onClose,
}: {
  device: DeviceRow;
  onClose: () => void;
}) {
  const register = useRegisterDevice();
  const isSensor = device.device_type === "sensor";
  const [name, setName] = useState(device.name ?? "");
  const [mapNode, setMapNode] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [intervalSeconds, setIntervalSeconds] = useState("30");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    register.mutate(
      {
        id: device.id,
        body: {
          name: name.trim(),
          enabled,
          map_node_id: mapNode,
          ...(isSensor ? { sampling_interval_seconds: Number(intervalSeconds) } : {}),
        },
      },
      { onSuccess: onClose }
    );
  };
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="bg-white text-[#102c4d] sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b08412]">
              Device registration
            </p>
            <DialogTitle className="font-display text-2xl tracking-[-0.04em]">
              Register {device.device_id}
            </DialogTitle>
            <DialogDescription>
              Discovered over MQTT ({device.device_type}, MAC{" "}
              {device.mac_address ?? "unknown"}). Registering adds it to the
              managed FlowSense fleet.
            </DialogDescription>
          </DialogHeader>
          <div className="my-6 space-y-4">
            <Field label="Device name">
              <Input
                required
                maxLength={150}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. EYA Lobby Sensor 1"
                className="border-[#dbe3ed]"
              />
            </Field>
            <Field label="Map node" hint="Where the device sits on the map. You can set it later.">
              <MapNodeSelect value={mapNode} onChange={setMapNode} />
            </Field>
            {isSensor && (
              <Field label="Sampling interval (seconds)" hint="How often the sensor takes a reading.">
                <Input
                  required
                  type="number"
                  min={1}
                  max={86400}
                  value={intervalSeconds}
                  onChange={e => setIntervalSeconds(e.target.value)}
                  className="border-[#dbe3ed]"
                />
              </Field>
            )}
            <label className="flex items-center gap-3 text-sm text-[#40556d]">
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                className="size-4 accent-[#17365d]"
              />
              Enabled (store its readings right away)
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={register.isPending || !name.trim()}
              className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            >
              <Check size={15} className="mr-2" />
              Register device
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  device,
  onClose,
}: {
  device: DeviceDetail;
  onClose: () => void;
}) {
  const update = useUpdateDevice();
  const buildings = useBuildings();
  const [name, setName] = useState(device.name ?? "");
  const [building, setBuilding] = useState<number | null>(
    device.assignment.building?.id ?? null
  );
  const [floor, setFloor] = useState<number | null>(device.assignment.floor?.id ?? null);
  const [mapNode, setMapNode] = useState<number | null>(device.assignment.map_node?.id ?? null);
  const [intervalSeconds, setIntervalSeconds] = useState(
    String(device.sensor?.sampling_interval_seconds ?? 30)
  );
  const floors = useFloors(building);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(
      {
        id: device.id,
        body: {
          name: name.trim(),
          area_id: building,
          floor_id: floor,
          map_node_id: mapNode,
          ...(device.sensor ? { sampling_interval_seconds: Number(intervalSeconds) } : {}),
        },
      },
      { onSuccess: onClose }
    );
  };
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="bg-white text-[#102c4d] sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-[-0.04em]">
              Edit {deviceLabel(device)}
            </DialogTitle>
            <DialogDescription>Name, assignment, and sensor settings.</DialogDescription>
          </DialogHeader>
          <div className="my-6 space-y-4">
            <Field label="Device name">
              <Input
                required
                maxLength={150}
                value={name}
                onChange={e => setName(e.target.value)}
                className="border-[#dbe3ed]"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Building">
                <NativeSelect
                  aria-label="Building"
                  value={building ?? ""}
                  onChange={e => {
                    setBuilding(e.target.value ? Number(e.target.value) : null);
                    setFloor(null);
                  }}
                >
                  <option value="">Unassigned</option>
                  {(buildings.data ?? []).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Floor">
                <NativeSelect
                  aria-label="Floor"
                  value={floor ?? ""}
                  disabled={building === null}
                  onChange={e => setFloor(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Unassigned</option>
                  {(floors.data ?? []).map(f => (
                    <option key={f.id} value={f.id}>
                      {f.floor_order}F
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Map node">
              <MapNodeSelect value={mapNode} onChange={setMapNode} />
            </Field>
            {device.sensor && (
              <Field label="Sampling interval (seconds)">
                <Input
                  required
                  type="number"
                  min={1}
                  max={86400}
                  value={intervalSeconds}
                  onChange={e => setIntervalSeconds(e.target.value)}
                  className="border-[#dbe3ed]"
                />
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={update.isPending || !name.trim()}
              className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            >
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeviceDetails({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: device, isLoading, error, refetch } = useDevice(id);
  const stats = useSensorStatistics(id, device?.device_type === "sensor");
  const command = useDeviceCommand();
  const decommission = useDecommissionDevice();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!device) {
    return (
      <div className="mt-5">
        <QueryStatus isLoading={isLoading} error={error} onRetry={() => refetch()} what="the device" />
      </div>
    );
  }
  const run = (name: "enable" | "disable" | "ping" | "restart") =>
    command.mutate({ id: device.id, command: name });
  const unregistered = device.status === "unregistered";

  return (
    <Card className="mt-5 border-[#d6e0eb] bg-[#f4f8fc]" aria-label="Device details">
      <CardHeader className="border-b border-[#dbe3ed]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#b08412]">
            Device details
          </p>
          <CardTitle className="mt-1 font-display text-xl">{deviceLabel(device)}</CardTitle>
          <p className="mt-1 text-xs text-[#718398]">
            {device.device_id} · {device.identity.mac_address ?? "No MAC"}
          </p>
        </div>
        <CardAction className="flex items-center gap-2">
          <StatusPill status={titleCase(device.status)} tone={statusTone(device.status)} />
          <Button variant="ghost" size="icon" aria-label="Close details" onClick={onClose}>
            <X size={16} />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <InfoList
            title="Identity"
            rows={[
              ["Device name", device.name],
              ["Device type", titleCase(device.device_type)],
              ["Device ID", device.device_id],
              ["MAC address", device.identity.mac_address],
              ...(device.kiosk ? ([["Serial number", device.identity.serial_number]] as [string, string | null][]) : []),
              ["Registered", device.identity.registration_date ? formatWhen(device.identity.registration_date) : "Not yet"],
            ]}
          />
          <InfoList
            title="Assignment"
            rows={[
              ["Building", device.assignment.building?.name],
              ["Floor", device.assignment.floor?.label],
              ["Zone / area", device.assignment.area?.name],
              ["Map node", device.assignment.map_node?.name],
            ]}
          />
          <InfoList
            title="Connection"
            rows={[
              ["Status", titleCase(device.connection.status)],
              ["Last ping", formatWhen(device.connection.last_ping_at)],
              ["Last data", formatWhen(device.connection.last_data_transmission)],
              ...(device.sensor ? ([["MQTT status", device.connection.mqtt_status ? titleCase(device.connection.mqtt_status) : null]] as [string, string | null][]) : []),
              ["IP address", device.connection.ip_address],
              ["Uptime", formatUptime(device.connection.uptime_seconds)],
            ]}
          />
          {device.sensor && (
            <InfoList
              title="Sensor"
              rows={[
                ["Sensor", device.sensor.sensor_enabled ? "Enabled" : "Disabled"],
                ["Sampling interval", device.sensor.sampling_interval_seconds ? `${device.sensor.sampling_interval_seconds} s` : null],
                ["Current signal count", device.sensor.current_signal_count],
                ["Last reading", device.sensor.last_reading ? `${device.sensor.last_reading.signal_count ?? "—"} signals · ${formatWhen(device.sensor.last_reading.observed_at)}` : null],
                ["Wi-Fi signal", device.sensor.signal_strength !== null ? `${device.sensor.signal_strength} dBm` : null],
                ["Battery", device.sensor.battery_level !== null ? `${Number(device.sensor.battery_level)}%` : "USB power / not reported"],
              ]}
            />
          )}
          {device.sensor && stats.data && (
            <InfoList
              title="Last 24 hours"
              rows={[
                ["Readings received", `${stats.data.observations_received}${stats.data.observations_expected ? ` of ${stats.data.observations_expected}` : ""}`],
                ["Transmission reliability", stats.data.transmission_reliability_percent !== null ? `${stats.data.transmission_reliability_percent}%` : null],
                ["Average signal count", stats.data.average_signal_count],
                ["Peak signal count", stats.data.peak_signal_count],
                ["Peak density", stats.data.peak_density],
              ]}
            />
          )}
          {device.kiosk && (
            <InfoList
              title="Kiosk"
              rows={Object.entries(device.kiosk).map(([key, value]) => [
                titleCase(key.replace(/_/g, " ")),
                typeof value === "boolean" ? (value ? "Yes" : "No") : value,
              ])}
            />
          )}
          <InfoList
            title="Firmware"
            rows={[
              ["Version", device.firmware.version],
              ["Last update", device.firmware.last_update ? formatWhen(device.firmware.last_update) : null],
              ["Status", device.firmware.status ? titleCase(device.firmware.status) : null],
            ]}
          />
        </div>
        {!unregistered && (
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Device actions">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil size={14} className="mr-2" /> Edit
            </Button>
            <Button size="sm" variant="outline" disabled={command.isPending} onClick={() => run("ping")}>
              <Wifi size={14} className="mr-2" /> Ping
            </Button>
            <Button size="sm" variant="outline" disabled={command.isPending} onClick={() => run("restart")}>
              <RotateCcw size={14} className="mr-2" /> Restart
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={command.isPending}
              onClick={() => run(device.status === "disabled" ? "enable" : "disable")}
            >
              <Power size={14} className="mr-2" />
              {device.status === "disabled" ? "Enable" : "Disable"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!device.assignment.map_node}
              title={device.assignment.map_node ? undefined : "Assign a map node first"}
              onClick={() =>
                window.location.assign(`/map-annotation?node=${device.assignment.map_node?.id}`)
              }
            >
              <MapPin size={14} className="mr-2" /> View on map
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-[#b13a36]"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} className="mr-2" /> Delete device
            </Button>
          </div>
        )}
      </CardContent>
      {editing && <EditDialog device={device} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${deviceLabel(device)}?`}
        description="The device is decommissioned: it leaves the registry, its map node is freed, and its messages are ignored. Its past readings are kept."
        confirmLabel="Delete device"
        busy={decommission.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          decommission.mutate(device.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              onClose();
            },
          })
        }
      />
    </Card>
  );
}

export function HardwareManagement() {
  const [filters, setFilters] = useState<DeviceFilters>({ search: "", device_type: "", status: "" });
  const [selected, setSelected] = useState<number | null>(null);
  const [registering, setRegistering] = useState<DeviceRow | null>(null);
  const { data: devices, isLoading, error, refetch, isFetching } = useDevices(filters);
  const all = useDevices({});

  const metrics = useMemo(() => {
    const rows = all.data ?? [];
    const sensors = rows.filter(d => d.device_type === "sensor").length;
    const expected = rows.filter(d => d.status === "online" || d.status === "offline").length;
    const online = rows.filter(d => d.status === "online").length;
    const unregistered = rows.filter(d => d.status === "unregistered").length;
    const offline = rows.filter(d => d.status === "offline").length;
    return { total: rows.length, sensors, kiosks: rows.length - sensors, expected, online, unregistered, offline };
  }, [all.data]);

  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Hardware management"
        title="Hardware registry"
        description="Keep every kiosk and sensor accounted for, assigned, and ready to contribute to campus wayfinding. New devices appear here automatically when they first connect."
        action={
          <Button
            className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            onClick={() => {
              refetch();
              all.refetch();
            }}
            disabled={isFetching}
          >
            <RefreshCw size={16} className={cn("mr-2", isFetching && "animate-spin")} />
            Refresh
          </Button>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Total devices"
          value={metrics.total}
          detail={`${metrics.sensors} sensor${metrics.sensors === 1 ? "" : "s"} · ${metrics.kiosks} kiosk${metrics.kiosks === 1 ? "" : "s"}`}
          icon={Cpu}
          accent="navy"
        />
        <MetricCard
          label="Online now"
          value={metrics.online}
          detail={
            metrics.expected
              ? `${Math.round((metrics.online / metrics.expected) * 100)}% of enabled devices`
              : "No enabled devices yet"
          }
          icon={Wifi}
          accent="green"
        />
        <MetricCard
          label="Needs attention"
          value={metrics.unregistered + metrics.offline}
          detail={`${metrics.unregistered} unregistered · ${metrics.offline} offline`}
          icon={Wrench}
          accent="amber"
        />
      </div>
      <Card className="border-[#dbe3ed] shadow-[0_10px_30px_rgba(16,44,77,0.04)]">
        <CardHeader className="border-b border-[#e7edf3] pb-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <CardTitle className="font-display text-lg">Device registry</CardTitle>
              <p className="mt-1 text-xs text-[#8391a3]">
                Select a row to inspect device details and connection history.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <NativeSelect
                aria-label="Filter by type"
                className="sm:w-32"
                value={filters.device_type}
                onChange={e => setFilters({ ...filters, device_type: e.target.value as DeviceFilters["device_type"] })}
              >
                <option value="">All types</option>
                <option value="sensor">Sensors</option>
                <option value="kiosk">Kiosks</option>
              </NativeSelect>
              <NativeSelect
                aria-label="Filter by status"
                className="sm:w-40"
                value={filters.status}
                onChange={e => setFilters({ ...filters, status: e.target.value as DeviceFilters["status"] })}
              >
                <option value="">All statuses</option>
                {(["unregistered", "online", "offline", "disabled"] as const).map(s => (
                  <option key={s} value={s}>
                    {titleCase(s)}
                  </option>
                ))}
              </NativeSelect>
              <div className="relative sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#93a1b1]" size={16} />
                <Input
                  value={filters.search}
                  onChange={e => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search name, ID, MAC"
                  aria-label="Search devices"
                  className="border-[#dbe3ed] pl-9 text-sm"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <div className="p-4 empty:hidden">
          <QueryStatus isLoading={isLoading} error={error} onRetry={() => refetch()} what="devices" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-[0.14em] text-[#8291a3]">
              <tr>
                <th className="px-5 py-3 font-bold">Name</th>
                <th className="px-5 py-3 font-bold">Type</th>
                <th className="px-5 py-3 font-bold">Location</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold">Last ping</th>
                <th className="px-5 py-3 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {devices && devices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-[#8391a3]">
                    {filters.search || filters.device_type || filters.status
                      ? "No devices match these filters."
                      : "No devices yet. A device appears here when it first connects to the MQTT broker."}
                  </td>
                </tr>
              )}
              {devices?.map(device => (
                <tr
                  key={device.id}
                  className={cn(
                    "cursor-pointer transition hover:bg-[#fbfcfe]",
                    selected === device.id && "bg-[#fffaf0]"
                  )}
                  onClick={() => device.status !== "unregistered" && setSelected(device.id)}
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-[#17365d]">
                      {device.name ?? "Unnamed device"}
                    </p>
                    <p className="mt-1 text-[11px] text-[#9aa7b5]">{device.device_id}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-2 text-xs text-[#53677d]">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          device.device_type === "sensor" ? "bg-[#5d86af]" : "bg-[#f4c542]"
                        )}
                      />
                      {titleCase(device.device_type)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-[#60748a]">{device.location.label}</td>
                  <td className="px-5 py-4">
                    <StatusPill status={titleCase(device.status)} tone={statusTone(device.status)} />
                  </td>
                  <td className="px-5 py-4 text-xs text-[#8291a3]">{formatWhen(device.last_ping_at)}</td>
                  <td className="px-5 py-4 text-right">
                    <Button
                      size="sm"
                      variant={device.status === "unregistered" ? "default" : "outline"}
                      className={
                        device.status === "unregistered"
                          ? "bg-[#f4c542] text-[#17365d] hover:bg-[#e8ba2d]"
                          : "border-[#dbe3ed] text-[#17365d]"
                      }
                      onClick={e => {
                        e.stopPropagation();
                        if (device.status === "unregistered") setRegistering(device);
                        else setSelected(device.id);
                      }}
                    >
                      {device.status === "unregistered" ? "Register" : "Manage"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {selected !== null && (
        <DeviceDetails key={selected} id={selected} onClose={() => setSelected(null)} />
      )}
      {registering && (
        <RegisterDialog device={registering} onClose={() => setRegistering(null)} />
      )}
    </>
  );
}
