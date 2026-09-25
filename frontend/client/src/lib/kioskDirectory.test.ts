import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Destination } from "@/data/navigation";

const post = vi.fn();
vi.mock("./api", async importOriginal => ({
  ...(await importOriginal<typeof import("./api")>()),
  apiClient: { post: (...args: unknown[]) => post(...args) },
}));

const { shortestWalkOrder } = await import("./kioskDirectory");

const room = (code: string, nodeId: number | null): Destination => ({
  id: `room-${code}`,
  name: code,
  code,
  color: "#2563EB",
  points: [],
  building: "EYA Building",
  floor: "First floor",
  nodeId,
});

describe("shortestWalkOrder", () => {
  beforeEach(() => post.mockReset());

  it("puts mapped stops in the order the Navigation API returns, unmapped ones last", async () => {
    post.mockResolvedValue({
      destinations: [
        { destination_order: 2, node: { id: 30 } },
        { destination_order: 1, node: { id: 10 } },
        { destination_order: 3, node: { id: 20 } },
      ],
    });
    const queue = [
      room("A", 20),
      room("X", null),
      room("B", 10),
      room("C", 30),
    ];
    const ordered = await shortestWalkOrder(5, queue);
    expect(ordered?.map(item => item.code)).toEqual(["B", "C", "A", "X"]);
    expect(post).toHaveBeenCalledWith("/navigation/routes", {
      origin_node_id: 5,
      destination_node_ids: [20, 10, 30],
      optimize_order: true,
    });
  });

  it("leaves the queue alone without a kiosk position or with fewer than two mapped stops", async () => {
    expect(
      await shortestWalkOrder(null, [room("A", 1), room("B", 2)])
    ).toBeNull();
    expect(
      await shortestWalkOrder(5, [room("A", 1), room("X", null)])
    ).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });
});
