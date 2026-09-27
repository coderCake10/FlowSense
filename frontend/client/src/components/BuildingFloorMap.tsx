import { Suspense, useEffect, useRef, useState } from "react";
import { Building2, Map as MapIcon, Pause, Play } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import type { BuildingConfig, Destination } from "@/data/navigation";
import { useBuildingRegistry } from "@/lib/buildingRegistry";
import {
  BUILDING_VIEW,
  CAMPUS_VIEW,
  campusHost,
  destinationLegs,
  firstViewFor,
  LABEL_Z_RANGE,
  legEndLabel,
  legInView,
  legSeconds,
  legView,
  routeLegInView,
  routeStepInView,
  viewKey,
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
import { CampusScene } from "@/components/map/CampusScene";
import { useLiveBuilding } from "@/lib/liveModel";

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
  onPickBuilding,
  registry,
}: {
  /** The building shown. */
  building: BuildingConfig;
  /** Every building (their placements and names). */
  registry: readonly BuildingConfig[];
  view: MapView;
  destination: Destination | null;
  resetKey: number;
  onPickBuilding?: (areaCode: string) => void;
}) {
  const prepared = useBuildingModel(building);
  const onKioskFloor =
    view.mode !== "floor" || view.floor === building.kioskFloor;
  const leg = routeLegInView(building, view, destination);
  const legs = destination ? destinationLegs(building, destination) : [];
  // Legs are rebuilt on each render for single-floor routes, so match by
  // building and floor.
  const next = leg
    ? legs[legs.findIndex(item => legInView(item, building, view)) + 1]
    : undefined;
  return (
    <>
      <BuildingModel prepared={prepared} building={building} view={view} />
      {building.campus && (
        <CampusScene
          campus={building.campus}
          buildingName={building.name}
          visible={view.mode === "campus"}
          onPickNeighbour={onPickBuilding}
        />
      )}
      <CameraRig
        prepared={prepared}
        building={building}
        view={view}
        resetKey={resetKey}
      />
      {onKioskFloor && (!building.placement || building.startLabel) && (
        // The kiosk's own building: "You are here"; another building: where
        // routes into it arrive (its entrance).
        <Marker
          point={building.start}
          label={building.placement ? building.startLabel : "You are here"}
          color="#17365d"
        />
      )}
      {leg && destination && (
        <>
          <RoutePath points={leg.points} color={destination.color} />
          {/* The destination, or where the route changes floor. */}
          <Marker
            point={leg.points[leg.points.length - 1]}
            label={
              next
                ? legEndLabel(leg, next, building, registry)
                : destination.code
            }
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
  building: configured,
  destination,
  playing = false,
  playKey = 0,
  onPickBuilding,
}: {
  building: BuildingConfig;
  destination: Destination | null;
  /** Following on the kiosk: a multi-floor route plays floor by floor,
   * then starts again, until the visitor takes over the map. */
  playing?: boolean;
  /** A new value plays the route again from its first floor. */
  playKey?: number;
  /** The visitor tapped another building in the campus view (its id). */
  onPickBuilding?: (id: string) => void;
}) {
  const { buildings } = useBuildingRegistry();
  const [view, setView] = useState<MapView>(BUILDING_VIEW);
  // The building shown: the one picked, another one a route leg is in, or
  // the campus's host (its model's coordinates are the campus's).
  const host = campusHost(buildings);
  const shownConfig =
    view.mode === "campus"
      ? host
      : (view.building && buildings.find(item => item.id === view.building)) ||
        configured;
  // The model activated in Asset Management, else the bundled one.
  const { building, pending, onModelError } = useLiveBuilding(shownConfig);
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
    if (destination) setView(firstViewFor(configured, destination));
  }
  // Playback: restarts from the first floor when playKey changes; the
  // visitor pressing Next, Back or a floor pauses it.
  const [paused, setPaused] = useState(false);
  const [playedKey, setPlayedKey] = useState(playKey);
  if (playKey !== playedKey) {
    setPlayedKey(playKey);
    setPaused(false);
    if (destination) setView(firstViewFor(configured, destination));
  }
  const autoplay = playing && !paused;
  // Worked out as plain values, so re-rendering the same route (the kiosk
  // re-creates it) doesn't restart the timer.
  const playLegs = destination
    ? destinationLegs(configured, destination).filter(
        leg => leg.points.length >= 2
      )
    : [];
  const shownFloor = viewKey(view, shownConfig.id);
  const legKey = (index: number) => {
    const leg = playLegs[index];
    const legShown = legView(leg, configured);
    return viewKey(
      legShown,
      legShown.mode === "campus" ? host.id : (leg.building ?? configured.id)
    );
  };
  const at = playLegs.findIndex((_, index) => legKey(index) === shownFloor);
  const playNextIndex =
    playLegs.length < 2 ? -1 : at < 0 ? 0 : (at + 1) % playLegs.length;
  const playNext = playNextIndex < 0 ? null : legKey(playNextIndex);
  const playWait =
    at < 0 ? 500 : Math.round(legSeconds(playLegs[at].points) * 1000);
  const routeKey = destination
    ? `${destination.id}:${destination.routeId ?? ""}`
    : "";
  useEffect(() => {
    if (!autoplay || !playNext) return;
    const [shown, floor] = playNext.split("|");
    const timer = setTimeout(
      () =>
        setView(
          floor === "campus"
            ? CAMPUS_VIEW
            : shown === configured.id
              ? { mode: "floor", floor }
              : { mode: "floor", floor, building: shown }
        ),
      playWait
    );
    return () => clearTimeout(timer);
  }, [autoplay, playNext, playWait, shownFloor, routeKey, configured.id]);
  /** The visitor chose a view: stop playing the route. */
  const choose = (next: MapView) => {
    setView(next);
    if (playing) setPaused(true);
  };
  const press = useRef<{ x: number; y: number } | null>(null);
  const floors = [...building.model.floors].reverse();
  // Views of the building shown (it may not be the one picked).
  const inShown = <V extends MapView>(next: V): V =>
    shownConfig.id === configured.id
      ? next
      : { ...next, building: shownConfig.id };
  const openBuilding = () =>
    setView(inShown({ mode: "floor", floor: building.kioskFloor }));
  // Tapping a building in the campus view opens it: the one picked in its
  // whole-building view, another one through the kiosk's building list.
  const tappedBuilding = useRef(false);
  const pickByArea = (areaCode: string) => {
    const picked = buildings.find(item => item.areaCode === areaCode);
    if (!picked) return;
    tappedBuilding.current = true;
    if (picked.id === configured.id || !onPickBuilding) choose(BUILDING_VIEW);
    else onPickBuilding(picked.id);
  };
  const step = routeStepInView(
    building,
    view,
    destination,
    buildings,
    configured
  );

  return (
    <div
      className="relative h-full min-h-[320px] w-full"
      aria-label={`${viewLabel(building, view)} map${destination ? `, route to ${destination.code}` : ""}`}
      onPointerDown={e => {
        press.current = { x: e.clientX, y: e.clientY };
      }}
      // A click, not pointer-up: the map's own handlers (a building tapped
      // in the campus view) run first and say whether they took the tap.
      onClick={e => {
        // Tapping the building (not dragging it) opens it, per the kiosk plan.
        const start = press.current;
        press.current = null;
        if (tappedBuilding.current) {
          tappedBuilding.current = false;
          return;
        }
        const tapped =
          start &&
          e.target instanceof HTMLCanvasElement &&
          Math.hypot(e.clientX - start.x, e.clientY - start.y) < TAP_SLOP;
        if (!tapped) return;
        // Campus: tapping goes to the building picked; building: into its
        // floor.
        if (view.mode === "campus") setView(BUILDING_VIEW);
        else if (view.mode === "building") openBuilding();
      }}
    >
      {pending ? (
        <p
          role="status"
          className="grid h-full place-content-center text-sm text-[#718398]"
        >
          Loading the map…
        </p>
      ) : (
        <ModelErrorBoundary
          key={`${building.id}:${building.modelUrl}`}
          fallback={<MapUnavailable modelUrl={building.modelUrl} />}
          onError={onModelError}
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
                onPickBuilding={pickByArea}
                registry={buildings}
              />
            </Suspense>
            <OrbitControls makeDefault enableDamping={false} />
          </Canvas>
        </ModelErrorBoundary>
      )}
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
        {host.campus && (
          <button
            aria-pressed={view.mode === "campus"}
            aria-label="Campus"
            title="Campus"
            onClick={() => choose(CAMPUS_VIEW)}
            className={cn(
              "grid size-10 place-items-center rounded-lg text-[#17365d]",
              view.mode === "campus" && "bg-[#17365d] text-white"
            )}
          >
            <MapIcon size={18} />
          </button>
        )}
        <button
          aria-pressed={view.mode === "building"}
          aria-label="Whole building"
          title="Whole building"
          onClick={() =>
            choose(
              view.mode === "campus" ? BUILDING_VIEW : inShown(BUILDING_VIEW)
            )
          }
          className={cn(
            "grid size-10 place-items-center rounded-lg text-[#17365d]",
            view.mode === "building" && "bg-[#17365d] text-white"
          )}
        >
          <Building2 size={18} />
        </button>
        {floors.map(floor => {
          const current = view.mode === "floor" && view.floor === floor.object;
          const here =
            !building.placement && floor.object === building.kioskFloor;
          return (
            <button
              key={floor.object}
              aria-pressed={current}
              aria-label={`${floor.name}${here ? " (you are here)" : ""}`}
              title={floor.name}
              onClick={() =>
                choose(inShown({ mode: "floor", floor: floor.object }))
              }
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
      {step && (
        <section
          aria-label="Route steps"
          className="absolute left-4 top-4 z-20 w-72 max-w-[calc(100%-7rem)] rounded-xl bg-white/95 p-3 shadow"
        >
          <p className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide text-[#2f6fdf]">
            <span>
              Step {step.step} of {step.count} · {step.floorName}
            </span>
            {playing && (
              <button
                onClick={() => setPaused(p => !p)}
                aria-label={paused ? "Play the route" : "Pause the route"}
                className="flex items-center gap-1 rounded-md border border-[#dbe3ed] px-2 py-0.5 normal-case tracking-normal text-[#17365d]"
              >
                {paused ? <Play size={12} /> : <Pause size={12} />}
                {paused ? "Play" : "Pause"}
              </button>
            )}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#17365d]">
            {step.instruction}
          </p>
          {destination?.notices?.map(notice => (
            <p
              key={notice}
              role="note"
              className="mt-1 rounded-md bg-[#fdf3d0] px-2 py-1 text-xs font-semibold text-[#7a5a00]"
            >
              {notice}
            </p>
          ))}
          <div className="mt-2 flex gap-2">
            {step.previous && (
              <button
                onClick={() => choose(step.previous!.view)}
                className="rounded-lg border border-[#dbe3ed] px-3 py-1.5 text-xs font-bold text-[#17365d]"
              >
                Back: {step.previous.name}
              </button>
            )}
            {step.next && (
              <button
                onClick={() => choose(step.next!.view)}
                className="rounded-lg bg-[#17365d] px-3 py-1.5 text-xs font-bold text-white"
              >
                Next: {step.next.name} →
              </button>
            )}
          </div>
        </section>
      )}
      <p className="absolute bottom-4 left-4 z-20 rounded-lg bg-white/95 px-3 py-2 text-xs text-[#52657a]">
        {view.mode === "campus"
          ? `Tap to look at the ${configured.name}, or a building's name to open it · Drag to turn · Pinch or scroll to zoom`
          : view.mode === "building"
            ? "Tap the building to look inside · Drag to turn · Pinch or scroll to zoom"
            : "Drag to turn · Pinch or scroll to zoom · Two fingers or right-drag to pan"}
      </p>
    </div>
  );
}
