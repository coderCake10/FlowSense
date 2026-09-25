/* Analytics page data: typed responses of /api/v1/analytics/* and one hook per section.
 * Every section follows the same filters (date range, building, floor, kiosk). */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient, isApiConfigured } from "./api";
import { demoAnalytics } from "./analyticsDemo";

export type RangeKey = "today" | "last_7_days" | "last_30_days" | "semester" | "custom";

export interface AnalyticsFilters {
  range: RangeKey;
  semester_id?: string;
  start_date?: string;
  end_date?: string;
  area_id?: string;
  floor_id?: string;
  kiosk_id?: string;
}

type Level = "low" | "moderate" | "high" | null;
type NotCollected = Record<string, string>;

export interface SearchAnalytics {
  totals: { total: number; successful: number; failed: number; success_rate: number | null };
  trend: { date: string; successful: number; failed: number; success_rate: number | null }[];
  failed_queries: { query: string; failures: number; last_occurrence: string }[];
  latency_ms: { average: number | null; p95: number | null };
}

export interface NavigationAnalytics {
  top_destinations: { rank: number; node_id: number; name: string; room_code: string | null; requests: number }[];
  queues: {
    navigation_requests: number;
    queue_usage: number;
    average_queue_size: number | null;
    single_destination_percent: number | null;
    multi_destination_percent: number | null;
    route_generation_success_percent: number | null;
    common_sequences: { sequence: string[]; count: number }[];
  };
  routes: {
    average_length_m: { all: number | null; single_destination: number | null; multi_destination: number | null };
    most_common: { origin: string; destination: string; count: number }[];
    average_turns: number | null;
    average_floors_crossed: number | null;
    average_buildings_crossed: number | null;
  };
  not_collected: NotCollected;
}

export interface KioskAnalytics {
  sessions: { total: number; average_seconds: number | null };
  usage_by_hour: { hour: number; sessions: number; searches: number }[];
  usage_over_time: { date: string; sessions: number; searches: number }[];
  availability: { device_id: number; name: string; availability_percent: number | null }[];
}

export interface QrAnalytics {
  totals: { generated: number; scanned: number; scan_rate: number | null };
  handoff_seconds: { average: number | null; median: number | null; longest: number | null; count: number };
  over_time: { date: string; generated: number; scanned: number; scan_rate: number | null }[];
  by_kiosk: { device_id: number; name: string; generated: number; scanned: number; scan_rate: number | null }[];
}

export interface SensorRow {
  device_id: number;
  name: string;
  location: string;
  expected: number | null;
  received: number;
  reliability_percent: number | null;
  average_density: number | null;
  peak_density: number | null;
}

export interface SensorAnalytics {
  overall: { expected: number; received: number; reliability_percent: number | null };
  sensors: SensorRow[];
}

export interface SpatialAnalytics {
  crowd_density: { average: number | null; level: Level };
  busiest_locations: {
    location: string;
    sensor: string;
    average_density: number | null;
    average_level: Level;
    peak_density: number | null;
    peak_level: Level;
    readings: number;
  }[];
  least_recommended_segments: null;
  not_collected: NotCollected;
}

export interface SystemAnalytics {
  latency_ms: {
    search_api: { average: number | null; p95: number | null };
    pathfinding: { average: number | null; p95: number | null };
    search_to_render: number | null;
  };
  api_success_rate: number | null;
  sensor_reliability: { expected: number; received: number; reliability_percent: number | null };
  not_collected: NotCollected;
}

export interface AnalyticsSections {
  search: SearchAnalytics;
  navigation: NavigationAnalytics;
  kiosks: KioskAnalytics;
  qr: QrAnalytics;
  sensors: SensorAnalytics;
  spatial: SpatialAnalytics;
  system: SystemAnalytics;
}

/** Which filters each endpoint accepts (OpenAPI parameters). */
const ACCEPTS: Record<keyof AnalyticsSections, (keyof AnalyticsFilters)[]> = {
  search: [],
  navigation: ["area_id", "floor_id"],
  kiosks: ["kiosk_id"],
  qr: [],
  sensors: ["area_id", "floor_id"],
  spatial: ["area_id", "floor_id"],
  system: [],
};

export function analyticsQuery(section: keyof AnalyticsSections, filters: AnalyticsFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.range === "semester" && filters.semester_id) params.set("semester_id", filters.semester_id);
  if (filters.range === "custom") {
    if (filters.start_date) params.set("start_date", filters.start_date);
    if (filters.end_date) params.set("end_date", filters.end_date);
  }
  for (const key of ACCEPTS[section]) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return `/analytics/${section}?${params.toString()}`;
}

/** Filters that can't be sent yet (a semester or custom range still being chosen). */
export function filtersReady(filters: AnalyticsFilters) {
  if (filters.range === "semester") return Boolean(filters.semester_id);
  if (filters.range === "custom") return Boolean(filters.start_date && filters.end_date && filters.start_date <= filters.end_date);
  return true;
}

export function useAnalytics<K extends keyof AnalyticsSections>(section: K, filters: AnalyticsFilters) {
  const live = isApiConfigured();
  const path = analyticsQuery(section, filters);
  const query = useQuery({
    queryKey: ["analytics", path],
    queryFn: () => apiClient.get<AnalyticsSections[K]>(path),
    enabled: live && filtersReady(filters),
    // Refetch keeps the frame: charts hold their previous render while new data loads.
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  if (!live) return { ...query, data: demoAnalytics[section] as AnalyticsSections[K], isLoading: false, isError: false, isDemo: true };
  return { ...query, isDemo: false };
}
