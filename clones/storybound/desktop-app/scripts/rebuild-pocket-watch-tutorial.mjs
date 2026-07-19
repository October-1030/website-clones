import { randomUUID } from "node:crypto";

const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const sourceTaskId = process.argv[2] || "6e8bcd4d-86d7-4244-9ac6-ff9124b1fd1d";
const targetTaskId = process.argv[3] || randomUUID();

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
  return response;
}

async function json(path, init) {
  return request(path, init).then((response) => response.json());
}

function compact(text) {
  return String(text || "").trim().replace(/\s*\r?\n+\s*/g, "");
}

function timelineFromAlignment(shots, audio) {
  const words = audio.alignment.words;
  let textCursor = 0;
  let timeCursor = 0;
  return shots.map((shot, index) => {
    textCursor += compact(shot.text).length;
    const marker = words.find((word) => word.textEnd >= textCursor);
    const endSec = index === shots.length - 1 ? audio.durationSec : Number(marker?.endSec);
    if (!Number.isFinite(endSec) || endSec <= timeCursor) throw new Error(`第 ${shot.id} 镜无法匹配真实时间戳`);
    const item = { shotId: shot.id, text: shot.text, startSec: timeCursor, endSec, durationSec: endSec - timeCursor };
    timeCursor = endSec;
    return item;
  });
}

const source = (await json(`/api/tasks/${sourceTaskId}`)).task;
const shots = source.artifacts?.storyboard?.shots || [];
if (!shots.length) throw new Error("源任务没有分镜");
const narrationText = shots.map((shot) => compact(shot.text)).join("");

const created = (await json("/api/tasks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    id: targetTaskId,
    title: `${source.title}（教程连续旁白版）`,
    inputText: source.inputText,
    sourceMode: source.sourceMode,
    aiBrief: source.aiBrief,
    mode: source.mode,
    pausePreset: source.pausePreset,
    customPauseSteps: source.customPauseSteps,
    videoForm: source.videoForm,
    track: source.track,
    visualStyle: source.visualStyle,
    aspectRatio: source.aspectRatio,
    status: "running",
    runState: "running",
    currentStep: 5,
    stepStatuses: ["done", "done", "done", "done", "done", "running", "pending"],
    options: { ...source.options, ttsMode: "continuous", ttsSpeed: 1 },
    artifacts: source.artifacts,
    media: {
      images: source.media.images,
      videos: source.media.videos || [],
      coverImages: source.media.coverImages || [],
      audioSegments: [],
      continuousAudio: null,
      podcast: null,
      externalAudio: null,
      bgm: source.media.bgm || null,
      timeline: null,
    },
  }),
})).task;

const audioResponse = await request("/api/tts/synthesize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    provider: "minimax",
    text: narrationText,
    voiceId: source.options.ttsVoiceId,
    speed: 1,
    config: { model: "speech-2.8-hd" },
    taskId: targetTaskId,
    shotId: 0,
    fileName: "pocket-watch-tutorial-continuous-1.0.mp3",
    alignment: true,
  }),
});
const audioBytes = await audioResponse.arrayBuffer();
const alignmentUrl = decodeURIComponent(audioResponse.headers.get("X-TTS-Alignment-Url") || "");
if (!alignmentUrl) throw new Error("MiniMax 没有返回词级时间戳文件");
const alignment = await request(alignmentUrl).then((response) => response.json());
const continuousAudio = {
  id: `audio-tutorial-${Date.now()}`,
  shotId: 0,
  text: narrationText,
  voiceId: source.options.ttsVoiceId,
  fileName: decodeURIComponent(audioResponse.headers.get("X-Asset-File") || ""),
  path: decodeURIComponent(audioResponse.headers.get("X-Asset-Path") || ""),
  url: decodeURIComponent(audioResponse.headers.get("X-Asset-Url") || ""),
  bytes: audioBytes.byteLength,
  durationSec: Number(audioResponse.headers.get("X-TTS-Duration")),
  speed: 1,
  alignment,
  status: "ready",
};
const timeline = timelineFromAlignment(shots, continuousAudio);
await json(`/api/tasks/${targetTaskId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    media: { ...created.media, continuousAudio, timeline },
    currentStep: 6,
    stepStatuses: ["done", "done", "done", "done", "done", "done", "running"],
  }),
});
const draftResult = await json(`/api/tasks/${targetTaskId}/draft`, { method: "POST" });
process.stdout.write(`${JSON.stringify({
  ok: true,
  sourceTaskId,
  targetTaskId,
  durationSec: continuousAudio.durationSec,
  words: alignment.words.length,
  shots: shots.length,
  shotDurations: timeline.map((item) => Number(item.durationSec.toFixed(3))),
  draftDir: draftResult.draft.projectDir,
}, null, 2)}\n`);
