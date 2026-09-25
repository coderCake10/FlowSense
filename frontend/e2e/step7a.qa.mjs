// Step 7a browser QA: the kiosk loads the compressed EYA model and its Draco
// decoder from this app only (no CDN), so it works on an offline network.
// Usage (see docs/qa/step-07a-test-report.md):
//   npx vite --host 127.0.0.1 --port 3000
//   npm run qa:step7a
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const origin = new URL(BASE).origin;
const requests = [];
const errors = [];
page.on("request", r => requests.push(r.url()));
page.on("pageerror", e => errors.push(e.message));
const model = page.waitForResponse(r => r.url().endsWith("/models/EYA.glb"), {
  timeout: 60000,
});

await page.goto(`${BASE}/kiosk`);
const modelResponse = await model.catch(() => null);
check(
  "M1",
  "Kiosk downloads the compressed EYA model",
  modelResponse?.ok(),
  modelResponse ? `HTTP ${modelResponse.status()}` : "no request"
);
const rendered = await page
  .getByText("You are here", { exact: true })
  .waitFor({ timeout: 120000 })
  .then(
    () => true,
    () => false
  );
check("M2", "Model decodes and the map renders", rendered);
check(
  "M3",
  "Draco decoder is loaded from this app",
  requests.some(u => u.startsWith(`${origin}/draco/draco_decoder.wasm`)) &&
    requests.some(u => u.startsWith(`${origin}/draco/draco_wasm_wrapper.js`))
);
// Web fonts still come from Google Fonts (tracked as QA-69); everything the
// map needs must come from this app.
const external = requests.filter(
  u =>
    /^https?:/.test(u) &&
    !u.startsWith(origin) &&
    !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)
);
check(
  "M4",
  "Map needs no outside server: no CDN request for models or the decoder",
  external.length === 0,
  external.slice(0, 3).join(", ")
);
check(
  "M5",
  "Map does not show the error message",
  !(await page.getByText("map isn't available").isVisible())
);
await page
  .getByRole("button", { name: /Office of the Dean \(College/ })
  .click();
check(
  "M6",
  "Existing routes still line up with the new model (route preview shown)",
  await page.getByText(/Route preview · EA-110/).isVisible()
);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/step7a-kiosk-eya.png` });
check("M7", "No uncaught page errors", errors.length === 0, errors[0]);

await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
