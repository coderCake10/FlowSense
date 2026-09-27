import { describe, expect, it } from "vitest";
import { formatBytes, formatDimensions, type AssetVersion } from "./assetsApi";
import { liveModelUrl } from "./liveModel";

describe("formatBytes", () => {
  it("uses B, KB and MB", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(682_928)).toBe("666.9 KB");
    expect(formatBytes(17_291_484)).toBe("16.5 MB");
  });
});

describe("formatDimensions", () => {
  it("shows width × height × depth in metres", () => {
    const v = {
      dimension_x: 28.46,
      dimension_y: 23.24,
      dimension_z: 71.79,
    } as AssetVersion;
    expect(formatDimensions(v)).toBe("28.5 × 23.2 × 71.8 m");
    expect(formatDimensions({ dimension_x: null } as AssetVersion)).toBe("—");
  });
});

describe("liveModelUrl", () => {
  it("serves the API's model path under this app's API base", () => {
    expect(liveModelUrl("/api/v1/assets/1/versions/4/download")).toBe(
      "/api/v1/assets/1/versions/4/download"
    );
  });
});
