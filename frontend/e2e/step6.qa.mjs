// Step 6 end-to-end QA against the real backend: the Analytics page reads
// /api/v1/analytics/* and every filter re-scopes it.
//
// Same setup as step 4a (Django logging to $BACKEND_LOG with the console
// email backend, CELERY_TASK_ALWAYS_EAGER=True, ADMIN_SESSION_COOKIE_SECURE=False,
// the head@auf.edu.ph super admin, `seed_campus`, the frontend with
// VITE_API_BASE_URL=/api/v1). See docs/qa/step-06-test-report.md.
import { readFileSync, statSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const LOG = process.env.BACKEND_LOG ?? "/tmp/flowsense-django.log";
const EMAIL = process.env.ADMIN_EMAIL ?? "head@auf.edu.ph";

const results = [];
const check = (id, name, pass, detail = "") => {
  results.push({ id, pass: Boolean(pass) });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${name}${detail ? " — " + detail : ""}`);
};
const visible = (locator, timeout = 10000) =>
  locator.waitFor({ timeout }).then(() => true, () => false);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
const requests = [];
page.on("request", r => r.url().includes("/api/v1/analytics/") && requests.push(r.url()));

const offset = statSync(LOG).size;
await page.goto(`${BASE}/auth`);
await page.getByLabel("Email address").fill(EMAIL);
await page.getByRole("button", { name: "Send sign-in code" }).click();
let code;
for (let i = 0; i < 50 && !code; i++) {
  code = readFileSync(LOG, "utf8").slice(offset).match(/login code is: (\d{6})/)?.[1];
  if (!code) await new Promise(r => setTimeout(r, 200));
}
await page.getByLabel("Authentication code").fill(code);
await Promise.all([page.waitForURL(`${BASE}/`), page.getByRole("button", { name: "Verify and sign in" }).click()]);

await page.goto(`${BASE}/analytics`);
const overview = page.getByRole("region", { name: "Overview" });
check("A1", "The page loads real analytics (no demo notice)",
  (await visible(overview.getByText("Total searches"))) && (await page.getByText("Demo data").count()) === 0);
const expected = (await (await page.request.get(`${BASE}/api/v1/analytics/search?range=last_7_days`)).json()).data.totals.total;
const figure = async label => (await overview.getByText(label, { exact: true }).locator("xpath=following-sibling::p[1]").textContent())?.trim();
check("A2", "Total searches matches GET /analytics/search for the last 7 days",
  (await figure("Total searches")) === new Intl.NumberFormat("en-PH").format(expected), `API ${expected}`);

const before = requests.length;
await page.getByLabel("Date range").selectOption("today");
await page.waitForTimeout(1500);
const scoped = requests.slice(before);
check("A3", "Choosing Today re-fetches every section with range=today",
  ["search", "navigation", "kiosks", "qr", "sensors", "spatial", "system"].every(s => scoped.some(u => u.includes(`/analytics/${s}?`) && u.includes("range=today"))));

await page.getByLabel("Date range").selectOption("custom");
check("A4", "A custom range waits for both dates before loading", await visible(page.getByText(/Choose a start and end date/)));
await page.getByLabel("Start date").fill("2026-09-01");
await page.getByLabel("End date").fill("2026-09-30");
await page.waitForTimeout(1500);
check("A5", "Custom dates are sent to the API",
  requests.some(u => u.includes("range=custom") && u.includes("start_date=2026-09-01") && u.includes("end_date=2026-09-30")));

await page.getByLabel("Date range").selectOption("last_7_days");
const building = page.getByLabel("Building");
await building.selectOption({ label: "EYA Building" });
await page.getByLabel("Floor").selectOption({ label: "1F" });
await page.waitForTimeout(1500);
check("A6", "Building and floor filters reach navigation, sensors, and spatial (not search)",
  ["navigation", "sensors", "spatial"].every(s => requests.some(u => u.includes(`/analytics/${s}?`) && u.includes("area_id=") && u.includes("floor_id="))) &&
  !requests.some(u => u.includes("/analytics/search?") && u.includes("area_id=")));

check("A7", "Metrics the system doesn't record say so, with a reason",
  (await page.getByText("Not collected yet").count()) >= 5 && (await visible(page.getByText(/API requests aren't logged/).first())));

const trend = page.getByRole("region", { name: "Navigation analytics" });
await trend.getByText("Show as table").click();
check("A8", "The trend chart's values are available as a table",
  (await trend.locator("details[open] tbody tr").count()) === 7);
check("A9", "Charts are labelled images with a legend",
  (await page.locator('svg[role="img"]').count()) >= 5 && (await visible(trend.getByRole("list", { name: "Legend" }))));

check("A10", "The alert panel and the reports notice are shown",
  (await visible(page.getByText("Alert panel"))) && (await visible(page.getByText(/QA-65/))));
check("E1", "No uncaught page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
