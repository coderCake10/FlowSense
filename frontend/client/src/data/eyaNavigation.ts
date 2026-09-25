/** Temporary demo routes in exported GLB scene coordinates (Y up).
 * EYA.glb is the whole building; the kiosk stands on the first floor.
 * Floor surface is y=0.927. Points follow the supplied corridor sketch;
 * endpoint offsets stop on the corridor side of each named door.
 * Keep this asset and its coordinates together when replacing the model.
 */
import type { BuildingConfig, Destination, Point3 } from "./navigation";
import { MODEL_FILES, modelUrl } from "./models";
export const MODEL_URL = modelUrl(MODEL_FILES.eya);
// Lobby center, inside the entrance.
export const START: Point3 = [0, 1.02, 28.5];
export const destinations: Destination[] = [
  {
    id: "guidance",
    name: "Guidance and Counseling Center Extension Office",
    code: "EA-101A",
    door: "DOOR_.001",
    color: "#2563EB",
    points: [
      START,
      [-4.6, 1.02, 28.5],
      [-4.6, 1.02, 31.75],
      [-5.65, 1.02, 31.75],
    ],
  },
  {
    id: "dean",
    name: "Office of the Dean (College of Computer Studies)",
    code: "EA-110",
    door: "DOOR_.009",
    color: "#2563EB",
    points: [
      START,
      [4.5, 1.02, 28.5],
      [4.5, 1.02, -11.85],
      [5.65, 1.02, -11.85],
    ],
  },
  {
    id: "faculty",
    name: "Faculty Center (College of Computer Studies)",
    code: "EA-111",
    door: "DOOR_.007",
    color: "#2563EB",
    points: [START, [4.5, 1.02, 28.5], [4.5, 1.02, 1.98], [5.65, 1.02, 1.98]],
  },
].map(d => ({
  ...d,
  points: d.points as Point3[],
  building: "EYA Building",
  floor: "First floor",
}));
export const eyaBuilding: BuildingConfig = {
  id: "eya-floor-1",
  name: "EYA Building",
  areaCode: "EYA",
  floor: "First floor",
  modelUrl: MODEL_URL,
  start: START,
  startLabel: "Kiosk",
  model: {
    exterior: ["EXTERIOR", "ROOF"],
    // Walking-surface heights measured from EYA.glb (floor slab tops).
    floors: [
      { object: "FLOOR_1", label: "1F", name: "First floor", elevation: 0.93 },
      { object: "FLOOR_2", label: "2F", name: "Second floor", elevation: 4.42 },
      { object: "FLOOR_3", label: "3F", name: "Third floor", elevation: 8.0 },
      {
        object: "FLOOR_4",
        label: "4F",
        name: "Fourth floor",
        elevation: 11.52,
      },
      { object: "FLOOR_5", label: "5F", name: "Fifth floor", elevation: 15.08 },
      { object: "FLOOR_6", label: "6F", name: "Sixth floor", elevation: 18.53 },
    ],
    // All room signs are in one group; each sign follows the floor it hangs on.
    byHeight: ["SIGNS 1-6"],
  },
  kioskFloor: "FLOOR_1",
  camera: {
    // Isometric-style view from the front-right, about 45 degrees down.
    position: [40, 48, 28],
    target: [0, 0, 0],
    near: 0.1,
    far: 500,
  },
  destinations,
};
