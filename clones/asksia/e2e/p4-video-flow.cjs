/* eslint-disable @typescript-eslint/no-require-imports -- Reuses the existing global Playwright installation. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const EVIDENCE_ROOT = path.join(ROOT, "docs", "evidence", "p4-video");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const RUN_DIR = path.join(EVIDENCE_ROOT, RUN_ID);
const BASE_URL = process.env.P4_E2E_BASE_URL || "http://127.0.0.1:3400";
const SERVER_PORT = new URL(BASE_URL).port || "3400";
const MEDIA_URL = "https://www.youtube.com/watch?v=aircAruvnKk";

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

function fixtureSession(id = "p4-browser-session") {
  return {
    version: 1,
    id,
    source: {
      kind: "youtube",
      url: MEDIA_URL,
      canonicalUrl: MEDIA_URL,
      title: "But what is a neural network?",
      author: "3Blue1Brown",
      durationSeconds: 1_162,
      language: "en",
      transcriptCharacters: 12_480,
      segmentCount: 286,
      fetchedAt: "2026-07-23T22:00:00.000Z",
    },
    provider: { id: "minimax-responses:MiniMax-M3", mode: "live", label: "MiniMax · MiniMax-M3" },
    pages: [{ page: null, label: "0:00–5:00", text: "A neural network uses weights and biases. Training adjusts them with gradient descent." }],
    summary: {
      overview: "The video builds an intuitive model of neural networks, showing how layers of weighted activations transform an input into a prediction and how training changes those weights.",
      keyConcepts: ["Neurons store activations", "Weights determine connection strength", "Biases shift activation thresholds", "Gradient descent reduces prediction error"],
      reviewQuestions: ["What role do weights and biases play in a neuron?", "How does gradient descent improve a network?", "Why are hidden layers useful?"],
    },
    messages: [],
    truncated: false,
    createdAt: "2026-07-23T22:00:00.000Z",
    updatedAt: "2026-07-23T22:00:00.000Z",
  };
}

async function runViewport(browser, project) {
  const diagnostics = {
    project: project.name,
    viewport: project.viewport,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    errorResponses: [],
    expectedErrors: [],
    assertions: [],
  };
  const context = await browser.newContext({ viewport: project.viewport, deviceScaleFactor: 1, hasTouch: project.name === "mobile-390", isMobile: false });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  let currentSession = fixtureSession(`${project.name}-session`);

  await page.route("**/api/video/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (url.pathname === "/api/video/summarize" && method === "POST") {
      const body = request.postDataJSON();
      if (typeof body.url !== "string" || !body.url.startsWith("https://")) {
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "仅支持公开 HTTPS 链接。", code: "unsafe_media_url" }) });
        return;
      }
      currentSession = fixtureSession(`${project.name}-session`);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: currentSession }) });
      return;
    }
    if (url.pathname === "/api/video/ask" && method === "POST") {
      const body = request.postDataJSON();
      currentSession = {
        ...currentSession,
        messages: [
          ...currentSession.messages,
          { id: `${Date.now()}-user`, role: "user", content: body.question, createdAt: new Date().toISOString() },
          {
            id: `${Date.now()}-assistant`,
            role: "assistant",
            content: "Weights scale incoming signals, while biases shift the activation threshold before the activation function is applied.",
            citations: [{ page: null, label: "0:00–5:00", excerpt: "A neural network uses weights and biases. Training adjusts them with gradient descent." }],
            createdAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: currentSession, result: { grounded: true } }) });
      return;
    }
    if (url.pathname.endsWith(`/${currentSession.id}`) && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: currentSession }) });
      return;
    }
    if (url.pathname.endsWith(`/${currentSession.id}`) && method === "DELETE") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deleted: true }) });
      return;
    }
    await route.continue();
  });

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
    await page.goto(`${BASE_URL}/pro/session?p4=${project.name}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("button", { name: "Video Link summary", exact: true }).first().click();
    await page.getByRole("textbox", { name: "视频或播客链接" }).fill(MEDIA_URL);
    await page.getByRole("button", { name: "生成学习总结" }).click();

    await page.getByText("字幕驱动总结", { exact: false }).waitFor({ state: "visible" });
    assert.match((await page.locator(".study-overview p").textContent()) || "", /weighted activations/);
    assert.equal(await page.locator(".study-summary-grid li").count(), 4);
    assert.match((await page.locator(".study-session-meta").textContent()) || "", /MiniMax · MiniMax-M3/);
    diagnostics.assertions.push("video transcript summary and live provider label rendered");

    await page.getByRole("button", { name: "What role do weights and biases play in a neuron?" }).click();
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await page.getByText("Weights scale incoming signals", { exact: false }).waitFor({ state: "visible" });
    assert.match((await page.locator(".study-citations summary").textContent()) || "", /0:00–5:00/);
    diagnostics.assertions.push("grounded follow-up and timestamp citation rendered");

    await page.waitForFunction(() => new URL(window.location.href).searchParams.has("videoSession"));
    const sessionId = new URL(page.url()).searchParams.get("videoSession");
    assert.equal(sessionId, currentSession.id);
    diagnostics.assertions.push("video session id persisted in URL");
    await page.screenshot({ path: path.join(RUN_DIR, `${project.name}-video-summary.png`), fullPage: true });

    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByText("已从本机服务恢复", { exact: false }).waitFor({ state: "visible" });
    assert.match((await page.locator(".study-overview p").textContent()) || "", /weighted activations/);
    diagnostics.assertions.push("server session restored after localStorage loss");

    await page.getByRole("button", { name: "清除", exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.has("videoSession"), false);
    diagnostics.assertions.push("browser and server video session cleared");

    await page.getByRole("textbox", { name: "视频或播客链接" }).fill("http://127.0.0.1/private");
    await page.getByRole("button", { name: "生成学习总结" }).click();
    await page.getByText("仅支持公开 HTTPS 链接。", { exact: true }).waitFor({ state: "visible" });
    assert.equal(diagnostics.errorResponses.length, 1);
    assert.equal(diagnostics.errorResponses[0].status, 400);
    const expectedConsoleErrors = diagnostics.consoleErrors.filter((entry) => entry.text.includes("400 (Bad Request)") && entry.location?.url?.includes("/api/video/summarize"));
    assert.equal(expectedConsoleErrors.length, 1);
    diagnostics.expectedErrors.push({ response: diagnostics.errorResponses[0], console: expectedConsoleErrors[0] });
    diagnostics.errorResponses = [];
    diagnostics.consoleErrors = diagnostics.consoleErrors.filter((entry) => !expectedConsoleErrors.includes(entry));
    diagnostics.assertions.push("unsafe URL error state verified and classified as expected");
    await page.screenshot({ path: path.join(RUN_DIR, `${project.name}-video-error.png`), fullPage: true });

    const overflow = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(overflow.scrollWidth <= overflow.innerWidth + 1, `horizontal overflow: ${JSON.stringify(overflow)}`);
    diagnostics.assertions.push("no horizontal viewport overflow");

    assert.deepEqual(diagnostics.consoleErrors, [], `console errors: ${JSON.stringify(diagnostics.consoleErrors)}`);
    assert.deepEqual(diagnostics.pageErrors, [], `page errors: ${JSON.stringify(diagnostics.pageErrors)}`);
    assert.deepEqual(diagnostics.failedRequests, [], `failed requests: ${JSON.stringify(diagnostics.failedRequests)}`);
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
    const projects = [
      { name: "desktop-1440", viewport: { width: 1440, height: 1000 } },
      { name: "mobile-390", viewport: { width: 390, height: 844 } },
    ];
    const results = [];
    for (const project of projects) results.push(await runViewport(browser, project));
    const summary = {
      status: "PASS",
      startedAt,
      completedAt: new Date().toISOString(),
      baseURL: BASE_URL,
      reusedServer: server.reused,
      runDirectory: RUN_DIR,
      browserVersion,
      playwrightVersion,
      projects: results.map((result) => ({ name: result.project, viewport: result.viewport, assertions: result.assertions })),
    };
    writeJson("run-summary.json", summary);
    fs.writeFileSync(path.join(EVIDENCE_ROOT, "latest.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    console.log("P4_VIDEO_E2E=PASS");
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
