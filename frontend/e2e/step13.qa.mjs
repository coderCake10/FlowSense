// Step 13 browser QA: the A Building in the kiosk (whole building, its
// rooms, a route from the EYA kiosk over the overpass to an upper floor),
// in Map Annotation, and Asset Management's Take offline.
//
// Needs the backend on :8000 logging to $BACKEND_LOG with `seed_campus`,
// `seed_eya_routes`, `seed_a_routes` and `seed_assets` run, the
// head@auf.edu.ph super admin, and
//   VITE_API_BASE_URL=/api/v1 npx vite --host 127.0.0.1 --port 3002
// (see docs/setup/local-development.md#browser-qa-suites).
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.LIVE_BASE_URL ?? "http://127.0.0.1:3002";
const LOG = process.env.BACKEND_LOG ?? "/tmp/flowsense-django.log";
const EMAIL = process.env.ADMIN_EMAIL ?? "head@auf.edu.ph";
const OUT = process.env.OUT ?? "e2e/output";
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (id, name, pass, detail = "") => {
  results.push({ id, pass: Boolean(pass) });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${id} ${name}${detail ? " — " + detail : ""}`
  );
};
const visible = (locator, timeout = 15000) =>
  locator.waitFor({ timeout }).then(
    () => true,
    () => false
  );

async function signIn(page) {
  const offset = statSync(LOG).size;
  await page.goto(`${BASE}/auth`);
  await page.getByLabel("Email address").fill(EMAIL);
  await page.getByRole("button", { name: "Send sign-in code" }).click();
  let code;
  for (let i = 0; i < 50 && !code; i++) {
    code = readFileSync(LOG, "utf8")
      .slice(offset)
      .match(/login code is: (\d{6})/)?.[1];
    if (!code) await new Promise(r => setTimeout(r, 200));
  }
  await page.getByLabel("Authentication code").fill(code);
  await Promise.all([
    page.waitForURL(`${BASE}/`),
    page.getByRole("button", { name: "Verify and sign in" }).click(),
  ]);
}

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", e => errors.push(e.message));

// The kiosk: pick the A Building.
await page.goto(`${BASE}/kiosk`);
await page
  .getByText(/^97 Destinations · by floor$/)
  .waitFor({ timeout: 60000 });
// The campus view: tapping the A Building (its name) opens it.
await page.getByRole("button", { name: "Campus", exact: true }).click();
const aLabel = page.getByRole("button", { name: /^A Building ›$/ });
check(
  "C1",
  "The campus view names the A Building as a button",
  await visible(aLabel, 30000)
);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/step13-campus.png` });
await aLabel.click();
check(
  "C2",
  "Tapping it opens the A Building's rooms and whole building",
  (await visible(page.getByText(/^48 Destinations · by floor$/), 30000)) &&
    (await visible(
      page.getByText("A Building · Whole building", { exact: true })
    ))
);
// Tapping the A Building's model (not only its name) opens it too.
await page
  .getByLabel("Building", { exact: true })
  .selectOption({ label: "EYA Building · First floor" });
await page
  .getByText(/^97 Destinations · by floor$/)
  .waitFor({ timeout: 30000 });
await page.getByRole("button", { name: "Campus", exact: true }).click();
const nameTag = page.getByRole("button", { name: /^A Building ›$/ });
await nameTag.waitFor({ timeout: 30000 });
// The models load after the names: wait for them before tapping one.
await page.waitForTimeout(10000);
const tag = await nameTag.boundingBox();
await page.mouse.click(tag.x + tag.width / 2, tag.y + tag.height + 40);
check(
  "C3",
  "Tapping the A Building's model opens it",
  await visible(page.getByText(/^48 Destinations · by floor$/), 30000)
);

// From EYA, search finds A rooms too, and routes to them.
await page
  .getByLabel("Building", { exact: true })
  .selectOption({ label: "EYA Building · First floor" });
await page
  .getByText(/^97 Destinations · by floor$/)
  .waitFor({ timeout: 30000 });
await page.getByLabel("Search destinations").fill("registrar");
const aResult = page.getByRole("button", { name: /A-203/ }).first();
check(
  "C4",
  "Searching in the EYA Building finds A Building rooms, named with their building",
  (await visible(aResult, 30000)) &&
    /A Building/i.test(await aResult.innerText())
);
await aResult.click();
check(
  "C5",
  "Picking one routes from the kiosk over to the A Building",
  await visible(
    page
      .getByRole("region", { name: "Route steps" })
      .getByText(/Step 1 of \d · EYA Building · First floor/),
    30000
  )
);
await page.getByRole("button", { name: "Change destination" }).click();
await page.getByLabel("Search destinations").fill("");

// Back to EYA, to pick the A Building from the list below.
await page
  .getByLabel("Building", { exact: true })
  .selectOption({ label: "EYA Building · First floor" });
await page
  .getByText(/^97 Destinations · by floor$/)
  .waitFor({ timeout: 30000 });

await page
  .getByLabel("Building", { exact: true })
  .selectOption({ label: "A Building" });
check(
  "K1",
  "The A Building's rooms are listed (48, all floors)",
  await visible(page.getByText(/^48 Destinations · by floor$/), 30000)
);
check(
  "K2",
  "The map shows the whole A Building",
  await visible(page.getByText("A Building · Whole building", { exact: true }))
);
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/step13-a-whole.png` });
check(
  "K3",
  "The header still says where the kiosk is",
  await visible(page.getByText("EYA Building", { exact: false }).first())
);

// A route from the EYA kiosk to A-305 (third floor).
const routeWait = page
  .waitForResponse(r => r.url().includes("/api/v1/navigation/routes"), {
    timeout: 30000,
  })
  .catch(() => null);
await page.getByLabel("Search destinations").fill("A-305");
await page.getByRole("button", { name: /A-305/ }).first().click();
const response = await routeWait;
const route = response ? (await response.json()).data : null;
const stops = route?.segments?.[0]?.stops ?? [];
check(
  "R1",
  "The route runs from the EYA kiosk to the A Building",
  stops[0]?.area_code === "EYA" && stops.at(-1)?.area_code === "A",
  `${stops.length} points`
);
const steps = page.getByRole("region", { name: "Route steps" });
const stepText = () => steps.innerText().catch(() => "");
check(
  "R2",
  "Step 1: the EYA first floor, out of the building",
  (await visible(
    steps.getByText(/Step 1 of 4 · EYA Building · First floor/)
  )) && /Walk out of the EYA Building/.test(await stepText())
);
check(
  "R3",
  "The route summary names every part",
  await visible(
    page.getByText(
      /From Kiosk: EYA Building · First floor → AUF Campus → A Building · First floor → A Building · Third floor/
    )
  )
);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/step13-r1-eya.png` });
await steps.getByRole("button", { name: /Next:/ }).click();
check(
  "R4",
  "Step 2: the campus view, over the overpass",
  (await visible(steps.getByText(/Step 2 of 4 · AUF Campus/))) &&
    /overpass/.test(await stepText())
);
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/step13-r2-campus.png` });
await steps.getByRole("button", { name: /Next:/ }).click();
check(
  "R5",
  "Step 3: the A Building's first floor, to the stairs",
  (await visible(steps.getByText(/Step 3 of 4 · A Building · First floor/))) &&
    /Walk to the stairs, then go up to the third floor/.test(await stepText())
);
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/step13-r3-a1f.png` });
await steps.getByRole("button", { name: /Next:/ }).click();
check(
  "R6",
  "Step 4: the third floor, to the door",
  (await visible(steps.getByText(/Step 4 of 4 · A Building · Third floor/))) &&
    /Walk to A-305/.test(await stepText())
);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/step13-r4-a3f.png` });
check(
  "R7",
  "The floor buttons are the A Building's (4 floors)",
  (await page
    .getByRole("navigation", { name: "Floors" })
    .getByRole("button")
    .count()) === 6
);

// The phone: the same route, with directions across the buildings.
await page.getByRole("button", { name: "Navigate", exact: true }).click();
const qr = page.locator("[data-handoff-url]");
await qr.waitFor({ timeout: 30000 });
const url = await qr.getAttribute("data-handoff-url");
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
phone.on("pageerror", e => errors.push(`phone: ${e.message}`));
await phone.goto(url.replace(/^https?:\/\/[^/]+/, BASE));
const directions = phone.getByRole("list", { name: "Directions to A-305" });
check(
  "P1",
  "The phone gives directions from the EYA kiosk into the A Building",
  (await visible(directions, 30000)) &&
    /Leave the EYA Building/.test(await directions.innerText()) &&
    /crossing the highway on the overpass/.test(await directions.innerText()) &&
    /Enter the A Building/.test(await directions.innerText()) &&
    /Go up to the third floor/.test(await directions.innerText())
);
check(
  "P2",
  "It starts from the kiosk in the EYA Building",
  await visible(phone.getByText(/Starting from the kiosk in the EYA Building/))
);
await phone.screenshot({ path: `${OUT}/step13-phone.png`, fullPage: true });
await phone.close();

// Map Annotation lists the A Building, with its generated points.
const admin = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
});
admin.on("pageerror", e => errors.push(e.message));
await signIn(admin);
await admin.goto(`${BASE}/map-annotation`);
const picker = admin.getByLabel("Building", { exact: true });
await picker.waitFor({ timeout: 30000 });
const options = await picker.locator("option").allInnerTexts();
check(
  "M1",
  "Map Annotation offers the A Building",
  options.includes("A Building"),
  options.join(" | ")
);
await picker.selectOption({ label: "A Building" });
check(
  "M2",
  "Its rooms are listed with their doors placed",
  await visible(admin.getByText("A-101", { exact: true }).first(), 30000)
);
check(
  "M3",
  "Entrances have a tool and a legend entry",
  (await visible(
    admin.getByRole("button", { name: "Entrance", exact: true })
  )) &&
    (await visible(admin.getByText("A Building front entrance").first(), 60000))
);
await admin.waitForTimeout(5000);
// Software rendering can be slow to paint the model: a picture isn't a check.
await admin
  .screenshot({ path: `${OUT}/step13-annotation.png`, timeout: 90000 })
  .catch(() => console.log("(annotation screenshot skipped: slow render)"));

// Asset Management: take the A model offline and make it live again.
await admin.goto(`${BASE}/assets`);
await admin
  .getByRole("list", { name: "Building models" })
  .getByRole("listitem")
  .filter({ hasText: /^A Building model/ })
  .click();
const offline = admin.getByRole("button", { name: /Take v\d+ offline/ });
check("T1", "A live model can be taken offline", await visible(offline));
await offline.click();
await admin.getByRole("button", { name: "Take offline", exact: true }).click();
check(
  "T2",
  "It says the kiosk uses its bundled model",
  await visible(
    admin.getByText(/is offline\. The kiosk uses the model bundled/)
  )
);
const areas = await admin.request
  .get(`${BASE}/api/v1/map/areas?page_size=100`)
  .then(r => r.json());
check(
  "T3",
  "The A Building has no live model in the Map API",
  areas.data.find(a => a.code === "A")?.model === null
);
await admin.getByRole("button", { name: /Make v\d+ live/ }).click();
check(
  "T4",
  "It can be made live again",
  await visible(admin.getByText(/is now live/))
);

check("E1", "No uncaught page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
