// Step 8d browser QA: kiosk → phone handoff with the kiosk's real route.
// The kiosk routes EA-110 through the Navigation API; its QR carries the
// route id; the phone shows "Preparing your route", loads that route (GET,
// no new route request), lists step-by-step directions, and confirms arrival.
// Needs the backend on :8000 with `seed_campus` and `seed_eya_routes` run
// (see docs/qa/step-08d-test-report.md):
//   VITE_API_BASE_URL=/api/v1 npx vite --host 127.0.0.1 --port 3002
//   npm run qa:step8d
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

// ---------------- Kiosk ----------------
const kiosk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
kiosk.on("pageerror", e => errors.push(`kiosk: ${e.message}`));
await kiosk.goto(`${BASE}/kiosk`);
await kiosk
  .getByText(/^92 Destinations · by floor$/)
  .waitFor({ timeout: 60000 });
const routeReply = kiosk
  .waitForResponse(
    r =>
      r.url().includes("/api/v1/navigation/routes") &&
      r.request().method() === "POST",
    { timeout: 30000 }
  )
  .catch(() => null);
await kiosk
  .getByRole("button", {
    name: /Office of the Dean, College of Computer Studies/,
  })
  .click();
const reply = await routeReply;
const routeId = reply?.status() === 201 ? (await reply.json()).data?.id : null;
check(
  "H1",
  "The kiosk routes EA-110 through the Navigation API",
  routeId,
  `route ${routeId}`
);
await kiosk
  .getByText(/From Kiosk to the destination/)
  .waitFor({ timeout: 30000 })
  .catch(() => {});
await kiosk.getByRole("button", { name: /^Navigate$/ }).click();
const qr = kiosk.getByRole("dialog").locator("svg[data-handoff-url]");
await qr.waitFor({ timeout: 15000 });
const link = new URL(await qr.getAttribute("data-handoff-url"));
const payload = JSON.parse(
  Buffer.from(link.searchParams.get("h"), "base64url").toString()
);
check(
  "H2",
  "The QR link carries the kiosk's route id",
  routeId && Object.values(payload.t ?? {}).includes(routeId),
  JSON.stringify(payload.t)
);

// ---------------- Phone ----------------
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
phone.on("pageerror", e => errors.push(`phone: ${e.message}`));
const phoneRoutes = [];
phone.on("request", r => {
  if (r.url().includes("/api/v1/navigation/routes"))
    phoneRoutes.push(`${r.method()} ${new URL(r.url()).pathname}`);
});
// Slow the route down a little so the loading screen can be seen.
await phone.route("**/api/v1/navigation/routes/**", async route => {
  await new Promise(r => setTimeout(r, 1200));
  await route.continue();
});
await phone.goto(`${BASE}/mobile${link.search}`);
const preparing = await phone
  .getByRole("heading", { name: "Preparing your route" })
  .waitFor({ timeout: 5000 })
  .then(
    () => true,
    () => false
  );
await phone.screenshot({ path: `${OUT}/step8d-preparing.png` });
check("H3", 'The phone shows "Preparing your route" while it loads', preparing);

const directions = phone.getByRole("list", { name: "Directions to EA-110" });
await directions.waitFor({ timeout: 30000 }).catch(() => {});
const steps = await directions.locator("li").allInnerTexts();
check(
  "H4",
  "Step-by-step directions from the kiosk to EA-110",
  steps.length >= 2 &&
    steps[0].startsWith("Start at the kiosk") &&
    steps[steps.length - 1].startsWith("Arrive at EA-110"),
  steps.map(s => s.split("\n")[0]).join(" → ")
);
check(
  "H5",
  "The phone read the saved route (one GET, no new route request)",
  phoneRoutes.length === 1 &&
    phoneRoutes[0] === `GET /api/v1/navigation/routes/${routeId}`,
  phoneRoutes.join(", ")
);
await phone.screenshot({
  path: `${OUT}/step8d-directions.png`,
  fullPage: true,
});

await phone.getByRole("button", { name: /I've arrived/ }).click();
const dialog = phone.getByRole("dialog");
await dialog.waitFor();
check(
  "H6",
  "Arriving asks to confirm, with the room and floor",
  (await dialog.getByText(/Have you reached Office of the Dean/).isVisible()) &&
    (await dialog.getByText("EA-110 · First floor").isVisible())
);
await phone.waitForTimeout(400);
await phone.screenshot({ path: `${OUT}/step8d-arrived.png` });
await dialog.getByRole("button", { name: "Yes, finish" }).click();
check(
  "H7",
  "Confirming the last stop finishes the route",
  await phone
    .getByRole("heading", { name: "You've reached every stop" })
    .waitFor({ timeout: 5000 })
    .then(
      () => true,
      () => false
    )
);
check("H8", "No uncaught page errors", errors.length === 0, errors[0]);

await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
