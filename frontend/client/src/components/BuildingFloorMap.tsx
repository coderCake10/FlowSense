import { Suspense, useRef, useState } from "react";
import { Building2 } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import type { BuildingConfig, Destination } from "@/data/navigation";
import {
  BUILDING_VIEW,
  destinationLegs,
  firstFloorFor,
  LABEL_Z_RANGE,
  routeLegInView,
  viewLabel,
  type MapView,
} from "@/lib/mapView";
import { cn } from "@/lib/utils";
import {
  BuildingModel,
  CameraRig,
  Marker,
  ModelErrorBoundary,
  RoutePath,
} from "@/components/map/BuildingScene";
import { useBuildingModel } from "@/components/map/buildingModel";

function MapUnavailable({ modelUrl }: { modelUrl: string }) {
  return (
    <div
      role="alert"
      className="grid h-full place-content-center gap-3 p-8 text-center"
    >
      <p>This building's map isn't available on this kiosk right now.</p>
      {import.meta.env.DEV && (
        // A model missing from the models folder (or not yet exported) is
        // the usual cause. Tell developers exactly which file is missing.
        <p className="max-w-md text-xs text-[#718398]">
          Missing or unreadable model file <code>{modelUrl}</code>. Copy it into{" "}
          <code>frontend/client/public/models/</code> and run{" "}
          <code>npm run models:check</code> (see docs/setup/building-models.md).
        </p>
      )}
      <button className="underline" onClick={() => window.location.reload()}>
        Reload map
      </button>
    </div>
  );
}

function Scene({
  building,
  view,
  destination,
  resetKey,
}: {
  building: BuildingConfig;
  view: MapView;
  destination: Destination | null;
  resetKey: number;
}) {
  const prepared = useBuildingModel(building);
  const onKioskFloor =
    view.mode === "building" || view.floor === building.kioskFloor;
  const leg = routeLegInView(building, view, destination);
  const legs = destination ? destinationLegs(building, destination) : [];
  // Legs are rebuilt on each render for single-floor routes, so match by floor.
  const next = leg
    ? legs[legs.findIndex(item => item.floor === leg.floor) + 1]
    : undefined;
  const nextFloor = next
    ? building.model.floors.find(f => f.object === next.floor)
    : undefined;
  return (
    <>
      <BuildingModel prepared={prepared} building={building} view={view} />
      <CameraRig
        prepared={prepared}
        building={building}
        view={view}
        resetKey={resetKey}
      />
      {onKioskFloor && (
        <Marker point={building.start} label="You are here" color="#17365d" />
      )}
      {leg && destination && (
        <>
          <RoutePath points={leg.points} color={destination.color} />
          {/* The destination, or where the route changes floor. */}
          <Marker
            point={leg.points[leg.points.length - 1]}
            label={nextFloor ? `Go to ${nextFloor.label}` : destination.code}
            color={destination.color}
          />
        </>
      )}
    </>
  );
}

/** Movement (px) under which a press on the map counts as a tap. */
const TAP_SLOP = 6;

export function BuildingFloorMap({
  building,
  destination,
}: {
  building: BuildingConfig;
  destination: Destination | null;
}) {
  const [view, setView] = useState<MapView>(BUILDING_VIEW);
  const [resetKey, setResetKey] = useState(0);
  // Picking a destination opens its floor (adjusting state during render,
  // when the destination prop changes).
  // Keyed on the route too: a live room first arrives without its route, then
  // again with it, and the map should move to where the route starts.
  const shownKey = destination
    ? `${destination.id}:${destination.legs ? "route" : ""}`
    : null;
  const [shownFor, setShownFor] = useState(shownKey);
  if (shownKey !== shownFor) {
    setShownFor(shownKey);
    if (destination)
      setView({ mode: "floor", floor: firstFloorFor(building, destination) });
  }
  const press = useRef<{ x: number; y: number } | null>(null);
  const floors = [...building.model.floors].reverse();
  const openBuilding = () =>
    setView({ mode: "floor", floor: building.kioskFloor });

  return (
    <div
      className="relative h-full min-h-[320px] w-full"
      aria-label={`${viewLabel(building, view)} map${destination ? `, route to ${destination.code}` : ""}`}
      onPointerDown={e => {
        press.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={e => {
        // Tapping the building (not dragging it) opens it, per the kiosk plan.
        const start = press.current;
        press.current = null;
        if (
          view.mode === "building" &&
          start &&
          e.target instanceof HTMLCanvasElement &&
          Math.hypot(e.clientX - start.x, e.clientY - start.y) < TAP_SLOP
        )
          openBuilding();
      }}
    >
      <ModelErrorBoundary
        key={`${building.id}:${building.modelUrl}`}
        fallback={<MapUnavailable modelUrl={building.modelUrl} />}
      >
        <Canvas
          orthographic
          camera={{
            position: building.camera.position,
            zoom: 10,
            near: building.camera.near,
            far: building.camera.far,
          }}
          dpr={[1, 1.5]}
          frameloop="demand"
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
                  Loading {building.name}…
                </div>
              </Html>
            }
          >
            <Scene
              building={building}
              view={view}
              destination={destination}
              resetKey={resetKey}
            />
          </Suspense>
          <OrbitControls makeDefault enableDamping={false} />
        </Canvas>
      </ModelErrorBoundary>
      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <span className="rounded-lg bg-white/95 px-3 py-2 text-xs font-bold shadow">
          {viewLabel(building, view)}
        </span>
        <button
          onClick={() => setResetKey(k => k + 1)}
          className="rounded-lg bg-white px-3 py-2 text-xs font-bold shadow"
        >
          Reset view
        </button>
      </div>
      <nav
        aria-label="Floors"
        className="absolute right-4 top-16 z-20 flex flex-col gap-1 rounded-xl bg-white/95 p-1.5 shadow"
      >
        <button
          aria-pressed={view.mode === "building"}
          aria-label="Whole building"
          title="Whole building"
          onClick={() => setView(BUILDING_VIEW)}
          className={cn(
            "grid size-10 place-items-center rounded-lg text-[#17365d]",
            view.mode === "building" && "bg-[#17365d] text-white"
          )}
        >
          <Building2 size={18} />
        </button>
        {floors.map(floor => {
          const current = view.mode === "floor" && view.floor === floor.object;
          const here = floor.object === building.kioskFloor;
          return (
            <button
              key={floor.object}
              aria-pressed={current}
              aria-label={`${floor.name}${here ? " (you are here)" : ""}`}
              title={floor.name}
              onClick={() => setView({ mode: "floor", floor: floor.object })}
              className={cn(
                "relative grid size-10 place-items-center rounded-lg text-xs font-bold text-[#17365d]",
                current && "bg-[#17365d] text-white"
              )}
            >
              {floor.label}
              {here && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 size-1.5 rounded-full bg-[#f4c542]"
                />
              )}
            </button>
          );
        })}
      </nav>
      <p className="absolute bottom-4 left-4 z-20 rounded-lg bg-white/95 px-3 py-2 text-xs text-[#52657a]">
        {view.mode === "building"
          ? "Tap the building to look inside · Drag to turn · Pinch or scroll to zoom"
          : "Drag to turn · Pinch or scroll to zoom · Two fingers or right-drag to pan"}
      </p>
    </div>
  );
}
