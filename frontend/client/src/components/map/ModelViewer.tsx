/* Asset Management's model viewer: one uploaded .glb version, with the
 * spec's Fit, Grid and Axes options. It loads only when shown and draws only
 * when the camera moves. */
import { Suspense, useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { DRACO_DECODER_PATH } from "@/data/models";
import { ModelErrorBoundary } from "./BuildingScene";

function Model({ url, fitKey }: { url: string; fitKey: number }) {
  const { scene } = useGLTF(url, DRACO_DECODER_PATH);
  const get = useThree(state => state.get);
  const invalidate = useThree(state => state.invalidate);
  const box = useMemo(() => new Box3().setFromObject(scene), [scene]);

  // Fit: frame the whole model from a three-quarter view.
  useEffect(() => {
    // Read from the store here: the camera and controls are Three.js objects
    // the scene moves, not React state.
    const { camera } = get();
    // OrbitControls with makeDefault registers itself as `controls`.
    const controls = get().controls as unknown as {
      target: Vector3;
      update: () => void;
    } | null;
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const radius = Math.max(size.length() / 2, 1);
    const fov = ((camera as PerspectiveCamera).fov ?? 45) * (Math.PI / 180);
    const distance = radius / Math.sin(fov / 2);
    camera.position
      .copy(center)
      .add(new Vector3(1, 0.8, 1).normalize().multiplyScalar(distance));
    camera.near = Math.max(distance / 1000, 0.01);
    camera.far = distance * 10;
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
    invalidate();
  }, [box, get, invalidate, fitKey]);

  return <primitive object={scene} />;
}

function Helpers({
  url,
  grid,
  axes,
}: {
  url: string;
  grid: boolean;
  axes: boolean;
}) {
  const { scene } = useGLTF(url, DRACO_DECODER_PATH);
  const { invalidate } = useThree();
  const box = useMemo(() => new Box3().setFromObject(scene), [scene]);
  const size = box.getSize(new Vector3());
  const span = Math.ceil(Math.max(size.x, size.z, 1) * 1.4);
  useEffect(() => invalidate(), [grid, axes, invalidate]);
  return (
    <>
      {grid && (
        <gridHelper
          args={[span, Math.min(span, 100), "#8391a3", "#dbe3ed"]}
          position={[
            box.getCenter(new Vector3()).x,
            box.min.y,
            box.getCenter(new Vector3()).z,
          ]}
        />
      )}
      {axes && <axesHelper args={[Math.max(size.x, size.y, size.z) * 0.6]} />}
    </>
  );
}

export function ModelViewer({
  url,
  grid,
  axes,
  fitKey,
}: {
  url: string;
  grid: boolean;
  axes: boolean;
  fitKey: number;
}) {
  const { active, progress } = useProgress();
  return (
    <ModelErrorBoundary
      key={url}
      fallback={
        <div
          role="alert"
          className="grid h-full place-items-center p-6 text-center text-sm text-[#8f2f2b]"
        >
          The model couldn&apos;t be displayed. The file may be damaged or use a
          feature the viewer doesn&apos;t support.
        </div>
      }
    >
      <div className="relative h-full">
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ fov: 45, position: [30, 25, 30] }}
          aria-label="3D model viewer"
        >
          <color attach="background" args={["#f7f9fc"]} />
          <hemisphereLight args={["#ffffff", "#b9c4d1", 1.6]} />
          <directionalLight position={[30, 50, 20]} intensity={1.4} />
          <Suspense fallback={null}>
            <Model url={url} fitKey={fitKey} />
            <Helpers url={url} grid={grid} axes={axes} />
          </Suspense>
          <OrbitControls makeDefault enableDamping={false} />
        </Canvas>
        {active && (
          <div
            role="status"
            className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-[#718398]"
          >
            Loading the model… {Math.round(progress)}%
          </div>
        )}
      </div>
    </ModelErrorBoundary>
  );
}
