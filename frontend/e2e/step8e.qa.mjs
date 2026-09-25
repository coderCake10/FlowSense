// Step 8e browser QA: the kiosk's Destination Queue is arranged for the
// shortest walk when Navigate is pressed, unless "Keep my order" is on.
// Needs the backend on :8000 with `seed_campus` and `seed_eya_routes` run:
//   VITE_API_BASE_URL=/api/v1 npx vite --host 127.0.0.1 --port 3002
//   npm run qa:step8e
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

async function queueThree(page) {
  await page.goto(`${BASE}/kiosk`);
  await page
    .getByText(/^92 Destinations · by floor$/)
    .waitFor({ timeout: 60000 });
  // All three are first-floor rooms in the default directory.
  for (const name of [
    /Office of the Dean, College of Computer Studies/,
    /Guidance and Counseling Center \(Extension Office\)/,
    /Faculty Center, College of Computer Studies/,
  ]) {
    // The animated route keeps software rendering busy, so click directly
    // instead of waiting for scrolling to settle.
    await page.getByRole("button", { name }).first().dispatchEvent("click");
    await page
      .getByRole("button", { name: "Add to queue", exact: true })
      .dispatchEvent("click");
  }
  await page
    .getByRole("button", { name: /^Queue \(\d+\)$/ })
    .first()
    .dispatchEvent("click");
  await page.getByRole("dialog").waitFor();
}

const stopsInDialog = page =>
  page
    .getByRole("list", { name: "Queued stops" })
    .locator(":scope > li")
    .allInnerTexts()
    .then(items => items.map(text => text.match(/EA-\d+[A-Z]?/)?.[0]));

// Shortest walk (default).
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", e => errors.push(e.message));
const queued = [];
page.on("request", r => {
  if (r.url().includes("/navigation/routes") && r.method() === "POST")
    queued.push(JSON.parse(r.postData() ?? "{}"));
});
await queueThree(page);
check(
  "Q1",
  "The queue lists the stops in the order they were added",
  JSON.stringify(await stopsInDialog(page)) ===
    JSON.stringify(["EA-110", "EA-101A", "EA-111"])
);
check(
  "Q2",
  '"Keep my order" is offered and off by default',
  (await page.getByLabel(/Keep my order/).isVisible()) &&
    !(await page.getByLabel(/Keep my order/).isChecked())
);
await page
  .getByRole("dialog")
  .getByRole("button", { name: "Navigate" })
  .dispatchEvent("click");
await page.getByText("Stops arranged for the shortest walk").waitFor({
  timeout: 30000,
});
const arranged = await stopsInDialog(page);
check(
  "Q3",
  "Navigate arranges the stops for the shortest walk (west wing first, then down the east corridor)",
  JSON.stringify(arranged) === JSON.stringify(["EA-101A", "EA-111", "EA-110"]),
  arranged.join(" → ")
);
check(
  "Q4",
  "One multi-stop request asked for the optimized order",
  queued.some(
    body =>
      body.optimize_order === true && body.destination_node_ids?.length === 3
  )
);
check(
  "Q5",
  "The kiosk starts the first arranged stop",
  (
    await stopsInDialog(page).then(() =>
      page
        .getByRole("list", { name: "Queued stops" })
        .locator(":scope > li")
        .first()
        .innerText()
    )
  ).includes("Navigating now")
);
await page.screenshot({ path: `${OUT}/step8e-arranged.png` });

// Keep my order.
const kept = await browser.newPage({ viewport: { width: 1440, height: 900 } });
kept.on("pageerror", e => errors.push(e.message));
await queueThree(kept);
await kept.getByLabel(/Keep my order/).dispatchEvent("click");
await kept
  .getByRole("dialog")
  .getByRole("button", { name: "Navigate" })
  .dispatchEvent("click");
await kept.waitForTimeout(1500);
check(
  "Q6",
  '"Keep my order" keeps the visitor\'s order',
  JSON.stringify(await stopsInDialog(kept)) ===
    JSON.stringify(["EA-110", "EA-101A", "EA-111"])
);
check("Q7", "No uncaught page errors", errors.length === 0, errors[0]);

await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
