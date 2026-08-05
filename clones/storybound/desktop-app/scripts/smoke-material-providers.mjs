import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { generateRunningHubVideos, testRunningHubConnection } from "../server/runninghub.mjs";
import { saveStockSelections, searchCommonsMedia, stockMaterialInternals } from "../server/stock-materials.mjs";

const root = await mkdtemp(join(tmpdir(), "storybound-provider-smoke-"));
const imagePath = join(root, "shot.jpg");
await writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

const commonsPage = {
  pageid: 42,
  title: "File:Verified historical portrait.jpg",
  canonicalurl: "https://commons.wikimedia.org/wiki/File:Verified_historical_portrait.jpg",
  imageinfo: [{
    mime: "image/jpeg",
    width: 1600,
    height: 2000,
    thumburl: "https://upload.wikimedia.org/example/portrait.jpg",
    extmetadata: {
      LicenseShortName: { value: "CC BY-SA 4.0" },
      LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" },
      Artist: { value: "<b>Verified archive</b>" },
      ImageDescription: { value: "Historical portrait" },
    },
  }],
};

const commonsFetch = async () => new Response(JSON.stringify({ query: { pages: [commonsPage] } }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});
const candidates = await searchCommonsMedia("historical portrait", { fetchImpl: commonsFetch });
assert.equal(candidates.length, 1);
assert.equal(candidates[0].license, "CC BY-SA 4.0");
assert.equal(candidates[0].creator, "Verified archive");
assert.equal(stockMaterialInternals.isReusableLicense("CC BY-NC 4.0"), false);
assert.throws(() => stockMaterialInternals.safeCommonsUrl("http://127.0.0.1/private.jpg"));

const savedBuffers = [];
const stockStore = {
  async saveRemoteAsset(taskId, kind, fileName, url) {
    assert.equal(taskId, "stock-task");
    assert.equal(kind, "images");
    assert.match(url, /^https:\/\/upload\.wikimedia\.org\//);
    return { fileName, path: join(root, fileName), url: `/files/${fileName}`, bytes: 4 };
  },
  async saveBuffer(taskId, kind, fileName, buffer) {
    savedBuffers.push(JSON.parse(buffer.toString("utf8")));
    return { fileName, path: join(root, fileName), url: `/files/${fileName}`, bytes: buffer.length };
  },
};
const stock = await saveStockSelections(stockStore, "stock-task", [{
  shotId: 1,
  query: "historical portrait",
  candidate: candidates[0],
  confidence: 0.92,
  reason: "姓名和年代一致",
}]);
assert.equal(stock.images[0].status, "ready");
assert.equal(stock.images[0].source, "wikimedia-commons");
assert.equal(savedBuffers[0].assets[0].license, "CC BY-SA 4.0");

let queryCount = 0;
const runningHubFetch = async (url) => {
  const target = String(url);
  if (target.endsWith("/uc/openapi/accountStatus")) {
    return new Response(JSON.stringify({ code: 0, msg: "success", data: { remainCoins: "88", currentTaskCounts: "0", currency: "CNY", apiType: "NORMAL" } }), { status: 200 });
  }
  if (target.endsWith("/openapi/v2/media/upload/binary")) {
    return new Response(JSON.stringify({ code: 200, message: "success", data: { download_url: "https://rh-images.example/input.jpg" } }), { status: 200 });
  }
  if (target.includes("/openapi/v2/minimax/hailuo-2.3-fast/image-to-video")) {
    return new Response(JSON.stringify({ taskId: "provider-task-1", status: "RUNNING" }), { status: 200 });
  }
  if (target.endsWith("/openapi/v2/query")) {
    queryCount += 1;
    return new Response(JSON.stringify(queryCount === 1
      ? { taskId: "provider-task-1", status: "RUNNING", results: null }
      : { taskId: "provider-task-1", status: "SUCCESS", results: [{ url: "https://rh-videos.example/output.mp4", outputType: "mp4" }] }), { status: 200 });
  }
  throw new Error(`unexpected fetch: ${target}`);
};

const connection = await testRunningHubConnection("session-key", { fetchImpl: runningHubFetch });
assert.equal(connection.remainCoins, "88");
const events = [];
const runningHubStore = {
  async appendEvent(_taskId, event) { events.push(event); },
  async saveRemoteAsset(_taskId, kind, fileName, url) {
    assert.equal(kind, "videos");
    assert.equal(url, "https://rh-videos.example/output.mp4");
    return { fileName, path: join(root, fileName), url: `/files/${fileName}`, bytes: 1200 };
  },
};
const task = {
  id: "dynamic-task",
  aspectRatio: "9:16",
  options: { videoIntroDurationMode: "narration" },
  artifacts: { storyboard: { shots: [{ id: 1, text: "人物缓慢转身", visual: "历史人物站在窗边", durationSec: 6 }] } },
  media: {
    images: [{ shotId: 1, path: imagePath, status: "ready" }],
    timeline: [{ shotId: 1, text: "人物缓慢转身", startSec: 0, endSec: 7, durationSec: 7 }],
  },
};
const videos = await generateRunningHubVideos({
  taskStore: runningHubStore,
  task,
  apiKey: "session-key",
  shotIds: [1],
  model: "hailuo-2.3-fast",
  concurrency: 1,
  probeMediaDuration: async () => 6,
  fetchImpl: runningHubFetch,
  pollIntervalMs: 10,
  maxPolls: 3,
});
assert.equal(videos[0].status, "ready");
assert.equal(videos[0].providerTaskId, "provider-task-1");
assert.equal(videos[0].targetDurationSec, 7);
assert.ok(events.some((event) => event.type === "runninghub_complete"));

await rm(root, { recursive: true, force: true });
console.log(JSON.stringify({ ok: true, stockCandidates: candidates.length, runningHubVideos: videos.length, events: events.length }));
