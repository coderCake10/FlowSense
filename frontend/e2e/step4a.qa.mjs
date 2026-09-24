// Step 4a end-to-end QA against the real backend (no mocks): admin route
// guard, passwordless sign-in with the emailed code and link, sign-out.
//
// Needs Django (console email backend, CELERY_TASK_ALWAYS_EAGER=True,
// ADMIN_SESSION_COOKIE_SECURE=False) logging to $BACKEND_LOG, an admin created
// with `manage.py create_admin --email head@auf.edu.ph --name "Maria Santos"
// --role "super admin"`, and the frontend with VITE_API_BASE_URL=/api/v1
// (Vite proxies /api to Django). See docs/qa/step-04a-test-report.md.
import { readFileSync, statSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const LOG = process.env.BACKEND_LOG ?? "/tmp/flowsense-django.log";
const EMAIL = process.env.ADMIN_EMAIL ?? "head@auf.edu.ph";
const NAME = process.env.ADMIN_NAME ?? "Maria Santos";

const results = [];
const check = (id, name, pass, detail = "") => {
  results.push({ id, pass: Boolean(pass) });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${id} ${name}${detail ? " — " + detail : ""}`
  );
};
const logSize = () => statSync(LOG).size;
/** Waits for the next sign-in email printed to the backend log after `offset`. */
async function nextEmail(offset) {
  for (let i = 0; i < 50; i++) {
    const text = readFileSync(LOG, "utf8").slice(offset);
    const code = text.match(/login code is: (\d{6})/)?.[1];
    const link = text.match(/(http\S+\/auth\?email=\S+)/)?.[1];
    if (code && link) return { code, link };
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error("No sign-in email appeared in the backend log");
}
const visible = l =>
  l.waitFor({ timeout: 10000 }).then(
    () => true,
    () => false
  );

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));

// Guard: no session → sign-in page.
await page.goto(`${BASE}/`);
await page.waitForURL("**/auth", { timeout: 10000 }).catch(() => {});
check(
  "G1",
  "Admin pages redirect to /auth without a session",
  page.url().endsWith("/auth")
);

// Sign in with the emailed code.
let offset = logSize();
await page.getByLabel("Email address").fill(EMAIL);
await page.getByRole("button", { name: "Send sign-in code" }).click();
check(
  "L1",
  "Requesting a code advances to the code step",
  await visible(page.getByLabel("Authentication code"))
);
const first = await nextEmail(offset);
check(
  "L2",
  "The backend emails a 6-digit code and a link",
  /^\d{6}$/.test(first.code) && first.link.startsWith(BASE)
);

await page
  .getByLabel("Authentication code")
  .fill(first.code === "000000" ? "111111" : "000000");
await page.getByRole("button", { name: "Verify and sign in" }).click();
check(
  "L3",
  "A wrong code is rejected by the real backend",
  await visible(
    page.getByRole("alert").filter({ hasText: "incorrect or has expired" })
  )
);

await page.getByLabel("Authentication code").fill(first.code);
await Promise.all([
  page.waitForURL(`${BASE}/`),
  page.getByRole("button", { name: "Verify and sign in" }).click(),
]);
check(
  "L4",
  "The right code signs in and opens the dashboard",
  page.url() === `${BASE}/`
);
check(
  "L5",
  "The sidebar shows the real admin from /auth/me (not the placeholder)",
  (await visible(page.getByText(NAME).first())) &&
    (await page.getByText(EMAIL).first().isVisible()) &&
    (await page.getByText("Admin Admin").count()) === 0
);
const cookies = await context.cookies();
check(
  "L6",
  "The session cookie is HttpOnly",
  cookies.some(c => c.name === "flowsense_admin_session" && c.httpOnly)
);
await page.reload();
check(
  "L7",
  "The session survives a reload",
  await visible(page.getByText(NAME).first())
);
await page.screenshot({ path: "e2e/output/step4a-dashboard.png" });

// Sign out.
await page.getByRole("button", { name: new RegExp(NAME) }).click();
await page.getByRole("button", { name: "Sign out" }).click();
await Promise.all([
  page.waitForURL("**/auth"),
  page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Sign out" })
    .click(),
]);
await page.goto(`${BASE}/analytics`);
await page.waitForURL("**/auth", { timeout: 10000 }).catch(() => {});
check(
  "S1",
  "After sign-out, admin pages redirect to /auth again",
  page.url().endsWith("/auth")
);

// Sign in with the emailed link.
offset = logSize();
await page.getByLabel("Email address").fill(EMAIL);
await page.getByRole("button", { name: "Send sign-in code" }).click();
const second = await nextEmail(offset);
await page.goto(second.link);
await page.waitForURL(`${BASE}/`, { timeout: 10000 }).catch(() => {});
check(
  "K1",
  "The emailed link signs in with one click",
  page.url() === `${BASE}/` && (await visible(page.getByText(NAME).first()))
);

const fresh = await browser.newContext();
const again = await fresh.newPage();
await again.goto(second.link);
check(
  "K2",
  "A used link is refused with a clear message",
  await visible(
    again
      .getByRole("alert")
      .filter({ hasText: "invalid, already used, or expired" })
  )
);
check(
  "K3",
  "The token is removed from the address bar",
  !again.url().includes("token=")
);
await fresh.close();

check("E1", "No uncaught page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
