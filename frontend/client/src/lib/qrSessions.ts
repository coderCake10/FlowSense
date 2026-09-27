/* The QR Sessions API for the kiosk → phone handoff (07 API: POST /sessions
 * → QR → POST /sessions/{id}/scan). The server counts each QR shown and each
 * scan for Analytics. The QR link still carries the stops itself, so the
 * handoff works when the server can't be reached; these calls only add the
 * session. `qr_token` sits beside `data` in the reply, so these use fetch
 * rather than apiClient (which returns `data` only). */
import { API_BASE_URL, endpointMap } from "@/lib/api";

export interface QrSession {
  id: string;
  token: string;
}

/** Opens a session for a route the kiosk requested (the Navigation API's
 * route id). Null when the server can't or won't. */
export async function createQrSession(
  navigationRequestId: number,
  kioskSessionId: string | null
): Promise<QrSession | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpointMap.sessions.all}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        navigation_request_id: navigationRequestId,
        ...(kioskSessionId ? { kiosk_session_id: kioskSessionId } : {}),
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      data?: { id?: string };
      qr_token?: string;
    };
    return body.data?.id && body.qr_token
      ? { id: body.data.id, token: body.qr_token }
      : null;
  } catch {
    return null;
  }
}

/** The phone opened the QR: the server records the scan. */
export async function reportScan(session: QrSession) {
  try {
    await fetch(`${API_BASE_URL}${endpointMap.sessions.scan(session.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_token: session.token }),
    });
  } catch {
    /* The checklist works without it; only the count misses a scan. */
  }
}

/** Whether a phone has scanned the session's QR yet. */
export async function wasScanned(id: string) {
  try {
    const response = await fetch(
      `${API_BASE_URL}${endpointMap.sessions.session(id)}`
    );
    if (!response.ok) return false;
    const body = (await response.json()) as { data?: { status?: string } };
    return ["scanned", "active", "completed"].includes(body.data?.status ?? "");
  } catch {
    return false;
  }
}
