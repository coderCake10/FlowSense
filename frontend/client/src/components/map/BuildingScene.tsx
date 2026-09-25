/* The 3D building shared by the kiosk map and the attract screen: the model
 * with its exterior and floors lifting away, the camera framing, and the
 * animated route. Rules for what shows live in lib/mapView.ts. */
import {
  Component,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  Box3,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Object3D,
  OrthographicCamera,
  Vector3,
} from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import type { BuildingConfig, Point3 } from "@/data/navigation";
import {
  arrowsAlong,
  LABEL_Z_RANGE,
  pathLength,
  poseAt,
  visibleParts,
  type MapView,
} from "@/lib/mapView";
import { applyLift, type Part, type PreparedModel } from "./buildingModel";

/** Renders `fallback` when the model can't be loaded or drawn. */
export class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Length of the lift and camera animations (ms). Time-based, so they finish
 * on schedule even on a slow device. */
const ANIMATION_MS = 900;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** The model, with parts rising away or settling back as `view` changes.
 * The first view is applied at once; later changes animate. */
export function BuildingModel({
  prepared,
  building,
  view,
}: {
  prepared: PreparedModel;
  building: BuildingConfig;
  view: MapView;
}) {
  const first = useRef(true);
  const animation = useRef<{ start: number; from: Map<Part, number> } | null>(
    null
  );
  const invalidate = useThree(s => s.invalidate);
  useLayoutEffect(() => {
    const targets = visibleParts(building.model, view);
    const from = new Map<Part, number>();
    prepared.parts.forEach((part, key) => {
      part.shown = targets[key] ?? true;
      if (first.current) {
        part.lift = part.shown ? 0 : part.height;
        applyLift(part);
      } else {
        from.set(part, part.lift);
      }
    });
    animation.current = first.current
      ? null
      : { start: performance.now(), from };
    first.current = false;
    invalidate();
  }, [prepared, building, view, invalidate]);
  // The canvas draws on demand: each animation frame asks for the next one.
  useFrame(state => {
    const run = animation.current;
    if (!run) return;
    const t = Math.min(1, (performance.now() - run.start) / ANIMATION_MS);
    run.from.forEach((start, part) => {
      const goal = part.shown ? 0 : part.height;
      if (start === goal && part.lift === goal) return;
      part.lift = start + (goal - start) * ease(t);
      applyLift(part);
    });
    if (t < 1) state.invalidate();
    else animation.current = null;
  });
  return <primitive object={prepared.root} />;
}

/** Distance from the look-at point to the orthographic camera (m). Only the
 * direction matters for framing; this keeps the model inside near/far. */
const CAMERA_DISTANCE = 150;
/** Share of the viewport the framed box may fill. */
const FRAME_FILL = 0.86;
const UP = new Vector3(0, 1, 0);

function viewDirection(building: BuildingConfig) {
  const [px, py, pz] = building.camera.position;
  const [tx, ty, tz] = building.camera.target;
  return new Vector3(px - tx, py - ty, pz - tz).normalize();
}

/** Zoom and center that fit `box` on screen when looking along `direction`. */
function frame(box: Box3, direction: Vector3, width: number, height: number) {
  const forward = direction.clone().negate();
  const right = new Vector3().crossVectors(forward, UP);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  const up = new Vector3().crossVectors(right, forward).normalize();
  const center = box.getCenter(new Vector3());
  let w = 0;
  let h = 0;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const corner = new Vector3(x, y, z).sub(center);
        w = Math.max(w, Math.abs(corner.dot(right)) * 2);
        h = Math.max(h, Math.abs(corner.dot(up)) * 2);
      }
  const zoom =
    Math.min(width / Math.max(w, 1), height / Math.max(h, 1)) * FRAME_FILL;
  return { center, zoom };
}

/** The parts of drei's OrbitControls the rig adjusts. */
interface Controls {
  target: Vector3;
  minZoom: number;
  maxZoom: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  update(): void;
}

/** Frames the view (the whole building or the chosen floor) and glides there
 * when it changes, then leaves the camera to the visitor. A new `resetKey`
 * also restores the default viewing direction. `spin` (rad/s) circles the
 * building, for the attract screen. The viewing angle from above is fixed
 * (isometric); visitors can turn around the building, pan, and zoom. */
export function CameraRig({
  prepared,
  building,
  view,
  resetKey = 0,
  spin = 0,
  direction,
}: {
  prepared: PreparedModel;
  building: BuildingConfig;
  view: MapView;
  resetKey?: number;
  spin?: number;
  /** Viewing direction instead of the building's (e.g. top-down). */
  direction?: Point3;
}) {
  const get = useThree(s => s.get);
  // Subscribed only so the framing re-runs when they change.
  const controlsReady = useThree(s => s.controls);
  const size = useThree(s => s.size);
  const defaultDirection = useMemo(
    () =>
      direction
        ? new Vector3(...direction).normalize()
        : viewDirection(building),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- by value
    [building, direction?.[0], direction?.[1], direction?.[2]]
  );
  const rig = useRef({
    direction: defaultDirection.clone(),
    target: new Vector3(),
    goalTarget: new Vector3(),
    goalZoom: 1,
    fromTarget: new Vector3(),
    fromZoom: 1,
    start: 0,
    moving: false,
    placed: false,
    lastReset: resetKey,
    lastDefault: defaultDirection,
  });

  useLayoutEffect(() => {
    const { camera, controls } = get() as unknown as {
      camera: OrthographicCamera;
      controls: Controls | null;
    };
    const r = rig.current;
    if (
      !r.placed ||
      r.lastReset !== resetKey ||
      r.lastDefault !== defaultDirection
    ) {
      r.lastDefault = defaultDirection;
      r.direction.copy(defaultDirection);
      r.lastReset = resetKey;
    } else if (controls) {
      // Keep the direction the visitor turned to.
      r.direction.copy(camera.position).sub(controls.target).normalize();
    }
    // A floor view frames that floor and the ones below it (they stay shown).
    const box = prepared.buildingBox.clone();
    if (view.mode === "floor") {
      box.makeEmpty();
      for (const floor of building.model.floors) {
        const floorBox = prepared.floorBoxes.get(floor.object);
        if (floorBox) box.union(floorBox);
        if (floor.object === view.floor) break;
      }
      if (box.isEmpty()) box.copy(prepared.buildingBox);
    }
    const goal = frame(box, r.direction, size.width, size.height);
    r.goalTarget.copy(goal.center);
    r.goalZoom = goal.zoom;
    if (controls) {
      const whole = frame(
        prepared.buildingBox,
        r.direction,
        size.width,
        size.height
      ).zoom;
      const polar = Math.acos(Math.min(1, Math.max(-1, defaultDirection.y)));
      controls.minZoom = whole * 0.5;
      controls.maxZoom = whole * 10;
      controls.minPolarAngle = polar;
      controls.maxPolarAngle = polar;
    }
    if (!r.placed) {
      r.target.copy(goal.center);
      camera.zoom = goal.zoom;
      r.placed = true;
      r.moving = false;
      placeCamera(camera, controls, r.target, r.direction);
    } else {
      if (controls) r.target.copy(controls.target);
      r.fromTarget.copy(r.target);
      r.fromZoom = camera.zoom;
      r.start = performance.now();
      r.moving = true;
    }
    get().invalidate();
  }, [
    get,
    controlsReady,
    prepared,
    building,
    view,
    resetKey,
    size.width,
    size.height,
    defaultDirection,
  ]);

  useFrame((state, delta) => {
    const camera = state.camera as OrthographicCamera;
    const controls = state.controls as unknown as Controls | null;
    const r = rig.current;
    const dt = Math.min(delta, 0.1);
    if (spin) r.direction.applyAxisAngle(UP, spin * dt);
    if (r.moving) {
      const t = Math.min(1, (performance.now() - r.start) / ANIMATION_MS);
      r.target.lerpVectors(r.fromTarget, r.goalTarget, ease(t));
      camera.zoom = r.fromZoom + (r.goalZoom - r.fromZoom) * ease(t);
      if (t === 1) r.moving = false;
    }
    if (r.moving || spin) {
      placeCamera(camera, controls, r.target, r.direction);
      state.invalidate();
    }
  });
  return null;
}

function placeCamera(
  camera: OrthographicCamera,
  controls: Controls | null,
  target: Vector3,
  direction: Vector3
) {
  camera.position.copy(target).addScaledVector(direction, CAMERA_DISTANCE);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  if (controls) {
    controls.target.copy(target);
    controls.update();
  }
}

export function Marker({
  point,
  label,
  color,
}: {
  point: Point3;
  label: string;
  color: string;
}) {
  return (
    <group position={point}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={12}>
        <ringGeometry args={[0.22, 0.42, 32]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
      <Html
        // High enough to clear the route's arrowhead.
        position={[0, 2.4, 0]}
        center
        zIndexRange={LABEL_Z_RANGE}
        style={{ pointerEvents: "none" }}
      >
        <span
          className="block whitespace-nowrap rounded-lg border bg-white px-3 py-1 text-xs font-bold shadow"
          style={{ color }}
        >
          {label}
        </span>
      </Html>
    </group>
  );
}

/** Flat chevron lying on the floor and pointing along +Z (0.7 m wide). */
function chevronGeometry() {
  const corners = [
    [-0.35, -0.15],
    [0, 0.2],
    [0.35, -0.15],
    [0.35, 0.05],
    [0, 0.4],
    [-0.35, 0.05],
  ];
  // Left arm (0-1-4-5) and right arm (1-2-3-4) as two quads.
  const order = [0, 1, 5, 1, 4, 5, 1, 2, 3, 1, 3, 4];
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      order.flatMap(i => [corners[i][0], 0, corners[i][1]]),
      3
    )
  );
  return geometry;
}

/** Solid arrowhead lying on the floor, pointing along +Z with its tip at the
 * origin (so the tip lands on the destination). */
function arrowheadGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([-0.55, 0, -1.1, 0.55, 0, -1.1, 0, 0, 0], 3)
  );
  return geometry;
}

/** Arrows keep the same size on screen at any zoom: about this many pixels
 * wide (the chevron geometry is 0.7 m wide at scale 1). */
const ARROW_PX = 22;
const CHEVRON_WIDTH = 0.7;
const MIN_ARROW_SCALE = 0.3;
/** Gap between chevrons, in chevron widths; they advance about one gap per
 * second toward the destination. */
const ARROW_GAP = 2.4;
const ARROW_FILL = "#f4c542"; // FlowSense signal gold
const ARROW_EDGE = "#17365d"; // AUF navy
const ABOVE_FLOOR = 0.04;

/** The route: a thin line, gold chevrons flowing toward the destination, and
 * an arrowhead at the end. Drawn over the model so walls never hide it. With
 * reduced motion the chevrons stay still. */
export function RoutePath({
  points,
  color,
}: {
  points: Point3[];
  color: string;
}) {
  const fill = useRef<InstancedMesh>(null);
  const edge = useRef<InstancedMesh>(null);
  const headFill = useRef<Object3D>(null);
  const headEdge = useRef<Object3D>(null);
  const travelled = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);
  const chevron = useMemo(() => chevronGeometry(), []);
  const head = useMemo(() => arrowheadGeometry(), []);
  const length = pathLength(points);
  const capacity =
    Math.ceil(length / (ARROW_GAP * CHEVRON_WIDTH * MIN_ARROW_SCALE)) + 1;
  const end = poseAt(points, length);
  const still = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );
  useEffect(
    () => () => {
      chevron.dispose();
      head.dispose();
    },
    [chevron, head]
  );
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => invalidate(), [invalidate, points]);
  useFrame((state, delta) => {
    if (!fill.current || !edge.current) return;
    const scale = Math.max(
      MIN_ARROW_SCALE,
      ARROW_PX / (state.camera.zoom * CHEVRON_WIDTH)
    );
    const spacing = ARROW_GAP * CHEVRON_WIDTH * scale;
    // Progress in gaps, so the flow looks the same at any zoom.
    if (!still) travelled.current += Math.min(delta, 0.1);
    const poses = arrowsAlong(
      points,
      spacing,
      travelled.current * spacing,
      spacing * 0.9
    ).slice(0, capacity);
    for (const [mesh, grow] of [
      [edge.current, 1.35],
      [fill.current, 1],
    ] as const) {
      poses.forEach((pose, i) => {
        const [x, y, z] = pose.position;
        dummy.position.set(x, y + ABOVE_FLOOR, z);
        dummy.rotation.set(0, pose.heading, 0);
        dummy.scale.setScalar(scale * grow);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.count = poses.length;
      mesh.instanceMatrix.needsUpdate = true;
    }
    headFill.current?.scale.setScalar(scale);
    headEdge.current?.scale.setScalar(scale * 1.3);
    if (!still) state.invalidate();
  });
  const headAt: Point3 = [
    end.position[0],
    end.position[1] + ABOVE_FLOOR,
    end.position[2],
  ];
  return (
    <group>
      <Line
        points={points}
        color="white"
        lineWidth={6}
        depthTest={false}
        renderOrder={10}
      />
      <Line
        points={points}
        color={color}
        lineWidth={3}
        depthTest={false}
        renderOrder={11}
      />
      <instancedMesh
        ref={edge}
        args={[chevron, undefined, capacity]}
        renderOrder={12}
        frustumCulled={false}
      >
        <meshBasicMaterial
          color={ARROW_EDGE}
          depthTest={false}
          side={DoubleSide}
        />
      </instancedMesh>
      <instancedMesh
        ref={fill}
        args={[chevron, undefined, capacity]}
        renderOrder={13}
        frustumCulled={false}
      >
        <meshBasicMaterial
          color={ARROW_FILL}
          depthTest={false}
          side={DoubleSide}
        />
      </instancedMesh>
      <mesh
        ref={headEdge}
        geometry={head}
        position={headAt}
        rotation={[0, end.heading, 0]}
        renderOrder={14}
      >
        <meshBasicMaterial
          color={ARROW_EDGE}
          depthTest={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh
        ref={headFill}
        geometry={head}
        position={headAt}
        rotation={[0, end.heading, 0]}
        renderOrder={15}
      >
        <meshBasicMaterial
          color={ARROW_FILL}
          depthTest={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
