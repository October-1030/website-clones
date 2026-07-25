/* eslint-disable @typescript-eslint/no-require-imports -- Reuses the existing global Playwright installation. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const RUN_DIR = path.join(ROOT, "docs", "evidence", "p16-usage", RUN_ID);
const BASE_URL = process.env.P16_E2E_BASE_URL || "http://127.0.0.1:3000";

function findExistingPath(candidates, label) {
  const found = candidates.filter(Boolean).find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`${label} not found. Checked: ${candidates.filter(Boolean).join(", ")}`);
  return found;
}

function loadPlaywright() {
  const modulePath = findExistingPath([
    process.env.PLAYWRIGHT_MODULE_PATH,
    process.env.APPDATA && path.join(process.env.APPDATA, "npm", "node_modules", "playwright"),
    path.join(ROOT, "node_modules", "playwright"),
  ], "Existing Playwright module");
  return { modulePath, playwright: require(modulePath) };
}

function findBrowserExecutable() {
  return findExistingPath([
    process.env.PLAYWRIGHT_CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    "D:\\projects\\Tools\\scrapling\\browsers\\chromium-1228\\chrome-win64\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ], "Existing Chromium browser");
}

function observe(page, bucket) {
  page.on("console", (message) => { if (message.type() === "error") bucket.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => bucket.pageErrors.push(error.message));
  page.on("requestfailed", (request) => bucket.requestFailures.push({ url: request.url(), error: request.failure()?.errorText || "unknown" }));
}

async function main() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const { modulePath, playwright } = loadPlaywright();
  const executablePath = findBrowserExecutable();
  const browser = await playwright.chromium.launch({ executablePath, headless: true });
  const observations = { consoleErrors: [], pageErrors: [], requestFailures: [] };
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    observe(desktop, observations);
    const response = await desktop.goto(`${BASE_URL}/pro/session?refresh=usage-p16`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200);
    await desktop.getByText("Local mode is not metered. Sign in to sync monthly usage.").waitFor({ state: "visible" });
    await desktop.screenshot({ path: path.join(RUN_DIR, "desktop-usage-banner.png"), fullPage: true });
    await desktop.getByRole("button", { name: "Profile" }).click();
    const menu = desktop.getByRole("dialog", { name: "Account menu" });
    await menu.waitFor({ state: "visible" });
    await menu.getByText("Local plan").waitFor({ state: "visible" });
    await menu.getByText("AI requests left").waitFor({ state: "visible" });
    const localLabels = await menu.getByText("Local", { exact: true }).count();
    assert.ok(localLabels >= 3, `Expected local unmetered labels, found ${localLabels}`);

    const detectorResult = await desktop.evaluate(async () => {
      const text = "This writing sample contains enough material for a responsible signal review. It varies sentence length and does not claim to identify authorship.";
      const apiResponse = await fetch("/api/writing/detector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = await apiResponse.json();
      return { status: apiResponse.status, kind: payload.artifact?.kind, metered: payload.usage?.metered };
    });
    assert.deepEqual(detectorResult, { status: 200, kind: "detector", metered: false });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    observe(mobile, observations);
    await mobile.goto(`${BASE_URL}/pro/session?refresh=usage-p16-mobile`, { waitUntil: "networkidle" });
    await mobile.getByText("Local mode is not metered. Sign in to sync monthly usage.").waitFor({ state: "visible" });
    await mobile.getByRole("button", { name: "Profile" }).click();
    await mobile.getByRole("dialog", { name: "Account menu" }).waitFor({ state: "visible" });
    const dimensions = await mobile.evaluate(() => ({ viewport: window.innerWidth, body: document.body.scrollWidth, root: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `Body overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.root <= dimensions.viewport + 1, `Root overflow: ${JSON.stringify(dimensions)}`);
    await mobile.screenshot({ path: path.join(RUN_DIR, "mobile-account-usage.png"), fullPage: true });

    assert.deepEqual(observations.consoleErrors, []);
    assert.deepEqual(observations.pageErrors, []);
    assert.deepEqual(observations.requestFailures, []);
    fs.writeFileSync(path.join(RUN_DIR, "report.json"), JSON.stringify({
      passed: true,
      baseUrl: BASE_URL,
      browserVersion: await browser.version(),
      browserExecutable: executablePath,
      playwrightModule: modulePath,
      detectorResult,
      screenshots: ["desktop-usage-banner.png", "mobile-account-usage.png"],
      observations,
    }, null, 2));
    console.log(`PASS P16 usage flow ${RUN_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});