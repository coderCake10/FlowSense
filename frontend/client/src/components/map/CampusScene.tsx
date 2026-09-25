/* The campus around the kiosk's building: nearby streets, buildings and
 * trees in low detail, neighbouring campus buildings in full, and names.
 * Everything is in the kiosk building's model coordinates. */
import { Suspense, useMemo } from "react";
import { Html, useGLTF } from "@react-three/drei";
import type { CampusConfig, Point3 } from "@/data/navigation";
import { DRACO_DECODER_PATH } from "@/data/models";
import { LABEL_Z_RANGE } from "@/lib/mapView";
import { ModelErrorBoundary } from "./BuildingScene";

function Placed({
  url,
  position = [0, 0, 0],
  rotationY = 0,
}: {
  url: string;
  position?: Point3;
  rotationY?: number;
}) {
  const { scene } = useGLTF(url, DRACO_DECODER_PATH);
  // A copy per map, so the cached model can be shown by several canvases.
  const copy = useMemo(() => scene.clone(true), [scene]);
  return (
    <primitive object={copy} position={position} rotation={[0, rotationY, 0]} />
  );
}

function Label({
  at,
  text,
  main,
}: {
  at: Point3;
  text: string;
  main?: boolean;
}) {
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
}: {
  campus: CampusConfig;
  buildingName: string;
  visible: boolean;
}) {
  return (
    <ModelErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <group visible={visible}>
          <Placed url={campus.modelUrl} />
          {campus.neighbours.map(item => (
            <Placed
              key={item.name}
              url={item.modelUrl}
              position={item.position}
              rotationY={item.rotationY}
            />
          ))}
        </group>
        {visible && (
          <>
            <Label at={campus.labelAt} text={buildingName} main />
            {campus.neighbours.map(item => (
              <Label key={item.name} at={item.labelAt} text={item.name} />
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
