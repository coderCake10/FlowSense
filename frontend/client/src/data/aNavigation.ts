/** The A Building, across MacArthur Highway from the kiosk's EYA Building.
 * A.glb is its whole model (exported from the team's A BUILDING4.blend; see
 * docs/setup/building-models.md). There is no kiosk inside: its routes start
 * at the EYA kiosk and come over the overpass to its front entrance. */
import type { BuildingConfig, BuildingPlacement } from "./navigation";
import { MODEL_FILES, modelUrl } from "./models";

/** Where the A Building stands in the campus (the EYA model's coordinates):
 * turned `rotationY` about the vertical axis, then moved to `position`.
 * Navigation points are stored in campus coordinates. Keep in step with
 * backend map/seed_data/a_building.py PLACEMENT. */
export const A_PLACEMENT: BuildingPlacement = {
  position: [-189.35, 3.2, 133.44],
  rotationY: 1.5708,
};

export const aBuilding: BuildingConfig = {
  id: "a-building",
  name: "A Building",
  areaCode: "A",
  floor: "First floor",
  modelUrl: modelUrl(MODEL_FILES.aBuilding),
  // Inside the front gate, where the walk from the EYA Building arrives.
  start: [59.8, 0.1, 1.5],
  startLabel: "Front entrance",
  placement: A_PLACEMENT,
  model: {
    exterior: ["ROOF"],
    // Walking-surface heights measured from the model (slab tops).
    floors: [
      { object: "FLOOR_1", label: "1F", name: "First floor", elevation: 0 },
      { object: "FLOOR_2", label: "2F", name: "Second floor", elevation: 3.6 },
      { object: "FLOOR_3", label: "3F", name: "Third floor", elevation: 7 },
      {
        object: "FLOOR_4",
        label: "4F",
        name: "Fourth floor",
        elevation: 10.05,
      },
    ],
    // The room signs: all floors' in one group each.
    byHeight: ["SIGNS", "SIGNS 1_4"],
  },
  kioskFloor: "FLOOR_1",
  camera: {
    position: [40, 48, 28],
    target: [0, 0, 0],
    near: 0.1,
    far: 800,
  },
  destinations: [],
};
