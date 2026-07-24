/* eslint-disable @typescript-eslint/no-require-imports -- Reuses the existing global Playwright installation. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const EVIDENCE_ROOT = path.join(ROOT, "docs", "evidence", "p3-homework");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const RUN_DIR = path.join(EVIDENCE_ROOT, RUN_ID);
const BASE_URL = process.env.P3_E2E_BASE_URL || "http://127.0.0.1:3300";
const SERVER_PORT = new URL(BASE_URL).port || "3000";
const EXPECT_LIVE = process.env.P3_EXPECT_LIVE === "1";
const PROBLEM = "Evaluate the definite integral ∫₀¹ x·e^(x²) dx, then verify the result by differentiating an antiderivative.";

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

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(RUN_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
    STUDYPAL_AI_PROVIDER: "demo",
    STUDYPAL_DATA_DIR: path.join(RUN_DIR, "runtime-data"),
  };
  const child = process.platform === "win32"
    ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm run start:local"], { cwd: ROOT, env: environment, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    : spawn("npm", ["run", "start:local"], { cwd: ROOT, env: environment, stdio: ["ignore", "pipe", "pipe"] });
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
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.process.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  else server.process.kill("SIGTERM");
  server.log?.end();
}

async function textOf(locator) {
  await locator.waitFor({ state: "visible", timeout: 90_000 });
  return (await locator.textContent()) || "";
}

async function runViewport(browser, project) {
  const diagnostics = {
    project: project.name,
    viewport: project.viewport,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    errorResponses: [],
    assertions: [],
  };
  const context = await browser.newContext({ viewport: project.viewport, deviceScaleFactor: 1, hasTouch: project.name === "mobile-390", isMobile: false });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push({ text: message.text(), location: message.location() });
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => diagnostics.failedRequests.push({ url: request.url(), method: request.method(), failure: request.failure() }));
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.errorResponses.push({ url: response.url(), status: response.status(), method: response.request().method() });
  });

  const tracePath = path.join(RUN_DIR, `trace-${project.name}.zip`);
  try {
    await page.goto(`${BASE_URL}/pro/session?p3=${project.name}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("button", { name: "Homework solver", exact: true }).first().click();
    await page.getByRole("textbox", { name: "作业题目" }).fill(PROBLEM);
    await page.getByRole("button", { name: "开始解题" }).click();

    assert.match(await textOf(page.getByText("真实解题结果", { exact: true })), /真实解题结果/);
    assert.match(await textOf(page.getByText("题意整理", { exact: true })), /题意整理/);
    assert.match(await textOf(page.getByText("最终答案", { exact: true })), /最终答案/);
    assert.match(await textOf(page.getByText("独立验算", { exact: true })), /独立验算/);
    assert.ok(await page.locator(".homework-steps li").count() >= 2);
    assert.ok((await textOf(page.locator(".homework-final-answer p"))).trim().length > 0);
    assert.ok((await textOf(page.locator(".homework-verification p"))).trim().length > 0);
    if (EXPECT_LIVE) assert.match(await textOf(page.locator(".homework-provider")), /MiniMax · MiniMax-M3/);
    diagnostics.assertions.push("structured homework solution and verification rendered");

    await page.waitForFunction(() => new URL(window.location.href).searchParams.has("homeworkSession"));
    const sessionId = new URL(page.url()).searchParams.get("homeworkSession");
    assert.ok(sessionId);
    diagnostics.assertions.push("homework session id persisted in URL");
    await page.screenshot({ path: path.join(RUN_DIR, `${project.name}-homework-solution.png`), fullPage: true });

    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    assert.match(await textOf(page.getByText("已从本机服务恢复", { exact: false })), /已从本机服务恢复/);
    assert.match(await page.getByRole("textbox", { name: "作业题目" }).inputValue(), /Evaluate the definite integral/);
    assert.ok(await page.locator(".homework-steps li").count() >= 2);
    diagnostics.assertions.push("server session restored after localStorage loss");
    await page.screenshot({ path: path.join(RUN_DIR, `${project.name}-homework-restored.png`), fullPage: true });

    const deleteResponse = page.waitForResponse((response) => response.url().includes(`/api/homework/session/${sessionId}`) && response.request().method() === "DELETE");
    await page.getByRole("button", { name: "清除", exact: true }).click();
    assert.equal((await deleteResponse).status(), 200);
    assert.equal(new URL(page.url()).searchParams.has("homeworkSession"), false);
    diagnostics.assertions.push("browser and server homework session cleared");

    await page.getByRole("textbox", { name: "作业题目" }).fill("x");
    await page.locator(".homework-problem-form").evaluate((form) => form.requestSubmit());
    assert.match(await textOf(page.locator(".homework-workspace .study-error")), /至少输入 3 个字符/);
    diagnostics.assertions.push("invalid problem error state verified");
    await page.screenshot({ path: path.join(RUN_DIR, `${project.name}-homework-invalid.png`), fullPage: true });

    const overflow = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(overflow.scrollWidth <= overflow.innerWidth + 1, `horizontal overflow: ${JSON.stringify(overflow)}`);
    diagnostics.assertions.push("no horizontal viewport overflow");

    assert.deepEqual(diagnostics.consoleErrors, [], `console errors: ${JSON.stringify(diagnostics.consoleErrors)}`);
    assert.deepEqual(diagnostics.pageErrors, [], `page errors: ${JSON.stringify(diagnostics.pageErrors)}`);
    assert.deepEqual(diagnostics.failedRequests, [], `failed requests: ${JSON.stringify(diagnostics.failedRequests)}`);
    assert.deepEqual(diagnostics.errorResponses, [], `HTTP error responses: ${JSON.stringify(diagnostics.errorResponses)}`);
    writeJson(`diagnostics-${project.name}.json`, diagnostics);
    return diagnostics;
  } catch (error) {
    diagnostics.failure = error instanceof Error ? error.stack || error.message : String(error);
    writeJson(`diagnostics-${project.name}.json`, diagnostics);
    try { await page.screenshot({ path: path.join(RUN_DIR, `${project.name}-failure.png`), fullPage: true }); } catch {}
    throw error;
  } finally {
    await context.tracing.stop({ path: tracePath });
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const { modulePath, playwright } = loadPlaywright();
  const executablePath = findBrowserExecutable();
  const server = await startServer();
  let browser;
  const startedAt = new Date().toISOString();
  try {
    browser = await playwright.chromium.launch({ headless: true, executablePath });
    const browserVersion = browser.version();
    const playwrightVersion = require(path.join(modulePath, "package.json")).version;
    writeJson("browser-version.json", { browserVersion, executablePath, playwrightVersion, modulePath });
    console.log(`Evidence ${RUN_DIR}`);

    const projects = [
      { name: "desktop-1440", viewport: { width: 1440, height: 1000 } },
      { name: "mobile-390", viewport: { width: 390, height: 844 } },
    ];
    const results = [];
    for (const project of projects) {
      console.log(`Running ${project.name}...`);
      results.push(await runViewport(browser, project));
      console.log(`PASS ${project.name}`);
    }

    const summary = {
      status: "PASS",
      startedAt,
      completedAt: new Date().toISOString(),
      baseURL: BASE_URL,
      expectedLive: EXPECT_LIVE,
      reusedServer: server.reused,
      runDirectory: RUN_DIR,
      browserVersion,
      playwrightVersion,
      projects: results.map((result) => ({ name: result.project, viewport: result.viewport, assertions: result.assertions })),
    };
    writeJson("run-summary.json", summary);
    fs.writeFileSync(path.join(EVIDENCE_ROOT, "latest.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    console.log("P3_HOMEWORK_E2E=PASS");
  } catch (error) {
    const summary = { status: "FAIL", startedAt, completedAt: new Date().toISOString(), baseURL: BASE_URL, runDirectory: RUN_DIR, error: error instanceof Error ? error.stack || error.message : String(error) };
    writeJson("run-summary.json", summary);
    fs.writeFileSync(path.join(EVIDENCE_ROOT, "latest.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    throw error;
  } finally {
    await browser?.close();
    stopServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
