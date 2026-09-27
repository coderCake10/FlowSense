import { describe, expect, it } from "vitest";
import { serviceGroups, type GraphTransition } from "./annotationApi";

describe("serviceGroups", () => {
  const names: Record<number, string> = {
    1: "Elevator (1F)",
    2: "Elevator (2F)",
    3: "Front stairs (1F)",
    4: "Front stairs (2F)",
    5: "Stairs 3F",
  };
  const link = (
    id: number,
    from: number,
    type: GraphTransition["transition_type"],
    active = true
  ): GraphTransition => ({
    id,
    transition_type: type,
    from_node: from,
    to_node: null,
    active,
  });

  it("groups each staircase or elevator's floor links under one name", () => {
    const groups = serviceGroups(
      [
        link(10, 1, "elevator"),
        link(11, 2, "elevator", false),
        link(12, 3, "stairs"),
        link(13, 4, "stairs"),
        link(14, 5, "stairs"),
      ],
      id => (id === null ? undefined : names[id])
    );
    expect(groups.map(g => [g.name, g.ids, g.active])).toEqual([
      // Out of service when any of its links is off.
      ["Elevator", [10, 11], false],
      ["Front stairs", [12, 13], true],
      ["Stairs", [14], true],
    ]);
  });
});
