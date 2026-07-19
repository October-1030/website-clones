import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ffprobe = process.env.FFPROBE_PATH
  || "C:\\Users\\pdb12\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffprobe.exe";
const appRoot = resolve(import.meta.dirname, "..");
const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const taskId = process.argv[2] || "6e8bcd4d-86d7-4244-9ac6-ff9124b1fd1d";
const round = process.argv[3] || "audio-fix";

async function requestJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

const task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`)).task;
const text = String(task.artifacts?.rewrite?.narration || task.inputText || "").replace(/\s+/g, "").trim();
if (!text) throw new Error("任务没有可合成的完整旁白");
const voiceId = task.options?.ttsVoiceId || "Chinese (Mandarin)_Reliable_Executive";
const speed = Number(task.options?.ttsSpeed || 1);
const response = await fetch(`${baseUrl}/api/tts/synthesize`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    provider: "minimax",
    text,
    voiceId,
    speed,
    config: { apiKey: "", model: "speech-2.8-hd" },
    taskId,
    fileName: "narration-continuous.mp3",
  }),
});
if (!response.ok) throw new Error(`连续旁白生成失败（${response.status}）：${await response.text()}`);
await response.arrayBuffer();
const audioPath = decodeURIComponent(response.headers.get("X-Asset-Path") || "");
if (!audioPath) throw new Error("连续旁白没有保存路径");
const { stdout } = await execFileAsync(ffprobe, [
  "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath,
], { windowsHide: true, timeout: 30_000 });
const actualDurationSec = Number(String(stdout).trim());
const outputDir = join(appRoot, ".storybound-data", "tasks", taskId, "review", round);
await mkdir(join(outputDir, "qc"), { recursive: true });
const metadata = {
  taskId,
  round,
  audioPath,
  text,
  characters: Array.from(text.replace(/\s/g, "")).length,
  voiceId,
  speed,
  model: "speech-2.8-hd",
  providerSegments: Number(response.headers.get("X-TTS-Segments") || 0),
  estimatedDurationSec: Number(response.headers.get("X-TTS-Duration") || 0),
  actualDurationSec,
};
await writeFile(join(outputDir, "continuous-source.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(metadata)}\n`);
