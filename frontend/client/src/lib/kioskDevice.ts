/* The kiosk screen's link to the admin dashboard.
 *
 * - Heartbeat: POST /hardware/kiosks/heartbeat every 30 s while the kiosk or
 *   attract screen is open. The first one makes the kiosk appear on the
 *   Hardware page as Unregistered; after an admin registers it, it shows
 *   Online, and Offline if the heartbeats stop.
 * - Visitor sessions: once the kiosk is registered, the first touch on the
 *   kiosk screen starts a kiosk session (Kiosk Sessions API), interactions
 *   keep it alive, and returning to the attract screen ends it. These feed
 *   the dashboard's "Kiosk sessions" and "Average session".
 *
 * Nothing happens without VITE_API_BASE_URL (offline demo). */
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiClient, endpointMap, isApiConfigured } from "./api";

const DEVICE_ID_KEY = "flowsense.kiosk.deviceId";
const STARTED_AT_KEY = "flowsense.kiosk.startedAt";
const HEARTBEAT_MS = 30_000;
const SESSION_PING_MS = 30_000;

export interface KioskHeartbeat {
  id: number;
  device_id: string;
  name: string | null;
  status: string;
  records_sessions: boolean;
  heartbeat_interval_seconds: number;
  /** Navigation node routes start from (null until the map has one). */
  map_node_id?: number | null;
}

let memoryDeviceId: string | null = null;

function randomId() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

/** A stable ID for this kiosk, kept in the browser (kiosk-xxxxxxxxxxxx). */
export function kioskDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;
    const created = `kiosk-${randomId()}`;
    localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    memoryDeviceId ??= `kiosk-${randomId()}`;
    return memoryDeviceId;
  }
}

/** When the kiosk app started in this browser tab (survives kiosk ↔ attract navigation). */
function applicationStartedAt(): string {
  try {
    const stored = sessionStorage.getItem(STARTED_AT_KEY);
    if (stored) return stored;
    const now = new Date().toISOString();
    sessionStorage.setItem(STARTED_AT_KEY, now);
    return now;
  } catch {
    return new Date().toISOString();
  }
}

/** "iPadOS 17.5", "Android 14", "Windows", … from the user agent (≤100 chars). */
export function describeOs(userAgent: string): string {
  const ios = userAgent.match(/(?:iPad|iPhone).*?OS (\d+)[_.](\d+)/);
  if (ios)
    return `${userAgent.includes("iPad") ? "iPadOS" : "iOS"} ${ios[1]}.${ios[2]}`;
  // iPadOS 13+ reports itself as a Mac; a Mac with touch is an iPad.
  if (
    /Macintosh/.test(userAgent) &&
    typeof navigator !== "undefined" &&
    navigator.maxTouchPoints > 1
  ) {
    return "iPadOS";
  }
  const android = userAgent.match(/Android (\d+(?:\.\d+)?)/);
  if (android) return `Android ${android[1]}`;
  if (/Windows NT/.test(userAgent)) return "Windows";
  if (/Mac OS X/.test(userAgent)) return "macOS";
  if (/Linux/.test(userAgent)) return "Linux";
  return userAgent.slice(0, 100) || "Unknown";
}

function heartbeatBody() {
  const portrait =
    typeof screen !== "undefined" &&
    (screen.orientation?.type?.startsWith("portrait") ??
      screen.height > screen.width);
  return {
    device_id: kioskDeviceId(),
    display_resolution: `${screen.width}×${screen.height}`,
    orientation: portrait ? "portrait" : "landscape",
    touchscreen_connected: navigator.maxTouchPoints > 0,
    frontend_version: import.meta.env.VITE_APP_VERSION || "1.0.0",
    os_version: describeOs(navigator.userAgent),
    application_started_at: applicationStartedAt(),
  };
}

/** Sends the heartbeat now and every 30 s; returns the latest reply. */
export function useKioskHeartbeat(): KioskHeartbeat | null {
  const [latest, setLatest] = useState<KioskHeartbeat | null>(null);
  useEffect(() => {
    if (!isApiConfigured()) return;
    let cancelled = false;
    const beat = () =>
      apiClient
        .post<KioskHeartbeat>(
          `${endpointMap.hardware.kiosks}/heartbeat`,
          heartbeatBody()
        )
        .then(reply => !cancelled && setLatest(reply))
        // A missed heartbeat is harmless; the next one retries. The kiosk
        // itself must keep working without the server.
        .catch(() => undefined);
    beat();
    const timer = window.setInterval(beat, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  return latest;
}

export type SessionEndReason = "idle_timeout" | "manual_exit";

/** The visitor session in progress (one kiosk screen per page). */
let currentVisitorSession: string | null = null;

/** Id of the visitor session in progress, or null. The Search API uses it to
 * credit searches to the visit in Analytics. */
export function visitorSessionId() {
  return currentVisitorSession;
}

/**
 * Records one visitor session on the kiosk screen: started by the first
 * touch, kept alive by interactions, ended by `end(reason)`.
 */
export function useKioskVisitorSession(kiosk: KioskHeartbeat | null) {
  const sessionId = useRef<string | null>(null);
  const starting = useRef(false);
  const lastPing = useRef(0);

  useEffect(() => {
    if (!kiosk?.records_sessions) return;
    const onInteraction = () => {
      const now = Date.now();
      if (!sessionId.current && !starting.current) {
        starting.current = true;
        apiClient
          .post<{ id: string }>(endpointMap.sessions.kiosk, { kiosk: kiosk.id })
          .then(session => {
            sessionId.current = session.id;
            currentVisitorSession = session.id;
            lastPing.current = Date.now();
          })
          .catch(() => undefined)
          .finally(() => {
            starting.current = false;
          });
      } else if (
        sessionId.current &&
        now - lastPing.current > SESSION_PING_MS
      ) {
        lastPing.current = now;
        apiClient
          .post(endpointMap.sessions.kioskHeartbeat(sessionId.current))
          .catch(() => undefined);
      }
    };
    const events = ["pointerdown", "keydown"] as const;
    events.forEach(event =>
      window.addEventListener(event, onInteraction, { passive: true })
    );
    return () =>
      events.forEach(event => window.removeEventListener(event, onInteraction));
  }, [kiosk?.id, kiosk?.records_sessions]);

  /** Ends the session; safe to call right before navigating away. */
  return useCallback((reason: SessionEndReason) => {
    const id = sessionId.current;
    if (!id) return;
    sessionId.current = null;
    currentVisitorSession = null;
    // keepalive lets the request finish while the page navigates away.
    fetch(`${API_BASE_URL}${endpointMap.sessions.kioskEnd(id)}`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ end_reason: reason }),
    }).catch(() => undefined);
  }, []);
}
