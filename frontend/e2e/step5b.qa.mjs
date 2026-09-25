// Step 5b end-to-end QA against the real backend and broker (no mocks): the
// Dashboard, Hardware, Users, and Settings pages read and change real data.
//
// Needs everything step 4a needs (Django logging to $BACKEND_LOG with the
// console email backend, CELERY_TASK_ALWAYS_EAGER=True,
// ADMIN_SESSION_COOKIE_SECURE=False, the head@auf.edu.ph super admin, the
// frontend with VITE_API_BASE_URL=/api/v1), plus `seed_campus`, Mosquitto,
// `run_mqtt_consumer`, and `mosquitto_pub` with a sensor login in
// $MQTT_USER / $MQTT_PASSWORD. See docs/qa/step-05b-test-report.md.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const LOG = process.env.BACKEND_LOG ?? "/tmp/flowsense-django.log";
const EMAIL = process.env.ADMIN_EMAIL ?? "head@auf.edu.ph";
const MQTT_HOST = process.env.MQTT_HOST ?? "127.0.0.1";
const MQTT_USER = process.env.MQTT_USER ?? "flowsense_sensor_01";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD ?? "";

const RUN = Date.now().toString(36);
const DEVICE_ID = `esp32-qa-${RUN}`;
const DEVICE_NAME = `QA Sensor ${RUN}`;
const ADMIN_EMAIL = `qa-${RUN}@auf.edu.ph`;

const results = [];
const check = (id, name, pass, detail = "") => {
  results.push({ id, pass: Boolean(pass) });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${name}${detail ? " — " + detail : ""}`);
};
const visible = (locator, timeout = 10000) =>
  locator.waitFor({ timeout }).then(
    () => true,
    () => false
  );
const gone = (locator, timeout = 10000) =>
  locator.waitFor({ state: "detached", timeout }).then(
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
    code = readFileSync(LOG, "utf8").slice(offset).match(/login code is: (\d{6})/)?.[1];
    if (!code) await new Promise(r => setTimeout(r, 200));
  }
  await page.getByLabel("Authentication code").fill(code);
  await Promise.all([
    page.waitForURL(`${BASE}/`),
    page.getByRole("button", { name: "Verify and sign in" }).click(),
  ]);
}

function publishReading() {
  execFileSync("mosquitto_pub", [
    "-h", MQTT_HOST, "-u", MQTT_USER, "-P", MQTT_PASSWORD,
    "-t", "flowsense/sensors/eya/qa",
    "-m", JSON.stringify({
      device_id: DEVICE_ID,
      device_type: "sensor",
      mac_address: "24:6F:28:QA:00:01",
      signal_count: 11,
      estimated_density: 0.3,
      signal_strength: -60,
    }),
  ]);
}

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));

await signIn(page);

// ---------- Dashboard ----------
check(
  "D1",
  "The dashboard shows the live system status",
  await visible(page.getByText(/SYSTEM HEALTH · (OPERATIONAL|DEGRADED|CRITICAL|MAINTENANCE)/))
);
check(
  "D2",
  "The system summary counts the 92 seeded rooms",
  await visible(page.getByText(/\d+ \/ 92/))
);
check("D3", "No demo-data notice with the API connected", (await page.getByText("Demo data").count()) === 0);

// ---------- Hardware: discovery and registration ----------
publishReading();
await page.goto(`${BASE}/hardware`);
const row = page.getByRole("row").filter({ hasText: DEVICE_ID });
for (let i = 0; i < 10 && !(await row.count()); i++) {
  await page.getByRole("button", { name: "Refresh" }).click();
  await page.waitForTimeout(500);
}
check(
  "H1",
  "A sensor that publishes for the first time appears as Unregistered",
  (await visible(row)) && (await row.getByText("Unregistered").isVisible())
);
await row.getByRole("button", { name: "Register" }).click();
const registerDialog = page.getByRole("dialog");
await registerDialog.getByLabel("Device name").fill(DEVICE_NAME);
await registerDialog.getByLabel("Sampling interval (seconds)").fill("30");
await registerDialog.getByRole("button", { name: "Register device" }).click();
const namedRow = page.getByRole("row").filter({ hasText: DEVICE_NAME });
check(
  "H2",
  "Registering names the sensor and it shows Online (it reported seconds ago)",
  (await visible(namedRow)) && (await visible(namedRow.getByText("Online")))
);

await namedRow.getByRole("button", { name: "Manage" }).click();
const details = page.locator('[aria-label="Device details"]');
check(
  "H3",
  "Device details show the real device ID and sampling interval",
  (await visible(details.getByText(DEVICE_ID).first())) && (await visible(details.getByText("30 s")))
);

await details.getByRole("button", { name: "Edit" }).click();
const editDialog = page.getByRole("dialog");
await editDialog.getByLabel("Building").selectOption({ label: "EYA Building" });
await editDialog.getByLabel("Floor").selectOption({ label: "1F" });
await editDialog.getByRole("button", { name: "Save changes" }).click();
check(
  "H4",
  "Assigning EYA, 1F updates the registry location",
  await visible(namedRow.getByText("EYA Building · 1F"))
);

await details.getByRole("button", { name: "Disable" }).click();
const disabled = await visible(namedRow.getByText("Disabled"));
await details.getByRole("button", { name: "Enable" }).click();
check(
  "H5",
  "Disable, then Enable, updates the status",
  disabled && (await visible(namedRow.getByText("Online")))
);

await details.getByRole("button", { name: "Ping" }).click();
check(
  "H6",
  "Ping explains it isn't available yet (no firmware command channel)",
  await visible(page.getByText(/isn't available yet/))
);

await details.getByRole("button", { name: "Delete device" }).click();
await page.getByRole("alertdialog").getByRole("button", { name: "Delete device" }).click();
check("H7", "Deleting (decommissioning) removes the device from the registry", await gone(namedRow));

// ---------- Users ----------
await page.goto(`${BASE}/users`);
await page.getByRole("button", { name: "Add administrator" }).click();
const userDialog = page.getByRole("dialog");
await userDialog.getByLabel("Full name").fill("QA Temporary Admin");
await userDialog.getByLabel("Email").fill(ADMIN_EMAIL);
await userDialog.getByRole("button", { name: "Add administrator" }).click();
const userRow = page.getByRole("row").filter({ hasText: ADMIN_EMAIL });
check("U1", "Adding an administrator lists them as Enabled", (await visible(userRow)) && (await visible(userRow.getByText("Enabled"))));
await userRow.getByRole("button", { name: `Actions for ${ADMIN_EMAIL}` }).click();
await page.getByRole("menuitem", { name: "Disable administrator" }).click();
check("U2", "Disabling an administrator updates the status", await visible(userRow.getByText("Disabled")));
await userRow.getByRole("button", { name: `Actions for ${ADMIN_EMAIL}` }).click();
await page.getByRole("menuitem", { name: "Delete administrator" }).click();
await page.getByRole("alertdialog").getByRole("button", { name: "Delete administrator" }).click();
check("U3", "Deleting an administrator removes them", await gone(userRow));

// ---------- Settings ----------
await page.goto(`${BASE}/settings`);
const clearTime = page.getByLabel("Informational alert clear time");
await visible(clearTime);
const previous = await clearTime.inputValue();
await clearTime.selectOption({ label: "30 minutes" });
check("S1", "Changing the clear time saves the new policy", await visible(page.getByText(/cleared after 30 minutes/)));
// Put the previous value back (a non-standard value is only listed while it's current).
const standard = await clearTime.locator("option").evaluateAll(options => options.map(o => o.value));
await clearTime.selectOption(standard.includes(previous) ? previous : "3600");

await page.getByRole("button", { name: "Add semester" }).click();
const form = page.getByRole("form", { name: "Semester form" });
await form.getByLabel("Academic year").fill(`QA-${RUN}`.slice(0, 20));
await form.getByLabel("Semester").fill("QA Semester");
await form.getByLabel("Start date").fill("2027-01-10");
await form.getByLabel("End date").fill("2026-12-01");
check("S2", "An end date before the start date is caught before saving", await visible(form.getByRole("alert")));
await form.getByLabel("End date").fill("2027-05-20");
await form.getByRole("button", { name: "Save semester" }).click();
const semesterRow = page.getByRole("row").filter({ hasText: `QA-${RUN}`.slice(0, 20) });
check("S3", "The new semester is listed", await visible(semesterRow));
await semesterRow.getByRole("button", { name: /^Delete / }).click();
await page.getByRole("alertdialog").getByRole("button", { name: "Delete semester" }).click();
check("S4", "Deleting the semester removes it", await gone(semesterRow));

// ---------- Kiosk heartbeat and visitor sessions (QA-62) ----------
const kioskBrowser = await browser.newContext({ viewport: { width: 1366, height: 1024 }, hasTouch: true });
const kioskPage = await kioskBrowser.newPage();
kioskPage.on("pageerror", e => errors.push(`kiosk: ${e.message}`));
await kioskPage.goto(`${BASE}/attraction`);
const idText = kioskPage.getByText(/Kiosk ID kiosk-[a-z0-9]+/);
const announced = await visible(idText);
const kioskId = announced ? (await idText.textContent()).match(/kiosk-[a-z0-9]+/)[0] : "";
check("K1", "A new kiosk shows its ID on the attract screen until it's registered", announced, kioskId);

await page.goto(`${BASE}/hardware`);
const kioskRow = page.getByRole("row").filter({ hasText: kioskId });
check(
  "K2",
  "The kiosk appears on the Hardware page as an Unregistered kiosk",
  (await visible(kioskRow)) && (await kioskRow.getByText("Kiosk", { exact: true }).isVisible()) && (await kioskRow.getByText("Unregistered").isVisible())
);
await kioskRow.getByRole("button", { name: "Register" }).click();
await page.getByRole("dialog").getByLabel("Device name").fill(`QA Kiosk ${RUN}`);
await page.getByRole("dialog").getByRole("button", { name: "Register device" }).click();
const kioskNamed = page.getByRole("row").filter({ hasText: `QA Kiosk ${RUN}` });
await visible(kioskNamed);
await kioskNamed.getByRole("button", { name: "Manage" }).click();
const kioskDetails = page.locator('[aria-label="Device details"]');
check(
  "K3",
  "The registered kiosk is Online and reports its screen and touch support",
  (await visible(kioskNamed.getByText("Online"))) &&
    (await visible(kioskDetails.getByText("1366×1024"))) &&
    (await visible(kioskDetails.getByText("Touchscreen Status")))
);

const sessionsToday = async () =>
  (await (await page.request.get(`${BASE}/api/v1/analytics/dashboard`)).json()).data.today.kiosk_sessions;
const before = await sessionsToday();
await kioskPage.goto(`${BASE}/kiosk`);
// The kiosk learns it's registered from its next heartbeat (sent on load).
await kioskPage.waitForTimeout(1500);
await kioskPage.mouse.click(700, 40); // a visitor touches the screen
await kioskPage.waitForTimeout(1000);
await kioskPage.getByRole("button", { name: "Back" }).click();
await kioskPage.waitForURL("**/attraction");
await page.waitForTimeout(500);
check("K4", "A visitor's touch, then Back, is counted in today's kiosk sessions", (await sessionsToday()) === before + 1);
await kioskBrowser.close();
const kioskDeviceId = (await (await page.request.get(`${BASE}/api/v1/hardware/devices?search=${kioskId}`)).json()).data[0]?.id;
if (kioskDeviceId) await page.request.delete(`${BASE}/api/v1/hardware/devices/${kioskDeviceId}`);

// ---------- Activity on the dashboard ----------
await page.goto(`${BASE}/`);
check(
  "D4",
  "The dashboard's recent activity lists these admin actions",
  await visible(page.getByText(/Deleted semester|Changed setting|Decommissioned device/).first())
);

check("E1", "No uncaught page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
