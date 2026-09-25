/* FlowSense API boundary: keep request contracts typed, mockable, and backend agnostic. */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export type DeviceStatus =
  | "Online"
  | "Offline"
  | "Unregistered"
  | "Disabled"
  | "Decommissioned";
export type DeviceType = "Sensor" | "Kiosk";
export type SystemStatus =
  | "Operational"
  | "Degraded"
  | "Critical"
  | "Maintenance";

export interface AdminProfile {
  email: string;
  name: string;
  role: "Admin" | "Super Admin";
}

/** GET /auth/me response (backend AdminUserSerializer). */
export interface AdminMe {
  id: number;
  full_name: string;
  email: string;
  role: "admin" | "super admin";
}

export function toAdminProfile(me: AdminMe): AdminProfile {
  return {
    name: me.full_name,
    email: me.email,
    role: me.role === "super admin" ? "Super Admin" : "Admin",
  };
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  location: string;
  status: DeviceStatus;
  lastPing: string;
  mac?: string;
}

export interface Destination {
  id: string;
  name: string;
  code: string;
  building: string;
  floor: string;
}

export interface DensityPoint {
  area: string;
  density: "Low" | "Moderate" | "High";
  value: number;
}

export interface DashboardSummary {
  systemStatus: SystemStatus;
  onlineKiosks: number;
  onlineSensors: number;
  kioskSessions: number;
  navigationQueries: number;
  successfulSearches: number;
  failedSearches: number;
  averageSession: string;
  density: DensityPoint[];
  topDestinations: Destination[];
}

/** Pagination block of a paginated response (OpenAPI PaginationMeta). */
export interface PaginationMeta {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}

export interface PageOf<T> {
  results: T[];
  meta: PaginationMeta;
}

export interface ApiClient {
  /** `headers` adds request headers (for example the kiosk session id). */
  get<T>(path: string, headers?: Record<string, string>): Promise<T>;
  /** A paginated list: the rows (`data`) and the `meta` block. */
  getPage<T>(path: string): Promise<PageOf<T>>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

/** Non-2xx API response; `status` lets callers distinguish 4xx from outages. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Parsed JSON error body, when the server sent one. */
    readonly body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * A readable message from an error body: the contract's
 * {"success": false, "error": {"code": "...", "message": "..."}}, or (from
 * non-API servers) {"detail": "..."} or a field error map.
 */
export function describeApiError(
  error: unknown,
  fallback = "Something went wrong. Try again."
): string {
  if (!(error instanceof ApiError)) return fallback;
  const body = error.body as Record<string, unknown> | undefined;
  if (!body || typeof body !== "object") return fallback;
  if (typeof body.detail === "string") return body.detail;
  const envelopeError = body.error as { message?: unknown } | undefined;
  if (envelopeError && typeof envelopeError.message === "string")
    return envelopeError.message;
  for (const value of Object.values(body)) {
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    if (typeof value === "string") return value;
  }
  return fallback;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  keepMeta = false
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new ApiError(
      `${init?.method ?? "GET"} ${path} failed with ${response.status}`,
      response.status,
      body
    );
  }

  if (response.status === 204) return undefined as T;
  const json = await response.json();
  // Every response uses the OpenAPI contract's envelope:
  // {"success": true, "data": ..., "meta"?: {...}}. Callers get `data`
  // (and `meta` for paginated lists through getPage).
  if (
    json &&
    typeof json === "object" &&
    !Array.isArray(json) &&
    "success" in json
  ) {
    if (keepMeta) {
      return { results: json.data ?? [], meta: json.meta } as T;
    }
    return json.data as T;
  }
  return json as T;
}

export const apiClient: ApiClient = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, headers ? { headers } : undefined),
  getPage: <T>(path: string) => request<PageOf<T>>(path, undefined, true),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

const byId = (resource: string, id: string) => `${resource}/${id}`;

export const endpointMap = {
  auth: {
    login: "/auth/login",
    verify: "/auth/verify",
    logout: "/auth/logout",
    me: "/auth/me",
    session: "/auth/session",
  },
  map: {
    context: "/map/context",
    areas: "/map/areas",
    area: (id: string) => byId("/map/areas", id),
    areaFloors: (id: string) => `${byId("/map/areas", id)}/floors`,
    floors: "/map/floors",
    floor: (id: string) => byId("/map/floors", id),
    rooms: "/map/rooms",
    room: (id: string) => byId("/map/rooms", id),
    roomPersonnel: (id: string) => `${byId("/map/rooms", id)}/personnel`,
    entrances: "/map/entrances",
    stairs: "/map/stairs",
    elevators: "/map/elevators",
    outdoorWalkways: "/map/outdoor-walkways",
    personnel: "/map/personnel",
  },
  navigation: {
    routes: "/navigation/routes",
    route: (id: string) => byId("/navigation/routes", id),
    nodes: "/navigation/nodes",
    node: (id: string) => byId("/navigation/nodes", id),
    destinations: "/navigation/destinations",
    destination: (id: string) => byId("/navigation/destinations", id),
  },
  search: { query: "/search", suggestions: "/search/suggestions" },
  sessions: {
    all: "/sessions",
    session: (id: string) => byId("/sessions", id),
    cancel: (id: string) => `${byId("/sessions", id)}/cancel`,
    complete: (id: string) => `${byId("/sessions", id)}/complete`,
    scan: (id: string) => `${byId("/sessions", id)}/scan`,
    destinationReached: (id: string, destinationId: string) =>
      `${byId("/sessions", id)}/destinations/${destinationId}/reach`,
    kiosk: "/sessions/kiosk",
    kioskSession: (id: string) => byId("/sessions/kiosk", id),
    kioskEnd: (id: string) => `${byId("/sessions/kiosk", id)}/end`,
    kioskHeartbeat: (id: string) => `${byId("/sessions/kiosk", id)}/heartbeat`,
    navigation: "/sessions/navigation",
    navigationSession: (id: string) => byId("/sessions/navigation", id),
    navigationCancel: (id: string) =>
      `${byId("/sessions/navigation", id)}/cancel`,
    navigationComplete: (id: string) =>
      `${byId("/sessions/navigation", id)}/complete`,
    navigationPause: (id: string) =>
      `${byId("/sessions/navigation", id)}/pause`,
    navigationResume: (id: string) =>
      `${byId("/sessions/navigation", id)}/resume`,
  },
  annotation: {
    all: "/annotations",
    nodes: "/annotations/nodes",
    node: (id: string) => byId("/annotations/nodes", id),
    edges: "/annotations/edges",
    edge: (id: string) => byId("/annotations/edges", id),
    transitions: "/annotations/transitions",
    transition: (id: string) => byId("/annotations/transitions", id),
    rooms: "/annotations/rooms",
    room: (id: string) => byId("/annotations/rooms", id),
    entrances: "/annotations/entrances",
    entrance: (id: string) => byId("/annotations/entrances", id),
    stairs: "/annotations/stairs",
    stair: (id: string) => byId("/annotations/stairs", id),
    elevators: "/annotations/elevators",
    elevator: (id: string) => byId("/annotations/elevators", id),
    outdoorWalkways: "/annotations/outdoor-walkways",
    outdoorWalkway: (id: string) => byId("/annotations/outdoor-walkways", id),
  },
  hardware: {
    devices: "/hardware/devices",
    device: (id: string) => byId("/hardware/devices", id),
    register: "/hardware/devices/register",
    command: (id: string, command: "disable" | "enable" | "ping" | "restart") =>
      `${byId("/hardware/devices", id)}/commands/${command}`,
    kiosks: "/hardware/kiosks",
    kiosk: (id: string) => byId("/hardware/kiosks", id),
    sensors: "/hardware/sensors",
    sensor: (id: string) => byId("/hardware/sensors", id),
    sensorObservations: (id: string) =>
      `${byId("/hardware/sensors", id)}/observations`,
    sensorStatistics: (id: string) =>
      `${byId("/hardware/sensors", id)}/statistics`,
  },
  assets: {
    all: "/assets",
    asset: (id: string) => byId("/assets", id),
    versions: (assetId: string) => `${byId("/assets", assetId)}/versions`,
    version: (assetId: string, versionId: string) =>
      `${byId("/assets", assetId)}/versions/${versionId}`,
    versionDownload: (assetId: string, versionId: string) =>
      `${endpointMap.assets.version(assetId, versionId)}/download`,
    versionRestore: (assetId: string, versionId: string) =>
      `${endpointMap.assets.version(assetId, versionId)}/restore`,
    versionValidation: (assetId: string, versionId: string) =>
      `${endpointMap.assets.version(assetId, versionId)}/validation`,
    versionValidationChecks: (assetId: string, versionId: string) =>
      `${endpointMap.assets.version(assetId, versionId)}/validation/checks`,
    validation: (assetId: string) => `${byId("/assets", assetId)}/validation`,
    processing: (assetId: string) => `${byId("/assets", assetId)}/processing`,
    activate: (assetId: string) => `${byId("/assets", assetId)}/activate`,
  },
  analytics: {
    dashboard: "/analytics/dashboard",
    activity: "/analytics/activity",
    navigation: "/analytics/navigation",
    kiosks: "/analytics/kiosks",
    search: "/analytics/search",
    sensors: "/analytics/sensors",
    spatial: "/analytics/spatial",
    system: "/analytics/system",
    qr: "/analytics/qr",
    qrEvents: "/analytics/qr/events",
    reports: "/analytics/reports",
    report: (id: string) => byId("/analytics/reports", id),
  },
  alerts: {
    all: "/alerts",
    alert: (id: string) => byId("/alerts", id),
    acknowledge: (id: string) => `${byId("/alerts", id)}/acknowledge`,
    clear: (id: string) => `${byId("/alerts", id)}/clear`,
  },
  activity: {
    all: "/activity",
    event: (id: string) => byId("/activity", id),
  },
  users: {
    all: "/users",
    user: (id: string) => byId("/users", id),
    me: "/auth/me",
  },
  settings: {
    all: "/settings",
    key: (key: string) => `/settings/${key}`,
    semesters: "/settings/semesters",
    semester: (id: string) => byId("/settings/semesters", id),
  },
  system: { status: "/system/status", health: "/system/health" },
};

export function isApiConfigured() {
  return Boolean(import.meta.env.VITE_API_BASE_URL);
}
