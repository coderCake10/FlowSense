/* Map Annotation's building editing (step 14): a floor's names and walking
 * height, adding a floor or a room, removing a room, and adding a building.
 * Saved straight away; the kiosk shows them from its next load. */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCampusEdits, type AnnotationFloor } from "@/lib/annotationApi";

/** One floor's names (what the kiosk shows) and walking height, and adding
 * the next floor. */
export function FloorSettings({
  areaId,
  floor,
  floors,
  defaults,
  heightEditable,
}: {
  areaId: number;
  floor: AnnotationFloor;
  floors: AnnotationFloor[];
  /** What the kiosk shows now: its label, name and walking height. */
  defaults: { label: string; name: string; elevation: number };
  /** Buildings added from the admin panel: their walking heights come from
   * here (the bundled buildings' are measured and kept with the app). */
  heightEditable: boolean;
}) {
  const edits = useCampusEdits();
  const [shortName, setShortName] = useState(
    floor.short_name ?? defaults.label
  );
  const [name, setName] = useState(floor.display_name ?? defaults.name);
  const [height, setHeight] = useState(String(defaults.elevation));
  const next = Math.max(0, ...floors.map(f => f.floor_order)) + 1;
  return (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
        <label className="text-[#52657a]">
          Button
          <Input
            aria-label="Floor button label"
            value={shortName}
            onChange={e => setShortName(e.target.value)}
            className="mt-1 h-8 text-xs"
          />
        </label>
        <label className="text-[#52657a]">
          Name
          <Input
            aria-label="Floor name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1 h-8 text-xs"
          />
        </label>
      </div>
      {heightEditable && (
        <label className="flex items-center gap-2 text-[#52657a]">
          Walking height (m)
          <Input
            aria-label="Walking height (m)"
            type="number"
            step={0.01}
            value={height}
            onChange={e => setHeight(e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </label>
      )}
      {heightEditable && (
        <p className="text-[11px] text-[#718398]">
          The top of this floor's slab in the model: clicks and points sit on
          it. Making a new model version live resets it to the model's lowest
          point on this floor, so check it after.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={edits.editFloor.isPending}
          onClick={() =>
            edits.editFloor.mutate(
              {
                id: floor.id,
                short_name: shortName.trim(),
                display_name: name.trim(),
                ...(heightEditable ? { elevation: Number(height) } : {}),
              },
              { onSuccess: () => toast.success("Floor saved.") }
            )
          }
          className="bg-[#17365d] text-white"
        >
          Save floor
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={edits.addFloor.isPending}
          onClick={() =>
            edits.addFloor.mutate(
              { area: areaId, floor_order: next },
              {
                onSuccess: () =>
                  toast.success(
                    `Floor ${next} added (model group FLOOR_${next}). Upload a model that has it.`
                  ),
              }
            )
          }
        >
          Add floor {next}
        </Button>
      </div>
    </div>
  );
}

/** Adds a room on the floor shown (then place its door as usual). */
export function AddRoomForm({ floorId }: { floorId: number }) {
  const edits = useCampusEdits();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  return (
    <form
      className="mt-3 space-y-2 border-t border-[#dbe3ed] pt-3 text-xs"
      onSubmit={event => {
        event.preventDefault();
        if (!code.trim()) return;
        edits.addRoom.mutate(
          { floor: floorId, room_code: code.trim(), room_alias: name.trim() },
          {
            onSuccess: () => {
              toast.success(
                `${code.trim()} added. Pick it above to place its door.`
              );
              setCode("");
              setName("");
            },
          }
        );
      }}
    >
      <p className="font-semibold text-[#17365d]">Add a room</p>
      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
        <Input
          aria-label="New room number"
          placeholder="e.g. B-101"
          value={code}
          onChange={e => setCode(e.target.value)}
          className="h-8 text-xs"
        />
        <Input
          aria-label="New room name"
          placeholder="Name (optional)"
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={!code.trim() || edits.addRoom.isPending}
      >
        Add room
      </Button>
    </form>
  );
}

/** Removes a room (its door point stays, as a plain point). */
export function RemoveRoomButton({
  roomId,
  code,
  onRemoved,
}: {
  roomId: number;
  code: string;
  onRemoved: () => void;
}) {
  const edits = useCampusEdits();
  return (
    <button
      onClick={() => {
        if (!window.confirm(`Remove ${code}? The kiosk stops listing it.`))
          return;
        edits.removeRoom.mutate(roomId, {
          onSuccess: () => {
            toast.success(`${code} removed.`);
            onRemoved();
          },
        });
      }}
      className="mt-2 text-xs text-[#b13a36] underline"
    >
      Remove this room
    </button>
  );
}

/** A new building: its code, name and floors. Its model comes next, in
 * Asset Management. */
export function AddBuildingDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const edits = useCampusEdits();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [floors, setFloors] = useState("3");
  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent className="bg-white text-[#17365d] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a building</DialogTitle>
          <DialogDescription>
            Then upload its 3D model in Asset Management (linked to this
            building, with floor groups FLOOR_1, FLOOR_2, …) and make it live.
            It shows here and in the kiosk; place it on the campus, add its
            rooms and draw its routes.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3 text-sm"
          onSubmit={event => {
            event.preventDefault();
            edits.addBuilding.mutate(
              { code: code.trim(), name: name.trim(), floors: Number(floors) },
              {
                onSuccess: () => {
                  toast.success(
                    `${name.trim()} added. Next: upload its model in Asset Management.`
                  );
                  setCode("");
                  setName("");
                  onClose();
                },
              }
            );
          }}
        >
          <label className="block">
            Name
            <Input
              aria-label="Building name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. B Building"
              className="mt-1"
            />
          </label>
          <label className="block">
            Short code
            <Input
              aria-label="Building code"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="e.g. B (used in sensor topics)"
              className="mt-1"
            />
          </label>
          <label className="block">
            Floors
            <Input
              aria-label="Number of floors"
              type="number"
              min={1}
              max={50}
              value={floors}
              onChange={e => setFloors(e.target.value)}
              className="mt-1 w-24"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !code.trim() ||
                !name.trim() ||
                Number(floors) < 1 ||
                edits.addBuilding.isPending
              }
              className="bg-[#17365d] text-white"
            >
              Add building
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
