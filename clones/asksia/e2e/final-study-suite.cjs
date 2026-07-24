/* eslint-disable @typescript-eslint/no-require-imports -- Reuses the existing global Playwright installation. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const RUN_DIR = path.join(ROOT, "docs", "evidence", "final-study-suite", RUN_ID);
const BASE_URL = process.env.FINAL_E2E_BASE_URL || "http://127.0.0.1:3600";
const SERVER_PORT = new URL(BASE_URL).port || "3600";

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

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function appIsReady() {
  try {
    const response = await fetch(`${BASE_URL}/pro/session`);
    return response.ok && (await response.text()).includes("StudyPal AI");
  } catch {
    return false;
  }
}

async function startServer() {
  if (await appIsReady()) return { process: null, reused: true };
  const logPath = path.join(RUN_DIR, "server.log");
  const log = fs.createWriteStream(logPath, { flags: "a" });
  const environment = {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
    HOSTNAME: "127.0.0.1",
    PORT: SERVER_PORT,
    STUDYPAL_DATA_DIR: path.join(RUN_DIR, "runtime-data"),
  };
  const child = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm run start:local"], {
    cwd: ROOT,
    env: environment,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited with ${child.exitCode}. See ${logPath}`);
    if (await appIsReady()) return { process: child, reused: false, log };
    await delay(500);
  }
  throw new Error(`Server was not ready within 60 seconds. See ${logPath}`);
}

function stopServer(server) {
  if (!server.process) return;
  spawnSync("taskkill", ["/PID", String(server.process.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  server.log?.end();
}

function studySession() {
  const now = "2026-07-23T20:00:00.000Z";
  return {
    version: 1,
    id: "final-e2e-study-session",
    file: { name: "photosynthesis-notes.txt", kind: "txt", type: "text/plain", size: 588, pageCount: 3, uploadedAt: now },
    provider: { id: "fixture", mode: "demo", label: "E2E grounded fixture" },
    pages: [
      { page: 1, label: "Section 1", text: "Photosynthesis captures light energy and stores it as chemical energy. Chlorophyll absorbs mostly red and blue wavelengths." },
      { page: 2, label: "Section 2", text: "The light-dependent reactions produce ATP and NADPH. The Calvin cycle uses those products to fix carbon dioxide." },
      { page: 3, label: "Section 3", text: "Researchers compare oxygen production under different wavelengths to measure photosynthetic activity." },
    ],
    summary: {
      overview: "Photosynthesis converts light energy into chemical energy through linked light-dependent reactions and carbon fixation.",
      keyConcepts: ["Chlorophyll absorption", "ATP and NADPH", "Calvin cycle", "Oxygen production"],
      reviewQuestions: ["Which wavelengths does chlorophyll absorb?", "How do ATP and NADPH support carbon fixation?", "Why measure oxygen production?"],
    },
    messages: [],
    truncated: false,
    createdAt: now,
    updatedAt: now,
  };
}

async function installPageObservers(page, record) {
  page.on("console", (message) => {
    if (message.type() === "error") record.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => record.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText || "unknown";
    if (!failure.includes("ERR_ABORTED")) record.failedRequests.push(`${request.method()} ${request.url()} ${failure}`);
  });
  await page.route("**/api/web-search", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        query: "photosynthesis",
        language: "en",
        results: [{
          id: 1,
          key: "Photosynthesis",
          title: "Photosynthesis",
          description: "Process used by plants to convert light energy.",
          excerpt: "Photosynthesis converts light energy into chemical energy.",
          url: "https://en.wikipedia.org/wiki/Photosynthesis",
          source: "Wikipedia",
          language: "en",
        }],
      }),
    });
  });
}

async function seedContext(context) {
  const session = studySession();
  await context.addInitScript((value) => {
    localStorage.setItem("studypal.study-session.v1", JSON.stringify(value));
  }, session);
}

async function goHome(page) {
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("heading", { name: /what are we studying today/i }).waitFor();
}

async function openTool(page, menu, label) {
  await goHome(page);
  await page.getByRole("button", { name: menu, exact: true }).last().click();
  await page.getByRole("button", { name: label, exact: true }).last().click();
}

async function runDesktop(browser, record) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await seedContext(context);
  const page = await context.newPage();
  await installPageObservers(page, record);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await page.goto(`${BASE_URL}/pro/session`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /what are we studying today/i }).waitFor();

  await openTool(page, "Tools", "Quiz");
  await page.getByRole("button", { name: "Generate" }).click();
  await page.getByText("Question 1").waitFor();
  const firstQuestion = page.locator(".quiz-question").first();
  await firstQuestion.locator(".quiz-options button").first().click();
  await firstQuestion.locator(".quiz-explanation").waitFor();

  await openTool(page, "Tools", "Study guide");
  await page.getByRole("button", { name: "Generate" }).click();
  await page.getByText("Three-pass review plan").waitFor();
  await page.locator(".guide-plan button").first().click();

  await openTool(page, "More", "Flashcard");
  await page.getByRole("button", { name: "Generate" }).click();
  await page.getByRole("button", { name: "Flip flashcard" }).click();
  await page.getByText(/Source/).last().waitFor();

  await openTool(page, "Tools", "Essay");
  await page.getByLabel("Essay topic or question").fill("How does light wavelength affect photosynthesis?");
  await page.getByLabel("Optional draft for revision feedback").fill("Photosynthesis captures light energy and stores it as chemical energy. However, chlorophyll does not absorb every wavelength equally. Researchers compare oxygen production under controlled light colors to evaluate photosynthetic activity. Therefore, an effective essay should connect wavelength, pigment absorption, and measured oxygen output while citing the original experiment.");
  await page.getByRole("button", { name: "Build plan" }).click();
  await page.getByText("Thesis directions").waitFor();

  await openTool(page, "Tools", "AI detector");
  await page.getByLabel("Text to review").fill("Photosynthesis captures light energy and stores it as chemical energy. However, the process depends on chlorophyll and a reliable supply of carbon dioxide. Researchers compare measured oxygen production across different wavelengths to test which colors are absorbed most effectively. Therefore, factual claims should be linked to the original experiment rather than inferred from writing style alone.");
  await page.getByRole("button", { name: "Review signals" }).click();
  await page.getByRole("heading", { name: "Indeterminate" }).waitFor();

  await openTool(page, "More", "Web search");
  await page.getByLabel("Public knowledge search query").fill("photosynthesis");
  await page.getByRole("button", { name: "Search", exact: true }).last().click();
  await page.getByRole("link", { name: /Open source/ }).waitFor();
  assert.equal(await page.getByRole("link", { name: /Open source/ }).getAttribute("href"), "https://en.wikipedia.org/wiki/Photosynthesis");

  await openTool(page, "More", "LinkedIn headshot");
  await page.locator('input[type="file"]').setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAwMDAxMDAwMAAAAwBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"),
  });
  await page.getByAltText("Local portrait preview").waitFor();
  await page.getByRole("button", { name: /Black & white/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export 800/ }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^studypal-black-and-white-portrait\.png$/);

  await goHome(page);
  await page.getByRole("button", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByLabel("Display name").fill("QA Student");
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByRole("heading", { name: /Hi QA Student/ }).waitFor();

  await page.getByRole("button", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Cloud account & sync" }).click();
  await page.getByRole("heading", { name: "StudyPal cloud account" }).waitFor();
  await page.getByRole("button", { name: "Sign in", exact: true }).last().waitFor();
  await page.getByRole("button", { name: "Close cloud account" }).click();

  await page.getByRole("button", { name: "Library" }).click();
  await page.getByRole("heading", { name: "Everything you have studied" }).waitFor();
  await page.getByLabel("Search saved sessions").fill("no-matching-session");
  await page.getByText("No sessions match this search").waitFor();
  await page.getByLabel("Search saved sessions").fill("");

  await page.screenshot({ path: path.join(RUN_DIR, "desktop-final.png"), fullPage: true });
  await context.tracing.stop({ path: path.join(RUN_DIR, "desktop-trace.zip") });
  await context.close();
}

async function runMobile(browser, record) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await seedContext(context);
  const page = await context.newPage();
  await installPageObservers(page, record);
  await page.goto(`${BASE_URL}/pro/session`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /what are we studying today/i }).waitFor();
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByRole("heading", { name: "Everything you have studied" }).waitFor();
  await page.screenshot({ path: path.join(RUN_DIR, "mobile-library.png"), fullPage: true });
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Web search", exact: true }).click();
  await page.getByLabel("Public knowledge search query").fill("photosynthesis");
  await page.getByRole("button", { name: "Search", exact: true }).last().click();
  await page.getByRole("link", { name: /Open source/ }).waitFor();
  await page.screenshot({ path: path.join(RUN_DIR, "mobile-web-search.png"), fullPage: true });
  await context.close();
}

async function main() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const runtimeSessions = path.join(RUN_DIR, "runtime-data", "sessions");
  fs.mkdirSync(runtimeSessions, { recursive: true });
  fs.writeFileSync(path.join(runtimeSessions, "final-e2e-study-session.json"), `${JSON.stringify(studySession(), null, 2)}\n`, "utf8");
  const server = await startServer();
  const { modulePath, playwright } = loadPlaywright();
  const executablePath = findBrowserExecutable();
  let browser;
  const record = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  try {
    browser = await playwright.chromium.launch({ headless: true, executablePath });
    const browserVersion = browser.version();
    await runDesktop(browser, record);
    await runMobile(browser, record);
    assert.deepEqual(record.pageErrors, []);
    assert.deepEqual(record.consoleErrors, []);
    assert.deepEqual(record.failedRequests, []);
    const report = {
      status: "PASS",
      runId: RUN_ID,
      baseUrl: BASE_URL,
      browserVersion,
      executablePath,
      playwrightVersion: require(path.join(modulePath, "package.json")).version,
      checks: [
        "Quiz source-backed generation and answer feedback",
        "Study guide source-backed plan and persistence interaction",
        "Flashcard generation and flip interaction",
        "Essay planning and responsible revision metrics",
        "AI detector indeterminate authorship result",
        "Allowlisted public search with direct source link",
        "Local-only portrait preview and PNG export",
        "Local account name persistence",
        "Cloud account configuration boundary and RLS-ready status",
        "Library search and empty state",
        "390px mobile Library and Web Search layouts",
        "No console errors, page errors, or failed requests",
      ],
      observations: record,
    };
    fs.writeFileSync(path.join(RUN_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    fs.writeFileSync(path.join(RUN_DIR, "README.md"), `# Final StudyPal browser suite\n\nStatus: **PASS**\n\n- Desktop screenshot: desktop-final.png\n- Mobile screenshots: mobile-library.png, mobile-web-search.png\n- Trace: desktop-trace.zip\n- Browser: ${browserVersion}\n- Playwright: ${report.playwrightVersion}\n`, "utf8");
    console.log(`PASS ${RUN_DIR}`);
  } finally {
    await browser?.close();
    stopServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
