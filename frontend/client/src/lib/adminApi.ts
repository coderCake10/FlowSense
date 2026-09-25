/* Admin dashboard data: typed responses of the /api/v1 admin endpoints and TanStack Query hooks.
 *
 * With VITE_API_BASE_URL unset the dashboard runs as an offline demo: queries
 * return the demo data in ./demoData and changes are refused with a notice. */
import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ApiError,
  PageOf,
  apiClient,
  describeApiError,
  endpointMap,
  isApiConfigured,
} from "./api";
import {
  demoActivity,
  demoAlerts,
  demoDashboard,
  demoDeviceDetail,
  demoDevices,
  demoSemesters,
  demoSettings,
  demoUsers,
} from "./demoData";

/* ---------- response types (mirror the Django serializers) ---------- */

export type DeviceStatusValue =
  | "unregistered"
  | "online"
  | "offline"
  | "disabled"
  | "decommissioned";
export type DeviceTypeValue = "sensor" | "kiosk";
export type SystemStatusValue =
  | "operational"
  | "degraded"
  | "critical"
  | "maintenance";

export interface AreaRef {
  id: number;
  code: string;
  name: string;
}
export interface FloorRef {
  id: number;
  floor_order: number;
  label: string;
}
export interface DeviceLocation {
  building: AreaRef | null;
  floor: FloorRef | null;
  area: AreaRef | null;
  label: string;
}

export interface DeviceRow {
  id: number;
  device_id: string;
  name: string | null;
  device_type: DeviceTypeValue;
  status: DeviceStatusValue;
  enabled: boolean;
  last_ping_at: string | null;
  mac_address: string | null;
  location: DeviceLocation;
}

export interface DeviceDetail {
  id: number;
  device_id: string;
  name: string | null;
  device_type: DeviceTypeValue;
  status: DeviceStatusValue;
  enabled: boolean;
  identity: {
    device_name: string | null;
    device_type: DeviceTypeValue;
    device_id: string;
    mac_address: string | null;
    serial_number: string | null;
    registration_date: string | null;
    discovered_at: string | null;
  };
  assignment: DeviceLocation & {
    map_node: { id: number; name: string; node_type: string } | null;
  };
  connection: {
    status: DeviceStatusValue;
    last_ping_at: string | null;
    last_data_transmission: string | null;
    mqtt_status: string | null;
    ip_address: string | null;
    uptime_seconds: number | null;
  };
  sensor: {
    sensor_enabled: boolean;
    sampling_interval_seconds: number | null;
    battery_level: string | number | null;
    signal_strength: number | null;
    current_signal_count: number | null;
    last_reading: {
      observed_at: string;
      signal_count: number | null;
      estimated_density: string | number | null;
    } | null;
  } | null;
  kiosk: Record<string, string | boolean | null> | null;
  firmware: {
    version: string | null;
    last_update: string | null;
    status: string | null;
  };
}

export interface SensorStatistics {
  period_start: string;
  period_end: string;
  observations_received: number;
  observations_expected: number | null;
  transmission_reliability_percent: number | null;
  average_signal_count: number | null;
  peak_signal_count: number | null;
  average_density: number | null;
  peak_density: number | null;
  last_transmission_at: string | null;
}

export interface AdminRef {
  id: number;
  full_name: string;
  email?: string;
}

export interface AlertItem {
  id: number;
  severity: "informational" | "warning" | "critical";
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: number | null;
  state: "active" | "acknowledged" | "cleared";
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: AdminRef | null;
  cleared_at: string | null;
}

export interface ActivityItem {
  id: number;
  event_type: string;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  description: string | null;
  metadata: Record<string, unknown>;
  admin_user: AdminRef | null;
  created_at: string;
}

export type Page<T> = PageOf<T>;

export interface DashboardData {
  generated_at: string;
  system: {
    status: SystemStatusValue;
    kiosks: { online: number; total: number };
    sensors: { online: number; total: number };
  };
  today: {
    kiosk_sessions: number;
    navigation_queries: number;
    successful_searches: number;
    failed_searches: number;
    average_session_seconds: number | null;
  };
  kiosk_activity: { date: string; sessions: number }[];
  crowd_density: {
    device_id: number;
    sensor: string;
    area: string;
    estimated_density: number | null;
    level: "low" | "moderate" | "high" | null;
    signal_count: number | null;
    observed_at: string | null;
  }[];
  top_destinations: { node_id: number; name: string; count: number }[];
  failed_searches: { query: string; count: number }[];
  alerts: { open: number; latest: AlertItem[] };
  recent_activity: ActivityItem[];
  summary: {
    buildings: number;
    floors: number;
    rooms: number;
    mapped_rooms: number;
    assets: number;
    kiosks: number;
    sensors: number;
  };
}

export interface AdminUserItem {
  id: number;
  full_name: string;
  email: string;
  role: "admin" | "super admin";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SettingItem {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  editable: boolean;
  updated_at: string;
  updated_by: AdminRef | null;
}

export interface SemesterItem {
  id: number;
  academic_year: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface BuildingOption {
  id: number;
  code: string;
  name: string;
}
export interface FloorOption {
  id: number;
  area: number;
  floor_order: number;
}
export interface MapNodeOption {
  id: number;
  name: string;
  node_type: string;
  floor?: number;
}

/* ---------- query plumbing ---------- */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      // Retry outages once; never retry a 4xx (it won't change).
      retry: (count, error) =>
        !(error instanceof ApiError && error.status < 500) && count < 1,
    },
  },
});

export const keys = {
  dashboard: ["dashboard"] as const,
  devices: (filters: DeviceFilters) => ["devices", filters] as const,
  device: (id: number) => ["device", id] as const,
  sensorStats: (id: number) => ["sensor-stats", id] as const,
  users: ["users"] as const,
  settings: ["settings"] as const,
  semesters: ["semesters"] as const,
  alerts: (state: string) => ["alerts", state] as const,
  activity: (page: number) => ["activity", page] as const,
  buildings: ["buildings"] as const,
  floors: (buildingId: number) => ["floors", buildingId] as const,
  mapNodes: ["map-nodes"] as const,
};

/** A query that serves demo data when no API is configured. */
function useAdminQuery<T>(
  queryKey: readonly unknown[],
  path: string,
  demo: T,
  options: {
    refetchInterval?: number;
    enabled?: boolean;
    fetcher?: (path: string) => Promise<T>;
  } = {}
) {
  const live = isApiConfigured();
  const query = useQuery({
    queryKey,
    queryFn: () => (options.fetcher ?? apiClient.get<T>)(path),
    enabled: live && (options.enabled ?? true),
    refetchInterval: options.refetchInterval,
  });
  if (!live) {
    return { ...query, data: demo, isLoading: false, isError: false, isDemo: true };
  }
  return { ...query, isDemo: false };
}

/** A mutation that refreshes the given queries and reports errors as toasts. */
function useAdminMutation<Input, Output>(
  run: (input: Input) => Promise<Output>,
  invalidate: readonly (readonly unknown[])[],
  successMessage?: (output: Output, input: Input) => string
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => {
      if (!isApiConfigured()) {
        return Promise.reject(new DemoModeError());
      }
      return run(input);
    },
    onSuccess: (output, input) => {
      invalidate.forEach(queryKey => client.invalidateQueries({ queryKey }));
      if (successMessage) toast.success(successMessage(output, input));
    },
    onError: error => {
      toast.error(
        error instanceof DemoModeError
          ? "Demo mode: connect the API to save changes."
          : describeApiError(error)
      );
    },
  });
}

class DemoModeError extends Error {}

/* ---------- dashboard ---------- */

export function useDashboard() {
  return useAdminQuery<DashboardData>(
    keys.dashboard,
    endpointMap.analytics.dashboard,
    demoDashboard,
    { refetchInterval: 30_000 }
  );
}

/* ---------- hardware ---------- */

export interface DeviceFilters {
  device_type?: DeviceTypeValue | "";
  status?: DeviceStatusValue | "";
  search?: string;
}

/** The rows of a paginated list endpoint. */
const rowsOf = <T,>(path: string) =>
  apiClient.getPage<T>(path).then(page => page.results);

function withQuery(path: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][]
  ).toString();
  return query ? `${path}?${query}` : path;
}

export function useDevices(filters: DeviceFilters) {
  const demo = demoDevices.filter(
    d =>
      (!filters.device_type || d.device_type === filters.device_type) &&
      (!filters.status || d.status === filters.status) &&
      (!filters.search ||
        `${d.name} ${d.device_id} ${d.mac_address}`
          .toLowerCase()
          .includes(filters.search.toLowerCase()))
  );
  return useAdminQuery<DeviceRow[]>(
    keys.devices(filters),
    withQuery(endpointMap.hardware.devices, {
      device_type: filters.device_type || undefined,
      status: filters.status || undefined,
      search: filters.search || undefined,
      // The registry shows every device on one page (the contract caps pages at 100).
      page_size: "100",
    }),
    demo,
    { refetchInterval: 15_000, fetcher: rowsOf<DeviceRow> }
  );
}

export function useDevice(id: number | null) {
  return useAdminQuery<DeviceDetail>(
    keys.device(id ?? 0),
    endpointMap.hardware.device(String(id)),
    demoDeviceDetail(id),
    { enabled: id !== null, refetchInterval: 15_000 }
  );
}

export function useSensorStatistics(id: number | null, enabled: boolean) {
  return useAdminQuery<SensorStatistics | null>(
    keys.sensorStats(id ?? 0),
    `${endpointMap.hardware.sensorStatistics(String(id))}?hours=24`,
    null,
    { enabled: id !== null && enabled }
  );
}

const hardwareKeys = [["devices"], ["device"], keys.dashboard] as const;

export interface RegisterInput {
  name: string;
  enabled: boolean;
  map_node_id?: number | null;
  sampling_interval_seconds?: number | null;
}

export function useRegisterDevice() {
  return useAdminMutation(
    ({ id, body }: { id: number; body: RegisterInput }) =>
      apiClient.post<DeviceDetail>(
        `${endpointMap.hardware.device(String(id))}/register`,
        body
      ),
    hardwareKeys,
    device => `${device.name} is registered.`
  );
}

export interface DeviceUpdateInput {
  name?: string;
  map_node_id?: number | null;
  area_id?: number | null;
  floor_id?: number | null;
  sampling_interval_seconds?: number;
}

export function useUpdateDevice() {
  return useAdminMutation(
    ({ id, body }: { id: number; body: DeviceUpdateInput }) =>
      apiClient.patch<DeviceDetail>(endpointMap.hardware.device(String(id)), body),
    hardwareKeys,
    device => `${device.name ?? device.device_id} is updated.`
  );
}

export type DeviceCommand = "enable" | "disable" | "ping" | "restart";

export function useDeviceCommand() {
  return useAdminMutation(
    ({ id, command }: { id: number; command: DeviceCommand }) =>
      apiClient.post<DeviceDetail>(
        endpointMap.hardware.command(String(id), command)
      ),
    hardwareKeys,
    (device, { command }) =>
      `${device.name ?? device.device_id} is ${command === "enable" ? "enabled" : command === "disable" ? "disabled" : command}.`
  );
}

export function useDecommissionDevice() {
  return useAdminMutation(
    (id: number) => apiClient.delete<void>(endpointMap.hardware.device(String(id))),
    hardwareKeys,
    () => "The device is decommissioned."
  );
}

export function useBuildings() {
  return useAdminQuery<BuildingOption[]>(
    keys.buildings,
    `${endpointMap.map.areas}?area_type=building`,
    [{ id: 2, code: "EYA", name: "EYA Building" }]
  );
}

export function useFloors(buildingId: number | null) {
  return useAdminQuery<FloorOption[]>(
    keys.floors(buildingId ?? 0),
    endpointMap.map.areaFloors(String(buildingId)),
    [1, 2, 3, 4, 5, 6].map(n => ({ id: n, area: 2, floor_order: n })),
    { enabled: buildingId !== null }
  );
}

export function useMapNodes() {
  const query = useAdminQuery<{ nodes: MapNodeOption[] }>(
    keys.mapNodes,
    endpointMap.annotation.all,
    { nodes: [] }
  );
  return { ...query, nodes: query.data?.nodes ?? [] };
}

/* ---------- alerts and activity ---------- */

export function useAlerts(state: "open" | "cleared" | "all" = "open") {
  return useAdminQuery<Page<AlertItem>>(
    keys.alerts(state),
    `${endpointMap.alerts.all}?state=${state}`,
    demoAlerts,
    { refetchInterval: 30_000, fetcher: path => apiClient.getPage<AlertItem>(path) }
  );
}

export function useAlertAction() {
  return useAdminMutation(
    ({ id, action }: { id: number; action: "acknowledge" | "clear" }) =>
      apiClient.post<AlertItem>(
        action === "clear"
          ? endpointMap.alerts.clear(String(id))
          : endpointMap.alerts.acknowledge(String(id))
      ),
    [["alerts"], keys.dashboard],
    (alert, { action }) =>
      action === "clear" ? `Cleared: ${alert.title}` : `Acknowledged: ${alert.title}`
  );
}

export function useActivity(page = 1) {
  return useAdminQuery<Page<ActivityItem>>(
    keys.activity(page),
    `${endpointMap.activity.all}?page=${page}`,
    demoActivity,
    { fetcher: path => apiClient.getPage<ActivityItem>(path) }
  );
}

/* ---------- users ---------- */

export function useUsers() {
  return useAdminQuery<AdminUserItem[]>(
    keys.users,
    `${endpointMap.users.all}?page_size=100`,
    demoUsers,
    { fetcher: rowsOf<AdminUserItem> }
  );
}

export interface UserInput {
  full_name: string;
  email: string;
  role: "admin" | "super admin";
}

export function useCreateUser() {
  return useAdminMutation(
    (body: UserInput) => apiClient.post<AdminUserItem>(endpointMap.users.all, body),
    [keys.users],
    user => `${user.full_name} can now sign in.`
  );
}

export function useUpdateUser() {
  return useAdminMutation(
    ({ id, body }: { id: number; body: Partial<UserInput> & { is_active?: boolean } }) =>
      apiClient.patch<AdminUserItem>(endpointMap.users.user(String(id)), body),
    [keys.users],
    user => `${user.full_name} is updated.`
  );
}

export function useDeleteUser() {
  return useAdminMutation(
    (id: number) => apiClient.delete<void>(endpointMap.users.user(String(id))),
    [keys.users],
    () => "The administrator is removed."
  );
}

/* ---------- settings ---------- */

export function useSettings() {
  return useAdminQuery<SettingItem[]>(
    keys.settings,
    endpointMap.settings.all,
    demoSettings
  );
}

export function useUpdateSetting() {
  return useAdminMutation(
    ({ key, value }: { key: string; value: Record<string, unknown> }) =>
      apiClient.patch<SettingItem>(endpointMap.settings.key(key), { value }),
    [keys.settings, keys.dashboard],
    () => "Setting saved."
  );
}

export function useSemesters() {
  return useAdminQuery<SemesterItem[]>(
    keys.semesters,
    endpointMap.settings.semesters,
    demoSemesters
  );
}

export type SemesterInput = Omit<SemesterItem, "id">;

export function useSaveSemester() {
  return useAdminMutation(
    ({ id, body }: { id?: number; body: Partial<SemesterInput> }) =>
      id
        ? apiClient.patch<SemesterItem>(endpointMap.settings.semester(String(id)), body)
        : apiClient.post<SemesterItem>(endpointMap.settings.semesters, body),
    [keys.semesters],
    semester => `${semester.academic_year} ${semester.name} saved.`
  );
}

export function useDeleteSemester() {
  return useAdminMutation(
    (id: number) => apiClient.delete<void>(endpointMap.settings.semester(String(id))),
    [keys.semesters],
    () => "Semester deleted."
  );
}

/* ---------- formatting helpers shared by the admin pages ---------- */

const timeFormat = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "10:29 AM" today, "Sep 23, 1:29 AM" otherwise, "Never" for null. */
export function formatWhen(value: string | null | undefined, now = new Date()) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toDateString() === now.toDateString()
    ? timeFormat.format(date)
    : dateTimeFormat.format(date);
}

/** 258 -> "04:18" (minutes:seconds). */
export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "—";
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

export function titleCase(value: string) {
  return value.replace(/\b\w/g, c => c.toUpperCase());
}
