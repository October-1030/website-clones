import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(body);
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

async function reservePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function post(base, path, body) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

async function waitForServer(url, child, logs) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(logs.join(""));
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`server timeout\n${logs.join("")}`);
}

let searchCalls = 0;
let feedCalls = 0;
const provider = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (url.pathname === "/v1/bugpk/parse") {
    sendJson(response, 200, {
      code: 200,
      data: {
        title: "蔡和森测试视频",
        author: { name: "书页温酒", avatar: "https://cdn.example/avatar.jpg" },
        video_backup: [{ codec: "h264", format: "mp4", url: "https://cdn.example/video.mp4" }],
      },
    });
    return;
  }
  sendJson(response, 404, { code: 404 });
});

const justOne = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (url.pathname === "/api/weixin-channels/search-account/v3") {
    searchCalls += 1;
    assert.equal(url.searchParams.get("token"), "test-token");
    assert.equal(url.searchParams.get("keyword"), "书页温酒");
    sendJson(response, 200, { code: 0, data: { profile: { v2Name: "shuye@finder", nickname: "书页温酒" } } });
    return;
  }
  if (url.pathname === "/api/weixin-channels/get-account-videos/v1") {
    feedCalls += 1;
    let body = "";
    for await (const chunk of request) body += chunk.toString();
    const form = new URLSearchParams(body);
    assert.equal(form.get("token"), "test-token");
    assert.equal(form.get("v2Name"), "shuye@finder");
    sendJson(response, 200, {
      code: 0,
      data: {
        contact: { username: "shuye@finder", nickname: "书页温酒", headUrl: "https://cdn.example/avatar.jpg" },
        feedList: [{
          objectId: "work-1",
          description: "测试账号作品",
          coverUrl: "https://cdn.example/cover.jpg",
          url: "https://weixin.qq.com/sph/example",
          likeCount: 123,
          createTime: 1_700_000_000,
        }],
        pagination: { lastBuffer: "next-page", continueFlag: 1 },
      },
    });
    return;
  }
  sendJson(response, 404, { code: 404 });
});

const providerPort = await listen(provider);
const justOnePort = await listen(justOne);
const appPort = await reservePort();
const base = `http://127.0.0.1:${appPort}`;
const dataDir = fileURLToPath(new URL(`../.storybound-data/justone-smoke-${process.pid}/`, import.meta.url));
const logs = [];
const app = spawn(process.execPath, ["server.mjs", "--production"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: String(appPort),
    STORYBOUND_DATA_DIR: dataDir,
    STORYBOUND_BENCHMARK_API_BASE_URL: `http://127.0.0.1:${providerPort}`,
    STORYBOUND_JUSTONE_API_BASE_URL: `http://127.0.0.1:${justOnePort}`,
    STORYBOUND_JUSTONE_API_TOKEN: "test-token",
    STORYBOUND_DAJIALA_API_KEY: "",
    DAJIALA_API_KEY: "",
    STORYBOUND_BENCHMARK_EMAIL: "",
    STORYBOUND_BENCHMARK_FINGERPRINT: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
app.stdout.on("data", (chunk) => logs.push(chunk.toString()));
app.stderr.on("data", (chunk) => logs.push(chunk.toString()));

try {
  await waitForServer(`${base}/api/benchmark/status`, app, logs);
  const status = await fetch(`${base}/api/benchmark/status`).then((response) => response.json());
  assert.equal(status.accountSync.mode, "justone");

  const resolved = await post(base, "/api/benchmark/resolve-account", { url: "https://weixin.qq.com/sph/AnuKmABVzZ" });
  assert.equal(resolved.response.status, 200);
  assert.equal(resolved.body.account.remoteId, "shuye@finder");

  const works = await post(base, "/api/benchmark/fetch-works", { remoteId: "shuye@finder" });
  assert.equal(works.response.status, 200);
  assert.equal(works.body.result.works.length, 1);
  assert.equal(works.body.result.works[0].title, "测试账号作品");
  assert.equal(works.body.result.lastBuffer, "next-page");
  assert.equal(works.body.result.continueFlag, 1);
  assert.equal(searchCalls, 1);
  assert.equal(feedCalls, 1);
  process.stdout.write(JSON.stringify({ passed: true, route: "anonymous video parse -> account name -> v2Name -> cursor feed" }, null, 2));
} finally {
  app.kill();
  await new Promise((resolve) => app.once("exit", resolve));
  await new Promise((resolve) => provider.close(resolve));
  await new Promise((resolve) => justOne.close(resolve));
  await rm(dataDir, { recursive: true, force: true });
}
