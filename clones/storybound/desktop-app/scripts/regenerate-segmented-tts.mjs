import { constants } from "node:fs";
import { copyFile, cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const taskId = process.argv[2];
const targetSpeed = Number(process.argv[3] || 1);
const round = process.argv[4] || `original-segmented-${targetSpeed.toFixed(1)}x`;
const serverBase = process.argv[5] || process.env.STORYBOUND_URL || "http://127.0.0.1:5173";

if (!taskId || !Number.isFinite(targetSpeed) || targetSpeed <= 0) {
  throw new Error("用法：node scripts/regenerate-segmented-tts.mjs <task-id> [speed] [round-name] [server-base]");
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${serverBase}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${path} 失败（HTTP ${response.status}）：${await response.text()}`);
  return response.json();
}

function assetHeader(response, name) {
  return decodeURIComponent(response.headers.get(name) || "");
}

function speedLabel(value) {
  return Number(value).toFixed(1);
}

async function archiveCurrentVersion(task, taskDir) {
  const currentSpeed = Number(task.options?.ttsSpeed || 1);
  if (Math.abs(currentSpeed - targetSpeed) < 0.0001) return null;
  const archiveDir = join(taskDir, "review", `original-segmented-${speedLabel(currentSpeed)}x`);
  const manifestPath = join(archiveDir, "archive-manifest.json");
  if (await exists(manifestPath)) return archiveDir;

  await mkdir(join(archiveDir, "audio"), { recursive: true });
  await copyFile(join(taskDir, "task.json"), join(archiveDir, "task-before-regeneration.json"), constants.COPYFILE_EXCL);
  for (const segment of task.media?.audioSegments || []) {
    if (!segment.path || !(await exists(segment.path))) continue;
    await copyFile(segment.path, join(archiveDir, "audio", basename(segment.path)), constants.COPYFILE_EXCL);
  }

  const legacyReview = join(taskDir, "review", "segmented-actual");
  if (await exists(legacyReview)) await cp(legacyReview, join(archiveDir, "review"), { recursive: true, errorOnExist: true, force: false });
  if (task.draft?.zipPath && await exists(task.draft.zipPath)) {
    await copyFile(task.draft.zipPath, join(archiveDir, `draft-${speedLabel(currentSpeed)}x.zip`), constants.COPYFILE_EXCL);
  }
  if (task.draft?.projectDir && await exists(task.draft.projectDir)) {
    await cp(task.draft.projectDir, join(archiveDir, "draft-project"), { recursive: true, errorOnExist: true, force: false });
  }

  await writeFile(manifestPath, `${JSON.stringify({
    taskId,
    mode: task.options?.ttsMode,
    speed: currentSpeed,
    voiceId: task.options?.ttsVoiceId,
    archivedAt: new Date().toISOString(),
    audioSegments: task.media?.audioSegments || [],
    draft: task.draft || null,
  }, null, 2)}\n`, "utf8");
  return archiveDir;
}

async function synthesize(task, shot, index) {
  const fileName = `${shot.id}-speed-${speedLabel(targetSpeed)}.mp3`;
  const response = await fetch(`${serverBase}/api/tts/synthesize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "minimax",
      text: shot.text,
      voiceId: task.options?.ttsVoiceId || "Chinese (Mandarin)_Reliable_Executive",
      speed: targetSpeed,
      config: { apiKey: "", model: "speech-2.8-hd" },
      taskId,
      shotId: shot.id,
      fileName,
    }),
  });
  if (!response.ok) throw new Error(`第 ${shot.id} 镜 TTS 失败（HTTP ${response.status}）：${await response.text()}`);
  await response.arrayBuffer();
  const path = assetHeader(response, "X-Asset-Path");
  const durationSec = Number(response.headers.get("X-TTS-Duration"));
  if (!path || !Number.isFinite(durationSec) || durationSec <= 0) throw new Error(`第 ${shot.id} 镜缺少有效文件路径或实测时长`);
  const segment = {
    id: `audio-N-${shot.id}-${Date.now()}-${index}`,
    shotId: shot.id,
    text: shot.text,
    voiceId: task.options?.ttsVoiceId || "Chinese (Mandarin)_Reliable_Executive",
    fileName: assetHeader(response, "X-Asset-File"),
    path,
    url: assetHeader(response, "X-Asset-Url"),
    bytes: Number(response.headers.get("content-length") || 0),
    durationSec: Number(durationSec.toFixed(3)),
    speed: targetSpeed,
    status: "ready",
  };
  process.stdout.write(`TTS ${index + 1}/${task.artifacts.storyboard.shots.length}：${segment.durationSec.toFixed(3)}s\n`);
  return segment;
}

const taskDir = join(appRoot, ".storybound-data", "tasks", taskId);
const taskPath = join(taskDir, "task.json");
const task = JSON.parse(await readFile(taskPath, "utf8"));
const shots = task.artifacts?.storyboard?.shots || [];
if (task.options?.ttsMode !== "original-segmented") throw new Error("当前任务不是原版逐镜 TTS 模式");
if (shots.length !== 9) throw new Error(`怀表验收任务应有 9 个分镜，当前为 ${shots.length} 个`);

const archiveDir = await archiveCurrentVersion(task, taskDir);
if (archiveDir) process.stdout.write(`ARCHIVE ${archiveDir}\n`);

const audioSegments = [];
let cursor = 0;
for (const [index, shot] of shots.entries()) {
  const segment = await synthesize(task, shot, index);
  segment.startSec = Number(cursor.toFixed(3));
  cursor += segment.durationSec;
  audioSegments.push(segment);
}
const timeline = audioSegments.map((segment) => ({
  shotId: segment.shotId,
  text: segment.text,
  startSec: segment.startSec,
  endSec: Number((segment.startSec + segment.durationSec).toFixed(3)),
  durationSec: segment.durationSec,
}));

const updated = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
  method: "PATCH",
  body: JSON.stringify({
    options: { ...task.options, ttsMode: "original-segmented", ttsSpeed: targetSpeed },
    media: {
      ...task.media,
      audioSegments,
      continuousAudio: null,
      podcast: null,
      externalAudio: null,
      timeline,
    },
    draft: null,
  }),
})).task;

const outputDir = join(taskDir, "review", round);
await mkdir(outputDir, { recursive: true });
const manifestPath = join(outputDir, "generation-manifest.json");
await writeFile(manifestPath, `${JSON.stringify({
  taskId,
  mode: "original-segmented",
  speed: targetSpeed,
  voiceId: updated.options?.ttsVoiceId,
  model: "speech-2.8-hd",
  totalDurationSec: Number(cursor.toFixed(3)),
  audioSegments,
  timeline,
  preservedArchiveDir: archiveDir,
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`, "utf8");

process.stdout.write(`${JSON.stringify({ taskId, round, speed: targetSpeed, totalDurationSec: Number(cursor.toFixed(3)), manifestPath, archiveDir })}\n`);
