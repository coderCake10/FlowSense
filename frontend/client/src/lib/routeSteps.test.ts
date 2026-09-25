import { describe, expect, it } from "vitest";
import type { BuildingConfig, Destination } from "@/data/navigation";
import { routeSteps } from "./routeSteps";

const building: BuildingConfig = {
  id: "b",
  name: "EYA Building",
  areaCode: "EYA",
  floor: "First floor",
  modelUrl: "/models/x.glb",
  start: [0, 1, 0],
  startLabel: "Kiosk",
  model: {
    exterior: [],
    floors: [
      { object: "FLOOR_1", label: "1F", name: "First floor", elevation: 0.93 },
      { object: "FLOOR_3", label: "3F", name: "Third floor", elevation: 8 },
    ],
  },
  kioskFloor: "FLOOR_1",
  camera: { position: [1, 1, 1], target: [0, 0, 0], near: 0.1, far: 10 },
  destinations: [],
};
const room = (extra: Partial<Destination>): Destination => ({
  id: "r",
  name: "Office of the Dean",
  code: "EA-110",
  color: "#2563EB",
  points: [],
  building: "EYA Building",
  floor: "First floor",
  ...extra,
});

describe("routeSteps", () => {
  it("reads turns from above: up the screen, then right, is a right turn", () => {
    const steps = routeSteps(
      building,
      room({
        points: [
          [0, 1, 0],
          [0, 1, -10],
          [5, 1, -10],
          [5, 1, -4],
        ],
      })
    );
    expect(steps.map(s => [s.kind, s.title, s.detail])).toEqual([
      ["start", "Start at the kiosk", "Walk about 10 m"],
      ["right", "Turn right", "Walk about 5 m"],
      ["right", "Turn right", "Walk about 6 m"],
      ["arrive", "Arrive at EA-110", "Office of the Dean · First floor"],
    ]);
  });

  it("walks straight through gentle bends and short jogs", () => {
    const steps = routeSteps(
      building,
      room({
        points: [
          [0, 1, 0],
          [0.5, 1, -6],
          [0.5, 1, -6.5],
          [1, 1, -12],
        ],
      })
    );
    expect(steps.map(s => s.kind)).toEqual(["start", "arrive"]);
    expect(steps[0].detail).toBe("Walk about 12 m");
  });

  it("tells a left turn from a right one", () => {
    const steps = routeSteps(
      building,
      room({
        points: [
          [0, 1, 0],
          [0, 1, -10],
          [-4, 1, -10],
        ],
      })
    );
    expect(steps[1].title).toBe("Turn left");
  });

  it("adds a floor change between legs", () => {
    const steps = routeSteps(
      building,
      room({
        code: "EA-305",
        floor: "Third floor",
        legs: [
          {
            floor: "FLOOR_1",
            points: [
              [0, 1, 0],
              [0, 1, -8],
            ],
          },
          {
            floor: "FLOOR_3",
            points: [
              [0, 8.1, -8],
              [6, 8.1, -8],
            ],
          },
        ],
      })
    );
    expect(steps.map(s => s.title)).toEqual([
      "Start at the kiosk",
      "Go up to the third floor",
      "On the third floor",
      "Arrive at EA-305",
    ]);
  });

  it("has no steps without a route", () => {
    expect(routeSteps(building, room({}))).toEqual([]);
  });
});
