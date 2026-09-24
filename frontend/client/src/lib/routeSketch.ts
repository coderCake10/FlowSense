/* Top-down 2D projection of kiosk route points for the phone checklist.
 * GLB space is Y-up; viewed from above, +X maps to screen right and +Z to
 * screen down, which keeps the sketch un-mirrored relative to the model. */
import type { Point3 } from "@/data/navigation";

export interface SketchFrame {
  width: number;
  height: number;
  padding: number;
}

/**
 * Projects `points` into a width×height box. `framePoints` (e.g. every route
 * in the building) fixes the scale so sketches for different stops share one
 * frame. Scale is uniform, so corridor proportions are preserved.
 */
export function projectRoute(
  points: readonly Point3[],
  framePoints: readonly Point3[],
  { width, height, padding }: SketchFrame
): [number, number][] {
  const all = framePoints.length ? framePoints : points;
  const xs = all.map(p => p[0]);
  const zs = all.map(p => p[2]);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const spanX = Math.max(...xs) - minX || 1;
  const spanZ = Math.max(...zs) - minZ || 1;
  const scale = Math.min(
    (width - padding * 2) / spanX,
    (height - padding * 2) / spanZ
  );
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanZ * scale) / 2;
  return points.map(([x, , z]) => [
    Number((offsetX + (x - minX) * scale).toFixed(2)),
    Number((offsetY + (z - minZ) * scale).toFixed(2)),
  ]);
}
