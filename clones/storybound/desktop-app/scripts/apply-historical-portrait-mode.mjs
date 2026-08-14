import { copyFile, stat } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:5173";
const [taskId] = process.argv.slice(2);

if (!taskId) {
  throw new Error("Usage: node scripts/apply-historical-portrait-mode.mjs <task-id>");
}

const originalSourceUrl = "https://upload.wikimedia.org/wikipedia/commons/4/45/%E4%BA%8E%E5%8F%B3%E4%BB%BB%E8%82%96%E5%83%8F%E7%85%A7.jpg";
const commonsPageUrl = "https://commons.wikimedia.org/wiki/File:%E4%BA%8E%E5%8F%B3%E4%BB%BB%E8%82%96%E5%83%8F%E7%85%A7.jpg";
// This tool is kept as the last-resort authenticity fallback.  The normal path
// is MiniMax scene generation with the approved source portrait as its single
// subject reference.  Do not apply archive stills to a task by default.
const portraitShots = new Set([6, 7, 28, 40, 42]);

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

const task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`)).task;
const taskDirectory = `${process.cwd()}/.storybound-data/tasks/${taskId}`;
const sourcePath = `${taskDirectory}/uploads/yu-youren-primary-identity-reference.jpg`;
const sourceStat = await stat(sourcePath);

const images = await Promise.all(task.media.images.map(async (image) => {
  if (!portraitShots.has(Number(image.shotId))) return image;
  const fileName = `historical-yu-youren-${image.shotId}.jpg`;
  const path = `${taskDirectory}/images/${fileName}`;
  await copyFile(sourcePath, path);
  return {
    ...image,
    id: `historical-yu-youren-${image.shotId}`,
    fileName,
    path,
    url: `/api/tasks/${encodeURIComponent(taskId)}/files/images/${fileName}`,
    bytes: sourceStat.size,
    provider: "historical-source",
    status: "ready",
    prompt: `真实历史肖像：于右任（本镜仅使用真实人物照片，不由 AI 伪造正脸）。${image.prompt || ""}`,
    sourceUrl: commonsPageUrl,
    sourceTitle: "于右任肖像照（1935–1945）",
    attribution: "Wikimedia Commons · Public domain",
    license: "Public domain",
    licenseUrl: commonsPageUrl,
    originalSourceUrl,
    historicalPortrait: true,
  };
}));

const stepStatuses = [...task.stepStatuses];
stepStatuses[6] = "pending";
const updated = await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
  method: "PATCH",
  body: JSON.stringify({
    media: { ...task.media, images },
    options: {
      ...task.options,
      historicalPortraitMode: true,
      historicalPortraitNotice: "真人正脸镜头使用已核实的公开历史肖像；AI 只生成场景、物件或不露脸镜头。",
    },
    draft: null,
    stepStatuses,
  }),
});

process.stdout.write(`Historical portrait mode applied to shots: ${[...portraitShots].join(", ")}\n`);
process.stdout.write(`${updated.task.media.images.filter((image) => image.historicalPortrait).length} historical portrait shots ready.\n`);
