/* Rules for the kiosk's 3D building map, kept free of three.js so they can be
 * unit tested: which parts of the model a view shows, which floor an object
 * belongs to, and where the route's moving arrows sit. */
import {
  CAMPUS_FLOOR,
  type BuildingConfig,
  type Destination,
  type ModelFloor,
  type Point3,
  type RouteLeg,
} from "@/data/navigation";
import { campusToBuilding } from "./mapCoordinates";

/** The campus around the building, the whole building from outside, or one
 * floor with the ones above it lifted away. `building`: the id of the
 * building shown, when it isn't the one the visitor picked (a route's leg
 * in another building). */
export type MapView =
  | { mode: "campus" }
  | { mode: "building"; building?: string }
  | { mode: "floor"; floor: string; building?: string };

export const BUILDING_VIEW: MapView = { mode: "building" };
export const CAMPUS_VIEW: MapView = { mode: "campus" };

/** Keep map labels below app overlays (dialogs, keyboard use z-50). drei's
 * default range (~16.7M) would paint map labels on top of every modal. */
export const LABEL_Z_RANGE: [number, number] = [10, 0];

/** Parts of the model that show or hide together. */
export const EXTERIOR_PART = "exterior";

/** Which parts a view shows: the campus and building views show everything;
 * a floor view hides the exterior and every floor above the chosen one. */
export function visibleParts(
  model: BuildingConfig["model"],
  view: MapView
): Record<string, boolean> {
  const chosen =
    view.mode === "floor"
      ? model.floors.findIndex(f => f.object === view.floor)
      : model.floors.length - 1;
  const parts: Record<string, boolean> = {
    [EXTERIOR_PART]: view.mode !== "floor",
  };
  model.floors.forEach((floor, index) => {
    parts[floor.object] = index <= chosen;
  });
  return parts;
}

/** The floor an object at height `y` belongs to: the highest floor whose
 * walking surface is at or below it (with a little tolerance for objects that
 * sit slightly into the slab). Objects below the first floor belong to it. */
export function floorAtHeight(
  floors: ModelFloor[],
  y: number,
  tolerance = 0.3
): ModelFloor {
  let found = floors[0];
  for (const floor of floors) {
    if (floor.elevation <= y + tolerance) found = floor;
  }
  return found;
}

/** Floor object a destination is on. */
export function destinationFloor(
  building: BuildingConfig,
  destination: { modelFloor?: string }
) {
  return destination.modelFloor ?? building.kioskFloor;
}

export function floorByObject(building: BuildingConfig, object: string) {
  return building.model.floors.find(f => f.object === object);
}

export function viewLabel(building: BuildingConfig, view: MapView) {
  if (view.mode === "campus") return building.campus?.name ?? building.name;
  if (view.mode === "building") return `${building.name} · Whole building`;
  const floor = floorByObject(building, view.floor);
  return `${building.name} · ${floor?.name ?? view.floor}`;
}

export function pathLength(points: Point3[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, , az] = points[i - 1];
    const [bx, , bz] = points[i];
    total += Math.hypot(bx - ax, bz - az);
  }
  return total;
}

/** A point on the route and the direction it faces (radians around the
 * vertical axis; 0 points along +Z). */
export interface PathPose {
  position: Point3;
  heading: number;
}

/** Pose at distance `d` along the route (clamped to its ends). */
export function poseAt(points: Point3[], d: number): PathPose {
  let remaining = Math.max(0, d);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const heading = Math.atan2(b[0] - a[0], b[2] - a[2]);
    if (remaining <= length || i === points.length - 1) {
      const t = length ? Math.min(1, remaining / length) : 1;
      return {
        position: [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
          a[2] + (b[2] - a[2]) * t,
        ],
        heading,
      };
    }
    remaining -= length;
  }
  const last = points[points.length - 1];
  return { position: last, heading: 0 };
}

/** Evenly spaced arrows along the route, shifted forward by `offset` metres
 * (animating `offset` makes them flow toward the destination). Arrows stop
 * short of the end, where the arrowhead sits. */
export function arrowsAlong(
  points: Point3[],
  spacing: number,
  offset: number,
  endGap = spacing
): PathPose[] {
  const length = pathLength(points);
  const arrows: PathPose[] = [];
  const shift = ((offset % spacing) + spacing) % spacing;
  for (let d = shift; d <= length - endGap; d += spacing) {
    arrows.push(poseAt(points, d));
  }
  return arrows;
}

/** A destination's route by floor: its `legs`, or its `points` as one leg on
 * its floor (the hand-placed demo routes). Empty when there's no route. */
export function destinationLegs(
  building: BuildingConfig,
  destination: Destination
): RouteLeg[] {
  if (destination.legs) return destination.legs;
  return destination.points.length >= 2
    ? [
        {
          floor: destinationFloor(building, destination),
          points: destination.points,
        },
      ]
    : [];
}

/** The floor (or `CAMPUS_FLOOR`) a view shows; null for a whole building. */
const viewFloor = (view: MapView) =>
  view.mode === "floor"
    ? view.floor
    : view.mode === "campus"
      ? CAMPUS_FLOOR
      : null;

/** Whether `leg` is what `view` shows of `building` (the building shown). */
export function legInView(
  leg: RouteLeg,
  building: BuildingConfig,
  view: MapView
) {
  return (
    (leg.building ?? building.id) === building.id &&
    leg.floor === viewFloor(view)
  );
}

/** The part of the route to draw in `view` of `building` (the building
 * shown): the leg on the floor shown, or the walk between buildings in the
 * campus view. Nothing in the building view, where a route would float over
 * walls. */
export function routeLegInView(
  building: BuildingConfig,
  view: MapView,
  destination: Destination | null
): RouteLeg | null {
  if (!destination || view.mode === "building") return null;
  return (
    destinationLegs(building, destination).find(
      leg => legInView(leg, building, view) && leg.points.length >= 2
    ) ?? null
  );
}

/** The view that shows `leg` (`building`: the building the visitor picked). */
export function legView(leg: RouteLeg, building: BuildingConfig): MapView {
  if (leg.floor === CAMPUS_FLOOR) return CAMPUS_VIEW;
  return leg.building && leg.building !== building.id
    ? { mode: "floor", floor: leg.floor, building: leg.building }
    : { mode: "floor", floor: leg.floor };
}

/** A view as text, to compare views (`shown`: the id of the building shown). */
export function viewKey(view: MapView, shown: string) {
  return `${shown}|${view.mode === "floor" ? view.floor : view.mode}`;
}

/** The campus's host: the building whose model coordinates are the
 * campus's (the kiosk's own building). */
export function campusHost(registry: readonly BuildingConfig[]) {
  return registry.find(item => item.campus) ?? registry[0];
}

/** Where one point of a Navigation API route is (its segment's `stops`). */
export interface RouteStop {
  area_code: string;
  floor_order: number;
  name?: string;
}

/**
 * Splits a route that may run between buildings (campus coordinates, one
 * `stops` entry per point) into legs: one per building floor, and one for
 * each walk outside (`CAMPUS_FLOOR`, drawn in the campus view). Each leg's
 * points are in its building's model coordinates. Across a building's
 * door the line continues (the next leg starts where the last one ended);
 * a stair climb isn't drawn, as in `splitByFloor`.
 */
export function splitByStops(
  registry: readonly BuildingConfig[],
  points: Point3[],
  stops: RouteStop[]
): RouteLeg[] {
  const host = campusHost(registry);
  const legs: (RouteLeg & { names: string[] })[] = [];
  points.forEach((point, index) => {
    const stop = stops[index];
    const building = registry.find(item => item.areaCode === stop?.area_code);
    const id = building?.id ?? host.id;
    const floor = building
      ? (
          building.model.floors[(stop.floor_order ?? 1) - 1] ??
          building.model.floors[0]
        ).object
      : CAMPUS_FLOOR;
    const local = campusToBuilding(building?.placement, point);
    const last = legs[legs.length - 1];
    if (last && last.building === id && last.floor === floor) {
      last.points.push(local);
      last.names.push(stop?.name ?? "");
      return;
    }
    const leg = {
      building: id,
      floor,
      points: [local],
      names: [stop?.name ?? ""],
    };
    const outside = (item: RouteLeg) => item.floor === CAMPUS_FLOOR;
    if (last && (last.building !== id || outside(last) || outside(leg))) {
      leg.points.unshift(
        campusToBuilding(building?.placement, points[index - 1])
      );
    }
    legs.push(leg);
  });
  return legs
    .filter(
      (leg, index) =>
        leg.points.length > 1 || index === 0 || index === legs.length - 1
    )
    .map(({ names, ...leg }) =>
      leg.floor === CAMPUS_FLOOR && names.some(name => /overpass/i.test(name))
        ? { ...leg, via: "overpass" }
        : leg
    );
}

/** Whether a route runs through more than one building (or outside). */
export function crossesBuildings(legs: readonly RouteLeg[]) {
  return legs.some(
    leg =>
      leg.floor === CAMPUS_FLOOR ||
      (leg.building ?? "") !== (legs[0].building ?? "")
  );
}

/** What a leg is called: "Second floor", or across buildings
 * "A Building · Second floor" and the campus's name outside. */
export function legName(
  leg: RouteLeg,
  building: BuildingConfig,
  registry: readonly BuildingConfig[],
  qualified: boolean
) {
  if (leg.floor === CAMPUS_FLOOR)
    return campusHost(registry).campus?.name ?? "Outside";
  const owner = registry.find(item => item.id === leg.building) ?? building;
  const floor = owner.model.floors.find(f => f.object === leg.floor);
  const name = floor?.name ?? leg.floor;
  return qualified ? `${owner.name} · ${name}` : name;
}

/** The label at the end of a leg that doesn't end at the destination:
 * "Elevator to 3F", "Exit", "A Building front entrance". */
export function legEndLabel(
  leg: RouteLeg,
  next: RouteLeg,
  building: BuildingConfig,
  registry: readonly BuildingConfig[]
) {
  const owner = (item: RouteLeg) =>
    registry.find(b => b.id === item.building) ?? building;
  if (next.floor === CAMPUS_FLOOR) return "Exit";
  if (leg.floor === CAMPUS_FLOOR || owner(leg).id !== owner(next).id)
    return `${owner(next).name} ${owner(next).startLabel.toLowerCase()}`;
  const nextFloor = owner(next).model.floors.find(f => f.object === next.floor);
  return rideLabel(leg.via, nextFloor?.label ?? next.floor);
}

/** The view to open for a destination: where its route starts (maybe in
 * another building), or the destination's own floor with no route yet. */
export function firstViewFor(
  building: BuildingConfig,
  destination: Destination
): MapView {
  const first = destinationLegs(building, destination)[0];
  return first
    ? legView(first, building)
    : { mode: "floor", floor: destinationFloor(building, destination) };
}

/** Floor to show first for a destination: where its route starts, or the
 * destination's own floor when it has no route yet. */
export function firstFloorFor(
  building: BuildingConfig,
  destination: Destination
) {
  return (
    destinationLegs(building, destination)[0]?.floor ??
    destinationFloor(building, destination)
  );
}

/** Splits a route (model coordinates) into consecutive legs by floor, using
 * each point's height. A stair climb ends one leg and starts the next on the
 * new floor (the climb itself isn't drawn: it would cut through the floors).
 * Floors the route only passes through (one point: on the stairs or in the
 * lift) aren't legs, so the kiosk says "Go to 3F", not "Go to 2F". */
export function splitByFloor(
  floors: ModelFloor[],
  points: Point3[]
): RouteLeg[] {
  const legs: RouteLeg[] = [];
  for (const point of points) {
    const floor = floorAtHeight(floors, point[1]).object;
    const last = legs[legs.length - 1];
    if (last && last.floor === floor) {
      last.points.push(point);
    } else {
      legs.push({ floor, points: [point] });
    }
  }
  return legs.filter(
    (leg, index) =>
      leg.points.length > 1 || index === 0 || index === legs.length - 1
  );
}

export interface RouteStepInView {
  /** 1-based step and how many: one per floor the route walks on. */
  step: number;
  count: number;
  floorName: string;
  /** What to do on this floor. */
  instruction: string;
  previous?: { floor: string; name: string; view: MapView };
  next?: { floor: string; name: string; view: MapView };
}

const rideName = (via: string | undefined) =>
  via === "elevator"
    ? "the elevator"
    : via === "stairs"
      ? "the stairs"
      : via === "escalator"
        ? "the escalator"
        : "the stairs or elevator";

/** The label at the end of a leg that leaves the floor: "Elevator to 3F". */
export function rideLabel(via: string | undefined, floorLabel: string) {
  if (via === "elevator") return `Elevator to ${floorLabel}`;
  if (via === "stairs") return `Stairs to ${floorLabel}`;
  return `Go to ${floorLabel}`;
}

/** Where a multi-floor (or building-to-building) route is at in `view`
 * of `building` (the building shown): the step shown, what to do, and the
 * steps before and after. Null for one-floor routes, and outside the parts
 * of the route the view shows. `picked`: the building the visitor chose. */
export function routeStepInView(
  building: BuildingConfig,
  view: MapView,
  destination: Destination | null,
  registry: readonly BuildingConfig[] = [building],
  picked: BuildingConfig = building
): RouteStepInView | null {
  if (!destination || view.mode === "building") return null;
  const legs = destinationLegs(building, destination);
  if (legs.length < 2) return null;
  const index = legs.findIndex(leg => legInView(leg, building, view));
  if (index < 0) return null;
  const qualified = crossesBuildings(legs);
  const owner = (leg: RouteLeg) =>
    registry.find(item => item.id === leg.building) ?? building;
  const floorOf = (leg: RouteLeg) =>
    owner(leg).model.floors.find(f => f.object === leg.floor);
  const name = (leg: RouteLeg) => legName(leg, building, registry, qualified);
  const step = (leg: RouteLeg) => ({
    floor: leg.floor,
    view: legView(leg, picked),
    name: name(leg),
  });
  const leg = legs[index];
  const after = legs[index + 1];
  const before = legs[index - 1];
  let instruction = `Walk to ${destination.code}.`;
  if (after && after.floor === CAMPUS_FLOOR) {
    instruction = `Walk out of the ${owner(leg).name}.`;
  } else if (after && leg.floor === CAMPUS_FLOOR) {
    instruction =
      leg.via === "overpass"
        ? `Cross the highway on the overpass, then walk to the ${owner(after).name}.`
        : `Walk to the ${owner(after).name}.`;
  } else if (after && owner(after).id !== owner(leg).id) {
    instruction = `Walk to the ${owner(after).name}.`;
  } else if (after) {
    const up =
      (floorOf(after)?.elevation ?? 0) > (floorOf(leg)?.elevation ?? 0);
    instruction = `Walk to ${rideName(leg.via)}, then go ${up ? "up" : "down"} to the ${(
      floorOf(after)?.name ?? after.floor
    ).toLowerCase()}.`;
  }
  return {
    step: index + 1,
    count: legs.length,
    floorName: name(leg),
    instruction,
    previous: before && step(before),
    next: after && step(after),
  };
}

/** How long "Follow on this kiosk" shows a floor's part of the route (s):
 * longer walks get longer, within 5 to 12 s. */
export function legSeconds(points: Point3[]) {
  return Math.min(12, Math.max(5, 3 + pathLength(points) / 6));
}
