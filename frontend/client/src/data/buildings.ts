import type { BuildingConfig } from "./navigation";
import { aBuilding } from "./aNavigation";
import { eyaBuilding } from "./eyaNavigation";

// Register each new building/floor configuration here to show it in the kiosk.
// The first is the kiosk's own building: routes start there, and its campus
// view shows the others at their placement.
export const buildings: [BuildingConfig, ...BuildingConfig[]] = [
  eyaBuilding,
  aBuilding,
];
