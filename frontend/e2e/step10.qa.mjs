// Step 10 browser QA against the real backend: Asset Management uploads,
// checks, activates and deletes building models, and the kiosk loads the
// activated model (falling back to the bundled one).
//
// Needs the backend on :8000 logging to $BACKEND_LOG (CELERY_TASK_ALWAYS_EAGER
// or a Celery worker), `seed_campus`, the head@auf.edu.ph super admin, the
// bundled models in client/public/models, and
//   VITE_API_BASE_URL=/api/v1 npx vite --host 127.0.0.1 --port 3002
// (see docs/setup/local-development.md#browser-qa-suites). The suite puts
// back whichever EYA model was live before it ran.
import { readFileSync, statSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.LIVE_BASE_URL ?? "http://127.0.0.1:3002";
const LOG = process.env.BACKEND_LOG ?? "/tmp/flowsense-django.log";
const EMAIL = process.env.ADMIN_EMAIL ?? "head@auf.edu.ph";
const MODELS = new URL("../client/public/models/", import.meta.url).pathname;
// The size the dialog shows, e.g. "17.3" (formatBytes: MB with one decimal).
const EYA_MB = (statSync(`${MODELS}EYA.glb`).size / 1024 ** 2).toFixed(1);
const RUN = Date.now().toString(36);
const NAME = `QA EYA ${RUN}`;

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

const api = async (page, path, init) => {
  const response = await page.request.fetch(`${BASE}/api/v1${path}`, init);
  return (await response.json()).data;
};
const eyaModel = async page =>
  (await api(page, "/map/areas")).find(a => a.code === "EYA")?.model ?? null;

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
const before = await eyaModel(page);

// Upload the bundled EYA model as a new asset for the EYA Building.
await page.goto(`${BASE}/assets`);
await page.getByRole("button", { name: "Upload model" }).first().click();
const dialog = page.getByRole("dialog");
await dialog.getByLabel("Model file").setInputFiles(`${MODELS}EYA.glb`);
await dialog.getByPlaceholder("EYA Building model").fill(NAME);
await dialog.getByLabel("Building").selectOption({ label: "EYA Building" });
check(
  "U1",
  "The dialog shows the chosen file and its size",
  await visible(dialog.getByText(`EYA.glb · ${EYA_MB} MB`))
);
await dialog.getByRole("button", { name: "Upload" }).click();
check(
  "U2",
  "Upload reports success and closes",
  await visible(page.getByText(`EYA.glb uploaded`))
);
const card = page.getByRole("listitem").filter({ hasText: NAME });
check(
  "U3",
  "The new asset is listed and selected",
  (await card.getAttribute("aria-current")) === "true"
);
check(
  "U4",
  "It is processed and validated (16 checks passed)",
  await visible(
    page.getByText("16 passed, 0 warnings, 0 errors").first(),
    30000
  )
);

// Model tab: the viewer and structure detection.
await page.getByRole("tab", { name: "Model", exact: true }).click();
await visible(page.getByRole("cell", { name: "FLOOR_6", exact: true }), 30000);
check(
  "M1",
  "Structure detection finds FLOOR_1 to FLOOR_6",
  (await page.getByRole("cell", { name: /^FLOOR_[1-6]$/ }).count()) === 6
);
check(
  "M2",
  "Walking heights match the kiosk (1F 0.93 m)",
  await visible(page.getByRole("cell", { name: "0.93 m" }))
);
check(
  "M3",
  "The 3D viewer shows the model",
  await visible(page.getByLabel("3D model viewer"))
);

// Activate: the kiosk's building now points at this asset.
await page.getByRole("button", { name: /Make v1 live/ }).click();
check(
  "A1",
  "Activation reports the new live version",
  await visible(page.getByText(`${NAME} v1 is now live`))
);
const live = await eyaModel(page);
const assets = await api(page, "/assets?page_size=100");
const qa = assets.find(a => a.name === NAME);
check(
  "A2",
  "GET /map/areas gives the kiosk this asset's model",
  live?.asset_id === qa?.id,
  JSON.stringify(live)
);

const kiosk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const loaded = [];
kiosk.on("request", r => {
  if (/\.glb|\/download/.test(r.url())) loaded.push(r.url().replace(BASE, ""));
});
await kiosk.goto(`${BASE}/kiosk`);
await kiosk.waitForTimeout(8000);
check(
  "K1",
  "The kiosk loads the live model from the Assets API",
  loaded.includes(live.url),
  loaded.join(", ")
);
check(
  "K2",
  "…and not the bundled EYA.glb",
  !loaded.includes("/models/EYA.glb")
);
await kiosk.close();

// A version that fails validation can't go live.
await page.getByRole("button", { name: "Upload a new version" }).click();
await page
  .getByRole("dialog")
  .getByLabel("Model file")
  .setInputFiles(`${MODELS}A.glb`);
await page.getByRole("dialog").getByRole("button", { name: "Upload" }).click();
check(
  "V1",
  "A model missing floors 5 and 6 fails validation",
  await visible(
    page.getByText(/Missing from the model: FLOOR_5, FLOOR_6/),
    30000
  )
);
check(
  "V2",
  "Make live is disabled with the reason",
  await visible(
    page.getByText(
      "Validation failed. Fix the errors and upload a new version."
    )
  )
);
check(
  "V3",
  "The live model is unchanged",
  (await eyaModel(page))?.asset_id === qa.id
);

// Activity and delete.
await page.getByRole("tab", { name: "Activity", exact: true }).click();
check(
  "H1",
  "Activity lists the upload",
  await visible(page.getByRole("cell", { name: `Uploaded ${NAME} (EYA.glb)` }))
);
check(
  "H2",
  "…and the failed validation",
  await visible(
    page.getByRole("cell", { name: `Validated ${NAME} v2: failed` })
  )
);

// Put back what was live before, then delete the QA asset.
if (before) {
  await api(
    page,
    `/assets/${before.asset_id}/versions/${before.version_id}/restore`,
    { method: "POST" }
  );
}
await page.reload();
await page.getByRole("listitem").filter({ hasText: NAME }).click();
await page.getByRole("button", { name: "Delete asset" }).click();
await page
  .getByRole("alertdialog")
  .getByRole("button", { name: "Delete asset" })
  .click();
check(
  "D1",
  "Delete removes the asset",
  await page
    .getByRole("listitem")
    .filter({ hasText: NAME })
    .waitFor({ state: "detached", timeout: 15000 })
    .then(
      () => true,
      () => false
    )
);
const after = await eyaModel(page);
check(
  "D2",
  "The live model is back to what it was",
  (after?.version_id ?? null) === (before?.version_id ?? null),
  JSON.stringify(after)
);

check("E1", "No uncaught page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const passed = results.filter(r => r.pass).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
