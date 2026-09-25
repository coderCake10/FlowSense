/* Rules for the kiosk's 3D building map, kept free of three.js so they can be
 * unit tested: which parts of the model a view shows, which floor an object
 * belongs to, and where the route's moving arrows sit. */
import type {
  BuildingConfig,
  Destination,
  ModelFloor,
  Point3,
  RouteLeg,
} from "@/data/navigation";

/** The whole building from outside, or one floor with the ones above it
 * lifted away. */
export type MapView = { mode: "building" } | { mode: "floor"; floor: string };

export const BUILDING_VIEW: MapView = { mode: "building" };

/** Keep map labels below app overlays (dialogs, keyboard use z-50). drei's
 * default range (~16.7M) would paint map labels on top of every modal. */
export const LABEL_Z_RANGE: [number, number] = [10, 0];

/** Parts of the model that show or hide together. */
export const EXTERIOR_PART = "exterior";

/** Which parts a view shows: the building view shows everything; a floor
 * view hides the exterior and every floor above the chosen one. */
export function visibleParts(
  model: BuildingConfig["model"],
  view: MapView
): Record<string, boolean> {
  const chosen =
    view.mode === "floor"
      ? model.floors.findIndex(f => f.object === view.floor)
      : model.floors.length - 1;
  const parts: Record<string, boolean> = {
    [EXTERIOR_PART]: view.mode === "building",
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

/** The part of the route to draw in `view`: the leg on the floor shown.
 * Nothing in the building view, where a route would float over walls. */
export function routeLegInView(
  building: BuildingConfig,
  view: MapView,
  destination: Destination | null
): RouteLeg | null {
  if (!destination || view.mode !== "floor") return null;
  return (
    destinationLegs(building, destination).find(
      leg => leg.floor === view.floor && leg.points.length >= 2
    ) ?? null
  );
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
 * new floor (the climb itself isn't drawn: it would cut through the floors). */
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
  return legs;
}
