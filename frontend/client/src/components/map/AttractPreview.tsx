/* The attract screen's sneak peek: the real building model turning slowly,
 * then opening onto the kiosk's floor with a sample route, and back. It is
 * decoration only (no controls, not focusable); taps go to the page. */
import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { BuildingConfig } from "@/data/navigation";
import { BUILDING_VIEW, type MapView } from "@/lib/mapView";
import {
  BuildingModel,
  CameraRig,
  Marker,
  ModelErrorBoundary,
  RoutePath,
} from "./BuildingScene";
import { useBuildingModel } from "./buildingModel";

/** How long each phase (outside, then inside with a route) lasts (ms). */
const PHASE_MS = 7000;
/** Turning speed around the building (rad/s). */
const SPIN = 0.15;

function PreviewScene({
  building,
  view,
  spin,
  onReady,
}: {
  building: BuildingConfig;
  view: MapView;
  spin: number;
  onReady: () => void;
}) {
  const prepared = useBuildingModel(building);
  useEffect(onReady, [onReady]);
  const sample = building.destinations[1] ?? building.destinations[0];
  return (
    <>
      <color attach="background" args={["#102d50"]} />
      <BuildingModel prepared={prepared} building={building} view={view} />
      <CameraRig
        prepared={prepared}
        building={building}
        view={view}
        spin={spin}
      />
      {view.mode === "floor" && sample && (
        <>
          <Marker point={building.start} label="You are here" color="#17365d" />
          {sample.points.length >= 2 && (
            <RoutePath points={sample.points} color={sample.color} />
          )}
        </>
      )}
    </>
  );
}

export function AttractPreview({
  building,
  onReady,
}: {
  building: BuildingConfig;
  /** Called once the model is showing (so the page can drop its placeholder). */
  onReady: () => void;
}) {
  const [view, setView] = useState<MapView>(BUILDING_VIEW);
  const [ready, setReady] = useState(false);
  const [still] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
  const shown = useCallback(() => {
    setReady(true);
    onReady();
  }, [onReady]);
  // Phases start once the model shows, so a slow load doesn't skip the outside.
  useEffect(() => {
    if (still || !ready) return;
    const timer = window.setInterval(
      () =>
        setView(current =>
          current.mode === "building"
            ? { mode: "floor", floor: building.kioskFloor }
            : BUILDING_VIEW
        ),
      PHASE_MS
    );
    return () => window.clearInterval(timer);
  }, [building, still, ready]);
  return (
    <ModelErrorBoundary fallback={null}>
      <Canvas
        orthographic
        frameloop="demand"
        dpr={1}
        camera={{
          position: building.camera.position,
          zoom: 10,
          near: building.camera.near,
          far: building.camera.far,
        }}
        style={{ pointerEvents: "none" }}
        aria-hidden="true"
      >
        <ambientLight intensity={1.6} />
        <directionalLight position={[10, 40, 20]} intensity={2} />
        <Suspense fallback={null}>
          <PreviewScene
            building={building}
            view={view}
            spin={still ? 0 : SPIN}
            onReady={shown}
          />
        </Suspense>
      </Canvas>
    </ModelErrorBoundary>
  );
}
