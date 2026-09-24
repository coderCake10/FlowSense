import type { BuildingConfig, Destination } from "@/data/navigation";
import { projectRoute } from "@/lib/routeSketch";

const FRAME = { width: 320, height: 200, padding: 18 };

/** Top-down sketch of one stop's route, framed on the whole building's routes. */
export function RouteSketch({
  building,
  destination,
}: {
  building: BuildingConfig;
  destination: Destination;
}) {
  const framePoints = [
    building.start,
    ...building.destinations.flatMap(item => item.points),
  ];
  const route = projectRoute(destination.points, framePoints, FRAME);
  const [start] = projectRoute([building.start], framePoints, FRAME);
  const end = route[route.length - 1];
  return (
    <svg
      viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      role="img"
      aria-label={`Route sketch from the ${building.startLabel.toLowerCase()} to ${destination.code}`}
      className="h-auto w-full rounded-xl border border-[#dbe3ed] bg-[#f7f9fc]"
    >
      <polyline
        points={route.map(point => point.join(",")).join(" ")}
        fill="none"
        stroke="white"
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={route.map(point => point.join(",")).join(" ")}
        fill="none"
        stroke={destination.color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={start[0]} cy={start[1]} r={7} fill="#17365d" />
      <circle cx={end[0]} cy={end[1]} r={7} fill={destination.color} />
      <circle cx={end[0]} cy={end[1]} r={3} fill="white" />
    </svg>
  );
}
