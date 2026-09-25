// Step 8b browser QA: Map Annotation on the real model, against the backend.
// Places corridor points and a room door on the third floor, checks what was
// saved, then deletes everything it placed (so it can be re-run).
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
  "It shows the saved graph (starter routes: 3 of 92 rooms placed)",
  (await stat("Rooms placed")) === "3 of 92" && (await stat("Points")) === "9",
  `${await stat("Rooms placed")}, ${await stat("Points")} points`
);
await page.screenshot({ path: `${OUT}/step8b-first-floor.png` });

await page.getByRole("button", { name: "3F", exact: true }).click();
check(
  "A3",
  "Switching to 3F lists that floor's rooms",
  await page
    .getByText("Rooms on this floor (16)")
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
await page.mouse.click(...spot(30, 60));
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
  await page.getByText(/^Connected to: Corridor 3F/).isVisible()
);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/step8b-third-floor.png` });

await page.getByRole("button", { name: "Isometric" }).click();
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}/step8b-isometric.png` });
await page.getByRole("button", { name: "Top down" }).click();
await page.waitForTimeout(3500);

// Clean up with the Delete tool, clicking the same spots.
await page.getByRole("button", { name: "Delete", exact: true }).click();
for (const [dx, dy] of [
  [30, 60],
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
await page.getByRole("button", { name: "EA-306 not placed" }).click();
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
  .getByRole("button", { name: "EA-306 not placed" })
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
    .getByRole("button", { name: "EA-306 not placed" })
    .getByText(nameBefore || "Room EA-306", { exact: true })
    .waitFor({ timeout: 15000 })
    .then(
      () => true,
      () => false
    )
);
await page.getByRole("button", { name: "Select", exact: true }).click();
check("A10", "No uncaught page errors", errors.length === 0, errors[0]);

await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
