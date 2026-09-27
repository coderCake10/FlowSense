import { describe, expect, it } from "vitest";
import type { AssetItem, AssetVersion } from "@/lib/assetsApi";
import { activationBlocker, downloadHref, versionState } from "./helpers";

const version = (
  id: number,
  fields: Partial<AssetVersion> = {}
): AssetVersion =>
  ({
    id,
    asset_id: 1,
    version: id,
    filename: "EYA.glb",
    processing_status: "completed",
    validation: {
      id: id * 10,
      asset_version_id: id,
      version: id,
      result: "passed",
      summary: "16 passed, 0 warnings, 0 errors",
      counts: { passed: 16, warnings: 0, errors: 0 },
      validated_by: null,
      created_at: "",
    },
    download_url: `/api/v1/assets/1/versions/${id}/download`,
    ...fields,
  }) as AssetVersion;

const asset = (active: number | null, latest: AssetVersion): AssetItem =>
  ({ id: 1, active_version_id: active, latest_version: latest }) as AssetItem;

describe("versionState", () => {
  const latest = version(3);
  it("names the live, newest, failed, in-progress and older versions", () => {
    const item = asset(1, latest);
    expect(versionState(item, version(1))).toBe("Active");
    expect(versionState(item, latest)).toBe("Ready to activate");
    expect(versionState(item, version(2))).toBe("Archived");
    expect(
      versionState(item, version(4, { processing_status: "processing" }))
    ).toBe("Processing");
    expect(
      versionState(
        item,
        version(5, { validation: { ...latest.validation!, result: "failed" } })
      )
    ).toBe("Failed");
  });
});

describe("activationBlocker", () => {
  it("allows a processed version that passed or only warned", () => {
    const v = version(2);
    expect(activationBlocker(asset(1, v), v)).toBeNull();
    const warned = version(3, {
      validation: { ...v.validation!, result: "warning" },
    });
    expect(activationBlocker(asset(1, warned), warned)).toBeNull();
  });

  it("explains why a version can't go live", () => {
    const v = version(2);
    expect(activationBlocker(asset(2, v), v)).toMatch(/already live/);
    expect(activationBlocker(asset(null, v), null)).toMatch(/Upload/);
    expect(
      activationBlocker(
        asset(null, v),
        version(3, { processing_status: "pending" })
      )
    ).toMatch(/being checked/);
    expect(
      activationBlocker(asset(null, v), version(4, { validation: null }))
    ).toMatch(/Run validation/);
    expect(
      activationBlocker(
        asset(null, v),
        version(5, { validation: { ...v.validation!, result: "failed" } })
      )
    ).toMatch(/failed/);
  });
});

describe("downloadHref", () => {
  it("keeps the API's path under this app's API base", () => {
    expect(downloadHref(version(7))).toBe(
      "/api/v1/assets/1/versions/7/download"
    );
  });
});
