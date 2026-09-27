// System audit 1 browser QA against the real backend: Help guides work, and
// Hardware's "View on map" link selects the node in Map Annotation.
//
// Needs the backend on :8000 logging to $BACKEND_LOG, `seed_campus`,
// `seed_eya_routes`, the head@auf.edu.ph super admin, and
//   VITE_API_BASE_URL=/api/v1 npx vite --host 127.0.0.1 --port 3002
// (see docs/setup/local-development.md#browser-qa-suites).
import { readFileSync, statSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.LIVE_BASE_URL ?? "http://127.0.0.1:3002";
const LOG = process.env.BACKEND_LOG ?? "/tmp/flowsense-django.log";
const EMAIL = process.env.ADMIN_EMAIL ?? "head@auf.edu.ph";

const results = [];
const check = (id, name, pass, detail = "") => {
  results.push({ id, pass: Boolean(pass) });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${id} ${name}${detail ? " — " + detail : ""}`
  );
};
const visible = (locator, timeout = 10000) =>
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
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await signIn(page);

// Help: every quick guide opens, and all but the Assets one lead somewhere.
await page.goto(`${BASE}/help`);
const guides = page.locator("[data-slot=accordion-trigger]");
await guides.nth(3).waitFor();
const guideCount = await guides.count();
let opened = 0;
for (let i = 0; i < guideCount; i++) {
  await guides.nth(i).click();
  if ((await guides.nth(i).getAttribute("aria-expanded")) === "true") opened++;
}
check(
  "A1",
  "Every Help quick guide opens",
  guideCount === 4 && opened === 4,
  `${opened}/${guideCount}`
);
await guides.nth(0).click();
await page.getByRole("link", { name: /Open Map Annotation/ }).click();
check(
  "A2",
  "A guide's link opens its page",
  await page.waitForURL(`${BASE}/map-annotation`).then(
    () => true,
    () => false
  )
);
await page.goto(`${BASE}/help`);
check(
  "A3",
  "The PDF manual says it isn't published instead of pretending to open",
  (await visible(page.getByText("The PDF manual isn't published yet"))) &&
    (await page.getByRole("button", { name: /PDF manual/ }).count()) === 0
);

// A4–A8 (Asset Management claimed nothing it didn't do) were retired in
// step 10, when the page was connected to the Assets API: qa:step10 checks it.

// View on map: ?node=<id> selects that node.
const scene = await page.request
  .get(`${BASE}/api/v1/map/areas?page_size=100`)
  .then(r => r.json());
const area = scene.data.find(a => a.code === "EYA") ?? scene.data[0];
const graph = await page.request
  .get(`${BASE}/api/v1/annotations?area_id=${area.id}`)
  .then(r => r.json());
const node = (graph.data.nodes ?? []).find(n => n.name);
await page.goto(`${BASE}/map-annotation?node=${node.id}`);
const panel = page
  .locator("section, div")
  .filter({ has: page.getByText("Selected point", { exact: true }) })
  .last();
check(
  "A9",
  "View on map selects the linked node",
  await visible(panel.getByText(node.name, { exact: true })),
  node.name
);
await page.goto(`${BASE}/map-annotation?node=999999`);
check(
  "A10",
  "A node that no longer exists is reported, not ignored",
  await visible(page.getByText("isn't on this building's map any more"))
);

check("E1", "No uncaught page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
