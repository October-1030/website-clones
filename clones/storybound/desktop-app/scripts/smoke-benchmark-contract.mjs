import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  return address.port;
}

async function reservePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(url, child, logs) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Storybound 服务提前退出（${child.exitCode}）\n${logs.join("")}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`等待 Storybound 服务启动超时\n${logs.join("")}`);
}

async function post(baseUrl, pathname, payload) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return { response, body };
}

async function remove(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, { method: "DELETE" });
  const body = await response.json();
  return { response, body };
}

let parserRequestCount = 0;
let directBalanceRequestCount = 0;
let directFeedInfoRequestCount = 0;
let directFeedListRequestCount = 0;
const provider = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (request.method === "GET" && url.pathname === "/v1/bugpk/parse") {
    parserRequestCount += 1;
    const sourceUrl = url.searchParams.get("url") || "";
    if (sourceUrl.includes("/empty")) {
      sendJson(response, 200, { code: 200, data: { title: "空解析结果" } });
      return;
    }
    sendJson(response, 200, {
      code: 200,
      data: {
        title: "测试视频号作品",
        author: { name: "测试视频号", avatar: "https://cdn.example/avatar.jpg" },
        video_backup: [{
          codec: "h264",
          format: "mp4",
          quality: "原画",
          url: "https://cdn.example/video.mp4",
        }],
        extra: { create_time: 1_700_000_000, statistics: { like_count: 12 } },
      },
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/dajiala/feed-info") {
    const body = await readJson(request);
    if (String(body.feed_info || "").includes("douyin.com")) {
      sendJson(response, 200, { code: 0, data: { nickname: "不应保存的抖音账号" } });
      return;
    }
    sendJson(response, 200, {
      code: 0,
      data: { v2_name: "wx-test-account", nickname: "测试视频号", object_id: "feed-1" },
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/dajiala/feed-list") {
    const body = await readJson(request);
    sendJson(response, 200, {
      code: 0,
      contact: { username: body.v2_name, nickname: "测试视频号", head_url: "" },
      object: [{
        object_id: "work-1",
        title: "测试作品",
        download_url: "https://cdn.example/video.mp4",
        publish_time: 1_700_000_000,
      }],
      last_buffer: "",
      continue_flag: 0,
      cost: 1,
    });
    return;
  }

  sendJson(response, 404, { error: "unknown fake provider route" });
});

const directProvider = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (request.method === "POST" && url.pathname === "/balance") {
    directBalanceRequestCount += 1;
    const body = await readJson(request);
    if (body.key !== "valid-direct-key") {
      sendJson(response, 401, { msg: "访问密钥无效" });
      return;
    }
    sendJson(response, 200, { code: 0, remain_money: 12.345 });
    return;
  }
  if (request.method === "POST" && url.pathname === "/wxvideo") {
    const contentType = String(request.headers["content-type"] || "");
    if (contentType.includes("multipart/form-data")) {
      directFeedListRequestCount += 1;
      let body = "";
      for await (const chunk of request) body += chunk.toString();
      assert.match(body, /name="type"\r\n\r\n1/);
      assert.match(body, /name="v2_name"\r\n\r\ndirect-account/);
      sendJson(response, 200, {
        code: 0,
        contact: { username: "direct-account", nickname: "自有接口测试账号", head_url: "" },
        object: [{
          object_id: "direct-work-1",
          title: "自有接口测试作品",
          openurl: "https://channels.weixin.qq.com/web/pages/feed?eid=direct",
          publish_time: "2026-08-13 08:30:00",
        }],
        last_buffer: "next-direct-page",
        continue_flag: 1,
        cost: 0.2,
      });
      return;
    }
    directFeedInfoRequestCount += 1;
    const body = await readJson(request);
    assert.equal(body.key, "valid-direct-key");
    assert.equal(body.type, "12");
    sendJson(response, 200, {
      code: 0,
      data: { v2_name: "direct-account", nickname: "自有接口测试账号", object_id: "direct-feed" },
      cost: 0.1,
    });
    return;
  }
  sendJson(response, 404, { error: "unknown direct provider route" });
});

const providerPort = await listen(provider);
const directProviderPort = await listen(directProvider);
const appPort = await reservePort();
const appBaseUrl = `http://127.0.0.1:${appPort}`;
const testDataDir = fileURLToPath(new URL(`../.storybound-data/benchmark-contract-${process.pid}/`, import.meta.url));
const logs = [];
const app = spawn(process.execPath, ["server.mjs", "--production"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: String(appPort),
    STORYBOUND_BENCHMARK_API_BASE_URL: `http://127.0.0.1:${providerPort}`,
    STORYBOUND_BENCHMARK_EMAIL: "",
    STORYBOUND_BENCHMARK_FINGERPRINT: "",
    STORYBOUND_DAJIALA_API_KEY: "",
    DAJIALA_API_KEY: "",
    STORYBOUND_ASR_COMMAND: process.execPath,
    STORYBOUND_DATA_DIR: testDataDir,
    STORYBOUND_DAJIALA_API_URL: `http://127.0.0.1:${directProviderPort}/wxvideo`,
    STORYBOUND_DAJIALA_BALANCE_URL: `http://127.0.0.1:${directProviderPort}/balance`,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
app.stdout.on("data", (chunk) => logs.push(chunk.toString()));
app.stderr.on("data", (chunk) => logs.push(chunk.toString()));

try {
  await waitForServer(`${appBaseUrl}/api/benchmark/status`, app, logs);

  const initialStatus = await fetch(`${appBaseUrl}/api/benchmark/status`).then((response) => response.json());
  assert.equal(initialStatus.accountSync.configured, false);

  const invalidSource = await post(appBaseUrl, "/api/benchmark/source", { apiKey: "invalid-key" });
  assert.equal(invalidSource.response.status, 401);

  const savedSource = await post(appBaseUrl, "/api/benchmark/source", { apiKey: "valid-direct-key" });
  assert.equal(savedSource.response.status, 200);
  assert.equal(savedSource.body.accountSync.mode, "direct");
  assert.equal(savedSource.body.accountSync.balance, 12.345);
  assert.equal(JSON.stringify(savedSource.body).includes("valid-direct-key"), false);
  assert.equal(directBalanceRequestCount, 2);

  const parsed = await post(appBaseUrl, "/api/benchmark/parse-video", {
    url: "https://weixin.qq.com/sph/ok",
  });
  assert.equal(parsed.response.status, 200);
  assert.equal(parsed.body.video.mediaUrl, "https://cdn.example/video.mp4");

  const empty = await post(appBaseUrl, "/api/benchmark/parse-video", {
    url: "https://weixin.qq.com/sph/empty",
  });
  assert.equal(empty.response.status, 400);
  assert.match(empty.body.error, /未解析到视频直链/);

  const resolved = await post(appBaseUrl, "/api/benchmark/resolve-account", {
    url: "https://weixin.qq.com/sph/account",
  });
  assert.equal(resolved.response.status, 200);
  assert.equal(resolved.body.account.remoteId, "direct-account");
  assert.equal(directFeedInfoRequestCount, 1);

  const douyin = await post(appBaseUrl, "/api/benchmark/resolve-account", {
    url: "https://www.douyin.com/video/123",
  });
  assert.equal(douyin.response.status, 400);
  assert.match(douyin.body.error, /仅支持视频号分享链接/);

  const works = await post(appBaseUrl, "/api/benchmark/fetch-works", {
    remoteId: "direct-account",
  });
  assert.equal(works.response.status, 200);
  assert.equal(works.body.result.works.length, 1);
  assert.equal(works.body.result.remoteId, "direct-account");
  assert.equal(works.body.result.works[0].publishTime > 1_700_000_000, true);
  assert.equal(directFeedListRequestCount, 1);

  const parserRequestsBeforeCachedTranscription = parserRequestCount;
  const cachedTranscription = await post(appBaseUrl, "/api/asr/transcribe-benchmark", {
    url: "https://weixin.qq.com/sph/ok",
    mediaUrl: "https://127.0.0.1/private-media.mp4",
    format: "mp4",
    expiresAt: "2099-01-01 00:00:00",
  });
  assert.equal(cachedTranscription.response.status, 400);
  assert.equal(parserRequestCount, parserRequestsBeforeCachedTranscription);

  const removedSource = await remove(appBaseUrl, "/api/benchmark/source");
  assert.equal(removedSource.response.status, 200);
  assert.equal(removedSource.body.removed, true);
  assert.equal(removedSource.body.accountSync.configured, false);

  process.stdout.write(JSON.stringify({
    passed: true,
    cases: [
      "视频号单视频有直链时成功",
      "空媒体结果被拒绝",
      "视频号账号取得真实远端 ID",
      "抖音账号空远端 ID 被拒绝",
      "作品列表按远端账号 ID 拉取",
      "自有对标数据密钥先验余额再保存",
      "访问密钥不回传浏览器且本机配置可删除",
      "大家啦 type=12 账号识别与 type=1 multipart 分页映射",
      "已保存媒体直链转写不重复调用解析接口",
    ],
  }, null, 2));
} finally {
  app.kill();
  await new Promise((resolve) => {
    if (app.exitCode !== null) {
      resolve();
      return;
    }
    app.once("exit", resolve);
    setTimeout(resolve, 2_000);
  });
  await new Promise((resolve) => provider.close(resolve));
  await new Promise((resolve) => directProvider.close(resolve));
  await rm(testDataDir, { recursive: true, force: true });
}
