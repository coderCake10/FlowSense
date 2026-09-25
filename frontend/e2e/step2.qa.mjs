// Step 2 browser QA: kiosk → phone QR handoff and the mobile checklist.
// Usage (see docs/qa/step-02-test-report.md):
//   npx vite --host 127.0.0.1 --port 3000
//   npm run qa:step2
import { mkdirSync } from "node:fs";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = process.env.OUT ?? "e2e/output";
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (id, name, pass, detail = "") => {
  results.push({ id, name, pass: Boolean(pass), detail });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${id} ${name}${detail ? " — " + detail : ""}`
  );
};

/** Decodes the QR code actually rendered on screen. */
async function scanQr(locator) {
  const png = PNG.sync.read(await locator.screenshot());
  return (
    jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null
  );
}

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const errors = [];

// ---------------- Kiosk: QR generation ----------------
const kiosk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
kiosk.on("pageerror", e => errors.push(`kiosk: ${e.message}`));
await kiosk.goto(`${BASE}/kiosk`);
await kiosk
  .getByRole("button", { name: /Office of the Dean \(College/ })
  .click();
await kiosk.getByRole("button", { name: "Add to queue", exact: true }).click();
await kiosk.getByRole("button", { name: /Faculty Center \(College/ }).click();
await kiosk.getByRole("button", { name: /^Navigate$/ }).click();
const dialog = kiosk.getByRole("dialog");
await dialog.waitFor();
await kiosk.waitForTimeout(500); // open animation
const qr = dialog.locator("svg[data-handoff-url]");
check(
  "Q1",
  "Navigate modal shows a real QR code (no placeholder text)",
  (await qr.count()) === 1 &&
    (await dialog.getByText("isn't available yet").count()) === 0
);
const scanned = await scanQr(qr);
const expected = await qr.getAttribute("data-handoff-url");
check(
  "Q2",
  "The rendered QR scans, and encodes the handoff URL",
  scanned !== null && scanned === expected,
  scanned ?? "not decodable"
);
const url = new URL(scanned ?? "http://invalid/");
check(
  "Q3",
  "URL targets /mobile with an h= payload",
  url.pathname === "/mobile" && Boolean(url.searchParams.get("h"))
);
check(
  "Q4",
  "Modal states stop count and expiry time",
  await dialog
    .getByText(/checklist of 2 stops\. Valid until \d{1,2}:\d{2}/)
    .isVisible()
);
await kiosk.screenshot({ path: `${OUT}/step2-kiosk-qr.png` });

await dialog.getByRole("button", { name: /Remove EA-111/ }).click();
const afterRemove = await qr.getAttribute("data-handoff-url");
check(
  "Q5",
  "Removing a stop updates the QR (same session, one stop)",
  afterRemove !== expected &&
    (await dialog.getByText(/checklist of 1 stop\./).isVisible())
);
await kiosk.keyboard.press("Escape");
await dialog.waitFor({ state: "detached" });
await kiosk.getByRole("button", { name: "Queue (1)" }).click();
await dialog.waitFor();
const reopened = await qr.getAttribute("data-handoff-url");
const sid = u =>
  JSON.parse(Buffer.from(new URL(u).searchParams.get("h"), "base64url")).s;
check(
  "Q6",
  "Reopening the modal issues a new handoff session",
  sid(reopened) !== sid(afterRemove)
);
await kiosk.close();

// ---------------- Phone: checklist ----------------
const phone = await browser.newContext({ ...devices["iPhone 13"] });
const mobile = await phone.newPage();
mobile.on("pageerror", e => errors.push(`mobile: ${e.message}`));
await mobile.goto(url.toString().replace(url.origin, BASE));
await mobile.locator("main h1").waitFor();
check(
  "M1",
  "Phone opens the checklist for the first stop",
  await mobile
    .getByRole("heading", {
      name: "To Office of the Dean (College of Computer Studies)",
    })
    .isVisible()
);
// Direct children only: the current stop also lists its directions.
const stops = mobile
  .getByRole("list", { name: "Your stops" })
  .locator(":scope > li");
check(
  "M2",
  "Checklist lists both stops in queue order",
  (await stops.count()) === 2 &&
    (await stops.nth(0).textContent()).includes("EA-110") &&
    (await stops.nth(1).textContent()).includes("EA-111")
);
check(
  "M3",
  "Current stop shows a route sketch",
  await mobile
    .getByRole("img", { name: "Route sketch from the kiosk to EA-110" })
    .isVisible()
);
check(
  "M4",
  "Progress starts at 0 of 2",
  await mobile.getByText("0 of 2 reached").isVisible()
);
check(
  "M5b",
  "No sticky confirm button before the visitor cancels (spec)",
  (await mobile.getByRole("button", { name: /Confirm arrival/ }).count()) === 0
);
check(
  "M5",
  "Honest note: sensor arrival detection not active yet",
  await mobile
    .getByText(/Sensor arrival detection isn't available on phones yet/)
    .isVisible()
);
await mobile.screenshot({
  path: `${OUT}/step2-phone-checklist.png`,
  fullPage: true,
});

await mobile.getByRole("button", { name: /I've arrived/ }).click();
const confirm = mobile.getByRole("dialog");
await confirm.waitFor();
check(
  "M6",
  "'I've arrived' opens the arrival confirmation",
  await confirm
    .getByText(
      "Have you reached Office of the Dean (College of Computer Studies)?"
    )
    .isVisible()
);
await confirm.getByRole("button", { name: "Not yet" }).click();
await confirm.waitFor({ state: "detached" });
const sticky = mobile.getByRole("button", {
  name: "Confirm arrival at EA-110",
});
check(
  "M7",
  "After cancelling, a sticky button reopens the confirmation (spec P2)",
  await sticky.isVisible()
);
await sticky.click();
await confirm.waitFor();
await confirm.getByRole("button", { name: "Yes, continue" }).click();
await confirm.waitFor({ state: "detached" });
check(
  "M8",
  "Confirming marks the stop reached and advances",
  (await mobile.getByText("1 of 2 reached").isVisible()) &&
    (await stops.nth(0).textContent()).includes("Reached") &&
    (await mobile
      .getByRole("heading", { name: /To Faculty Center/ })
      .isVisible())
);

await mobile.reload();
await mobile.locator("main h1").waitFor();
check(
  "M9",
  "Progress survives a reload",
  await mobile.getByText("1 of 2 reached").isVisible()
);
await mobile.getByRole("button", { name: /I've arrived/ }).click();
await confirm.getByRole("button", { name: "Yes, finish" }).click();
await confirm.waitFor({ state: "detached" });
check(
  "M10",
  "Completing every stop shows the finished state",
  (await mobile
    .getByRole("heading", { name: "You've reached every stop" })
    .isVisible()) &&
    (await mobile.getByRole("button", { name: /Confirm arrival/ }).count()) ===
      0
);

// Expiry: QR links last 15 minutes, but a phone that already started keeps going.
const later = Date.now() + 16 * 60 * 1000;
await mobile.clock.install({ time: later });
await mobile.reload();
await mobile.locator("main h1").waitFor();
check(
  "M11",
  "Started session still opens after the QR expired",
  await mobile
    .getByRole("heading", { name: "You've reached every stop" })
    .isVisible()
);
await phone.close();

const fresh = await browser.newContext({ ...devices["iPhone 13"] });
const late = await fresh.newPage();
await late.clock.install({ time: later });
await late.goto(url.toString().replace(url.origin, BASE));
await late.locator("main h1").waitFor();
check(
  "M12",
  "Unstarted link after 15 minutes shows 'expired'",
  await late
    .getByRole("heading", { name: "This route link has expired" })
    .isVisible()
);
await late.goto(`${BASE}/mobile?h=bm90LWEtcGF5bG9hZA`);
await late.locator("main h1").waitFor();
check(
  "M13",
  "Tampered/garbage link shows 'couldn't be read'",
  await late
    .getByRole("heading", { name: "This QR code couldn't be read" })
    .isVisible()
);
await late.goto(`${BASE}/mobile`);
await late.locator("main h1").waitFor();
check(
  "M14",
  "No link shows 'No route to show'",
  await late.getByRole("heading", { name: "No route to show" }).isVisible()
);
await fresh.close();

check("E1", "No uncaught page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
