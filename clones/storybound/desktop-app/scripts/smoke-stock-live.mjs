import { randomUUID } from "node:crypto";

const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const taskId = `stock-live-${randomUUID()}`;

async function json(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

let created = false;
try {
  await json("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: taskId,
      title: "长城网络素材实测",
      inputText: "夕阳照在中国长城的城墙与烽火台上，远处群山层叠。",
      mode: "direct",
      videoForm: "narration",
      track: "民间故事",
      visualStyle: "现代电影",
      aspectRatio: "9:16",
      status: "paused",
      runState: "paused",
      currentStep: 4,
      options: { materialSource: "stock", autoBorrowImage: false },
      artifacts: {
        rewrite: {
          title: "夕阳下的长城",
          subtitle: [],
          narration: "夕阳照在中国长城的城墙与烽火台上，远处群山层叠。",
          tags: [],
          pinnedComment: "",
          comments: [],
          publishCopy: "",
          summary: "",
        },
        storyboard: {
          shots: [{
            id: 1,
            text: "夕阳照在中国长城的城墙与烽火台上，远处群山层叠。",
            visual: "中国长城全景，夕阳，烽火台，无人物",
            emotion: "庄重",
            durationSec: 6,
          }],
        },
        prompts: {
          templateVersion: "stock-live-smoke",
          prompts: [{ shotId: 1, prompt: "中国长城全景，夕阳，烽火台，无人物", negativePrompt: "水印" }],
        },
      },
    }),
  });
  created = true;

  const result = await json("/api/materials/stock/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskId,
      shotIds: [1],
      llmConfig: { provider: "minimax", apiKey: "", baseUrl: "", model: "MiniMax-M3" },
    }),
  });
  const image = result.task?.media?.images?.find((item) => item.shotId === 1);
  const manifest = result.task?.media?.stockLicenseManifest;
  if (image?.status !== "ready" || !image.path || !image.sourceUrl) {
    throw new Error(`网络素材未生成可用文件：${JSON.stringify(image)}`);
  }
  if (!image.license || !image.licenseUrl || !manifest?.path) {
    throw new Error(`素材授权记录不完整：${JSON.stringify({ image, manifest })}`);
  }
  process.stdout.write(JSON.stringify({
    ok: true,
    taskId,
    query: result.plans?.[0]?.queryEn || result.plans?.[0]?.queryZh,
    title: image.sourceTitle,
    license: image.license,
    sourceUrl: image.sourceUrl,
    localUrl: image.url,
    manifest: manifest.path,
  }) + "\n");
} finally {
  if (created && process.env.KEEP_TASK !== "1") {
    await fetch(`${baseUrl}/api/tasks/${taskId}`, { method: "DELETE" }).catch(() => undefined);
  }
}
