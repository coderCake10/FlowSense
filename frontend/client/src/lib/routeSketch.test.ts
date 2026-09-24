import { describe, expect, it } from "vitest";
import type { Point3 } from "@/data/navigation";
import { projectRoute } from "./routeSketch";

const frame = { width: 100, height: 100, padding: 10 };

describe("projectRoute", () => {
  it("maps +X to screen right and +Z to screen down (top-down, not mirrored)", () => {
    const pts: Point3[] = [
      [0, 5, 0],
      [10, 5, 0],
      [10, 5, 10],
    ];
    expect(projectRoute(pts, pts, frame)).toEqual([
      [10, 10],
      [90, 10],
      [90, 90],
    ]);
  });

  it("uses a uniform scale and centres the shorter axis", () => {
    const pts: Point3[] = [
      [0, 0, 0],
      [40, 0, 10],
    ];
    const [a, b] = projectRoute(pts, pts, frame);
    // 80px across 40 units → 2px/unit; 10 units of Z → 20px, centred vertically.
    expect(a).toEqual([10, 40]);
    expect(b).toEqual([90, 60]);
  });

  it("frames a single route against the whole building", () => {
    const building: Point3[] = [
      [0, 0, 0],
      [100, 0, 100],
    ];
    const route: Point3[] = [
      [0, 0, 0],
      [50, 0, 0],
    ];
    expect(projectRoute(route, building, frame)).toEqual([
      [10, 10],
      [50, 10],
    ]);
  });

  it("survives a degenerate (single-point) frame", () => {
    const pt: Point3[] = [[3, 0, 3]];
    expect(projectRoute(pt, pt, frame)[0].every(Number.isFinite)).toBe(true);
  });
});
