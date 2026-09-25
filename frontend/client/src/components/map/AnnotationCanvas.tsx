/* Map Annotation's workspace: one floor of the real building model (floors
 * above lifted away, as in the kiosk), with the navigation graph drawn on it.
 * Clicking reports a node (the nearest one on screen, within a few pixels) or
 * the spot on the floor's walking surface; the page decides what the click
 * means for the tool in use. */
import { Suspense, useRef, type ReactNode } from "react";
import { Plane, Vector3, type Group } from "three";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { BuildingConfig, Point3 } from "@/data/navigation";
import { NODE_COLORS, type GraphNode } from "@/lib/annotationApi";
import { LABEL_Z_RANGE, type MapView } from "@/lib/mapView";
import { BuildingModel, CameraRig, ModelErrorBoundary } from "./BuildingScene";
import { useBuildingModel } from "./buildingModel";

/** Looking straight down (a hair off vertical keeps the camera's up stable). */
const TOP_DOWN: Point3 = [0, 1, 0.02];
/** Pointer movement (px) under which a press counts as a click, not a drag. */
const CLICK_SLOP = 5;

/** Points keep about this size on screen at any zoom, so they stay easy to
 * click (the disc geometry is 1 m across at scale 1). */
const POINT_PX = 16;

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
  resetKey: number;
}

function Scene(props: AnnotationCanvasProps) {
  const { building, floor, topDown, nodes, edges, linked } = props;
  const prepared = useBuildingModel(building);
  const view: MapView = { mode: "floor", floor };
  const size = useThree(state => state.size);
  // Clicks are resolved on screen and on the floor plane, not against the
  // model's geometry: room boxes, ceilings and the atrium would otherwise
  // catch or swallow them.
  const onClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_SLOP) return;
    event.stopPropagation();
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
    if (nearest) return props.onNodeClick(nearest);
    const floorPlane = new Plane(new Vector3(0, 1, 0), -props.elevation);
    const spot = event.ray.intersectPlane(floorPlane, new Vector3());
    if (spot) props.onFloorClick([spot.x, spot.y, spot.z]);
  };
  const markers = nodes.map(node => {
    const selected = node.id === props.selectedId;
    const pending = node.id === props.pendingId;
    const color = NODE_COLORS[node.node_type];
    return (
      <group key={node.id}>
        <ScreenSized position={node.position}>
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
            position={[
              node.position[0],
              node.position[1] + 1.2,
              node.position[2],
            ]}
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
      {/* Invisible click catcher over the whole floor (raycast still hits it). */}
      <mesh
        position={[0, props.elevation, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        onClick={onClick}
      >
        <planeGeometry args={[2000, 2000]} />
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
          points={[edge.from, edge.to]}
          color="#17365d"
          lineWidth={3}
          depthTest={false}
          renderOrder={10}
        />
      ))}
    </>
  );
}

export function AnnotationCanvas(props: AnnotationCanvasProps) {
  return (
    <ModelErrorBoundary
      key={props.building.modelUrl}
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
