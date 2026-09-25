import { describe, expect, it } from "vitest";
import { describeOs, kioskDeviceId } from "./kioskDevice";

describe("kiosk device", () => {
  it("keeps one stable kiosk ID in the backend's accepted format", () => {
    const id = kioskDeviceId();
    expect(id).toMatch(/^kiosk-[a-z0-9-]{8,64}$/);
    expect(kioskDeviceId()).toBe(id);
  });

  it("names the operating system from the user agent", () => {
    expect(describeOs("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15")).toBe("iPadOS 17.5");
    expect(describeOs("Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36")).toBe("Android 14");
    expect(describeOs("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Windows");
  });
});
