/* Offline demo data for the admin dashboard (used only when VITE_API_BASE_URL is unset).
 * Values match what the pages showed before they were connected to the API. */
import type {
  ActivityItem,
  AdminUserItem,
  AlertItem,
  DashboardData,
  DeviceDetail,
  DeviceRow,
  Page,
  SemesterItem,
  SettingItem,
} from "./adminApi";

const today = new Date();
const at = (hours: number, minutes: number, daysAgo = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

const eya = { id: 2, code: "EYA", name: "EYA Building" };
const floor = (n: number) => ({ id: n, floor_order: n, label: `${n}F` });
const location = (n: number | null, area: string | null = null) =>
  n === null
    ? { building: null, floor: null, area: null, label: "Unassigned" }
    : {
        building: eya,
        floor: floor(n),
        area: area ? { id: 90 + n, code: area, name: area } : null,
        label: `EYA Building · ${n}F`,
      };

export const demoDevices: DeviceRow[] = [
  { id: 1, device_id: "esp32-eya-1f-01", name: null, device_type: "sensor", status: "unregistered", enabled: false, last_ping_at: at(10, 27), mac_address: "84:CC:A8:41:2F:11", location: location(null) },
  { id: 2, device_id: "kiosk-eya-main", name: "Main Entrance Kiosk", device_type: "kiosk", status: "online", enabled: true, last_ping_at: at(10, 29), mac_address: "84:CC:A8:41:2F:12", location: location(1, "Main Entrance") },
  { id: 3, device_id: "kiosk-eya-1f", name: "EYA Kiosk-1", device_type: "kiosk", status: "online", enabled: true, last_ping_at: at(10, 29), mac_address: "84:CC:A8:41:2F:13", location: location(1) },
  { id: 4, device_id: "esp32-eya-2f-01", name: "Sensor-2", device_type: "sensor", status: "online", enabled: true, last_ping_at: at(10, 29), mac_address: "84:CC:A8:41:2F:14", location: location(2) },
  { id: 5, device_id: "esp32-eya-3f-01", name: "Sensor-3", device_type: "sensor", status: "offline", enabled: true, last_ping_at: at(1, 29, 1), mac_address: "84:CC:A8:41:2F:15", location: location(3) },
  { id: 6, device_id: "esp32-eya-1f-02", name: "Sensor-4", device_type: "sensor", status: "disabled", enabled: false, last_ping_at: at(9, 0, 7), mac_address: "84:CC:A8:41:2F:16", location: location(1) },
];

export function demoDeviceDetail(id: number | null): DeviceDetail {
  const row = demoDevices.find(d => d.id === id) ?? demoDevices[3];
  const isSensor = row.device_type === "sensor";
  return {
    id: row.id,
    device_id: row.device_id,
    name: row.name,
    device_type: row.device_type,
    status: row.status,
    enabled: row.enabled,
    identity: {
      device_name: row.name,
      device_type: row.device_type,
      device_id: row.device_id,
      mac_address: row.mac_address,
      serial_number: isSensor ? null : "FS-KIOSK-0001",
      registration_date: row.status === "unregistered" ? null : at(9, 0, 30),
      discovered_at: at(8, 30, 31),
    },
    assignment: { ...row.location, map_node: null },
    connection: {
      status: row.status,
      last_ping_at: row.last_ping_at,
      last_data_transmission: row.last_ping_at,
      mqtt_status: isSensor ? (row.status === "online" ? "online" : "offline") : null,
      ip_address: "192.168.1.41",
      uptime_seconds: 86_400,
    },
    sensor: isSensor
      ? {
          sensor_enabled: row.enabled,
          sampling_interval_seconds: 30,
          battery_level: null,
          signal_strength: -58,
          current_signal_count: 21,
          last_reading: { observed_at: row.last_ping_at ?? at(10, 29), signal_count: 21, estimated_density: 0.51 },
        }
      : null,
    kiosk: isSensor
      ? null
      : {
          display_resolution: "1920×1080",
          touchscreen_connected: true,
          orientation: "landscape",
          application_status: "running",
          os_version: null,
        },
    firmware: { version: isSensor ? "v1.8.4" : null, last_update: null, status: null },
  };
}

export const demoAlerts: Page<AlertItem> = {
  meta: { page: 1, page_size: 25, total_count: 1, total_pages: 1 },
  results: [
    {
      id: 1,
      severity: "warning",
      title: "Device offline",
      message: "Sensor-3 (sensor) stopped reporting. Last seen: 01:29 AM yesterday.",
      entity_type: "device",
      entity_id: 5,
      state: "active",
      created_at: at(1, 32, 1),
      acknowledged_at: null,
      acknowledged_by: null,
      cleared_at: null,
    },
  ],
};

export const demoActivity: Page<ActivityItem> = {
  meta: { page: 1, page_size: 25, total_count: 2, total_pages: 1 },
  results: [
    { id: 2, event_type: "asset", action: "activate", entity_type: "asset", entity_id: 1, description: "Published EYA Building v1.4", metadata: {}, admin_user: { id: 1, full_name: "Maria Santos" }, created_at: at(10, 18) },
    { id: 1, event_type: "administrative", action: "create", entity_type: "device", entity_id: 4, description: "Registered sensor Sensor-2", metadata: {}, admin_user: { id: 1, full_name: "Maria Santos" }, created_at: at(9, 2) },
  ],
};

export const demoDashboard: DashboardData = {
  generated_at: today.toISOString(),
  system: { status: "operational", kiosks: { online: 4, total: 4 }, sensors: { online: 18, total: 21 } },
  today: { kiosk_sessions: 184, navigation_queries: 327, successful_searches: 269, failed_searches: 21, average_session_seconds: 258 },
  kiosk_activity: [42, 65, 51, 76, 88, 64, 96].map((sessions, i) => ({
    date: new Date(today.getTime() - (6 - i) * 86_400_000).toISOString().slice(0, 10),
    sessions,
  })),
  crowd_density: [
    { device_id: 2, sensor: "Main Entrance", area: "Main Entrance · EYA Building · 1F", estimated_density: 0.72, level: "high", signal_count: 36, observed_at: at(10, 29) },
    { device_id: 3, sensor: "EYA 1F", area: "EYA Building · 1F", estimated_density: 0.48, level: "moderate", signal_count: 24, observed_at: at(10, 29) },
    { device_id: 4, sensor: "Sensor-2", area: "EYA Building · 2F", estimated_density: 0.21, level: "low", signal_count: 10, observed_at: at(10, 29) },
  ],
  top_destinations: [
    { node_id: 1, name: "Registrar's Office", count: 64 },
    { node_id: 2, name: "EA-110 Office of the Dean (CAS)", count: 41 },
    { node_id: 3, name: "Guidance and Counseling Center", count: 33 },
  ],
  failed_searches: [
    { query: "cashier", count: 9 },
    { query: "guidanse", count: 5 },
  ],
  alerts: { open: demoAlerts.meta.total_count, latest: demoAlerts.results },
  recent_activity: demoActivity.results,
  summary: { buildings: 1, floors: 6, rooms: 92, mapped_rooms: 0, assets: 2, kiosks: 4, sensors: 21 },
};

export const demoUsers: AdminUserItem[] = [
  { id: 1, full_name: "Maria Santos", email: "m.santos@auf.edu.ph", role: "super admin", is_active: true, created_at: at(9, 0, 40), updated_at: at(9, 0, 40) },
  { id: 2, full_name: "Jose Reyes", email: "j.reyes@auf.edu.ph", role: "admin", is_active: true, created_at: at(9, 0, 20), updated_at: at(9, 0, 20) },
  { id: 3, full_name: "Ana Cruz", email: "a.cruz@auf.edu.ph", role: "admin", is_active: false, created_at: at(9, 0, 10), updated_at: at(9, 0, 2) },
];

export const demoSettings: SettingItem[] = [
  { key: "informational_alert_clear_time", value: { seconds: 3600 }, description: "How long informational alerts remain before being automatically cleared.", editable: true, updated_at: at(9, 0, 5), updated_by: null },
  { key: "maintenance_mode", value: { enabled: false }, description: "When enabled, the system status is Maintenance and the system isn't available for use.", editable: true, updated_at: at(9, 0, 5), updated_by: null },
];

export const demoSemesters: SemesterItem[] = [
  { id: 1, academic_year: "2026-2027", name: "First Semester", start_date: "2026-08-10", end_date: "2026-12-18", is_active: true },
];
