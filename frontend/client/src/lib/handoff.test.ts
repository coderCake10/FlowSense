import { describe, expect, it } from "vitest";
import type { BuildingConfig, Destination } from "@/data/navigation";
import {
  HANDOFF_TTL_SECONDS,
  createHandoff,
  currentStopIndex,
  decodeHandoff,
  encodeHandoff,
  handoffUrl,
  newSessionId,
  resolveHandoff,
} from "./handoff";

const stop = (id: string): Destination => ({
  id,
  name: `Room ${id}`,
  code: id.toUpperCase(),
  color: "#2563EB",
  points: [
    [0, 0, 0],
    [1, 0, 1],
  ],
  building: "EYA Building",
  floor: "First floor",
});
const building: BuildingConfig = {
  id: "eya-floor-1",
  name: "EYA Building",
  areaCode: "EYA",
  floor: "First floor",
  modelUrl: "/models/x.glb",
  start: [0, 0, 0],
  startLabel: "Kiosk",
  model: {
    exterior: [],
    floors: [
      { object: "FLOOR_1", label: "1F", name: "First floor", elevation: 0 },
    ],
  },
  kioskFloor: "FLOOR_1",
  camera: { position: [1, 1, 1], target: [0, 0, 0], near: 0.1, far: 10 },
  destinations: [stop("a"), stop("b"), stop("c")],
};
const NOW = Date.UTC(2026, 8, 24, 3, 0, 0);
const payload = createHandoff(
  building,
  [building.destinations[2], building.destinations[0]],
  NOW,
  "s1"
);
const token = encodeHandoff(payload);

describe("createHandoff", () => {
  it("captures building, queue order, and a 15-minute expiry", () => {
    expect(payload).toEqual({
      v: 1,
      s: "s1",
      b: "eya-floor-1",
      d: ["c", "a"],
      iat: NOW / 1000,
      exp: NOW / 1000 + 900,
    });
    expect(HANDOFF_TTL_SECONDS).toBe(900);
  });
});

describe("encode/decode", () => {
  it("round-trips and is URL-safe", () => {
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeHandoff(token)).toEqual(payload);
  });

  it.each([
    ["garbage", "not-base64!!"],
    ["non-JSON", btoa("hello")],
    ["wrong version", encodeHandoff({ ...payload, v: 2 as 1 })],
    ["empty queue", encodeHandoff({ ...payload, d: [] })],
    ["expiry before issue", encodeHandoff({ ...payload, exp: payload.iat })],
    ["missing session", encodeHandoff({ ...payload, s: "" })],
  ])("rejects %s", (_label, bad) => {
    expect(decodeHandoff(bad)).toBeNull();
  });
});

describe("handoffUrl", () => {
  it("builds /mobile?h=… on the given origin", () => {
    const url = new URL(handoffUrl(payload, "http://192.168.1.20:3000"));
    expect(url.origin).toBe("http://192.168.1.20:3000");
    expect(url.pathname).toBe("/mobile");
    expect(decodeHandoff(url.searchParams.get("h")!)).toEqual(payload);
  });
});

describe("resolveHandoff", () => {
  const registry = [building];

  it("resolves destinations in queue order", () => {
    const result = resolveHandoff(token, registry, NOW + 60_000);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.session.destinations.map(d => d.id)).toEqual(["c", "a"]);
    expect(result.session.expiresAt.getTime()).toBe(NOW + 900_000);
  });

  it("reports a missing token", () => {
    expect(resolveHandoff(null, registry, NOW).status).toBe("missing");
  });

  it("rejects unknown buildings and destinations (stale or tampered links)", () => {
    expect(
      resolveHandoff(encodeHandoff({ ...payload, b: "gone" }), registry, NOW)
        .status
    ).toBe("invalid");
    expect(
      resolveHandoff(
        encodeHandoff({ ...payload, d: ["a", "zz"] }),
        registry,
        NOW
      ).status
    ).toBe("invalid");
  });

  it("carries labels for live-directory rooms the registry doesn't know", () => {
    const room = {
      ...stop("x"),
      id: "room-42",
      code: "EA-305",
      name: "Room EA-305",
      floor: "Third floor",
    };
    const live = createHandoff(
      building,
      [room, building.destinations[0]],
      NOW,
      "s2"
    );
    expect(live.r).toEqual({
      "room-42": ["EA-305", "Room EA-305", "Third floor"],
    });
    const result = resolveHandoff(encodeHandoff(live), registry, NOW);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.session.destinations[0]).toMatchObject({
      id: "room-42",
      code: "EA-305",
      name: "Room EA-305",
      floor: "Third floor",
    });
    expect(result.session.destinations[1].id).toBe("a");
  });

  it("rejects malformed room labels", () => {
    const bad = { ...payload, d: ["room-1"], r: { "room-1": ["EA-1"] } };
    expect(decodeHandoff(encodeHandoff(bad as never))).toBeNull();
  });

  it("expires at exp, unless this phone already started the session", () => {
    const at = NOW + 900_000;
    expect(resolveHandoff(token, registry, at - 1).status).toBe("ok");
    expect(resolveHandoff(token, registry, at).status).toBe("expired");
    expect(resolveHandoff(token, registry, at, id => id === "s1").status).toBe(
      "ok"
    );
  });
});

describe("currentStopIndex", () => {
  const list = building.destinations;
  it("finds the first unreached stop, or -1 when done", () => {
    expect(currentStopIndex(list, [])).toBe(0);
    expect(currentStopIndex(list, ["a"])).toBe(1);
    expect(currentStopIndex(list, ["a", "c"])).toBe(1);
    expect(currentStopIndex(list, ["a", "b", "c"])).toBe(-1);
  });
});

describe("newSessionId", () => {
  it("is 16 hex chars and varies", () => {
    const a = newSessionId();
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(newSessionId()).not.toBe(a);
  });
});
