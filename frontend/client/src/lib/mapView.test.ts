import { describe, expect, it } from "vitest";
import type { BuildingConfig, Point3 } from "@/data/navigation";
import {
  arrowsAlong,
  destinationLegs,
  firstFloorFor,
  routeLegInView,
  splitByFloor,
  BUILDING_VIEW,
  destinationFloor,
  EXTERIOR_PART,
  floorAtHeight,
  pathLength,
  poseAt,
  viewLabel,
  visibleParts,
} from "./mapView";

const floors = [
  { object: "FLOOR_1", label: "1F", name: "First floor", elevation: 0.93 },
  { object: "FLOOR_2", label: "2F", name: "Second floor", elevation: 4.42 },
  { object: "FLOOR_3", label: "3F", name: "Third floor", elevation: 8 },
];
const building = {
  id: "b",
  name: "EYA Building",
  areaCode: "EYA",
  floor: "First floor",
  modelUrl: "/models/x.glb",
  start: [0, 0, 0],
  startLabel: "Kiosk",
  model: { exterior: ["EXTERIOR"], floors },
  kioskFloor: "FLOOR_1",
  camera: { position: [1, 1, 1], target: [0, 0, 0], near: 0.1, far: 10 },
  destinations: [],
} satisfies BuildingConfig;

describe("visibleParts", () => {
  it("shows the exterior and every floor from outside", () => {
    expect(visibleParts(building.model, BUILDING_VIEW)).toEqual({
      [EXTERIOR_PART]: true,
      FLOOR_1: true,
      FLOOR_2: true,
      FLOOR_3: true,
    });
  });
  it("lifts away the exterior and the floors above the chosen one", () => {
    expect(
      visibleParts(building.model, { mode: "floor", floor: "FLOOR_2" })
    ).toEqual({
      [EXTERIOR_PART]: false,
      FLOOR_1: true,
      FLOOR_2: true,
      FLOOR_3: false,
    });
  });
  it("first floor shows only itself", () => {
    const parts = visibleParts(building.model, {
      mode: "floor",
      floor: "FLOOR_1",
    });
    expect(parts.FLOOR_2).toBe(false);
    expect(parts.FLOOR_1).toBe(true);
  });
});

describe("floorAtHeight", () => {
  it("assigns signs to the floor they hang on", () => {
    expect(floorAtHeight(floors, 2.8).object).toBe("FLOOR_1");
    expect(floorAtHeight(floors, 6.4).object).toBe("FLOOR_2");
  });
  it("tolerates objects sunk slightly into the slab", () => {
    expect(floorAtHeight(floors, 4.2).object).toBe("FLOOR_2");
  });
  it("puts anything below the first floor on the first floor", () => {
    expect(floorAtHeight(floors, -0.5).object).toBe("FLOOR_1");
  });
});

describe("labels and floors", () => {
  it("names the view", () => {
    expect(viewLabel(building, BUILDING_VIEW)).toBe(
      "EYA Building · Whole building"
    );
    expect(viewLabel(building, { mode: "floor", floor: "FLOOR_3" })).toBe(
      "EYA Building · Third floor"
    );
  });
  it("defaults a destination to the kiosk floor", () => {
    expect(destinationFloor(building, {})).toBe("FLOOR_1");
    expect(destinationFloor(building, { modelFloor: "FLOOR_3" })).toBe(
      "FLOOR_3"
    );
  });
});

describe("route arrows", () => {
  // An L-shaped route: 4 m along +X, then 3 m along -Z.
  const route: Point3[] = [
    [0, 1, 0],
    [4, 1, 0],
    [4, 1, -3],
  ];
  it("measures the route on the floor plane", () => {
    expect(pathLength(route)).toBe(7);
  });
  it("finds positions and headings along each leg", () => {
    const first = poseAt(route, 2);
    expect(first.position).toEqual([2, 1, 0]);
    expect(first.heading).toBeCloseTo(Math.PI / 2);
    const second = poseAt(route, 5);
    expect(second.position).toEqual([4, 1, -1]);
    expect(Math.abs(second.heading)).toBeCloseTo(Math.PI);
  });
  it("clamps past either end", () => {
    expect(poseAt(route, -1).position).toEqual([0, 1, 0]);
    expect(poseAt(route, 99).position).toEqual([4, 1, -3]);
  });
  it("spaces arrows evenly and leaves room for the arrowhead", () => {
    const arrows = arrowsAlong(route, 2, 0);
    expect(arrows.map(a => a.position)).toEqual([
      [0, 1, 0],
      [2, 1, 0],
      [4, 1, 0],
    ]);
  });
  it("moves arrows forward as the offset grows, wrapping each spacing", () => {
    const moved = arrowsAlong(route, 2, 1).map(a => a.position);
    expect(moved[0]).toEqual([1, 1, 0]);
    expect(arrowsAlong(route, 2, 3)[0].position).toEqual([1, 1, 0]);
  });
});

describe("route legs", () => {
  const onFirst: Point3[] = [
    [0, 1, 0],
    [4, 1, 0],
  ];
  const demo = {
    id: "d",
    name: "Dean",
    code: "EA-110",
    color: "#2563EB",
    points: onFirst,
    building: "EYA Building",
    floor: "First floor",
  };
  it("treats hand-placed points as one leg on the destination floor", () => {
    expect(destinationLegs(building, demo)).toEqual([
      { floor: "FLOOR_1", points: onFirst },
    ]);
  });
  it("has no legs when a room has no route yet", () => {
    expect(destinationLegs(building, { ...demo, points: [] })).toEqual([]);
    expect(
      firstFloorFor(building, { ...demo, points: [], modelFloor: "FLOOR_3" })
    ).toBe("FLOOR_3");
  });
  it("draws only the leg on the floor shown", () => {
    expect(
      routeLegInView(building, { mode: "floor", floor: "FLOOR_1" }, demo)
    ).toEqual({ floor: "FLOOR_1", points: onFirst });
    expect(
      routeLegInView(building, { mode: "floor", floor: "FLOOR_2" }, demo)
    ).toBeNull();
    expect(routeLegInView(building, BUILDING_VIEW, demo)).toBeNull();
  });
  it("splits a route that climbs to another floor, without the climb", () => {
    const legs = splitByFloor(floors, [
      [0, 1, 0],
      [3, 1, 0],
      [3, 4.5, 2],
      [6, 4.5, 2],
    ]);
    expect(legs).toEqual([
      {
        floor: "FLOOR_1",
        points: [
          [0, 1, 0],
          [3, 1, 0],
        ],
      },
      {
        floor: "FLOOR_2",
        points: [
          [3, 4.5, 2],
          [6, 4.5, 2],
        ],
      },
    ]);
    expect(firstFloorFor(building, { ...demo, legs })).toBe("FLOOR_1");
  });
});
