/** Temporary demo routes in exported GLB scene coordinates (Y up).
 * Floor surface is y=0.927. Points follow the supplied corridor sketch;
 * endpoint offsets stop on the corridor side of each named door.
 * Keep this asset and its coordinates together when replacing the model.
 */
import type { BuildingConfig, Destination, Point3 } from "./navigation";
import { MODEL_FILES, modelUrl } from "./models";
export const MODEL_URL = modelUrl(MODEL_FILES.eyaFloor1);
// Lobby center, inside the entrance.
export const START: Point3 = [0, 1.02, 28.5];
export const START_OBJECT = "GEO-foot.005_male_primitive_realistic.L";
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
      [5.15, 1.02, 28.5],
      [5.15, 1.02, -11.85],
      [5.65, 1.02, -11.85],
    ],
  },
  {
    id: "faculty",
    name: "Faculty Center (College of Computer Studies)",
    code: "EA-111",
    door: "DOOR_.007",
    color: "#2563EB",
    points: [START, [5.15, 1.02, 28.5], [5.15, 1.02, 1.98], [5.65, 1.02, 1.98]],
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
  floor: "First floor",
  modelUrl: MODEL_URL,
  start: START,
  startLabel: "Kiosk",
  kioskObject: START_OBJECT,
  camera: {
    position: [55, 75, 30],
    target: [-3, 0, 5],
    fitWidth: 85,
    fitHeight: 55,
    near: 0.1,
    far: 400,
    minZoom: 5,
    maxZoom: 45,
    maxPolarAngle: Math.PI / 2.15,
  },
  destinations,
};
