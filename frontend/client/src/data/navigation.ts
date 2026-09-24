/** Coordinates use the exported GLB world space (Y up). */
export type Point3 = [number, number, number];

export interface Destination {
  id: string;
  name: string;
  code: string;
  door?: string;
  color: string;
  points: Point3[];
  building: string;
  floor: string;
}

/** One selectable building/floor map. IDs must be unique in the registry. */
export interface BuildingConfig {
  id: string;
  name: string;
  floor: string;
  modelUrl: string;
  start: Point3;
  startLabel: string;
  /** Optional model object to move to start (preserving its standing height). */
  kioskObject?: string;
  camera: {
    position: Point3;
    target: Point3;
    /** Visible world-space width/height used to fit the orthographic view. */
    fitWidth: number;
    fitHeight: number;
    near: number;
    far: number;
    minZoom: number;
    maxZoom: number;
    maxPolarAngle: number;
  };
  destinations: Destination[];
}
