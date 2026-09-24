import { describe, expect, it } from "vitest";
import type { Destination } from "@/data/navigation";
import {
  activateQueue,
  addToQueue,
  isQueued,
  nextStop,
  removeFromQueue,
} from "./kioskQueue";

const stop = (id: string): Destination => ({
  id,
  name: `Room ${id}`,
  code: id.toUpperCase(),
  color: "#2563EB",
  points: [
    [0, 0, 0],
    [1, 0, 1],
  ],
  building: "EYA Building",
  floor: "First floor",
});
const a = stop("a");
const b = stop("b");
const c = stop("c");

describe("kiosk queue", () => {
  it("appends in order and ignores duplicates", () => {
    const queue = addToQueue(addToQueue(addToQueue([], a), b), a);
    expect(queue.map(d => d.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input", () => {
    const original = [a];
    addToQueue(original, b);
    removeFromQueue(original, "a");
    expect(original).toEqual([a]);
  });

  it("removes by id", () => {
    expect(removeFromQueue([a, b, c], "b").map(d => d.id)).toEqual(["a", "c"]);
    expect(removeFromQueue([a], "missing")).toEqual([a]);
  });

  it("reports membership", () => {
    expect(isQueued([a, b], "b")).toBe(true);
    expect(isQueued([a, b], "c")).toBe(false);
  });

  it("offers the first stop other than the current one", () => {
    expect(nextStop([a, b, c], "a")).toBe(b);
    expect(nextStop([a, b, c], "b")).toBe(a);
    expect(nextStop([a, b], null)).toBe(a);
    expect(nextStop([a], "a")).toBeNull();
    expect(nextStop([], null)).toBeNull();
  });

  describe("activateQueue (Navigate)", () => {
    it("uses the selection as the only stop when the queue is empty", () => {
      expect(activateQueue([], a)).toEqual([a]);
    });
    it("appends an unqueued selection after the queued stops", () => {
      expect(activateQueue([a, b], c).map(d => d.id)).toEqual(["a", "b", "c"]);
    });
    it("keeps order when the selection is already queued", () => {
      expect(activateQueue([a, b], b).map(d => d.id)).toEqual(["a", "b"]);
    });
    it("runs the existing queue when nothing is selected", () => {
      expect(activateQueue([a], null)).toEqual([a]);
      expect(activateQueue([], null)).toEqual([]);
    });
  });
});
