// Step 1 browser QA: kiosk flow, label layering, auth validation, sign-out dialog.
// Usage (see docs/qa/step-01-test-report.md):
//   pnpm exec vite --port 3000                                  # no API configured
//   VITE_API_BASE_URL=/api/v1 pnpm exec vite --port 3002        # API configured (mocked here)
//   pnpm run qa:step1
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const API_BASE = process.env.API_BASE_URL ?? "http://127.0.0.1:3002";
const OUT = process.env.OUT ?? "e2e/output";
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (id, name, pass, detail = "") => {
  results.push({ id, name, pass, detail });
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
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));

// ---------------- Kiosk ----------------
await page.goto(`${BASE}/kiosk`);
const dean = page.getByRole("button", {
  name: /Office of the Dean \(College of Computer Studies\)/,
});
const faculty = page.getByRole("button", {
  name: /Faculty Center \(College of Computer Studies\)/,
});
await dean.click();
check(
  "K1",
  "Selecting a destination opens no dialog",
  (await page.getByRole("dialog").count()) === 0
);
const changeBtn = page.getByRole("button", { name: "Change destination" });
check(
  "K2",
  "Labelled 'Change destination' is visible in preview",
  await changeBtn.isVisible()
);

await page.getByRole("button", { name: "Add to queue", exact: true }).click();
check(
  "K3",
  "Add to queue does not open a dialog/QR",
  (await page.getByRole("dialog").count()) === 0
);
check(
  "K4",
  "Button becomes 'In queue' (disabled)",
  await page.getByRole("button", { name: "In queue", exact: true }).isDisabled()
);
check(
  "K5",
  "Queue (1) button appears",
  await page.getByRole("button", { name: "Queue (1)" }).isVisible()
);

await faculty.click();
await page.getByRole("button", { name: "Add to queue", exact: true }).click();
check(
  "K6",
  "Queue button visible while another destination is previewed",
  await page.getByRole("button", { name: "Queue (2)" }).isVisible()
);

await changeBtn.click();
check(
  "K7",
  "Change destination clears the selection",
  await page.getByText("Select an office to see the walking route").isVisible()
);
check(
  "K8",
  "Change destination focuses the search box",
  await page.evaluate(
    () =>
      document.activeElement?.getAttribute("aria-label") ===
      "Search destinations"
  )
);

// Navigate (architecture notes, Kiosk → Interactive 3D Map): activates the
// queue, starts the first stop, and opens the modal with stops + QR panel.
await dean.click();
await page.getByRole("button", { name: /^Navigate$/ }).click();
const dialog = page.getByRole("dialog");
await dialog.waitFor();
const stops = dialog
  .getByRole("list", { name: "Queued stops" })
  .getByRole("listitem");
check(
  "K9",
  "Navigate opens the destination queue modal",
  await dialog.getByText("Destination queue").isVisible()
);
check(
  "K10",
  "Modal lists queued stops in order; first stop is being navigated",
  (await stops.count()) === 2 &&
    (await stops.nth(0).textContent())?.includes(
      "EA-110 · First floor · Navigating now"
    ) &&
    (await stops.nth(1).textContent())?.includes("EA-111")
);
check(
  "K11",
  "Modal presents the phone handoff (QR) panel",
  await dialog
    .getByRole("region", { name: "Continue on your phone" })
    .isVisible()
);

// Wait for the model so map labels exist, then test the layering fix.
const youAreHere = page.getByText("You are here", { exact: true });
let labelsLoaded = true;
try {
  await youAreHere.waitFor({ state: "attached", timeout: 120000 });
} catch {
  labelsLoaded = false;
}
check("K12", "Model and 'You are here' label render", labelsLoaded);
if (labelsLoaded) {
  await page.waitForTimeout(500); // let the dialog finish its open animation
  const covered = await page.evaluate(() => {
    const label = [...document.querySelectorAll("span")].find(
      s => s.textContent === "You are here"
    );
    if (!label) return "no-label";
    const r = label.getBoundingClientRect();
    const top = document.elementFromPoint(
      r.x + r.width / 2,
      r.y + r.height / 2
    );
    return top === label || label.contains(top) ? "label-on-top" : "covered";
  });
  check(
    "K13",
    "Dialog overlay covers map labels (overlap bug fixed)",
    covered === "covered",
    covered
  );
}
await page.screenshot({ path: `${OUT}/kiosk-queue-dialog.png` });

await dialog.getByRole("button", { name: "Follow on this kiosk" }).click();
await dialog.waitFor({ state: "detached" });
check(
  "K14",
  "'Follow on this kiosk' closes the modal and the route stays active",
  await page.getByText(/Follow the highlighted route · EA-110/).isVisible()
);
check(
  "K15",
  "Change destination still available while navigating",
  await changeBtn.isVisible()
);
await page.screenshot({ path: `${OUT}/kiosk-navigating.png` });

const next = page.getByRole("button", { name: /Next stop · EA-111/ });
check(
  "K16",
  "Next stop offers the other queued destination",
  await next.isVisible()
);
await next.click();
check(
  "K17",
  "Next stop navigates to it and drops the finished stop",
  (await page.getByText(/Follow the highlighted route · EA-111/).isVisible()) &&
    (await page.getByRole("button", { name: "Queue (1)" }).isVisible())
);

await page.getByRole("button", { name: "Queue (1)" }).click();
await dialog.waitFor();
await dialog.getByRole("button", { name: /Remove EA-111/ }).click();
check(
  "K18",
  "Removing the stop being navigated empties the queue and ends that route",
  (await dialog.getByText("Your queue is empty").isVisible()) &&
    (await page
      .getByText("Select an office to see the walking route")
      .isVisible())
);
await page.keyboard.press("Escape");
await dialog.waitFor({ state: "detached" });

await page
  .getByRole("button", { name: /Guidance and Counseling Center/ })
  .click();
await page.getByRole("button", { name: /^Navigate$/ }).click();
await dialog.waitFor();
check(
  "K19",
  "Empty queue + selection: Navigate makes it the only stop and starts it",
  (await stops.count()) === 1 &&
    (await stops.nth(0).textContent())?.includes(
      "EA-101A · First floor · Navigating now"
    )
);
await page.keyboard.press("Escape");
check(
  "K20",
  "No uncaught page errors in kiosk",
  errors.length === 0,
  errors.join(" | ")
);

// ---------------- Auth (no API configured) ----------------
await page.goto(`${BASE}/auth`);
const send = page.getByRole("button", { name: "Send sign-in code" });
const email = page.getByLabel("Email address");
const fieldMsg = async () =>
  (await page.locator("#auth-email-error").textContent())?.trim();
await send.click();
check(
  "A1",
  "Empty email rejected",
  (await fieldMsg()) === "Enter your institutional email address."
);
await email.fill("not-an-email");
await send.click();
check(
  "A2",
  "Malformed email rejected",
  (await fieldMsg()) === "Enter a valid email address."
);
await email.fill("someone@gmail.com");
await send.click();
check(
  "A3",
  "Non-AUF domain rejected",
  (await fieldMsg()) === "Use your @auf.edu.ph email address."
);
check(
  "A4",
  "Field marked aria-invalid",
  (await email.getAttribute("aria-invalid")) === "true"
);
await email.fill("admin@auf.edu.ph");
await page.keyboard.press("Enter");
check(
  "A5",
  "Without backend: clear 'not connected' error, no fake success",
  (await page.getByRole("alert").textContent())?.includes("not connected") &&
    (await page.getByText("Check your inbox").count()) === 0
);
check(
  "A6",
  "Demo-state text removed",
  (await page.getByText("demo state").count()) === 0
);

// ---------------- Auth (API configured, mocked backend) ----------------
const api = await ctx.newPage();
let verifyAttempts = 0;
await api.route("**/api/v1/auth/login", r =>
  r.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      message: "If an account exists for that email, a code has been sent.",
    }),
  })
);
await api.route("**/api/v1/auth/verify", async r => {
  verifyAttempts++;
  const body = JSON.parse(r.request().postData() ?? "{}");
  if (verifyAttempts === 2) return r.fulfill({ status: 429, body: "{}" });
  if (body.token === "123456" && body.email === "admin@auf.edu.ph")
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  return r.fulfill({ status: 401, body: "{}" });
});
// After sign-in the admin shell's route guard loads /auth/me (step 4a).
await api.route("**/api/v1/auth/me", r =>
  r.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: 1,
      full_name: "Admin Admin",
      email: "admin@auf.edu.ph",
      role: "super admin",
    }),
  })
);
await api.goto(`${API_BASE}/auth`);
await api.getByLabel("Email address").fill("  Admin@AUF.edu.ph ");
await api.getByRole("button", { name: "Send sign-in code" }).click();
const codeInput = api.getByLabel("Authentication code");
await codeInput.waitFor();
check(
  "A7",
  "Valid email advances to code step with non-enumerating copy",
  await api
    .getByText(/If an administrator account exists for admin@auf.edu.ph/)
    .isVisible()
);
await codeInput.fill("12ab3");
check(
  "A8",
  "Code input keeps digits only",
  (await codeInput.inputValue()) === "123"
);
await api.getByRole("button", { name: "Verify and sign in" }).click();
check(
  "A9",
  "Short code rejected client-side",
  (await api.locator("#auth-code-error").textContent())?.includes("6 digits")
);
await codeInput.fill("999999");
await api.getByRole("button", { name: "Verify and sign in" }).click();
await api.getByRole("alert").waitFor();
check(
  "A10",
  "Wrong code → 'incorrect or has expired'",
  (await api.getByRole("alert").textContent())?.includes(
    "incorrect or has expired"
  )
);
await codeInput.fill("111111");
await api.getByRole("button", { name: "Verify and sign in" }).click();
await api.getByText(/Too many attempts/).waitFor();
check(
  "A12",
  "HTTP 429 → rate-limit message",
  await api.getByText(/Too many attempts/).isVisible()
);
await api.getByRole("button", { name: "Send a new code" }).click();
check(
  "A13",
  "Resend shows confirmation toast",
  await api
    .getByText("A new code was sent if the account exists.")
    .waitFor({ timeout: 5000 })
    .then(
      () => true,
      () => false
    )
);
await codeInput.fill("123456");
await Promise.all([
  api.waitForURL(`${API_BASE}/`),
  api.getByRole("button", { name: "Verify and sign in" }).click(),
]);
check("A14", "Correct code signs in and redirects to dashboard", true);

// ---------------- Sign-out dialog ----------------
await api.route("**/api/v1/auth/logout", r => r.fulfill({ status: 204 }));
let nativeDialog = false;
api.on("dialog", d => {
  nativeDialog = true;
  d.dismiss();
});
await api.getByRole("button", { name: /Admin Admin/ }).click();
await api.getByRole("button", { name: "Sign out" }).click();
const alert = api.getByRole("alertdialog");
await alert.waitFor();
check(
  "S1",
  "Sign out opens an in-app alert dialog (not window.confirm)",
  !nativeDialog && (await alert.getByText("Sign out of FlowSense?").isVisible())
);
await api.screenshot({ path: `${OUT}/signout-dialog.png` });
await alert.getByRole("button", { name: "Stay signed in" }).click();
await api
  .getByRole("alertdialog")
  .waitFor({ state: "detached", timeout: 3000 })
  .catch(() => {});
check(
  "S2",
  "Cancel keeps the user on the dashboard",
  (await api.getByRole("alertdialog").count()) === 0 &&
    api.url() === `${API_BASE}/`
);
await api.getByRole("button", { name: /Admin Admin/ }).click();
await api.getByRole("button", { name: "Sign out" }).click();
const [logoutReq] = await Promise.all([
  api.waitForRequest("**/api/v1/auth/logout"),
  api.waitForURL("**/auth"),
  api
    .getByRole("alertdialog")
    .getByRole("button", { name: "Sign out" })
    .click(),
]);
check(
  "S3",
  "Confirm calls POST /auth/logout and returns to /auth",
  logoutReq.method() === "POST"
);

await browser.close();
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
