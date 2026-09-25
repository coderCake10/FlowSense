/* Offline demo data for the Analytics page (used only when VITE_API_BASE_URL is unset). */
import type { AnalyticsSections } from "./analyticsApi";

const days = Array.from({ length: 7 }, (_, i) =>
  new Date(Date.now() - (6 - i) * 86_400_000).toISOString().slice(0, 10)
);
const notCollected = {
  search_to_render: "The kiosk doesn't report how long results take to appear yet.",
  api_success_rate: "API requests aren't logged; the database schema has no table for them.",
  route_turns: "Routes aren't stored with their path yet; this comes with navigation on the annotated 3D models.",
  floors_crossed: "Routes aren't stored with their path yet; this comes with navigation on the annotated 3D models.",
  buildings_crossed: "Routes aren't stored with their path yet; this comes with navigation on the annotated 3D models.",
  least_recommended_segments: "Route segments aren't stored yet; this comes with navigation on the annotated 3D models.",
};
const successful = [182, 205, 194, 217, 223, 198, 210];
const failed = [6, 9, 4, 12, 5, 7, 8];
const generated = [82, 91, 103, 97, 109, 88, 95];
const scanned = [67, 74, 84, 80, 91, 70, 79];

export const demoAnalytics: AnalyticsSections = {
  search: {
    totals: { total: 1480, successful: 1429, failed: 51, success_rate: 96.6 },
    trend: days.map((date, i) => ({
      date,
      successful: successful[i],
      failed: failed[i],
      success_rate: Math.round((successful[i] * 1000) / (successful[i] + failed[i])) / 10,
    })),
    failed_queries: [
      { query: "enrollment", failures: 18, last_occurrence: new Date().toISOString() },
      { query: "registrar's office", failures: 11, last_occurrence: new Date().toISOString() },
      { query: "dean's office", failures: 7, last_occurrence: new Date(Date.now() - 86_400_000).toISOString() },
    ],
    latency_ms: { average: 84, p95: 142 },
  },
  navigation: {
    top_destinations: [
      { rank: 1, node_id: 1, name: "Registrar's Office", room_code: "EA-104", requests: 183 },
      { rank: 2, node_id: 2, name: "Accounting Office", room_code: "EA-105", requests: 118 },
      { rank: 3, node_id: 3, name: "Guidance and Counseling Center", room_code: "EA-110", requests: 94 },
    ],
    queues: {
      navigation_requests: 1284,
      queue_usage: 482,
      average_queue_size: 2.8,
      single_destination_percent: 62.4,
      multi_destination_percent: 37.6,
      route_generation_success_percent: 98.7,
      common_sequences: [
        { sequence: ["Registrar's Office", "Accounting Office"], count: 64 },
        { sequence: ["Guidance and Counseling Center", "Clinic"], count: 21 },
      ],
    },
    routes: {
      average_length_m: { all: 215, single_destination: 184, multi_destination: 427 },
      most_common: [{ origin: "EYA Lobby Kiosk", destination: "Registrar's Office", count: 92 }],
      average_turns: null,
      average_floors_crossed: null,
      average_buildings_crossed: null,
    },
    not_collected: notCollected,
  },
  kiosks: {
    sessions: { total: 1312, average_seconds: 258 },
    usage_by_hour: Array.from({ length: 24 }, (_, hour) => {
      const peak = [0, 0, 0, 0, 0, 0, 0, 12, 43, 87, 124, 103, 52, 79, 118, 96, 61, 22, 5, 0, 0, 0, 0, 0][hour];
      return { hour, sessions: peak, searches: Math.round(peak * 1.3) };
    }),
    usage_over_time: days.map((date, i) => ({ date, sessions: [183, 214, 198, 231, 228, 120, 138][i], searches: successful[i] + failed[i] })),
    availability: [
      { device_id: 2, name: "Main Entrance Kiosk", availability_percent: 99.7 },
      { device_id: 3, name: "EYA Kiosk-1", availability_percent: 98.9 },
    ],
  },
  qr: {
    totals: { generated: 665, scanned: 545, scan_rate: 82.0 },
    handoff_seconds: { average: 7.4, median: 6.2, longest: 31.8, count: 545 },
    over_time: days.map((date, i) => ({
      date,
      generated: generated[i],
      scanned: scanned[i],
      scan_rate: Math.round((scanned[i] * 1000) / generated[i]) / 10,
    })),
    by_kiosk: [
      { device_id: 2, name: "Main Entrance Kiosk", generated: 402, scanned: 334, scan_rate: 83.1 },
      { device_id: 3, name: "EYA Kiosk-1", generated: 263, scanned: 211, scan_rate: 80.2 },
    ],
  },
  sensors: {
    overall: { expected: 60_000, received: 59_000, reliability_percent: 98.3 },
    sensors: [
      { device_id: 4, name: "Sensor-2", location: "EYA Building · 2F", expected: 20_160, received: 19_950, reliability_percent: 99.0, average_density: 0.41, peak_density: 0.72 },
      { device_id: 5, name: "Sensor-3", location: "EYA Building · 3F", expected: 20_160, received: 19_020, reliability_percent: 94.3, average_density: 0.22, peak_density: 0.51 },
    ],
  },
  spatial: {
    crowd_density: { average: 0.41, level: "moderate" },
    busiest_locations: [
      { location: "EYA Building · 1F", sensor: "Main Entrance", average_density: 0.72, average_level: "high", peak_density: 0.94, peak_level: "high", readings: 20_000 },
      { location: "EYA Building · 2F", sensor: "Sensor-2", average_density: 0.41, average_level: "moderate", peak_density: 0.72, peak_level: "high", readings: 19_950 },
      { location: "EYA Building · 3F", sensor: "Sensor-3", average_density: 0.22, average_level: "low", peak_density: 0.51, peak_level: "moderate", readings: 19_020 },
    ],
    least_recommended_segments: null,
    not_collected: notCollected,
  },
  system: {
    latency_ms: { search_api: { average: 84, p95: 142 }, pathfinding: { average: 112, p95: 190 }, search_to_render: null },
    api_success_rate: null,
    sensor_reliability: { expected: 60_000, received: 59_000, reliability_percent: 98.3 },
    not_collected: notCollected,
  },
};
