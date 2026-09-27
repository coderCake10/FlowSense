// Step 8b browser QA: Map Annotation on the real model, against the backend.
// Places corridor points and a room door on the third floor, checks what was
// saved, then deletes everything it placed (so it can be re-run). Every room
// has a generated door (step 12), so it first takes EA-305's out and puts it
// back, with its connections, at the end.
// Needs the backend on :8000 (console email, `seed_campus`, `seed_eya_routes`,
// an active super admin) and its log (see docs/qa/step-08b-test-report.md):
//   VITE_API_BASE_URL=/api/v1 npx vite --host 127.0.0.1 --port 3002
//   BACKEND_LOG=/path/to/runserver.log npm run qa:step8b
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

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));

// Sign in with the emailed code (console email backend → server log).
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
await page.getByLabel("Authentication code").fill(code ?? "");
await Promise.all([
  page.waitForURL(`${BASE}/`),
  page.getByRole("button", { name: "Verify and sign in" }).click(),
]);

const stat = label =>
  page
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd")
    .innerText();
const waitForStat = async (label, expected) => {
  for (let i = 0; i < 100; i++) {
    if ((await stat(label)) === String(expected)) return true;
    await page.waitForTimeout(200);
  }
  return false;
};

const api = async (path, init) => {
  const response = await page.request.fetch(`${BASE}/api/v1${path}`, init);
  return (await response.json()).data;
};
// EA-305's generated door and its connections, to put back afterwards.
// Every EA-305 door is taken out first, so a door left by an interrupted
// run can't be mistaken for the generated one.
const eya = (await api("/map/areas")).find(a => a.code === "EYA");
const rooms = await api(`/map/rooms?area_id=${eya.id}&page_size=100`);
const ea305 = rooms.find(r => r.room_code === "EA-305");
const scene = await api(`/annotations?area_id=${eya.id}`);
const ea305Doors = scene.nodes.filter(n => n.room === ea305.id);
const door = ea305Doors.find(n => n.metadata?.seed === "eya-network") ?? null;
const doorEdges = door
  ? scene.edges.filter(e => e.from_node === door.id || e.to_node === door.id)
  : [];
if (!door)
  console.log("Note: EA-305 has no generated door; run seed_eya_routes.");
for (const node of ea305Doors) {
  await page.request.fetch(`${BASE}/api/v1/annotations/nodes/${node.id}/`, {
    method: "DELETE",
  });
}

await page.goto(`${BASE}/map-annotation`);
const loaded = await page
  .getByText("Rooms on this floor (15)")
  .waitFor({ timeout: 60000 })
  .then(
    () => true,
    () => false
  );
await page.locator("canvas").waitFor({ timeout: 60000 });
await page.waitForTimeout(4000);
check(
  "A1",
  "Map Annotation opens the EYA model on the first floor, with its 15 rooms",
  loaded
);
check(
  "A2",
  "It shows the generated network (every room but EA-305, taken out for this test, placed)",
  (await stat("Rooms placed")) === "96 of 97" &&
    Number(await stat("Points")) > 100,
  `${await stat("Rooms placed")}, ${await stat("Points")} points`
);
await page.screenshot({ path: `${OUT}/step8b-first-floor.png` });

await page.getByRole("button", { name: "3F", exact: true }).click();
check(
  "A3",
  "Switching to 3F lists that floor's rooms",
  await page
    .getByText("Rooms on this floor (17)")
    .waitFor({ timeout: 10000 })
    .then(
      () => true,
      () => false
    )
);
await page.waitForTimeout(4000);

const box = await page.locator("canvas").boundingBox();
const spot = (dx, dy) => [
  box.x + box.width / 2 + dx,
  box.y + box.height / 2 + dy,
];
const [points, connections] = [
  Number(await stat("Points")),
  Number(await stat("Connections")),
];

await page.getByRole("button", { name: "Corridor point" }).click();
await page.mouse.click(...spot(0, -60));
await waitForStat("Points", points + 1);
await page.mouse.click(...spot(0, 20));
check(
  "A4",
  "Two corridor clicks save two points, connected in order",
  (await waitForStat("Points", points + 2)) &&
    (await waitForStat("Connections", connections + 1))
);

await page.getByRole("button", { name: "EA-305 not placed" }).click();
await page.mouse.click(...spot(0, 60));
check(
  "A5",
  "Placing EA-305's door marks the room placed and connects it to the corridor",
  (await page
    .getByRole("button", { name: "EA-305 placed" })
    .waitFor({ timeout: 15000 })
    .then(
      () => true,
      () => false
    )) && (await waitForStat("Connections", connections + 2))
);
check(
  "A6",
  "The new door is selected with its connection listed",
  await page
    .getByRole("button", { name: /^Remove the connection to Corridor 3F/ })
    .isVisible()
);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/step8b-third-floor.png` });

await page.getByRole("button", { name: "Isometric" }).click();
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}/step8b-isometric.png` });
await page.getByRole("button", { name: "Top down" }).click();
await page.waitForTimeout(3500);

// A connection can go on its own: from the selected point's panel ...
await page
  .getByRole("button", { name: /^Remove the connection to Corridor 3F/ })
  .click();
check(
  "A6b",
  "Remove, in the selected point's panel, deletes just that connection",
  (await waitForStat("Connections", connections + 1)) &&
    (await waitForStat("Points", points + 3))
);
// ... or by clicking its line with the Delete tool (between the corridor
// points placed at -60 and 20).
await page.getByRole("button", { name: "Delete", exact: true }).click();
await page.mouse.click(...spot(0, -20));
check(
  "A6c",
  "The Delete tool on a line deletes just that connection",
  (await waitForStat("Connections", connections)) &&
    (await waitForStat("Points", points + 3))
);

// Clean up with the Delete tool, clicking the same spots.
for (const [dx, dy] of [
  [0, 60],
  [0, 20],
  [0, -60],
]) {
  if (process.env.DEBUG_SHOTS) {
    await page.screenshot({ path: `${OUT}/step8b-delete-${dx}_${dy}.png` });
  }
  await page.mouse.click(...spot(dx, dy));
  await page.getByText("All changes saved").waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
}
check(
  "A7",
  "The Delete tool removes the points and their connections",
  (await waitForStat("Points", points)) &&
    (await waitForStat("Connections", connections)) &&
    (await page.getByRole("button", { name: "EA-305 not placed" }).isVisible())
);
// Room details: rename a room and give it a purpose, then put it back.
await page.getByRole("button", { name: "EA-306 placed" }).click();
const name = page.getByLabel("Name (optional)");
const purpose = page.getByLabel("Purpose (optional)");
await name.waitFor({ timeout: 15000 });
const [nameBefore, purposeBefore] = [
  await name.inputValue(),
  await purpose.inputValue(),
];
await name.fill("QA Computer Lab");
await purpose.fill("Programming classes and thesis consultations");
await page.getByRole("button", { name: "Save room details" }).click();
const renamed = await page
  .getByRole("button", { name: "EA-306 placed" })
  .getByText("QA Computer Lab")
  .waitFor({ timeout: 15000 })
  .then(
    () => true,
    () => false
  );
check(
  "A8",
  "Room details save: the new name shows in the room list",
  renamed &&
    (await purpose.inputValue()) ===
      "Programming classes and thesis consultations"
);
await page.screenshot({ path: `${OUT}/step8b-room-details.png` });
await name.fill(nameBefore);
await purpose.fill(purposeBefore);
await page.getByRole("button", { name: "Save room details" }).click();
check(
  "A9",
  "Clearing the name falls back to the room number",
  await page
    .getByRole("button", { name: "EA-306 placed" })
    .getByText(nameBefore || "Room EA-306", { exact: true })
    .waitFor({ timeout: 15000 })
    .then(
      () => true,
      () => false
    )
);
await page.getByRole("button", { name: "Select", exact: true }).click();

// Drag EA-306's door with the Select tool, check it saved, then put it back.
const door306 = rooms.find(r => r.room_code === "EA-306").node_id;
const before306 = await api(`/annotations/nodes/${door306}/`);
const edgesOf = async id =>
  (await api(`/annotations?area_id=${eya.id}`)).edges.filter(
    e => e.from_node === id || e.to_node === id
  );
const [edgeBefore] = await edgesOf(door306);
// The label sits 16 px above its point in the top-down view.
const label = await page
  .locator('span[class*="-translate-y-4"]', { hasText: /^EA-306 door$/ })
  .boundingBox();
const [px, py] = [label.x + label.width / 2, label.y + label.height / 2 + 16];
await page.mouse.move(px, py);
await page.mouse.down();
for (let i = 1; i <= 6; i++) await page.mouse.move(px + i * 8, py);
await page.mouse.up();
await page.getByText("All changes saved").waitFor({ timeout: 15000 });
await page.waitForTimeout(1000);
const after306 = await api(`/annotations/nodes/${door306}/`);
const [edgeAfter] = await edgesOf(door306);
const movedBy = Math.hypot(
  after306.geometry.coordinates[0] - before306.geometry.coordinates[0],
  after306.geometry.coordinates[1] - before306.geometry.coordinates[1]
);
check(
  "A11",
  "Dragging a point with the Select tool moves it, and its connection follows",
  movedBy > 0.5 &&
    JSON.stringify(edgeAfter.geometry) !== JSON.stringify(edgeBefore.geometry),
  `moved ${movedBy.toFixed(2)} m`
);
await page.request.fetch(`${BASE}/api/v1/annotations/nodes/${door306}/`, {
  method: "PATCH",
  data: { geometry: before306.geometry },
});
// The elevator out of service: routes take the stairs and say why.
const lift = page.getByRole("switch", { name: "Elevator in service" });
await lift.click();
await page.getByText("All changes saved").waitFor({ timeout: 15000 });
// "All changes saved" may still show from the last edit: wait for the
// switch's saves themselves.
let liftOff = [];
for (let i = 0; i < 40; i++) {
  liftOff = (
    await api(`/annotations?area_id=${eya.id}`)
  ).floor_transitions.filter(t => t.transition_type === "elevator");
  if (liftOff.length && liftOff.every(t => !t.active)) break;
  await page.waitForTimeout(250);
}
const kiosk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
kiosk.on("pageerror", e => errors.push(`kiosk: ${e.message}`));
await kiosk.goto(`${BASE}/kiosk`);
await kiosk
  .getByText(/^\d+ Destinations · by floor$/)
  .waitFor({ timeout: 60000 });
await kiosk.getByLabel("Search destinations").fill("EA-307");
await kiosk
  .getByRole("button", { name: /EA-307/ })
  .first()
  .click();
const steps = kiosk.getByLabel("Route steps");
const stepText = await steps
  .waitFor({ timeout: 30000 })
  .then(() => steps.innerText())
  .catch(() => "no route steps");
check(
  "A12",
  "Switching the elevator off: routes take the stairs, and the kiosk says it's out of service",
  liftOff.length > 0 &&
    liftOff.every(t => !t.active) &&
    /Walk to the stairs/.test(stepText) &&
    /The elevator is out of service/.test(stepText),
  stepText.replace(/\n+/g, " | ")
);
await kiosk.screenshot({ path: `${OUT}/step8b-elevator-out.png` });
await kiosk.close();
await lift.click();
await page.getByText("All changes saved").waitFor({ timeout: 15000 });
check(
  "A13",
  "Switching it back on puts it back in service",
  (await api(`/annotations?area_id=${eya.id}`)).floor_transitions
    .filter(t => t.transition_type === "elevator")
    .every(t => t.active)
);
check("A10", "No uncaught page errors", errors.length === 0, errors[0]);

// Put EA-305's generated door back, as seed_eya_routes made it.
if (door) {
  const restored = await api("/annotations/nodes/", {
    method: "POST",
    data: {
      floor: door.floor,
      room: door.room,
      name: door.name,
      node_type: door.node_type,
      geometry: door.geometry,
      metadata: door.metadata,
      connection_mode: "no_connection",
    },
  });
  for (const edge of doorEdges) {
    const other = edge.from_node === door.id ? edge.to_node : edge.from_node;
    await api("/annotations/edges/", {
      method: "POST",
      data: { from_node: restored.id, to_node: other, metadata: edge.metadata },
    });
  }
}

await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
