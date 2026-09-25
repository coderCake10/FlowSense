import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient, describeApiError } from "./api";

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }))
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("API envelope (OpenAPI contract)", () => {
  it("returns the data of a success envelope", async () => {
    respond(200, { success: true, data: { id: 3, name: "Kiosk" }, message: null });
    await expect(apiClient.get("/hardware/devices/3")).resolves.toEqual({ id: 3, name: "Kiosk" });
  });

  it("returns rows and meta for a paginated list", async () => {
    const meta = { page: 1, page_size: 25, total_count: 2, total_pages: 1 };
    respond(200, { success: true, data: [{ id: 1 }, { id: 2 }], meta });
    await expect(apiClient.getPage("/alerts")).resolves.toEqual({ results: [{ id: 1 }, { id: 2 }], meta });
  });

  it("turns an error envelope into an ApiError with the server's message", async () => {
    respond(409, { success: false, error: { code: "CONFLICT", message: "Only an unregistered device can be registered." } });
    const error = await apiClient.post("/hardware/devices/1/register").catch(e => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(describeApiError(error)).toBe("Only an unregistered device can be registered.");
  });

  it("falls back when there's no readable message", () => {
    expect(describeApiError(new Error("x"), "Fallback")).toBe("Fallback");
    expect(describeApiError(new ApiError("x", 500), "Fallback")).toBe("Fallback");
  });
});
