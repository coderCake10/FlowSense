/* Routes between buildings (step 13): the A Building's placement in the
 * campus, splitting a Navigation API route by its stops, and the kiosk's and
 * phone's directions across buildings. */
import { describe, expect, it } from "vitest";
import { buildings } from "@/data/buildings";
import { aBuilding } from "@/data/aNavigation";
import { eyaBuilding } from "@/data/eyaNavigation";
import { CAMPUS_FLOOR, type Destination, type Point3 } from "@/data/navigation";
import { buildingToCampus, campusToBuilding } from "./mapCoordinates";
import {
  CAMPUS_VIEW,
  firstViewFor,
  legEndLabel,
  routeLegInView,
  routeStepInView,
  splitByStops,
  type RouteStop,
} from "./mapView";
import { routeSteps } from "./routeSteps";

const A = aBuilding.placement!;

describe("the A Building's placement", () => {
  it("matches the backend (seed_a_routes place())", () => {
    // Its front entrance, in the A model and in the campus.
    expect(buildingToCampus(A, [59.8, 0.1, 1.5])).toEqual([
      -187.85, 3.3, 73.64,
    ]);
  });

  it("round-trips", () => {
    const point: Point3 = [12.3, 7.1, -8.4];
    expect(campusToBuilding(A, buildingToCampus(A, point))).toEqual(point);
    expect(buildingToCampus(undefined, point)).toEqual(point);
  });
});

// Kiosk (EYA 1F) → front doors → outside (over the overpass) → A's entrance
// → the stairs → A 3F, in campus coordinates, as the API sends it.
const inA = (p: Point3) => buildingToCampus(A, p);
const points: Point3[] = [
  [0, 1.03, 28.5],
  [0, 1.03, 34],
  [0, 1.27, 39.5],
  [-81.1, 5.5, 40.5],
  [-81.4, 5.5, 73.5],
  [-187.85, 3.3, 70],
  inA([59.8, 0.1, 1.5]),
  inA([36.4, 0.1, -16.3]),
  inA([36.4, 3.7, -16.3]),
  inA([36.4, 7.1, -16.3]),
  inA([43.5, 7.1, 3.3]),
];
const stop = (
  area_code: string,
  floor_order: number,
  name = ""
): RouteStop => ({
  area_code,
  floor_order,
  name,
});
const stops = [
  stop("EYA", 1),
  stop("EYA", 1),
  stop("AUF-WALKWAYS", 1),
  stop("AUF-WALKWAYS", 1, "Overpass (north end)"),
  stop("AUF-WALKWAYS", 1, "Overpass (south end)"),
  stop("AUF-WALKWAYS", 1),
  stop("A", 1),
  stop("A", 1),
  stop("A", 2),
  stop("A", 3),
  stop("A", 3),
];

describe("splitByStops", () => {
  const legs = splitByStops(buildings, points, stops);

  it("gives a leg per building floor and one outside", () => {
    expect(legs.map(leg => [leg.building, leg.floor])).toEqual([
      ["eya-floor-1", "FLOOR_1"],
      ["eya-floor-1", CAMPUS_FLOOR],
      ["a-building", "FLOOR_1"],
      ["a-building", "FLOOR_3"],
    ]);
    expect(legs[1].via).toBe("overpass");
  });

  it("continues the line through doors, in each building's coordinates", () => {
    // Outside starts at the EYA front doors; A's first floor at the gate.
    expect(legs[1].points[0]).toEqual([0, 1.03, 34]);
    expect(legs[2].points[0]).toEqual(campusToBuilding(A, [-187.85, 3.3, 70]));
    expect(legs[2].points[1]).toEqual([59.8, 0.1, 1.5]);
    // The climb itself isn't a leg (2F is passed on the stairs).
    expect(legs[3].points[0]).toEqual([36.4, 7.1, -16.3]);
  });
});

describe("a route from the kiosk to the A Building", () => {
  const legs = splitByStops(buildings, points, stops);
  legs[2].via = "stairs";
  const destination: Destination = {
    id: "room-1",
    name: "Office of the Vice President for Research and Innovation",
    code: "A-305",
    color: "#2563EB",
    points,
    legs,
    building: "A Building",
    floor: "Third floor",
    modelFloor: "FLOOR_3",
  };

  it("opens where the route starts: the EYA first floor", () => {
    expect(firstViewFor(aBuilding, destination)).toEqual({
      mode: "floor",
      floor: "FLOOR_1",
      building: "eya-floor-1",
    });
  });

  it("draws each leg in its own building's view", () => {
    const eyaFloor = { mode: "floor" as const, floor: "FLOOR_1" };
    expect(routeLegInView(eyaBuilding, eyaFloor, destination)).toBe(legs[0]);
    expect(routeLegInView(eyaBuilding, CAMPUS_VIEW, destination)).toBe(legs[1]);
    expect(routeLegInView(aBuilding, eyaFloor, destination)).toBe(legs[2]);
  });

  it("says what to do at each step", () => {
    const at = (
      building: typeof aBuilding,
      view: Parameters<typeof routeStepInView>[1]
    ) => routeStepInView(building, view, destination, buildings, aBuilding);
    const first = at(eyaBuilding, { mode: "floor", floor: "FLOOR_1" })!;
    expect(first.instruction).toBe("Walk out of the EYA Building.");
    expect(first.floorName).toBe("EYA Building · First floor");
    expect(first.next?.view).toEqual(CAMPUS_VIEW);
    const outside = at(eyaBuilding, CAMPUS_VIEW)!;
    expect(outside.instruction).toBe(
      "Cross the highway on the overpass, then walk to the A Building."
    );
    expect(outside.floorName).toBe("AUF Campus");
    expect(outside.next?.view).toEqual({ mode: "floor", floor: "FLOOR_1" });
    const ground = at(aBuilding, { mode: "floor", floor: "FLOOR_1" })!;
    expect(ground.instruction).toBe(
      "Walk to the stairs, then go up to the third floor."
    );
    expect(ground.step).toBe(3);
    expect(
      at(aBuilding, { mode: "floor", floor: "FLOOR_3" })!.instruction
    ).toBe("Walk to A-305.");
  });

  it("labels where each leg ends", () => {
    expect(legEndLabel(legs[0], legs[1], aBuilding, buildings)).toBe("Exit");
    expect(legEndLabel(legs[1], legs[2], aBuilding, buildings)).toBe(
      "A Building front entrance"
    );
    expect(legEndLabel(legs[2], legs[3], aBuilding, buildings)).toBe(
      "Stairs to 3F"
    );
  });

  it("gives the phone directions across buildings", () => {
    const titles = routeSteps(aBuilding, destination, buildings).map(
      s => s.title
    );
    expect(titles[0]).toBe("Start at the kiosk");
    expect(titles).toContain("Leave the EYA Building");
    expect(titles).toContain(
      "Walk to the A Building, crossing the highway on the overpass"
    );
    // Outside is one step (no turn-by-turn on the rough campus map).
    const outside = titles.indexOf("Leave the EYA Building") + 1;
    expect(titles[outside + 1]).toBe("Enter the A Building");
    expect(titles).toContain("Enter the A Building");
    expect(titles).toContain("Go up to the third floor");
    expect(titles[titles.length - 1]).toBe("Arrive at A-305");
  });
});
