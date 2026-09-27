/* The campus around the kiosk's building: nearby streets, buildings and
 * trees in low detail, neighbouring campus buildings in full, and names.
 * Everything is in the kiosk building's model coordinates. */
import { Suspense, useMemo } from "react";
import { Html, useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { CampusConfig, CampusNeighbour, Point3 } from "@/data/navigation";
import { DRACO_DECODER_PATH } from "@/data/models";
import { LABEL_Z_RANGE } from "@/lib/mapView";
import { useLiveBuilding } from "@/lib/liveModel";
import { ModelErrorBoundary } from "./BuildingScene";

/** Movement (px) under which a press on a building counts as a tap. */
const TAP_PX = 6;

function Placed({
  url,
  position = [0, 0, 0],
  rotationY = 0,
  onTap,
}: {
  url: string;
  position?: Point3;
  rotationY?: number;
  /** Tapping the model (not dragging the map over it). */
  onTap?: () => void;
}) {
  const { scene } = useGLTF(url, DRACO_DECODER_PATH);
  // A copy per map, so the cached model can be shown by several canvases.
  const copy = useMemo(() => scene.clone(true), [scene]);
  return (
    <primitive
      object={copy}
      position={position}
      rotation={[0, rotationY, 0]}
      onClick={
        onTap
          ? (event: ThreeEvent<MouseEvent>) => {
              if (event.delta > TAP_PX) return;
              event.stopPropagation();
              onTap();
            }
          : undefined
      }
      onPointerOver={
        onTap ? () => (document.body.style.cursor = "pointer") : undefined
      }
      onPointerOut={onTap ? () => (document.body.style.cursor = "") : undefined}
    />
  );
}

/** A neighbouring building: its live model (Asset Management), else the
 * bundled one. */
function Neighbour({
  item,
  onTap,
}: {
  item: CampusNeighbour;
  onTap?: () => void;
}) {
  const configured = useMemo(
    () => ({ areaCode: item.areaCode ?? "", modelUrl: item.modelUrl }),
    [item.areaCode, item.modelUrl]
  );
  const { building, pending, onModelError } = useLiveBuilding(configured);
  if (pending) return null;
  return (
    <ModelErrorBoundary
      key={building.modelUrl}
      fallback={null}
      onError={onModelError}
    >
      <Suspense fallback={null}>
        <Placed
          url={building.modelUrl}
          position={item.position}
          rotationY={item.rotationY}
          onTap={onTap}
        />
      </Suspense>
    </ModelErrorBoundary>
  );
}

function Label({
  at,
  text,
  main,
  onTap,
}: {
  at: Point3;
  text: string;
  main?: boolean;
  /** A label that opens its building. */
  onTap?: () => void;
}) {
  if (onTap)
    return (
      <Html position={at} center zIndexRange={LABEL_Z_RANGE}>
        <button
          onClick={onTap}
          className="block whitespace-nowrap rounded-lg border border-[#17365d] bg-white px-3 py-1 text-xs font-bold text-[#17365d] shadow hover:bg-[#eef3f7]"
        >
          {text} ›
        </button>
      </Html>
    );
  return (
    <Html
      position={at}
      center
      zIndexRange={LABEL_Z_RANGE}
      style={{ pointerEvents: "none" }}
    >
      <span
        className={
          main
            ? "block whitespace-nowrap rounded-lg bg-[#17365d] px-3 py-1 text-xs font-bold text-white shadow"
            : "block whitespace-nowrap rounded-lg border bg-white px-3 py-1 text-xs font-bold text-[#17365d] shadow"
        }
      >
        {text}
      </span>
    </Html>
  );
}

/** Shown only in the campus view; loads on its own, so a missing campus
 * model never takes the building map down with it. */
export function CampusScene({
  campus,
  buildingName,
  visible,
  onPickNeighbour,
}: {
  campus: CampusConfig;
  buildingName: string;
  visible: boolean;
  /** Tapping a neighbouring building (or its name) opens it, by area code. */
  onPickNeighbour?: (areaCode: string) => void;
}) {
  const pick = (item: CampusNeighbour) =>
    visible && onPickNeighbour && item.areaCode
      ? () => onPickNeighbour(item.areaCode!)
      : undefined;
  // The area model an admin made live in Asset Management, else the bundled one.
  const configured = useMemo(
    () => ({ areaCode: campus.areaCode, modelUrl: campus.modelUrl }),
    [campus.areaCode, campus.modelUrl]
  );
  const { building: area, pending, onModelError } = useLiveBuilding(configured);
  return (
    <ModelErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <group visible={visible}>
          {!pending && (
            // Keyed by URL: after a failed live file, the bundled one loads.
            <ModelErrorBoundary
              key={area.modelUrl}
              fallback={null}
              onError={onModelError}
            >
              <Suspense fallback={null}>
                <Placed url={area.modelUrl} />
              </Suspense>
            </ModelErrorBoundary>
          )}
          {campus.neighbours.map(item => (
            <Neighbour key={item.name} item={item} onTap={pick(item)} />
          ))}
        </group>
        {visible && (
          <>
            <Label at={campus.labelAt} text={buildingName} main />
            {campus.neighbours.map(item => (
              <Label
                key={item.name}
                at={item.labelAt}
                text={item.name}
                onTap={pick(item)}
              />
            ))}
            {campus.landmarks.map(item => (
              <Label key={item.name} at={item.at} text={item.name} />
            ))}
          </>
        )}
      </Suspense>
    </ModelErrorBoundary>
  );
}
