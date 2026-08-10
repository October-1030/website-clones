import { spawn } from "node:child_process";
import { createServer } from "node:http";

const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=";

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const requests = [];
const fakeProvider = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  requests.push({ url: request.url, body: JSON.parse(raw || "{}") });
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ data: [{ b64_json: tinyPng }] }));
});

const probe = createServer();
const appPort = await listen(probe);
await new Promise((resolve) => probe.close(resolve));
const providerPort = await listen(fakeProvider);
const child = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PORT: String(appPort) },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitFor(`http://127.0.0.1:${appPort}/api/tts/status`);
  for (const provider of ["jimeng", "all-purpose"]) {
    const response = await fetch(`http://127.0.0.1:${appPort}/api/images/openai/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        prompts: [{ shotId: provider === "jimeng" ? 1 : 2, prompt: "路由测试", negativePrompt: "" }],
        aspectRatio: "9:16",
        maxImages: 1,
        track: "通用故事",
        visualStyle: "现代电影",
        config: {
          baseUrl: `http://127.0.0.1:${providerPort}/v1`,
          apiKey: "smoke-test-only",
          model: provider === "jimeng" ? "seedream-smoke" : "all-purpose-smoke",
          concurrency: 1,
          providerName: provider,
          supportsReference: provider === "jimeng",
        },
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    if (payload.images?.[0]?.provider !== provider || payload.images?.[0]?.status !== "ready") {
      throw new Error(`${provider} route returned the wrong provider/status`);
    }
  }
  if (requests.length !== 2 || requests.some((item) => !item.url.endsWith("/v1/images/generations"))) {
    throw new Error("Provider requests did not use the expected /images/generations endpoint");
  }
  process.stdout.write("Image provider routing smoke test passed: jimeng + all-purpose\n");
} finally {
  child.kill();
  await new Promise((resolve) => fakeProvider.close(resolve));
}
