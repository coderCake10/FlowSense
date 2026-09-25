// Missing-model QA: the kiosk must explain a missing building model clearly.
// Run against a dev server whose models folder is empty/unreachable:
//   VITE_MODELS_BASE_URL=/no-such-models npx vite --host 127.0.0.1 --port 3004 --strictPort
//   npm run qa:models
import { chromium } from "playwright";

const BASE = process.env.MISSING_MODELS_BASE_URL ?? "http://127.0.0.1:3004";
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
await page.goto(`${BASE}/kiosk`);
const alert = page
  .getByRole("alert")
  .filter({ hasText: "map isn't available" });
const shown = await alert.waitFor({ timeout: 30000 }).then(
  () => true,
  () => false
);
check("MD1", "Kiosk shows a clear 'map isn't available' message", shown);
check(
  "MD2",
  "Development build names the missing file and the fix",
  shown &&
    (await alert.getByText("/no-such-models/EYA.glb").isVisible()) &&
    (await alert.getByText("npm run models:check").isVisible())
);
await page
  .getByRole("button", { name: /Office of the Dean \(College/ })
  .click();
check(
  "MD3",
  "The rest of the kiosk (destination list, route panel) still works",
  await page.getByText(/Route preview · EA-110/).isVisible()
);
await page.screenshot({ path: "e2e/output/models-missing.png" });
await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
