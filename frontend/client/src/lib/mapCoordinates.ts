/* How stored node/edge geometry maps to the 3D model's coordinates. The
 * backend stores model (x, y, z) — glTF, metres, Y up — as (x, -z, y) with
 * Z as height (backend: apps/navigation/coordinates.py). */
import type { BuildingPlacement, Point3 } from "@/data/navigation";

/** Stored [X, Y, Z] → model [x, y, z]. */
export function storedToModel([x, y, z]: number[]): Point3 {
  return [x, z ?? 0, y === 0 ? 0 : -y];
}

/** Model [x, y, z] → stored [X, Y, Z]. */
export function modelToStored([x, y, z]: Point3): [number, number, number] {
  return [x, z === 0 ? 0 : -z, y];
}

/** A point in a building's model → campus coordinates (the kiosk
 * building's model's): turned about the vertical axis, then moved, as
 * three.js places the model in the campus view. No placement: unchanged. */
export function buildingToCampus(
  placement: BuildingPlacement | undefined,
  [x, y, z]: Point3
): Point3 {
  if (!placement) return [x, y, z];
  const { position, rotationY } = placement;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return [
    round(position[0] + x * cos + z * sin),
    round(position[1] + y),
    round(position[2] - x * sin + z * cos),
  ];
}

/** Campus coordinates → a point in the building's model. */
export function campusToBuilding(
  placement: BuildingPlacement | undefined,
  [x, y, z]: Point3
): Point3 {
  if (!placement) return [x, y, z];
  const { position, rotationY } = placement;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const dx = x - position[0];
  const dz = z - position[2];
  return [
    round(dx * cos - dz * sin),
    round(y - position[1]),
    round(dx * sin + dz * cos),
  ];
}

/** Millimetres are plenty (and keep round trips exact in tests). */
const round = (value: number) => Math.round(value * 1000) / 1000;
