/* Map Annotation's workspace: one floor of the real building model (floors
 * above lifted away, as in the kiosk), with the navigation graph drawn on it.
 * Clicking reports a node (the nearest one on screen, within a few pixels) or
 * the spot on the floor's walking surface; the page decides what the click
 * means for the tool in use. With dragging on, pressing a point and moving
 * it reports its new spot instead. */
import { Suspense, useRef, useState, type ReactNode } from "react";
import { Plane, Raycaster, Vector3, type Group, type Object3D } from "three";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { BuildingConfig, Point3 } from "@/data/navigation";
import { NODE_COLORS, type GraphNode } from "@/lib/annotationApi";
import { CAMPUS_VIEW, LABEL_Z_RANGE, type MapView } from "@/lib/mapView";
import { CampusScene } from "./CampusScene";
import { BuildingModel, CameraRig, ModelErrorBoundary } from "./BuildingScene";
import { useLiveBuilding } from "@/lib/liveModel";
import { useBuildingModel } from "./buildingModel";

/** Looking straight down (a hair off vertical keeps the camera's up stable). */
const TOP_DOWN: Point3 = [0, 1, 0.02];
/** Pointer movement (px) under which a press counts as a click, not a drag. */
const CLICK_SLOP = 5;

/** Points keep about this size on screen at any zoom, so they stay easy to
 * click (the disc geometry is 1 m across at scale 1). */
const POINT_PX = 16;
/** Campus model objects clicks land on (ground, overpass deck). */
const WALKABLE = /GROUND|OVERPASS/i;
/** A click this close (px) to a line picks it (the Delete tool). */
const LINE_PX = 6;

/** A group that scales with the camera zoom to stay POINT_PX wide. */
function ScreenSized({
  position,
  children,
}: {
  position: Point3;
  children: ReactNode;
}) {
  const group = useRef<Group>(null);
  useFrame(state => {
    group.current?.scale.setScalar(Math.max(0.3, POINT_PX / state.camera.zoom));
  });
  return (
    <group ref={group} position={position}>
      {children}
    </group>
  );
}

export interface AnnotationCanvasProps {
  building: BuildingConfig;
  /** Model floor object shown (`FLOOR_1` …). */
  floor: string;
  /** The floor's walking-surface height (m): clicks land on this plane. */
  elevation: number;
  topDown: boolean;
  nodes: GraphNode[];
  /** Connections on this floor, as pairs of positions. */
  edges: { id: number; from: Point3; to: Point3 }[];
  /** Nodes on this floor linked to another floor (stairs, elevators). */
  linked: Set<number>;
  selectedId: number | null;
  /** First node of a two-click action (connect, floor link). */
  pendingId: number | null;
  onFloorClick: (point: Point3) => void;
  onNodeClick: (node: GraphNode) => void;
  /** Clicking a line reports it (the Delete tool); otherwise clicks near a
   * line land on the floor. */
  onEdgeClick?: (edgeId: number) => void;
  /** Points can be dragged to a new spot (the Select tool). */
  dragEnabled?: boolean;
  onNodeMove?: (node: GraphNode, point: Point3) => void;
  resetKey: number;
  /** The campus instead of one floor (step 14): `building` is the campus's
   * host, shown with the campus around it; clicks land on the ground (or a
   * roof) under the pointer, not on a flat floor. */
  campus?: boolean;
  /** More to draw in the scene (the campus editor's labels and buildings). */
  children?: ReactNode;
}

const samePoint = (a: Point3, b: Point3) =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

function Scene(props: AnnotationCanvasProps) {
  const { building, floor, topDown, nodes, edges, linked } = props;
  const prepared = useBuildingModel(building);
  const view: MapView = props.campus ? CAMPUS_VIEW : { mode: "floor", floor };
  const size = useThree(state => state.size);
  // Read from the store when needed: the controls are a Three.js object.
  const get = useThree(state => state.get);
  const holdCamera = (hold: boolean) => {
    const controls = get().controls as { enabled: boolean } | null;
    if (controls) controls.enabled = !hold;
  };
  // The point being dragged and where it is now (drawn there until saved).
  const [drag, setDrag] = useState<{
    node: GraphNode;
    at: Point3;
    /** Where the press started on screen, to tell a drag from a click. */
    from: [number, number];
    moved: boolean;
  } | null>(null);
  // Clicks are resolved on screen and on the floor plane, not against the
  // model's geometry: room boxes, ceilings and the atrium would otherwise
  // catch or swallow them.
  const nodeUnder = (event: ThreeEvent<MouseEvent | PointerEvent>) => {
    let nearest: GraphNode | undefined;
    let best = POINT_PX / 2 + 4;
    for (const node of nodes) {
      const at = new Vector3(...node.position).project(event.camera);
      const px = Math.hypot(
        ((at.x - event.pointer.x) * size.width) / 2,
        ((at.y - event.pointer.y) * size.height) / 2
      );
      if (px <= best) {
        best = px;
        nearest = node;
      }
    }
    return nearest;
  };
  /** The connection drawn within a few pixels of the pointer, if any. */
  const lineUnder = (event: ThreeEvent<MouseEvent>) => {
    const screen = (p: Point3) => {
      const at = new Vector3(...p).project(event.camera);
      return [(at.x * size.width) / 2, (at.y * size.height) / 2];
    };
    const [px, py] = [
      (event.pointer.x * size.width) / 2,
      (event.pointer.y * size.height) / 2,
    ];
    let found: number | undefined;
    let best = LINE_PX;
    for (const edge of edges) {
      const [ax, ay] = screen(edge.from);
      const [bx, by] = screen(edge.to);
      const [dx, dy] = [bx - ax, by - ay];
      const t = Math.max(
        0,
        Math.min(
          1,
          ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)
        )
      );
      const gap = Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
      if (gap <= best) {
        best = gap;
        found = edge.id;
      }
    }
    return found;
  };
  const floorSpot = (
    event: ThreeEvent<MouseEvent | PointerEvent>
  ): Point3 | null => {
    if (props.campus) {
      // The ground (or a roof) under the pointer. The event only lists
      // objects with handlers, so cast against the whole scene, skipping the
      // click catcher and what's drawn on top (points, lines, labels).
      const raycaster = new Raycaster(event.ray.origin, event.ray.direction);
      // Lines (drei's Line2) need the camera to be hit-tested.
      raycaster.camera = event.camera;
      const shown = (object: Object3D | null): boolean =>
        !object || (object.visible && shown(object.parent));
      const hits = raycaster
        .intersectObjects(get().scene.children, true)
        .filter(
          item =>
            !item.object.userData.catcher &&
            !item.object.userData.overlay &&
            (item.object as { isMesh?: boolean }).isMesh &&
            !(item.object as { isLine2?: boolean }).isLine2 &&
            ((item.object as { material?: { depthTest?: boolean } }).material
              ?.depthTest ??
              true) &&
            shown(item.object)
        );
      // The ground or the overpass deck, not a roof (the campus model's
      // AREA_GROUND and OVERPASS); any surface if the model names neither.
      const named = (object: Object3D | null): boolean =>
        !!object && (WALKABLE.test(object.name) || named(object.parent));
      const hit = hits.find(item => named(item.object)) ?? hits[0];
      if (hit) return [hit.point.x, hit.point.y, hit.point.z];
    }
    const floorPlane = new Plane(new Vector3(0, 1, 0), -props.elevation);
    const spot = event.ray.intersectPlane(floorPlane, new Vector3());
    return spot ? [spot.x, spot.y, spot.z] : null;
  };
  const onClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_SLOP) return;
    event.stopPropagation();
    const nearest = nodeUnder(event);
    if (nearest) return props.onNodeClick(nearest);
    if (props.onEdgeClick) {
      const line = lineUnder(event);
      if (line !== undefined) return props.onEdgeClick(line);
    }
    const spot = floorSpot(event);
    if (spot) props.onFloorClick(spot);
  };
  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!props.dragEnabled || event.button !== 0) return;
    const node = nodeUnder(event);
    if (!node) return;
    event.stopPropagation();
    // Hold the camera still while a point moves.
    holdCamera(true);
    (event.target as unknown as Element).setPointerCapture?.(event.pointerId);
    setDrag({
      node,
      at: node.position,
      from: [event.nativeEvent.clientX, event.nativeEvent.clientY],
      moved: false,
    });
  };
  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!drag) return;
    const spot = floorSpot(event);
    const travelled = Math.hypot(
      event.nativeEvent.clientX - drag.from[0],
      event.nativeEvent.clientY - drag.from[1]
    );
    if (spot)
      setDrag({
        ...drag,
        at: spot,
        moved: drag.moved || travelled > CLICK_SLOP,
      });
  };
  const onPointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!drag) return;
    (event.target as unknown as Element).releasePointerCapture?.(
      event.pointerId
    );
    holdCamera(false);
    if (drag.moved) props.onNodeMove?.(drag.node, drag.at);
    else props.onNodeClick(drag.node);
    setDrag(null);
  };
  const shown = (node: GraphNode) =>
    drag && drag.node.id === node.id ? drag.at : node.position;
  const moved = (point: Point3) =>
    drag && samePoint(point, drag.node.position) ? drag.at : point;
  const markers = nodes.map(node => {
    const selected = node.id === props.selectedId;
    const pending = node.id === props.pendingId;
    const position = shown(node);
    const color = NODE_COLORS[node.node_type];
    return (
      <group key={node.id}>
        <ScreenSized position={position}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={12}>
            <circleGeometry
              args={[node.node_type === "auxiliary" ? 0.4 : 0.5, 24]}
            />
            <meshBasicMaterial color={color} depthTest={false} />
          </mesh>
          {(selected || pending || linked.has(node.id)) && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={11}>
              <ringGeometry args={[0.6, 0.85, 32]} />
              <meshBasicMaterial
                color={pending ? "#f4c542" : selected ? "#17365d" : "#7c3aed"}
                depthTest={false}
              />
            </mesh>
          )}
        </ScreenSized>
        {node.node_type !== "auxiliary" && (
          <Html
            position={[position[0], position[1] + 1.2, position[2]]}
            center
            zIndexRange={LABEL_Z_RANGE}
            style={{ pointerEvents: "none" }}
          >
            <span
              className="block -translate-y-4 whitespace-nowrap rounded border bg-white px-1.5 py-0.5 text-[10px] font-bold shadow"
              style={{ color }}
            >
              {node.name}
            </span>
          </Html>
        )}
      </group>
    );
  });

  return (
    <>
      <BuildingModel prepared={prepared} building={building} view={view} />
      {props.campus && building.campus && (
        <CampusScene
          campus={building.campus}
          buildingName={building.name}
          visible
        />
      )}
      {props.children}
      {/* Invisible click catcher over the whole floor (raycast still hits it). */}
      <mesh
        userData={{ catcher: true }}
        position={[0, props.elevation, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        onClick={event => {
          // A drag (or a press on a point) is handled by the pointer events.
          if (
            !drag &&
            !(
              props.dragEnabled &&
              event.delta <= CLICK_SLOP &&
              nodeUnder(event)
            )
          )
            onClick(event);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <planeGeometry args={[4000, 4000]} />
      </mesh>
      {markers}
      <CameraRig
        prepared={prepared}
        building={building}
        view={view}
        resetKey={props.resetKey}
        direction={topDown ? TOP_DOWN : undefined}
      />
      {edges.map(edge => (
        <Line
          key={edge.id}
          points={[moved(edge.from), moved(edge.to)]}
          color="#17365d"
          lineWidth={3}
          depthTest={false}
          renderOrder={10}
        />
      ))}
    </>
  );
}

export function AnnotationCanvas({
  building: configured,
  ...rest
}: AnnotationCanvasProps) {
  // The model activated in Asset Management, else the bundled one.
  const { building, pending, onModelError } = useLiveBuilding(configured);
  const props = { ...rest, building };
  if (pending)
    return (
      <p role="status" className="grid h-full place-content-center p-8 text-sm">
        Loading the building model…
      </p>
    );
  return (
    <ModelErrorBoundary
      key={props.building.modelUrl}
      onError={onModelError}
      fallback={
        <p
          role="alert"
          className="grid h-full place-content-center p-8 text-sm"
        >
          The building model couldn't be loaded.
        </p>
      }
    >
      <Canvas
        orthographic
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{
          position: props.building.camera.position,
          zoom: 10,
          near: props.building.camera.near,
          far: props.building.camera.far,
        }}
      >
        <color attach="background" args={["#edf2f6"]} />
        <ambientLight intensity={1.6} />
        <directionalLight position={[10, 40, 20]} intensity={2} />
        <Suspense
          fallback={
            <Html center zIndexRange={LABEL_Z_RANGE}>
              <div
                role="status"
                className="whitespace-nowrap rounded-xl bg-white p-4 shadow"
              >
                Loading {props.building.name}…
              </div>
            </Html>
          }
        >
          <Scene {...props} />
        </Suspense>
        <OrbitControls makeDefault enableDamping={false} />
      </Canvas>
    </ModelErrorBoundary>
  );
}
