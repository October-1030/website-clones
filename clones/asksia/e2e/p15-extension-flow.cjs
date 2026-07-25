/* eslint-disable @typescript-eslint/no-require-imports -- Reuses the existing global Playwright installation. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const RUN_DIR = path.join(ROOT, "docs", "evidence", "p15-extension", RUN_ID);
const BASE_URL = process.env.P15_E2E_BASE_URL || "http://127.0.0.1:3000";

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
  page.on("console", (message) => {
    if (message.type() === "error") bucket.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => bucket.pageErrors.push(error.message));
  page.on("requestfailed", (request) => bucket.requestFailures.push({ url: request.url(), error: request.failure()?.errorText || "unknown" }));
}

async function assertDialog(page) {
  const dialog = page.getByRole("dialog", { name: "Browser extension sync" });
  await dialog.waitFor({ state: "visible" });
  await page.getByRole("heading", { name: "StudyPal browser extension" }).waitFor({ state: "visible" });
  await page.getByText("Sign in to StudyPal cloud first").waitFor({ state: "visible" });
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, body: document.body.scrollWidth, root: document.documentElement.scrollWidth }));
  assert.ok(dimensions.body <= dimensions.viewport + 1, `Body overflow: ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.root <= dimensions.viewport + 1, `Root overflow: ${JSON.stringify(dimensions)}`);
}

async function main() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const { modulePath, playwright } = loadPlaywright();
  const executablePath = findBrowserExecutable();
  const browser = await playwright.chromium.launch({ executablePath, headless: true });
  const observations = { consoleErrors: [], pageErrors: [], requestFailures: [] };
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    observe(desktop, observations);
    const desktopResponse = await desktop.goto(`${BASE_URL}/pro/session?refresh=extension-p15`, { waitUntil: "networkidle" });
    assert.equal(desktopResponse?.status(), 200);
    await desktop.getByRole("button", { name: "Set up extension sync" }).click();
    await assertDialog(desktop);
    await desktop.screenshot({ path: path.join(RUN_DIR, "desktop-extension-dialog.png"), fullPage: true });
    await desktop.getByRole("button", { name: "Close browser extension sync" }).click();
    await desktop.getByRole("dialog", { name: "Browser extension sync" }).waitFor({ state: "hidden" });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    observe(mobile, observations);
    const mobileResponse = await mobile.goto(`${BASE_URL}/pro/session?extensionCapture=b57b04c5-20c7-54a8-a72d-8a5b90b86ec0`, { waitUntil: "networkidle" });
    assert.equal(mobileResponse?.status(), 200);
    await assertDialog(mobile);
    await mobile.screenshot({ path: path.join(RUN_DIR, "mobile-extension-dialog.png"), fullPage: true });

    assert.deepEqual(observations.consoleErrors, []);
    assert.deepEqual(observations.pageErrors, []);
    assert.deepEqual(observations.requestFailures, []);
    const report = {
      passed: true,
      baseUrl: BASE_URL,
      browserVersion: await browser.version(),
      browserExecutable: executablePath,
      playwrightModule: modulePath,
      screenshots: ["desktop-extension-dialog.png", "mobile-extension-dialog.png"],
      observations,
    };
    fs.writeFileSync(path.join(RUN_DIR, "report.json"), JSON.stringify(report, null, 2));
    console.log(`PASS P15 extension flow ${RUN_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});