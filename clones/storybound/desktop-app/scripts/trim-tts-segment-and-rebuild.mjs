import { execFile } from "node:child_process";
import { copyFile, mkdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
const appRoot = resolve(import.meta.dirname, "..");
const taskId = process.argv[2];
const shotId = Number(process.argv[3]);
const trimStartSec = Number(process.argv[4]);
const serverBase = process.argv[5] || "http://127.0.0.1:5173";

if (!taskId || !Number.isFinite(shotId) || !Number.isFinite(trimStartSec) || trimStartSec <= 0) {
  throw new Error("用法：node scripts/trim-tts-segment-and-rebuild.mjs <task-id> <shot-id> <trim-start-sec> [server-base]");
}

async function request(pathname, init) {
  const response = await fetch(`${serverBase}${pathname}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

async function durationSec(filePath) {
  const { stdout } = await execFileAsync(ffprobe, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ], { windowsHide: true, timeout: 30_000 });
  return Number(Number(stdout.trim()).toFixed(3));
}

const { task } = await request(`/api/tasks/${encodeURIComponent(taskId)}`);
const segment = task.media?.audioSegments?.find((item) => Number(item.shotId) === shotId);
if (!segment?.path) throw new Error(`第 ${shotId} 镜缺少可用 TTS 文件`);

const qcDir = join(appRoot, ".storybound-data", "tasks", taskId, "review", "final", "qc");
const backupDir = join(qcDir, "tts-original");
await mkdir(backupDir, { recursive: true });
await copyFile(segment.path, join(backupDir, `${shotId}.mp3`)).catch((error) => {
  if (error.code !== "EEXIST") throw error;
});

const temporaryPath = join(dirname(segment.path), `${shotId}.trimmed.mp3`);
await rm(temporaryPath, { force: true });
await execFileAsync(ffmpeg, [
  "-hide_banner", "-y",
  "-ss", trimStartSec.toFixed(3),
  "-i", segment.path,
  "-vn", "-c:a", "libmp3lame", "-q:a", "2",
  temporaryPath,
], { windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
await rename(temporaryPath, segment.path);

const audioSegments = [];
const timeline = [];
let cursor = 0;
for (const shot of task.artifacts?.storyboard?.shots || []) {
  const current = task.media.audioSegments.find((item) => Number(item.shotId) === Number(shot.id));
  if (!current?.path) throw new Error(`第 ${shot.id} 镜缺少 TTS 文件`);
  const measuredDurationSec = await durationSec(current.path);
  const startSec = Number(cursor.toFixed(3));
  const endSec = Number((startSec + measuredDurationSec).toFixed(3));
  audioSegments.push({ ...current, durationSec: measuredDurationSec, startSec, endSec, status: "ready" });
  timeline.push({ shotId: shot.id, text: shot.text, startSec, endSec, durationSec: measuredDurationSec });
  cursor = endSec;
}

const patch = await request(`/api/tasks/${encodeURIComponent(taskId)}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    options: { ...task.options, ttsMode: "original-segmented" },
    media: { ...task.media, audioSegments, timeline, continuousAudio: null, externalAudio: null },
  }),
});
const draft = await request(`/api/tasks/${encodeURIComponent(taskId)}/draft`, { method: "POST" });

process.stdout.write(`${JSON.stringify({
  taskId,
  shotId,
  trimStartSec,
  totalDurationSec: cursor,
  segmentDurationSec: audioSegments.find((item) => Number(item.shotId) === shotId)?.durationSec,
  projectDir: draft.draft?.projectDir,
  draftZipPath: draft.draft?.zipPath,
  taskUpdatedAt: patch.task?.updatedAt,
}, null, 2)}\n`);
