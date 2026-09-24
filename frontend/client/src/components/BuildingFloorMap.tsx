import {
  Component,
  Suspense,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PropertyBinding, Vector3 } from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, useGLTF } from "@react-three/drei";
import type { BuildingConfig, Destination, Point3 } from "@/data/navigation";

class MapErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div
        role="alert"
        className="grid h-full place-content-center gap-3 p-8 text-center"
      >
        <p>The building model could not be loaded.</p>
        <button className="underline" onClick={() => window.location.reload()}>
          Reload map
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function FitView({ config }: { config: BuildingConfig["camera"] }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    // Three.js cameras are mutable scene objects; resizing updates their projection.
    // eslint-disable-next-line react-hooks/immutability
    camera.zoom = Math.min(
      size.width / config.fitWidth,
      size.height / config.fitHeight
    );
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, config]);
  return null;
}
function Building({ building }: { building: BuildingConfig }) {
  const { scene } = useGLTF(building.modelUrl);
  const displayScene = useMemo(() => {
    // Clone the hierarchy so the cached GLB remains unchanged across remounts.
    const clone = scene.clone(true);
    clone.updateMatrixWorld(true);
    if (!building.kioskObject) return clone;
    const kiosk = clone.getObjectByName(
      PropertyBinding.sanitizeNodeName(building.kioskObject)
    );
    if (!kiosk) return clone;
    const position = kiosk.getWorldPosition(new Vector3());
    // Preserve the model's standing height; start.y is the route overlay height.
    position.set(building.start[0], position.y, building.start[2]);
    if (kiosk.parent) kiosk.parent.worldToLocal(position);
    kiosk.position.copy(position);
    clone.updateMatrixWorld(true);
    return clone;
  }, [scene, building]);
  return <primitive object={displayScene} />;
}
function Marker({
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
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.42, 32]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
      <Html
        position={[0, label === "You are here" ? 3.5 : 1.1, 0]}
        center
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
export function BuildingFloorMap({
  building,
  destination,
}: {
  building: BuildingConfig;
  destination: Destination | null;
}) {
  const [view, setView] = useState(0);
  return (
    <div
      className="relative h-full min-h-[320px] w-full"
      aria-label={`${building.name} · ${building.floor} map${destination ? `, route to ${destination.code}` : ""}`}
    >
      <MapErrorBoundary key={`${building.id}:${building.modelUrl}:${view}`}>
        <Canvas
          key={view}
          orthographic
          camera={{
            position: building.camera.position,
            zoom: 10,
            near: building.camera.near,
            far: building.camera.far,
          }}
          dpr={[1, 1.5]}
        >
          <color attach="background" args={["#edf2f6"]} />
          <FitView config={building.camera} />
          <ambientLight intensity={1.6} />
          <directionalLight position={[10, 40, 20]} intensity={2} />
          <Suspense
            fallback={
              <Html center>
                <div
                  role="status"
                  className="whitespace-nowrap rounded-xl bg-white p-4 shadow"
                >
                  Loading {building.name} · {building.floor}…
                </div>
              </Html>
            }
          >
            <Building building={building} />
            <Marker
              point={building.start}
              label="You are here"
              color="#17365d"
            />
            {destination && destination.points.length >= 2 && (
              <>
                <Line
                  points={destination.points}
                  color="white"
                  lineWidth={9}
                  depthTest={false}
                  renderOrder={10}
                />
                <Line
                  points={destination.points}
                  color={destination.color}
                  lineWidth={5}
                  depthTest={false}
                  renderOrder={11}
                />
                <Marker
                  point={destination.points[destination.points.length - 1]}
                  label={destination.code}
                  color={destination.color}
                />
              </>
            )}
          </Suspense>
          <OrbitControls
            makeDefault
            target={building.camera.target}
            minZoom={building.camera.minZoom}
            maxZoom={building.camera.maxZoom}
            maxPolarAngle={building.camera.maxPolarAngle}
          />
        </Canvas>
      </MapErrorBoundary>
      <div className="absolute right-4 top-4 flex gap-2">
        <span className="rounded-lg bg-white/95 px-3 py-2 text-xs font-bold shadow">
          {building.name} · {building.floor}
        </span>
        <button
          onClick={() => setView(v => v + 1)}
          className="rounded-lg bg-white px-3 py-2 text-xs font-bold shadow"
        >
          Reset view
        </button>
      </div>
      <p className="absolute bottom-4 left-4 rounded-lg bg-white/95 px-3 py-2 text-xs text-[#52657a]">
        Drag to rotate · Scroll to zoom · Right-drag to pan
      </p>
    </div>
  );
}
