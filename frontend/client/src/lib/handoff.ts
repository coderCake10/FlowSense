/* Kiosk → phone handoff (QR). Shaped after the QR Sessions API in
 * architecture-notes-main/07 API (POST /sessions → QR → phone scans → checklist)
 * so that swapping this local transport for the backend is a transport change.
 *
 * Local transport: the QR URL carries a small encoded payload (building id,
 * ordered destination ids, issue/expiry times, session id). It references
 * public room data only, so it is encoded, not signed; the backend transport
 * (step 4) replaces it with a server session + single-use qr_token. */
import type { BuildingConfig, Destination } from "@/data/navigation";

/** Mirrors the backend's QR session lifetime (fs_sessions.services, 15 min). */
export const HANDOFF_TTL_SECONDS = 15 * 60;
export const HANDOFF_QUERY_PARAM = "h";
const PAYLOAD_VERSION = 1;

export interface HandoffPayload {
  v: typeof PAYLOAD_VERSION;
  /** Session id: keys the phone's saved progress. */
  s: string;
  /** Building/floor configuration id (see data/buildings.ts). */
  b: string;
  /** Destination ids in queue order. */
  d: string[];
  /** Issued-at and expiry, in epoch seconds. */
  iat: number;
  exp: number;
}

export interface HandoffSession {
  id: string;
  building: BuildingConfig;
  destinations: Destination[];
  expiresAt: Date;
}

export type HandoffResolution =
  | { status: "ok"; session: HandoffSession }
  | { status: "missing" | "invalid" | "expired" };

export function createHandoff(
  building: BuildingConfig,
  queue: readonly Destination[],
  issuedAtMs: number,
  sessionId: string
): HandoffPayload {
  const iat = Math.floor(issuedAtMs / 1000);
  return {
    v: PAYLOAD_VERSION,
    s: sessionId,
    b: building.id,
    d: queue.map(item => item.id),
    iat,
    exp: iat + HANDOFF_TTL_SECONDS,
  };
}

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach(byte => (binary += String.fromCharCode(byte)));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(
    Uint8Array.from(binary, char => char.charCodeAt(0))
  );
}

export function encodeHandoff(payload: HandoffPayload) {
  return toBase64Url(JSON.stringify(payload));
}

/** Returns the payload, or null when the token is malformed or unsupported. */
export function decodeHandoff(token: string): HandoffPayload | null {
  try {
    const data = JSON.parse(fromBase64Url(token)) as Partial<HandoffPayload>;
    const valid =
      data.v === PAYLOAD_VERSION &&
      typeof data.s === "string" &&
      data.s.length > 0 &&
      typeof data.b === "string" &&
      Array.isArray(data.d) &&
      data.d.length > 0 &&
      data.d.every(id => typeof id === "string") &&
      Number.isInteger(data.iat) &&
      Number.isInteger(data.exp) &&
      (data.exp as number) > (data.iat as number);
    return valid ? (data as HandoffPayload) : null;
  } catch {
    return null;
  }
}

/** The URL the kiosk encodes in its QR code. */
export function handoffUrl(payload: HandoffPayload, baseUrl: string) {
  const url = new URL("/mobile", baseUrl);
  url.searchParams.set(HANDOFF_QUERY_PARAM, encodeHandoff(payload));
  return url.toString();
}

/**
 * Resolves a scanned token against the building registry. A session the phone
 * has already started stays usable after expiry, like a backend session that
 * was scanned before its QR expired.
 */
export function resolveHandoff(
  token: string | null,
  registry: readonly BuildingConfig[],
  nowMs: number,
  alreadyStarted: (sessionId: string) => boolean = () => false
): HandoffResolution {
  if (!token) return { status: "missing" };
  const payload = decodeHandoff(token);
  if (!payload) return { status: "invalid" };
  const building = registry.find(item => item.id === payload.b);
  if (!building) return { status: "invalid" };
  const destinations = payload.d.map(id =>
    building.destinations.find(item => item.id === id)
  );
  if (destinations.some(item => !item)) return { status: "invalid" };
  if (payload.exp * 1000 <= nowMs && !alreadyStarted(payload.s))
    return { status: "expired" };
  return {
    status: "ok",
    session: {
      id: payload.s,
      building,
      destinations: destinations as Destination[],
      expiresAt: new Date(payload.exp * 1000),
    },
  };
}

/** Index of the first stop not yet reached, or -1 when all are done. */
export function currentStopIndex(
  destinations: readonly Destination[],
  reached: readonly string[]
) {
  return destinations.findIndex(item => !reached.includes(item.id));
}

/** Short random id for a handoff session (not a secret). */
export function newSessionId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Origin phones should open. A kiosk served from localhost must set
 * VITE_PUBLIC_BASE_URL (e.g. http://192.168.1.20) or phones can't reach it. */
export function publicBaseUrl() {
  return import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
}
