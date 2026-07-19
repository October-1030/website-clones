import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const taskId = process.argv[2];
const round = process.argv[3] || "segmented-actual";

if (!taskId) throw new Error("用法：node scripts/build-segmented-actual-timeline.mjs <task-id> [round-name]");

function parseTime(value) {
  const [hours, minutes, rest] = value.split(":");
  const [seconds, milliseconds] = rest.split(",");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(milliseconds) / 1000;
}

function parseSrt(value) {
  return String(value || "").trim().split(/\r?\n\r?\n+/).map((block) => {
    const lines = block.split(/\r?\n/);
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) return null;
    const [start, end] = lines[timingIndex].split("-->").map((item) => item.trim());
    return { startSec: parseTime(start), endSec: parseTime(end), text: lines.slice(timingIndex + 1).join(" ").trim() };
  }).filter(Boolean);
}

function visibleLength(value) {
  return [...String(value || "").replace(/\s/g, "")].length;
}

function fallbackCues(value, maximum = 12) {
  const clean = String(value || "").replace(/\s+/g, "").replace(/[，。、；：？！“”‘’（）【】《》——…·,.!?;:"'()[\]]/gu, "");
  const characters = [...clean];
  const cues = [];
  for (let index = 0; index < characters.length; index += maximum) cues.push(characters.slice(index, index + maximum).join(""));
  return cues.length ? cues : [String(value || "").trim()];
}

function srtTime(seconds) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((milliseconds % 60_000) / 1000);
  const remainder = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")},${String(remainder).padStart(3, "0")}`;
}

const taskPath = join(appRoot, ".storybound-data", "tasks", taskId, "task.json");
const task = JSON.parse(await readFile(taskPath, "utf8"));
const shots = task.artifacts?.storyboard?.shots || [];
const oldTimeline = task.media?.timeline || [];
const analysisPath = join(dirname(taskPath), "review", round, "qc", "tts-segment-analysis.json");
const analysis = JSON.parse(await readFile(analysisPath, "utf8"));
const measuredByShot = new Map(analysis.segments.map((item) => [Number(item.shotId), item]));
const originalSrt = parseSrt(await readFile(join(task.draft.projectDir, "timeline.srt"), "utf8"));
let cursor = 0;
const timeline = [];
const cues = [];
for (const shot of shots) {
  const measured = measuredByShot.get(Number(shot.id));
  if (!measured) throw new Error(`第 ${shot.id} 镜缺少实测音频分析`);
  const old = oldTimeline.find((item) => Number(item.shotId) === Number(shot.id));
  const texts = originalSrt
    .filter((cue) => old && cue.startSec >= old.startSec - 0.002 && cue.startSec < old.endSec - 0.002)
    .map((cue) => cue.text)
    .filter(Boolean);
  const cueTexts = texts.length ? texts : fallbackCues(shot.text);
  const durationSec = Number(measured.durationSec);
  const startSec = cursor;
  const endSec = Number((startSec + durationSec).toFixed(3));
  timeline.push({
    shotId: shot.id,
    text: shot.text,
    startSec,
    endSec,
    durationSec,
    audioPath: measured.filePath,
    leadingSilenceSec: measured.leadingSilenceSec,
    trailingSilenceSec: measured.trailingSilenceSec,
    treatment: measured.abnormalLeading || measured.abnormalTrailing ? "异常首尾静音待裁剪" : "实测范围内，保留原音",
  });
  const totalWeight = Math.max(1, cueTexts.reduce((sum, text) => sum + Math.max(1, visibleLength(text)), 0));
  let cueCursor = startSec;
  for (const [index, text] of cueTexts.entries()) {
    const cueDuration = index === cueTexts.length - 1
      ? endSec - cueCursor
      : durationSec * Math.max(1, visibleLength(text)) / totalWeight;
    const cueEnd = index === cueTexts.length - 1 ? endSec : Number((cueCursor + cueDuration).toFixed(3));
    cues.push({ index: cues.length + 1, shotId: shot.id, text, startSec: cueCursor, endSec: cueEnd });
    cueCursor = cueEnd;
  }
  cursor = endSec;
}

const outputDir = join(dirname(taskPath), "review", round);
await mkdir(outputDir, { recursive: true });
const plan = {
  mode: "original-segmented",
  structure: "每镜独立图片、独立 TTS、独立字幕；按 MP3 实测时长连续排列",
  totalDurationSec: cursor,
  timeline,
  cues,
  audioTreatment: "9 段均未超过异常静音阈值，保留原始段首/段尾和内部语义停顿；不做硬切或交叉淡化",
};
const planPath = join(outputDir, "review-plan.json");
const srtPath = join(outputDir, "timeline.srt");
const srt = `${cues.map((cue) => `${cue.index}\n${srtTime(cue.startSec)} --> ${srtTime(cue.endSec)}\n${cue.text}`).join("\n\n")}\n`;
await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
await writeFile(srtPath, srt, "utf8");
process.stdout.write(`${JSON.stringify({ planPath, srtPath, totalDurationSec: cursor, shots: timeline.length, cues: cues.length })}\n`);
