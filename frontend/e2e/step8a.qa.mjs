// Step 8a browser QA: the kiosk's live directory, search and routes against
// the real backend, and the attract screen staying until a visitor taps.
// Needs the backend on :8000 with `seed_campus` and `seed_eya_routes` run
// (see docs/qa/step-08a-test-report.md):
//   VITE_API_BASE_URL=/api/v1 npx vite --host 127.0.0.1 --port 3002
//   npm run qa:step8a
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.LIVE_BASE_URL ?? "http://127.0.0.1:3002";
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
const errors = [];

// The attract screen waits for a visitor.
const attract = await browser.newPage({
  viewport: { width: 1440, height: 900 },
});
attract.on("pageerror", e => errors.push(e.message));
await attract.goto(`${BASE}/attraction`);
await attract.waitForTimeout(20000);
check(
  "L1",
  "Attract screen stays up without a tap (20 s)",
  new URL(attract.url()).pathname === "/attraction"
);
await attract.close();

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", e => errors.push(e.message));
const searches = [];
const routes = [];
page.on("request", r => {
  if (r.url().includes("/api/v1/search")) searches.push(r.url());
  if (r.url().includes("/api/v1/navigation/routes")) routes.push(r);
});
await page.goto(`${BASE}/kiosk`);
const listed = await page
  .getByText(/^97 Destinations · by floor$/)
  .waitFor({ timeout: 60000 })
  .then(
    () => true,
    () => false
  );
check("L2", "Kiosk lists every EYA room (97, all floors)", listed);
check(
  "L3",
  "Rooms from upper floors are listed",
  await page
    .getByRole("button", { name: /EA-305/ })
    .isVisible()
    .catch(() => false)
);

const search = page.getByLabel("Search destinations");
await search.fill("computer studies");
await page
  .getByText(/^\d+ Destinations · by floor$/)
  .waitFor({ timeout: 30000 });
const firstHits = await page
  .locator("aside button[aria-pressed]")
  .allInnerTexts();
check(
  "L4",
  "Search finds the College of Computer Studies offices",
  firstHits.some(t => t.includes("EA-110")) &&
    firstHits.some(t => t.includes("EA-111")),
  firstHits.slice(0, 3).join(" | ").replace(/\n/g, " ")
);
check(
  "L5",
  "The search went to the Search API once, after typing stopped",
  searches.filter(u => u.includes("q=computer")).length === 1,
  `${searches.length} request(s)`
);

// Listen before clicking: the reply can arrive before the click resolves.
const routeWait = page
  .waitForResponse(r => r.url().includes("/api/v1/navigation/routes"), {
    timeout: 30000,
  })
  .catch(() => null);
await page
  .getByRole("button", {
    name: /Office of the Dean, College of Computer Studies/,
  })
  .click();
const routeReply = await routeWait;
check(
  "L6",
  "Choosing EA-110 asks the Navigation API for the route",
  routeReply?.status() === 201,
  routeReply ? `HTTP ${routeReply.status()}` : "no request"
);
await page
  .getByText(/From Kiosk to the destination/)
  .waitFor({ timeout: 30000 })
  .catch(() => {});
check(
  "L7",
  "The route shows on the first floor",
  (await page.getByText(/Route preview · EA-110/).isVisible()) &&
    (await page
      .locator('span:text-is("EYA Building · First floor")')
      .isVisible())
);
await page.waitForTimeout(3000);
check(
  "L7b",
  "The route ends at EA-110 (no floor-change marker on a one-floor route)",
  (await page.getByText(/^(Go|Elevator|Stairs) to \dF$/).count()) === 0
);
await page.screenshot({ path: `${OUT}/step8a-live-route.png` });

await page.getByRole("button", { name: "Change destination" }).click();
await search.fill("EA-305");
await page
  .getByRole("button", { name: /EA-305/ })
  .first()
  .waitFor({ timeout: 30000 });
const upstairs = page
  .waitForResponse(r => r.url().includes("/api/v1/navigation/routes"), {
    timeout: 30000,
  })
  .catch(() => null);
await page
  .getByRole("button", { name: /EA-305/ })
  .first()
  .click();
check(
  "L8",
  "A third-floor room gets a route too (the generated network covers every floor)",
  (await upstairs)?.status() === 201
);
await page
  .getByText(/From Kiosk: First floor → Third floor/)
  .waitFor({ timeout: 30000 })
  .catch(() => {});
const steps = page.getByLabel("Route steps");
// The map's labels are drawn a few frames after the route text appears.
const ride = await page
  .getByText(/^(Elevator|Stairs) to 3F$/)
  .waitFor({ timeout: 15000 })
  .then(
    () => true,
    () => false
  );
const stepsText = await steps.innerText().catch(() => "");
check(
  "L9",
  "It starts on the first floor: step 1 of 2 names the ride up to 3F",
  ride &&
    (await page
      .locator('span:text-is("EYA Building · First floor")')
      .isVisible()) &&
    (await page
      .getByText(/From Kiosk: First floor → Third floor/)
      .isVisible()) &&
    /Step 1 of 2.*First floor/i.test(stepsText) &&
    /then go up to the third floor/.test(stepsText),
  `ride label ${ride ? "shown" : "missing"}; ${stepsText.replace(/\n+/g, " | ")}`
);
// Next opens the rest of the route.
await steps.getByRole("button", { name: /^Next: Third floor/ }).click();
await page.waitForTimeout(2500);
check(
  "L9b",
  "The third floor shows the rest of the route, ending at EA-305",
  (await page
    .locator('span:text-is("EYA Building · Third floor")')
    .isVisible()) &&
    (await page.getByText("EA-305", { exact: true }).last().isVisible()) &&
    /Step 2 of 2.*Third floor/is.test(await steps.innerText()) &&
    (await steps
      .getByRole("button", { name: /^Back: First floor/ })
      .isVisible())
);
await page.screenshot({ path: `${OUT}/step8a-third-floor-room.png` });

// Follow on this kiosk plays the route floor by floor, then again.
await page.getByRole("button", { name: /^Navigate$/ }).click();
await page.getByRole("button", { name: /Follow on this kiosk/ }).click();
const shown = () =>
  page.locator('span:text-matches("^EYA Building · ")').innerText();
const waitForShown = async text => {
  for (let i = 0; i < 40; i++) {
    if ((await shown()) === text) return true;
    await page.waitForTimeout(500);
  }
  return false;
};
check(
  "L11",
  "Follow on this kiosk plays the route: first floor, third floor, then first again",
  (await waitForShown("EYA Building · First floor")) &&
    (await waitForShown("EYA Building · Third floor")) &&
    (await waitForShown("EYA Building · First floor"))
);
await page.getByRole("button", { name: "Pause the route" }).click();
const pausedOn = await shown();
await page.waitForTimeout(9000);
check(
  "L12",
  "Pause holds the floor shown",
  (await shown()) === pausedOn &&
    (await page.getByRole("button", { name: "Play the route" }).isVisible())
);
check("L10", "No uncaught page errors", errors.length === 0, errors[0]);

await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
