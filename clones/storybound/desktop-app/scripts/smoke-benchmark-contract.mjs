import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";

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

const provider = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (request.method === "GET" && url.pathname === "/v1/bugpk/parse") {
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

const providerPort = await listen(provider);
const appPort = await reservePort();
const appBaseUrl = `http://127.0.0.1:${appPort}`;
const logs = [];
const app = spawn(process.execPath, ["server.mjs", "--production"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: String(appPort),
    STORYBOUND_BENCHMARK_API_BASE_URL: `http://127.0.0.1:${providerPort}`,
    STORYBOUND_BENCHMARK_EMAIL: "contract-test@example.invalid",
    STORYBOUND_BENCHMARK_FINGERPRINT: "contract-test-device",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
app.stdout.on("data", (chunk) => logs.push(chunk.toString()));
app.stderr.on("data", (chunk) => logs.push(chunk.toString()));

try {
  await waitForServer(`${appBaseUrl}/api/benchmark/status`, app, logs);

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
  assert.equal(resolved.body.account.remoteId, "wx-test-account");

  const douyin = await post(appBaseUrl, "/api/benchmark/resolve-account", {
    url: "https://www.douyin.com/video/123",
  });
  assert.equal(douyin.response.status, 400);
  assert.match(douyin.body.error, /没解析出账号/);

  const works = await post(appBaseUrl, "/api/benchmark/fetch-works", {
    remoteId: "wx-test-account",
  });
  assert.equal(works.response.status, 200);
  assert.equal(works.body.result.works.length, 1);
  assert.equal(works.body.result.remoteId, "wx-test-account");

  process.stdout.write(JSON.stringify({
    passed: true,
    cases: [
      "视频号单视频有直链时成功",
      "空媒体结果被拒绝",
      "视频号账号取得真实远端 ID",
      "抖音账号空远端 ID 被拒绝",
      "作品列表按远端账号 ID 拉取",
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
}
