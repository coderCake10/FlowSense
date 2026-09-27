// Step 14 browser QA: Map Annotation's Campus view (labels, walkway points,
// placing a building) and adding a building from the admin panel all the
// way to the kiosk (its model, a room, the kiosk's list).
//
// Needs the backend on :8000 logging to $BACKEND_LOG with `seed_campus`,
// `seed_eya_routes`, `seed_a_routes` and `seed_assets` run, the
// head@auf.edu.ph super admin, and
//   VITE_API_BASE_URL=/api/v1 npx vite --host 127.0.0.1 --port 3002
// (see docs/setup/local-development.md#browser-qa-suites). It cleans up
// what it adds (the building is soft-deleted, so each run uses a new code).
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.LIVE_BASE_URL ?? "http://127.0.0.1:3002";
const LOG = process.env.BACKEND_LOG ?? "/tmp/flowsense-django.log";
const EMAIL = process.env.ADMIN_EMAIL ?? "head@auf.edu.ph";
const OUT = process.env.OUT ?? "e2e/output";
const MODELS = new URL("../client/public/models/", import.meta.url).pathname;
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
const until = async (test, timeout = 15000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await test()) return true;
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
};

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
const admin = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
});
admin.on("pageerror", e => errors.push(e.message));
await signIn(admin);
const api = async (path, init) => {
  const response = await admin.request.fetch(`${BASE}/api/v1${path}`, init);
  return (await response.json()).data;
};
const json = (method, data) => ({ method, data });
const areaByCode = async code =>
  (await api("/map/areas?page_size=100")).find(a => a.code === code);

// ---------------------------------------------------------------- the campus
await admin.goto(`${BASE}/map-annotation`);
const picker = admin.getByLabel("Building", { exact: true });
await picker.waitFor({ timeout: 30000 });
check(
  "S1",
  "Map Annotation offers the campus",
  (await picker.locator("option").allInnerTexts()).includes("Campus (outdoors)")
);
await picker.selectOption({ value: "campus" });
const summary = admin.getByText(/[1-9]\d* walkway points · \d+ connections/);
check(
  "S2",
  "The Campus view shows the walk between the buildings",
  await visible(summary, 60000),
  await summary.innerText().catch(() => "")
);
await admin.waitForTimeout(8000);
await admin
  .screenshot({ path: `${OUT}/step14-campus.png`, timeout: 90000 })
  .catch(() => console.log("(campus screenshot skipped: slow render)"));
const canvas = admin.locator("canvas").first();
const box = await canvas.boundingBox();
const clickMap = (dx = 0, dy = 0) =>
  admin.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);

// Labels: add, rename, delete.
const text = `QA label ${Date.now() % 100000}`;
await admin.getByLabel("New label").fill(text);
await clickMap(-60, 40);
const added = await until(async () =>
  (await api("/annotations/labels")).some(l => l.name === text)
);
check("S3", "A label is placed by typing its text and clicking the map", added);
await admin.getByRole("button", { name: text, exact: true }).click();
const renamed = `${text} renamed`;
await admin.getByLabel(`Rename ${text}`).fill(renamed);
await admin.getByLabel(`Rename ${text}`).press("Enter");
check(
  "S4",
  "It can be renamed",
  await until(async () =>
    (await api("/annotations/labels")).some(l => l.name === renamed)
  )
);
await admin.getByRole("button", { name: `Delete ${renamed}` }).click();
check(
  "S5",
  "And deleted",
  await until(
    async () =>
      !(await api("/annotations/labels")).some(l => l.name === renamed)
  )
);

// A walkway point.
const walkways = (await api("/map/areas?page_size=100")).find(
  a => a.area_type === "outdoor"
);
const walkNodes = async () =>
  (await api(`/annotations?area_id=${walkways.id}`)).nodes.filter(n =>
    /^Walkway \d+$/.test(n.name)
  );
const before = (await walkNodes()).map(n => n.id);
await admin.getByRole("button", { name: "Walkway point" }).click();
await clickMap(80, -60);
const addedPoint = await until(async () =>
  (await walkNodes()).some(n => !before.includes(n.id))
);
const newPoint = (await walkNodes()).find(n => !before.includes(n.id));
check(
  "S6",
  "A walkway point is placed on the campus, on the ground",
  addedPoint &&
    newPoint.geometry.coordinates[2] > -1 &&
    newPoint.geometry.coordinates[2] < 10,
  `height ${newPoint?.geometry.coordinates[2]}`
);
for (const node of await walkNodes())
  if (!before.includes(node.id))
    await admin.request.delete(`${BASE}/api/v1/annotations/nodes/${node.id}`);

// Placing a building: move the A Building, check its points moved, put it back.
const aArea = await areaByCode("A");
const original = aArea.placement;
const entrance = async () =>
  (await api(`/annotations?area_id=${aArea.id}`)).nodes.find(
    n => n.node_type === "area_entrance"
  ).geometry.coordinates;
const entranceBefore = await entrance();
await admin.getByRole("button", { name: "Move", exact: true }).first().click();
await clickMap(-120, 90);
const turn = admin.getByLabel("Turn (degrees)");
await turn.focus();
for (let i = 0; i < 15; i++) await turn.press("ArrowRight");
await admin.getByRole("button", { name: "Save", exact: true }).click();
const moved = await until(async () => {
  const now = (await areaByCode("A")).placement;
  return now && now.position[0] !== original.position[0];
});
const entranceAfter = await entrance();
const placedAt = (await areaByCode("A")).placement;
check(
  "S7",
  "Placing a building saves where it stands (on the ground), and its points move with it",
  moved &&
    entranceAfter[0] !== entranceBefore[0] &&
    placedAt.position[1] > -1 &&
    placedAt.position[1] < 10,
  JSON.stringify((await areaByCode("A")).placement)
);
await api(`/map/areas/${aArea.id}`, json("PATCH", { placement: original }));
const restored = await entrance();
check(
  "S8",
  "Putting it back puts its points back",
  restored.every((v, i) => Math.abs(v - entranceBefore[i]) < 0.01)
);

// ---------------------------------------------------------------- a new building
const code = `Q${Date.now() % 100000}`;
const name = `QA Building ${code}`;
await picker.selectOption({ index: 0 });
await admin.getByRole("button", { name: "Add building" }).click();
const dialog = admin.getByRole("dialog");
await dialog.getByLabel("Building name").fill(name);
await dialog.getByLabel("Building code").fill(code);
await dialog.getByLabel("Number of floors").fill("4");
await dialog.getByRole("button", { name: "Add building" }).click();
const created = await until(async () => Boolean(await areaByCode(code)));
const area = await areaByCode(code);
const floors = area ? await api(`/map/areas/${area.id}/floors`) : [];
check(
  "N1",
  "Add building creates it with its floors (FLOOR_1 … FLOOR_4)",
  created &&
    floors.map(f => f.glb_node_name).join() ===
      "FLOOR_1,FLOOR_2,FLOOR_3,FLOOR_4"
);
check(
  "N2",
  "Map Annotation lists it as waiting for its model",
  await until(async () =>
    (await picker.locator("option").allInnerTexts()).includes(
      `${name} (upload its model first)`
    )
  )
);

// Its model (the A model stands in: it has FLOOR_1 … FLOOR_4), live.
const upload = await admin.request.post(`${BASE}/api/v1/assets`, {
  multipart: {
    file: {
      name: "QA.glb",
      mimeType: "model/gltf-binary",
      buffer: readFileSync(`${MODELS}A.glb`),
    },
    area_id: String(area.id),
    name: `${name} model`,
  },
});
const asset = (await upload.json()).data;
const activated = await admin.request.post(
  `${BASE}/api/v1/assets/${asset.id}/activate`
);
check(
  "N3",
  "Its model uploads and goes live (validated against its 4 floors)",
  upload.status() === 201 && activated.status() === 200,
  `${upload.status()} / ${activated.status()}`
);
// Placed on the campus, away from the others.
await api(
  `/map/areas/${area.id}`,
  json("PATCH", {
    placement: { position: [-40, 1.2, 150], rotation_y: 0 },
  })
);

// Map Annotation shows it, and a room is added there.
await admin.reload();
await picker.waitFor({ timeout: 30000 });
await picker.selectOption({ label: name });
await admin.getByLabel("New room number").fill(`${code}-101`);
await admin.getByLabel("New room name").fill("QA Office");
await admin.getByRole("button", { name: "Add room" }).click();
check(
  "N4",
  "Map Annotation opens it, and adds a room on its first floor",
  await visible(admin.getByText(`${code}-101`, { exact: true }), 30000)
);

// Its entrance: where routes into it arrive (the kiosk marks it).
await admin.getByRole("button", { name: "Entrance", exact: true }).click();
await admin.waitForTimeout(3000);
const mapBox = await admin.locator("canvas").first().boundingBox();
await admin.mouse.click(
  mapBox.x + mapBox.width / 2,
  mapBox.y + mapBox.height / 2
);
check(
  "N4b",
  "Placing its entrance records where routes into it arrive",
  await until(async () => {
    const start = (await areaByCode(code)).map_settings?.start;
    return Array.isArray(start) && start.length === 3;
  }, 30000)
);

// The kiosk lists it, with its room, and shows its model.
const kiosk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
kiosk.on("pageerror", e => errors.push(`kiosk: ${e.message}`));
await kiosk.goto(`${BASE}/kiosk`);
await kiosk
  .getByText(/^97 Destinations · by floor$/)
  .waitFor({ timeout: 60000 });
const kioskPicker = kiosk.getByLabel("Building", { exact: true });
check(
  "N5",
  "The kiosk lists the new building (no code change)",
  await until(async () =>
    (await kioskPicker.locator("option").allInnerTexts()).includes(name)
  )
);
await kioskPicker.selectOption({ label: name });
check(
  "N6",
  "With its room and its whole building",
  (await visible(kiosk.getByText(/^1 Destinations · by floor$/), 30000)) &&
    (await visible(
      kiosk.getByText(`${name} · Whole building`, { exact: true })
    ))
);
await kiosk.waitForTimeout(5000);
await kiosk.screenshot({ path: `${OUT}/step14-kiosk-new.png` });
check(
  "N6b",
  "The kiosk marks its entrance",
  await visible(kiosk.getByText("Entrance", { exact: true }).first(), 30000)
);
await kiosk.getByRole("button", { name: "Campus", exact: true }).click();
check(
  "N7",
  "The campus view names it where it was placed",
  await visible(kiosk.getByRole("button", { name: `${name} ›` }), 30000)
);
await kiosk.close();

// Clean up: its model offline and deleted, the building removed.
await admin.request.post(`${BASE}/api/v1/assets/${asset.id}/deactivate`);
await admin.request.delete(`${BASE}/api/v1/assets/${asset.id}`);
await admin.request.delete(`${BASE}/api/v1/map/areas/${area.id}`);

check("E1", "No uncaught page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
