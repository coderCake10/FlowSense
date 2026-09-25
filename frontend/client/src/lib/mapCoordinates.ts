/* How stored node/edge geometry maps to the 3D model's coordinates. The
 * backend stores model (x, y, z) — glTF, metres, Y up — as (x, -z, y) with
 * Z as height (backend: apps/navigation/coordinates.py). */
import type { Point3 } from "@/data/navigation";

/** Stored [X, Y, Z] → model [x, y, z]. */
export function storedToModel([x, y, z]: number[]): Point3 {
  return [x, z ?? 0, y === 0 ? 0 : -y];
}

/** Model [x, y, z] → stored [X, Y, Z]. */
export function modelToStored([x, y, z]: Point3): [number, number, number] {
  return [x, z === 0 ? 0 : -z, y];
}
