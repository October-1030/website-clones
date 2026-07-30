import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const dataRoot = join(process.cwd(), ".storybound-data", "tasks");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

async function upload(jobId, path, kind) {
  const extension = extname(path).toLowerCase();
  const mimeType = extension === ".mp3" ? "audio/mpeg" : "image/jpeg";
  const base64 = (await readFile(path)).toString("base64");
  return request(`/api/media-workbench/jobs/${encodeURIComponent(jobId)}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      fileName: `smoke-${kind}${extension}`,
      mimeType,
      base64,
    }),
  }).then((payload) => payload.asset);
}

const files = await walk(dataRoot);
const images = files.filter((path) => /\.(?:jpe?g|png|webp)$/i.test(path));
const audio = files.filter((path) => /\.(?:mp3|wav|flac)$/i.test(path));
const relativeAssets = files.map((path) => ({ path, parts: relative(dataRoot, path).split(/[\\/]/) }));
const taskIds = [...new Set(relativeAssets.map(({ parts }) => parts[0]).filter(Boolean))];
const pairedTask = taskIds
  .map((taskId) => {
    const pairs = [1, 2].map((number) => ({
      imagePath: images.find((path) => {
        const parts = relative(dataRoot, path).split(/[\\/]/);
        return parts[0] === taskId && parts[1] === "images" && parts[2] === `${number}${extname(path)}`;
      }),
      audioPath: audio.find((path) => {
        const parts = relative(dataRoot, path).split(/[\\/]/);
        return parts[0] === taskId && parts[1] === "audio" && parts[2] === `${number}${extname(path)}`;
      }),
    }));
    return pairs.every((pair) => pair.imagePath && pair.audioPath) ? pairs : null;
  })
  .find(Boolean);

if (!pairedTask) throw new Error("没有找到同一任务下两组可复用的分镜图片和逐镜音频");

const timestamp = new Date().toISOString();
const manifest = {
  schemaVersion: 1,
  kind: "html-video",
  title: "媒体工作台真实渲染冒烟测试",
  sourceText: "怀表停在凌晨两点十七分，时间留下了一道没有说完的谜。",
  visualStyle: "现代电影",
  aspectRatio: "9:16",
  width: 540,
  height: 960,
  fps: 30,
  scenes: [
    {
      id: 1,
      title: "停在凌晨两点十七分的怀表",
      subtitle: "怀表停在凌晨两点十七分，时间留下了一道没有说完的谜。",
      prompt: "现代电影感，昏暗室内，一枚停摆的旧怀表，竖屏构图",
      layout: "center-focus",
      subtitleStyle: "outline",
      animation: "breathe",
      status: "pending",
    },
    {
      id: 2,
      title: "第二个分镜",
      subtitle: "指针不再前进，故事却刚刚开始。",
      prompt: "旧怀表特写，冷色电影光线，悬疑氛围，竖屏构图",
      layout: "full-image",
      subtitleStyle: "pill",
      animation: "rise",
      status: "pending",
    },
  ],
  createdAt: timestamp,
  updatedAt: timestamp,
};

const created = await request("/api/media-workbench/jobs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ kind: "html-video", title: manifest.title, manifest }),
}).then((payload) => payload.job);

const assets = await Promise.all(pairedTask.map(async (pair) => ({
  image: await upload(created.id, pair.imagePath, "images"),
  audio: await upload(created.id, pair.audioPath, "audio"),
})));

const readyManifest = {
  ...manifest,
  scenes: manifest.scenes.map((scene, index) => ({
    ...scene,
    image: assets[index].image,
    audio: assets[index].audio,
    status: "ready",
  })),
  updatedAt: new Date().toISOString(),
};

await request(`/api/media-workbench/jobs/${encodeURIComponent(created.id)}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ manifest: readyManifest, stage: "真实资源已上传", progress: 40 }),
});

const rendered = await request(`/api/media-workbench/jobs/${encodeURIComponent(created.id)}/render`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ manifest: readyManifest }),
}).then((payload) => payload.job);

if (rendered.status !== "completed" || !rendered.output?.mp4Path || !rendered.output?.jianyingZipPath) {
  throw new Error(`真实渲染未完成：${rendered.status} ${rendered.error || ""}`);
}

const [mp4, draft] = await Promise.all([
  stat(rendered.output.mp4Path),
  stat(rendered.output.jianyingZipPath),
]);

console.log(JSON.stringify({
  jobId: rendered.id,
  sourceAssets: pairedTask,
  status: rendered.status,
  output: rendered.output,
  mp4Bytes: mp4.size,
  jianyingZipBytes: draft.size,
}, null, 2));
