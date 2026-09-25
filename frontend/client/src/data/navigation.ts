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
  /** Model floor the destination is on (`ModelFloor.object`). Defaults to
   * the building's `kioskFloor`. */
  modelFloor?: string;
  /** Rooms from the Map/Search API: the room, and its navigation node
   * (null until the room is placed in Map Annotation). */
  roomId?: number;
  nodeId?: number | null;
  /** The route split by floor (Navigation API routes can change floors).
   * Without it, `points` is one leg on `modelFloor`. */
  legs?: RouteLeg[];
  /** The Navigation API route (`GET /navigation/routes/{id}`), so the phone
   * handoff can load the same route without requesting a new one. */
  routeId?: number;
}

export interface RouteLeg {
  /** `ModelFloor.object` the leg is on. */
  floor: string;
  points: Point3[];
}

/** One floor of the building model. */
export interface ModelFloor {
  /** Floor group name in the model, as named in Blender (e.g. "FLOOR_1"). */
  object: string;
  /** Short button label, e.g. "1F". */
  label: string;
  /** Spoken name, e.g. "First floor". */
  name: string;
  /** Height of the walking surface (m). Also decides which floor a
   * `byHeight` object belongs to. */
  elevation: number;
}

/** A building shown around the kiosk's building in the campus view. */
export interface CampusNeighbour {
  name: string;
  modelUrl: string;
  /** Placement in the kiosk building's model coordinates. */
  position: Point3;
  /** Turn about the vertical axis (radians). */
  rotationY: number;
  /** Where its name label sits. */
  labelAt: Point3;
}

/** The low-detail neighbourhood around the kiosk's building. */
export interface CampusConfig {
  name: string;
  /** Surrounding streets, buildings and trees, in the building's
   * coordinates (scripts/blender/build_campus_model.py). */
  modelUrl: string;
  neighbours: CampusNeighbour[];
  /** Box the campus view frames: [min, max]. */
  frame: [Point3, Point3];
  /** Label for the kiosk's own building. */
  labelAt: Point3;
  /** Other labelled places, such as the overpass. */
  landmarks: { name: string; at: Point3 }[];
}

/** One selectable building map. IDs must be unique in the registry. */
export interface BuildingConfig {
  id: string;
  name: string;
  /** The building's area code in the Map API (campus.areas.code). */
  areaCode: string;
  /** Floor the kiosk stands on (label shown to visitors). */
  floor: string;
  modelUrl: string;
  start: Point3;
  startLabel: string;
  /** Optional model object to move to start (preserving its standing height). */
  kioskObject?: string;
  model: {
    /** Objects lifted away when the visitor opens the building (shell, roof). */
    exterior: string[];
    /** Floors, bottom to top. */
    floors: ModelFloor[];
    /** Groups whose children are split between floors by height (for
     * example one group holding every floor's room signs). */
    byHeight?: string[];
  };
  /** `ModelFloor.object` the kiosk stands on. */
  kioskFloor: string;
  camera: {
    /** Viewing direction: the camera looks from `position` toward `target`.
     * The polar angle is kept (isometric view); visitors can turn around
     * the building and zoom. Framing is computed from the model. */
    position: Point3;
    target: Point3;
    near: number;
    far: number;
  };
  destinations: Destination[];
  /** The campus around the building, when a campus model exists. */
  campus?: CampusConfig;
}
