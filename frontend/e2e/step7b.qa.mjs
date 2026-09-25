// Step 7b browser QA: the kiosk opens on the whole building, the front lifts
// away on tap, floors switch, routes animate, and the attract screen previews
// the real model.
// Usage (see docs/qa/step-07b-test-report.md):
//   npx vite --host 127.0.0.1 --port 3000
//   npm run qa:step7b
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = process.env.OUT ?? "e2e/output";
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (id, name, pass, detail = "") => {
  results.push({ id, pass: Boolean(pass) });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${id} ${name}${detail ? " — " + detail : ""}`
  );
};

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
const pressed = name =>
  page.getByRole("button", { name, exact: true }).getAttribute("aria-pressed");
// The map's own label (the building picker has similar option text).
const viewLabel = text => page.locator(`span:text-is("${text}")`).isVisible();

await page.goto(`${BASE}/kiosk`);
await page
  .getByText("You are here", { exact: true })
  .waitFor({ timeout: 120000 });
check(
  "B1",
  "Kiosk opens on the whole building",
  (await viewLabel("EYA Building · Whole building")) &&
    (await pressed("Whole building")) === "true"
);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/step7b-building.png` });

const canvas = await page.locator("canvas").boundingBox();
await page.mouse.click(
  canvas.x + canvas.width / 2,
  canvas.y + canvas.height / 2
);
await page.waitForTimeout(500);
check(
  "B2",
  "Tapping the building opens the kiosk's floor",
  (await viewLabel("EYA Building · First floor")) &&
    (await pressed("First floor (you are here)")) === "true"
);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/step7b-opened.png` });

await page.getByRole("button", { name: "Third floor", exact: true }).click();
check(
  "B3",
  "Floor buttons switch floors (3F)",
  (await viewLabel("EYA Building · Third floor")) &&
    (await pressed("Third floor")) === "true"
);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/step7b-floor3.png` });

await page
  .getByRole("button", { name: /Office of the Dean \(College/ })
  .click();
check(
  "B4",
  "Choosing a destination opens its floor with the route",
  (await viewLabel("EYA Building · First floor")) &&
    (await page.getByText(/Route preview · EA-110/).isVisible())
);
await page.waitForTimeout(3000);
const mapBox = await page.locator("canvas").boundingBox();
const clip = {
  x: mapBox.x,
  y: mapBox.y,
  width: mapBox.width,
  height: mapBox.height,
};
const before = await page.screenshot({ clip });
await page.waitForTimeout(1500);
const after = await page.screenshot({ clip });
check(
  "B4b",
  "A single-floor route ends at the room, not at a floor change",
  (await page.getByText(/^Go to \dF$/).count()) === 0
);
check(
  "B5",
  "Route arrows move (map redraws while a route is shown)",
  !before.equals(after)
);
await page.screenshot({ path: `${OUT}/step7b-route.png` });

await page.getByRole("button", { name: "Reset view" }).click();
check(
  "B6",
  "Reset view keeps the chosen floor",
  await viewLabel("EYA Building · First floor")
);
await page.getByRole("button", { name: "Whole building", exact: true }).click();
check(
  "B7",
  "Whole building button returns to the outside view",
  (await viewLabel("EYA Building · Whole building")) &&
    (await pressed("Whole building")) === "true"
);

// Attract screen: stop its 15 s jump to the kiosk while it is checked.
const attract = await browser.newPage({
  viewport: { width: 1440, height: 900 },
});
attract.on("pageerror", e => errors.push(e.message));
await attract.addInitScript(() => {
  const setTimeoutBefore = window.setTimeout;
  window.setTimeout = (fn, ms, ...args) =>
    ms === 15000 ? 0 : setTimeoutBefore(fn, ms, ...args);
});
await attract.goto(`${BASE}/attraction`);
const modelShown = await attract
  .getByText("Tap to open the building and find your route.")
  .waitFor({ timeout: 120000 })
  .then(
    () => true,
    () => false
  );
check(
  "B8",
  "Attract screen shows the real model (placeholder replaced)",
  modelShown && (await attract.locator("canvas").count()) === 1
);
await attract.waitForTimeout(1500);
await attract.screenshot({ path: `${OUT}/step7b-attract.png` });
const preview = await attract.locator("canvas").boundingBox();
await attract.mouse.click(
  preview.x + preview.width / 2,
  preview.y + preview.height / 2
);
await attract.waitForURL(/\/kiosk$/, { timeout: 30000 }).catch(() => {});
check(
  "B9",
  "Tapping the preview still opens the kiosk",
  attract.url().endsWith("/kiosk")
);
check("B10", "No uncaught page errors", errors.length === 0, errors[0]);

await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
