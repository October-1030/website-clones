/* eslint-disable @typescript-eslint/no-require-imports -- Reuses the existing global Playwright installation. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const EVIDENCE_ROOT = path.join(ROOT, "docs", "evidence", "p5-transcribe");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const RUN_DIR = path.join(EVIDENCE_ROOT, RUN_ID);
const BASE_URL = process.env.P5_E2E_BASE_URL || "http://127.0.0.1:3500";
const SERVER_PORT = new URL(BASE_URL).port || "3500";

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

function fixtureSession(kind, id) {
  return {
    version: 1,
    id,
    source: {
      kind,
      fileName: `studypal-${kind}.webm`,
      mimeType: "audio/webm",
      sizeBytes: 2048,
      durationSeconds: 9.407,
      capturedAt: "2026-07-23T22:00:00.000Z",
    },
    provider: { id: "faster-whisper:small", label: "Faster-Whisper · small", device: "cpu" },
    language: "en",
    languageProbability: 0.99,
    text: "Photosynthesis captures light energy and stores it as chemical energy. Chlorophyll absorbs light in plant cells.",
    segments: [
      { startSeconds: 0, endSeconds: 4.8, text: "Photosynthesis captures light energy and stores it as chemical energy." },
      { startSeconds: 5.6, endSeconds: 8.8, text: "Chlorophyll absorbs light in plant cells." },
    ],
    createdAt: "2026-07-23T22:00:00.000Z",
    updatedAt: "2026-07-23T22:00:00.000Z",
  };
}

async function installCaptureMocks(page) {
  await page.addInitScript(() => {
    class FakeTrack {
      constructor(kind = "audio") { this.kind = kind; this.onended = null; }
      stop() {}
    }
    class FakeStream {
      constructor(tracks = [new FakeTrack("audio")]) { this.tracks = tracks; }
      getTracks() { return this.tracks; }
      getAudioTracks() { return this.tracks.filter((track) => track.kind === "audio"); }
    }
    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
      constructor(stream, options = {}) {
        this.stream = stream;
        this.mimeType = options.mimeType || "audio/webm";
        this.state = "inactive";
        this.ondataavailable = null;
        this.onerror = null;
        this.onstop = null;
      }
      start() { this.state = "recording"; }
      stop() {
        if (this.state !== "recording") return;
        this.state = "inactive";
        const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
        this.ondataavailable?.({ data: new Blob([bytes], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    class FakeSpeechRecognition {
      constructor() {
        this.continuous = true;
        this.interimResults = true;
        this.lang = "en-US";
        this.onresult = null;
        this.onerror = null;
      }
      start() {
        setTimeout(() => this.onresult?.({
          resultIndex: 0,
          results: [{ isFinal: false, 0: { transcript: "Photosynthesis captures light energy" } }],
        }), 20);
      }
      stop() {}
    }
    window.__captureCalls = { microphone: 0, tab: 0 };
    window.MediaStream = FakeStream;
    window.MediaRecorder = FakeMediaRecorder;
    window.SpeechRecognition = FakeSpeechRecognition;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          window.__captureCalls.microphone += 1;
          return new FakeStream();
        },
        getDisplayMedia: async () => {
          window.__captureCalls.tab += 1;
          return new FakeStream([new FakeTrack("audio"), new FakeTrack("video")]);
        },
      },
    });
  });
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
  await installCaptureMocks(page);
  let currentSession = fixtureSession("microphone", `${project.name}-microphone-session`);

  await page.route("**/api/transcribe**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/transcribe" && request.method() === "POST") {
      const body = request.postDataBuffer()?.toString("utf8") || "";
      const kind = body.includes("browser-tab") ? "browser-tab" : "microphone";
      currentSession = fixtureSession(kind, `${project.name}-${kind}-session`);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: currentSession }) });
      return;
    }
    if (url.pathname.endsWith(`/${currentSession.id}`) && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: currentSession }) });
      return;
    }
    if (url.pathname.endsWith(`/${currentSession.id}`) && request.method() === "DELETE") {
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
    await page.goto(`${BASE_URL}/pro/session?p5=${project.name}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("button", { name: "Live transcribe", exact: true }).first().click();
    assert.deepEqual(await page.evaluate(() => window.__captureCalls), { microphone: 0, tab: 0 });
    diagnostics.assertions.push("no capture permission requested before explicit source click");

    await page.getByRole("button", { name: /Microphone/ }).click();
    await page.getByText("Temporary live captions", { exact: true }).waitFor();
    await page.getByText("Photosynthesis captures light energy", { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.__captureCalls), { microphone: 1, tab: 0 });
    diagnostics.assertions.push("microphone recording and temporary captions rendered");
    await page.getByRole("button", { name: "Stop and transcribe" }).click();
    await page.getByText("Final transcript", { exact: true }).waitFor();
    assert.match((await page.locator(".transcript-document p").textContent()) || "", /Chlorophyll absorbs light/);
    assert.equal(await page.locator(".transcript-segments article").count(), 2);
    assert.equal(new URL(page.url()).searchParams.get("transcribeSession"), currentSession.id);
    diagnostics.assertions.push("final timestamped transcript and URL persistence rendered");
    await page.screenshot({ path: path.join(RUN_DIR, `${project.name}-microphone-final.png`), fullPage: true });

    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByText("Restored from local service", { exact: true }).waitFor();
    assert.match((await page.locator(".transcript-document p").textContent()) || "", /chemical energy/);
    diagnostics.assertions.push("server session restored after localStorage loss");
    await page.getByRole("button", { name: "Clear", exact: true }).click();

    await page.getByRole("button", { name: /Browser Tab/ }).click();
    await page.getByText("Browser-tab capture", { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.__captureCalls), { microphone: 0, tab: 1 });
    assert.match((await page.locator(".interim-caption").textContent()) || "", /does not claim real-time captions/);
    await page.getByRole("button", { name: "Stop and transcribe" }).click();
    await page.getByText("Final transcript", { exact: true }).waitFor();
    assert.match((await page.locator(".study-session-meta").textContent()) || "", /Browser-tab recording/);
    diagnostics.assertions.push("browser-tab capture honestly defers final transcript until Stop");
    await page.screenshot({ path: path.join(RUN_DIR, `${project.name}-browser-tab-final.png`), fullPage: true });

    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("Denied", "NotAllowedError");
      };
    });
    await page.getByRole("button", { name: /Microphone/ }).click();
    await page.getByText("Audio permission was not granted. Nothing was recorded.", { exact: true }).waitFor();
    diagnostics.assertions.push("permission denial error state rendered without recording");
    await page.screenshot({ path: path.join(RUN_DIR, `${project.name}-permission-error.png`), fullPage: true });

    const overflow = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(overflow.scrollWidth <= overflow.innerWidth + 1, `horizontal overflow: ${JSON.stringify(overflow)}`);
    diagnostics.assertions.push("no horizontal viewport overflow");
    assert.deepEqual(diagnostics.consoleErrors, [], `console errors: ${JSON.stringify(diagnostics.consoleErrors)}`);
    assert.deepEqual(diagnostics.pageErrors, [], `page errors: ${JSON.stringify(diagnostics.pageErrors)}`);
    assert.deepEqual(diagnostics.failedRequests, [], `failed requests: ${JSON.stringify(diagnostics.failedRequests)}`);
    assert.deepEqual(diagnostics.errorResponses, [], `error responses: ${JSON.stringify(diagnostics.errorResponses)}`);
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
    console.log("P5_TRANSCRIBE_E2E=PASS");
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
