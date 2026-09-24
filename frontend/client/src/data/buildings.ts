import type { BuildingConfig } from "./navigation";
import { eyaBuilding } from "./eyaNavigation";
import { aBuilding } from "./aBuildingNavigation";

// Register each new building/floor configuration here to show it in the kiosk.
export const buildings: [BuildingConfig, ...BuildingConfig[]] = [eyaBuilding, aBuilding];
