import type { BuildingConfig, Destination, Point3 } from "./navigation";
import { MODEL_FILES, modelUrl } from "./models";
export const MODEL_URL = modelUrl(MODEL_FILES.aBuilding);

export const START: Point3 = [0, 0, 0];
export const destinations: Destination[] = [
  {
    id: "payroll",
    name: "Payroll and Benefits Window",
    code: "A-102",
    door: "DOORS.001",
    color: "#2563EB",
    points: [
          START,
          [-16, 0, 0],
          [-16, 0, -16],
          [-21, 0, -16],
          [-21, 0, -18],
        ],
  }
].map(d => ({
  ...d,
  points: d.points as Point3[],
  building: "A Building",
  floor: "First floor",
}));;

export const aBuilding: BuildingConfig = {
  id: 'a-building',
  name: 'A Building',
  floor: "First floor",
  modelUrl: MODEL_URL,
    start: START,
    startLabel: "Kiosk",
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
}
