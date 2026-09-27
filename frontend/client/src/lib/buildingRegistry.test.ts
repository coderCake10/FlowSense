/* The building registry (step 14): bundled buildings updated by the API,
 * and buildings added from the admin panel. */
import { describe, expect, it } from "vitest";
import { buildings } from "@/data/buildings";
import { mergeRegistry, type RegistryData } from "./buildingRegistry";

const floor = (id: number, order: number, extra = {}) => ({
  id,
  floor_order: order,
  glb_node_name: `FLOOR_${order}`,
  elevation: String(order * 3.5 - 3.5),
  display_name: null,
  short_name: null,
  ...extra,
});

const data: RegistryData = {
  areas: [
    {
      id: 1,
      code: "EYA",
      name: "EYA Building",
      area_type: "building",
      model: null,
      placement: null,
      map_settings: null,
    },
    {
      id: 2,
      code: "A",
      name: "A Building",
      area_type: "building",
      model: null,
      placement: { position: [-180, 3.2, 140], rotation_y: 1.6 },
      map_settings: null,
    },
    {
      id: 3,
      code: "B",
      name: "B Building",
      area_type: "building",
      model: { url: "/api/v1/assets/9/versions/12/download" },
      placement: { position: [-40, 1, -60], rotation_y: 0 },
      map_settings: {
        exterior: ["SHELL"],
        start: [1, 0, 2],
        start_label: "Main door",
      },
    },
    {
      id: 4,
      code: "C",
      name: "C Building",
      area_type: "building",
      model: null,
      placement: null,
      map_settings: null,
    },
  ],
  floors: {
    2: [floor(21, 1, { display_name: "Ground floor", short_name: "G" })],
    3: [floor(31, 2), floor(32, 1)],
    4: [floor(41, 1)],
  },
  labels: [{ id: 1, name: "Chapel", geometry: { coordinates: [-30, 50, 2] } }],
};

describe("mergeRegistry", () => {
  const list = mergeRegistry(buildings, data);

  it("keeps the bundled buildings without the API", () => {
    expect(mergeRegistry(buildings, undefined).map(b => b.id)).toEqual(
      buildings.map(b => b.id)
    );
  });

  it("takes placements and floor names from the API", () => {
    const a = list.find(b => b.areaCode === "A")!;
    expect(a.placement).toEqual({ position: [-180, 3.2, 140], rotationY: 1.6 });
    expect(a.model.floors[0]).toMatchObject({
      label: "G",
      name: "Ground floor",
      elevation: 0,
    });
    expect(a.model.floors[1].label).toBe("2F");
  });

  it("adds a building from the admin panel once its model is live", () => {
    const b = list.find(item => item.areaCode === "B")!;
    expect(b).toMatchObject({
      id: "area-b",
      name: "B Building",
      modelUrl: "/api/v1/assets/9/versions/12/download",
      start: [1, 0, 2],
      startLabel: "Main door",
      kioskFloor: "FLOOR_1",
    });
    expect(b.model.exterior).toEqual(["SHELL"]);
    expect(b.model.floors.map(f => [f.object, f.label, f.name])).toEqual([
      ["FLOOR_1", "1F", "First floor"],
      ["FLOOR_2", "2F", "Second floor"],
    ]);
    // No live model yet: not shown.
    expect(list.some(item => item.areaCode === "C")).toBe(false);
  });

  it("shows every placed building and the API's labels in the campus view", () => {
    const campus = list[0].campus!;
    expect(campus.neighbours.map(n => [n.areaCode, n.position])).toEqual([
      ["A", [-180, 3.2, 140]],
      ["B", [-40, 1, -60]],
    ]);
    // Moved: its name goes above its new place.
    expect(campus.neighbours[0].labelAt).toEqual([-180, 21.2, 140]);
    expect(campus.landmarks).toEqual([{ name: "Chapel", at: [-30, 2, -50] }]);
  });
});
