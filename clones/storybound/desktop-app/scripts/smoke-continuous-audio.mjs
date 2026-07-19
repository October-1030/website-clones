import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const taskId = randomUUID();
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

function silentWav(seconds = 4, sampleRate = 8000) {
  const samples = seconds * sampleRate;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
  return response;
}

async function json(path, init) {
  return request(path, init).then((response) => response.json());
}

async function upload(fileName, kind, buffer) {
  const payload = await json(`/api/tasks/${taskId}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, kind, base64: buffer.toString("base64") }),
  });
  return payload.asset;
}

let created = false;
try {
  await json("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: taskId,
      title: "连续旁白草稿回归测试",
      inputText: "第一段连续旁白。第二段连续旁白。",
      mode: "direct",
      videoForm: "narration",
      aspectRatio: "9:16",
      options: { draftTemplateId: "default-portrait-9-16" },
      artifacts: { storyboard: { shots: [
        { id: 1, text: "第一段连续旁白。", visual: "画面一", emotion: "自然", durationSec: 2 },
        { id: 2, text: "第二段连续旁白。", visual: "画面二", emotion: "自然", durationSec: 2 },
      ] } },
    }),
  });
  created = true;
  const [image1, image2, audio] = await Promise.all([
    upload("1.png", "images", png),
    upload("2.png", "images", png),
    upload("narration-continuous.wav", "audio", silentWav()),
  ]);
  if (Math.abs(Number(audio.durationSec) - 4) > 0.05) throw new Error(`连续音频真实时长错误：${audio.durationSec}`);
  await json(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media: {
      images: [
        { id: "image-1", shotId: 1, prompt: "画面一", status: "ready", ...image1 },
        { id: "image-2", shotId: 2, prompt: "画面二", status: "ready", ...image2 },
      ],
      audioSegments: [],
      continuousAudio: { id: "audio-continuous", shotId: 0, text: "第一段连续旁白。第二段连续旁白。", voiceId: "smoke", status: "ready", ...audio },
      timeline: [
        { shotId: 1, text: "第一段连续旁白。", startSec: 0, endSec: 2, durationSec: 2 },
        { shotId: 2, text: "第二段连续旁白。", startSec: 2, endSec: 4, durationSec: 2 },
      ],
    } }),
  });
  const result = await json(`/api/tasks/${taskId}/draft`, { method: "POST" });
  const draftInfo = JSON.parse(await readFile(join(result.draft.projectDir, "draft_info.json"), "utf8"));
  const narrationTrack = draftInfo.tracks?.find((track) => track.name === "audio_main");
  if (narrationTrack?.segments?.length !== 1) throw new Error(`连续旁白应只有 1 个音频片段，实际为 ${narrationTrack?.segments?.length || 0}`);
  if (draftInfo.materials?.audios?.length !== 1) throw new Error(`连续旁白应只有 1 个音频素材，实际为 ${draftInfo.materials?.audios?.length || 0}`);
  if (narrationTrack.segments[0].target_timerange?.duration !== 4_000_000) throw new Error("连续旁白没有覆盖完整 4 秒时间线");
  process.stdout.write(`${JSON.stringify({ ok: true, taskId, projectName: result.draft.projectName, narrationSegments: 1, durationUs: draftInfo.duration })}\n`);
} finally {
  if (created && process.env.KEEP_TASK !== "1") await request(`/api/tasks/${taskId}`, { method: "DELETE" }).catch(() => undefined);
}
