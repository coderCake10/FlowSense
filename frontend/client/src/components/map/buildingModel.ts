/* Loading the building model and splitting it into parts that lift away
 * (exterior, floors). Used by the map scene. */
import { useEffect, useMemo } from "react";
import {
  Box3,
  Mesh,
  Object3D,
  PropertyBinding,
  Vector3,
  type Material,
} from "three";
import { useGLTF } from "@react-three/drei";
import type { BuildingConfig } from "@/data/navigation";
import { DRACO_DECODER_PATH } from "@/data/models";
import { EXTERIOR_PART, floorAtHeight } from "@/lib/mapView";

/** How far parts rise while fading out (m). */
const EXTERIOR_LIFT = 30;
const FLOOR_LIFT = 12;

export interface Part {
  objects: { object: Object3D; base: Vector3 }[];
  /** Each copy with its original opacity, transparency and depth writing. */
  materials: {
    material: Material;
    opacity: number;
    transparent: boolean;
    depthWrite: boolean;
  }[];
  height: number;
  lift: number;
  shown: boolean;
}

export interface PreparedModel {
  root: Object3D;
  parts: Map<string, Part>;
  buildingBox: Box3;
  floorBoxes: Map<string, Box3>;
}

function named(root: Object3D, name: string) {
  return root.getObjectByName(PropertyBinding.sanitizeNodeName(name));
}

/** Clone the cached GLB and split it into parts that can lift away. Each part
 * gets its own material copies so fading one part leaves the others alone. */
function prepareModel(
  scene: Object3D,
  building: BuildingConfig
): PreparedModel {
  const root = scene.clone(true);
  root.updateMatrixWorld(true);
  if (building.kioskObject) {
    const kiosk = named(root, building.kioskObject);
    if (kiosk) {
      const position = kiosk.getWorldPosition(new Vector3());
      // Preserve the model's standing height; start.y is the route overlay height.
      position.set(building.start[0], position.y, building.start[2]);
      if (kiosk.parent) kiosk.parent.worldToLocal(position);
      kiosk.position.copy(position);
      root.updateMatrixWorld(true);
    }
  }

  const members = new Map<string, Object3D[]>();
  const add = (part: string, object: Object3D | undefined) => {
    if (!object) return;
    members.set(part, [...(members.get(part) ?? []), object]);
  };
  const { model } = building;
  model.exterior.forEach(name => add(EXTERIOR_PART, named(root, name)));
  const floorBoxes = new Map<string, Box3>();
  for (const floor of model.floors) {
    const group = named(root, floor.object);
    add(floor.object, group);
    if (group) floorBoxes.set(floor.object, new Box3().setFromObject(group));
  }
  for (const name of model.byHeight ?? []) {
    for (const child of [...(named(root, name)?.children ?? [])]) {
      const center = new Box3().setFromObject(child).getCenter(new Vector3());
      add(floorAtHeight(model.floors, center.y).object, child);
    }
  }

  const parts = new Map<string, Part>();
  members.forEach((objects, key) => {
    const copies = new Map<Material, Material>();
    for (const object of objects) {
      object.traverse((node: Object3D) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        const swap = (material: Material) => {
          if (!copies.has(material)) copies.set(material, material.clone());
          return copies.get(material)!;
        };
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(swap)
          : swap(mesh.material);
      });
    }
    parts.set(key, {
      objects: objects.map((object: Object3D) => ({
        object,
        base: object.position.clone(),
      })),
      materials: Array.from(copies.values(), material => ({
        material,
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
      })),
      height: key === EXTERIOR_PART ? EXTERIOR_LIFT : FLOOR_LIFT,
      lift: 0,
      shown: true,
    });
  });
  return {
    root,
    parts,
    buildingBox: new Box3().setFromObject(root),
    floorBoxes,
  };
}

/** Place a part `lift` metres above its resting position (in world space, so
 * parent transforms don't matter) and fade it as it rises. */
export function applyLift(part: Part) {
  const fade = Math.min(1, part.lift / part.height);
  const world = new Vector3();
  for (const { object, base } of part.objects) {
    if (object.parent) {
      world.copy(base);
      object.parent.localToWorld(world);
      world.y += part.lift;
      object.parent.worldToLocal(world);
      object.position.copy(world);
    }
    object.visible = fade < 0.98;
  }
  for (const entry of part.materials) {
    entry.material.transparent = fade > 0 || entry.transparent;
    entry.material.opacity = entry.opacity * (1 - fade);
    entry.material.depthWrite = fade === 0 && entry.depthWrite;
  }
}

export function useBuildingModel(building: BuildingConfig) {
  const { scene } = useGLTF(building.modelUrl, DRACO_DECODER_PATH);
  const prepared = useMemo(
    () => prepareModel(scene, building),
    [scene, building]
  );
  // The material copies belong to this map; the cached GLB keeps its own.
  useEffect(
    () => () =>
      prepared.parts.forEach(part =>
        part.materials.forEach(({ material }) => material.dispose())
      ),
    [prepared]
  );
  return prepared;
}
