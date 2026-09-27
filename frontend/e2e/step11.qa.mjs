// Step 11 browser QA against the real backend: Analytics › Reports and
// exports generates snapshot reports, opens the printable page (PDF) and
// downloads the CSV ZIP.
//
// Needs the backend on :8000 logging to $BACKEND_LOG (CELERY_TASK_ALWAYS_EAGER
// or a Celery worker), the head@auf.edu.ph super admin, and
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

const browser = await chromium.launch();
// A browser in another time zone than the server: the report must still
// show the server's days.
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
  timezoneId: "America/New_York",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await signIn(page);

await page.goto(`${BASE}/analytics`);
const generate = page.getByRole("button", { name: "Generate report" });
await generate.scrollIntoViewIfNeeded();

// Validation: no sections, or an end before the start, can't be generated.
for (const section of [
  "Search",
  "Navigation and routes",
  "Kiosks",
  "QR handoff",
  "Sensors",
  "Crowd density",
  "System performance",
  "Daily activity",
]) {
  await page.getByRole("checkbox", { name: section }).uncheck();
}
check(
  "F1",
  "With no sections, Generate is disabled and says why",
  (await generate.isDisabled()) &&
    (await visible(page.getByText("Choose at least one section.")))
);
await page.getByRole("checkbox", { name: "Search" }).check();
await page.getByRole("checkbox", { name: "Daily activity" }).check();
const from = await page.getByLabel("From", { exact: true }).inputValue();
const to = await page.getByLabel("To", { exact: true }).inputValue();
await page.getByLabel("From", { exact: true }).fill("2026-12-31");
check(
  "F2",
  "An end before the start is refused",
  (await generate.isDisabled()) &&
    (await visible(page.getByText("The end can't be before the start.")))
);
await page.getByLabel("From", { exact: true }).fill(from);

// PDF: generate, then the printable page opens.
await generate.click();
check(
  "P1",
  "Generating opens the printable report",
  await page.waitForURL(/\/analytics\/reports\/\d+$/, { timeout: 30000 }).then(
    () => true,
    () => false
  ),
  page.url()
);
const toDay = new Date(`${to}T12:00:00`);
const label = toDay
  .toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  .replace(",", "");
check(
  "P2",
  "It shows the chosen period in the server's days",
  await visible(
    page.getByRole("heading", {
      level: 1,
      name: new RegExp(label.replace(/ (\d{4})$/, ", $1")),
    })
  ),
  label
);
check(
  "P3",
  "Only the chosen sections, in report order",
  (await page.getByRole("heading", { level: 2 }).allTextContents()).join(
    " | "
  ) === "Search | Daily activity"
);
check(
  "P4",
  "Search figures are shown",
  await visible(page.getByText("Total searches"))
);
check(
  "P5",
  "Print or save as PDF is offered",
  await visible(page.getByRole("button", { name: "Print or save as PDF" }))
);
await page.emulateMedia({ media: "print" });
check(
  "P6",
  "Printing hides the admin sidebar and the buttons",
  !(await page
    .getByRole("button", { name: "Print or save as PDF" })
    .isVisible()) && !(await page.getByText("OPERATIONS").isVisible())
);
await page.emulateMedia({ media: "screen" });

const [zip] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "CSV" }).click(),
]);
check(
  "C1",
  "CSV downloads as a ZIP",
  /^flowsense-report-\d+\.zip$/.test(zip.suggestedFilename()),
  zip.suggestedFilename()
);

// CSV format from the panel downloads straight away; the list shows both.
await page.goto(`${BASE}/analytics`);
await page
  .getByRole("button", { name: "Generate report" })
  .scrollIntoViewIfNeeded();
await page.getByRole("radio", { name: /CSV/ }).check();
const [direct] = await Promise.all([
  page.waitForEvent("download", { timeout: 30000 }),
  page.getByRole("button", { name: "Generate report" }).click(),
]);
check(
  "C2",
  "CSV format downloads the ZIP when ready",
  /\.zip$/.test(direct.suggestedFilename())
);
check(
  "L1",
  "Recent reports lists them as ready",
  (await page.getByRole("cell", { name: "Ready" }).count()) >= 2
);

check("E1", "No uncaught page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
