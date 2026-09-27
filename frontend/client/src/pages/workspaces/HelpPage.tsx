/* Help: short procedures for the admin pages, each linking to the page it describes. */
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/FlowSenseShell";

type Guide = {
  title: string;
  steps: ReactNode[];
  page?: { href: string; label: string };
};

const guides: Guide[] = [
  {
    title: "Annotate a floor and validate route connections",
    page: { href: "/map-annotation", label: "Open Map Annotation" },
    steps: [
      "Choose the building and the floor.",
      <>
        With <b>Corridor point</b>, click along the middle of every corridor, at
        each corner and junction, in walking order.
      </>,
      <>
        For each room in <i>Rooms on this floor</i>, pick the room, choose{" "}
        <b>Room door</b>, and click the corridor side of its door.
      </>,
      <>
        At stairs and elevators, place a corridor point, then use{" "}
        <b>Stairs / elevator</b> to link it to the matching point on the next
        floor.
      </>,
      <>
        On the kiosk&apos;s floor, place the <b>Kiosk</b> point and connect it
        to the corridor.
      </>,
      "A green tick next to a room means the kiosk can route to it. Every change saves straight away.",
      <>
        The EYA Building&apos;s routes come ready-made from its 3D model. To
        adjust them: with <b>Select</b>, drag a point to move it; with{" "}
        <b>Delete</b>, click a point to remove it or a line to remove just that
        connection (or use <b>Remove</b> in <i>Selected point</i>).
      </>,
      <>
        Elevator or stairs under maintenance? Switch it off in{" "}
        <i>Stairs and elevators</i>: routes go another way and tell visitors
        it&apos;s out of service.
      </>,
    ],
  },
  {
    title: "Register an ESP32 sensor or kiosk",
    page: { href: "/hardware", label: "Open Hardware" },
    steps: [
      "Power the device on the campus network. It appears in the registry as Unregistered the first time it connects.",
      <>
        Select it and choose <b>Register</b>. Give it a name, pick its map node,
        and for sensors set the sampling interval.
      </>,
      "Once registered, the device shows Online while it reports, and Offline when it stops.",
      <>
        <b>Edit</b> changes its name, building, floor, map node or interval;
        <b> Disable</b> keeps it registered but ignored.
      </>,
    ],
  },
  {
    title: "Review alerts and hardware health",
    page: { href: "/", label: "Open the Dashboard" },
    steps: [
      "The Dashboard lists open alerts, kiosks and sensors online, and crowd density. It refreshes every 30 seconds.",
      <>
        <b>Acknowledge</b> an alert you are handling; <b>Clear</b> it once
        resolved. Informational alerts clear on their own after the time set in
        Settings.
      </>,
      "A device that stops reporting raises an alert. Open Hardware to see its last contact and readings.",
      "Analytics shows kiosk availability and sensor reliability over a chosen period.",
    ],
  },
  {
    title: "Publish a verified building asset",
    page: { href: "/assets", label: "Open Asset Management" },
    steps: [
      <>
        Export the building from Blender as glTF Binary (.glb) with Draco
        compression, one group per floor named FLOOR_1, FLOOR_2, …
      </>,
      <>
        Choose <b>Upload model</b>, pick the file and its building. For a newer
        export of a building that already has a model, open that asset and
        choose <b>Upload a new version</b>.
      </>,
      "FlowSense reads the model and runs its checks. Errors block activation; warnings don't.",
      <>
        Review the Model tab (floors found, heights) and choose <b>Make live</b>
        . The kiosk shows it from its next load, and the building&apos;s floors
        take their heights from the model.
      </>,
      <>
        To go back, use <b>Restore</b> on an earlier version in the Asset tab.
      </>,
    ],
  },
];

export function HelpPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / Help"
        title="FlowSense operations manual"
        description="Find the guidance needed to annotate maps, manage devices, and keep campus wayfinding dependable."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">Quick guides</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="space-y-3">
              {guides.map((guide, i) => (
                <AccordionItem
                  key={guide.title}
                  value={guide.title}
                  className="rounded-xl border border-[#e5ebf2] px-4 last:border-b"
                >
                  <AccordionTrigger className="text-left text-sm font-semibold text-[#17365d] hover:no-underline">
                    {i + 1}. {guide.title}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-6 text-[#52657a]">
                    {guide.steps.length > 0 && (
                      <ol className="mb-3 list-decimal space-y-1 pl-5">
                        {guide.steps.map((step, n) => (
                          <li key={n}>{step}</li>
                        ))}
                      </ol>
                    )}
                    {guide.page && (
                      <Link
                        href={guide.page.href}
                        className="inline-flex items-center gap-1 font-semibold text-[#17365d] underline-offset-4 hover:underline"
                      >
                        {guide.page.label} <ArrowUpRight size={14} />
                      </Link>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
        <Card className="border-[#dbe3ed]">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Need technical help?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-[#718398]">
            <p>
              The full system manual covers administrator procedures, MQTT
              device topics, sensor placement, and troubleshooting.
            </p>
            <p className="rounded-xl border border-dashed border-[#dbe3ed] p-4 text-[#52657a]">
              The PDF manual isn&apos;t published yet. Until it is, contact the
              FlowSense development team for help.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
