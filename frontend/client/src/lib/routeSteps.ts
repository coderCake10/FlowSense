/* Walking directions for the phone checklist, worked out from a route's
 * shape: straight runs, left/right turns, floor changes, and the arrival.
 * Routes carry geometry only (no per-corner instructions), so turns come
 * from the angle between runs, seen from above. */
import type { BuildingConfig, Destination, Point3 } from "@/data/navigation";
import { destinationLegs } from "./mapView";

export type StepKind = "start" | "left" | "right" | "floor" | "arrive";

export interface RouteStep {
  kind: StepKind;
  title: string;
  detail: string;
  /** Metres walked in this step (0 for arrival). */
  metres: number;
}

/** Runs shorter than this are folded into the next one (m). */
const MIN_RUN = 1.5;
/** Direction changes smaller than this count as walking straight on. */
const MIN_TURN_DEGREES = 30;

interface Run {
  dx: number;
  dz: number;
  metres: number;
}

/** Straight runs along one floor's points, gentle bends merged. */
function runsAlong(points: Point3[]): Run[] {
  const runs: Run[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dz = points[i][2] - points[i - 1][2];
    const metres = Math.hypot(dx, dz);
    if (metres < 1e-6) continue;
    const last = runs[runs.length - 1];
    if (
      last &&
      (turnDegrees(last, { dx, dz }) < MIN_TURN_DEGREES || metres < MIN_RUN)
    ) {
      last.metres += metres;
      continue;
    }
    if (last && last.metres < MIN_RUN) {
      Object.assign(last, { dx, dz, metres: last.metres + metres });
      continue;
    }
    runs.push({ dx, dz, metres });
  }
  return runs;
}

function turnDegrees(
  a: { dx: number; dz: number },
  b: { dx: number; dz: number }
) {
  const angle = Math.atan2(
    a.dx * b.dz - a.dz * b.dx,
    a.dx * b.dx + a.dz * b.dz
  );
  return Math.abs((angle * 180) / Math.PI);
}

/** Seen from above (+X right, +Z toward the bottom), a clockwise change of
 * direction is a right turn. */
function side(a: Run, b: Run): "left" | "right" {
  return a.dx * b.dz - a.dz * b.dx > 0 ? "right" : "left";
}

const walk = (metres: number) =>
  `Walk about ${Math.max(1, Math.round(metres))} m`;

export function routeSteps(
  building: BuildingConfig,
  destination: Destination
): RouteStep[] {
  const legs = destinationLegs(building, destination).filter(
    leg => leg.points.length >= 2
  );
  if (!legs.length) return [];
  const floorName = (object: string) =>
    building.model.floors.find(f => f.object === object)?.name ?? "next floor";
  const steps: RouteStep[] = [];
  legs.forEach((leg, index) => {
    const runs = runsAlong(leg.points);
    runs.forEach((run, i) => {
      if (i === 0) {
        steps.push(
          index === 0
            ? {
                kind: "start",
                title: `Start at the ${building.startLabel.toLowerCase()}`,
                detail: walk(run.metres),
                metres: run.metres,
              }
            : {
                kind: "start",
                title: `On the ${floorName(leg.floor).toLowerCase()}`,
                detail: walk(run.metres),
                metres: run.metres,
              }
        );
        return;
      }
      const turn = side(runs[i - 1], run);
      steps.push({
        kind: turn,
        title: turn === "left" ? "Turn left" : "Turn right",
        detail: walk(run.metres),
        metres: run.metres,
      });
    });
    const next = legs[index + 1];
    if (next) {
      const up = next.points[0][1] > leg.points[leg.points.length - 1][1];
      steps.push({
        kind: "floor",
        title: `Go ${up ? "up" : "down"} to the ${floorName(next.floor).toLowerCase()}`,
        detail: "Take the stairs or the elevator",
        metres: 0,
      });
    }
  });
  steps.push({
    kind: "arrive",
    title: `Arrive at ${destination.code}`,
    detail: `${destination.name} · ${destination.floor}`,
    metres: 0,
  });
  return steps;
}
