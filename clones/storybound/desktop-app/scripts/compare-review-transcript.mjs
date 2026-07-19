import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const taskId = process.argv[2];
const round = process.argv[3] || "round-1";

if (!taskId) throw new Error("用法：node scripts/compare-review-transcript.mjs <task-id> [round-name]");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .replace(/凌晨2点17分/g, "凌晨两点十七分");
}

function editDistance(left, right) {
  const a = Array.from(left);
  const b = Array.from(right);
  let previous = Array.from({ length: b.length + 1 }, (_item, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function compare(expected, actual) {
  const expectedNormalized = normalize(expected);
  const actualNormalized = normalize(actual);
  const distance = editDistance(expectedNormalized, actualNormalized);
  return {
    expected,
    actual,
    expectedChars: Array.from(expectedNormalized).length,
    actualChars: Array.from(actualNormalized).length,
    editDistance: distance,
    characterErrorRate: expectedNormalized ? Number((distance / Array.from(expectedNormalized).length).toFixed(4)) : 0,
  };
}

const outputDir = join(appRoot, ".storybound-data", "tasks", taskId, "review", round);
const qcDir = join(outputDir, "qc");
const sceneMap = JSON.parse(await readFile(join(outputDir, "scene-voice-map.json"), "utf8"));
const transcript = JSON.parse(await readFile(join(qcDir, "transcript.json"), "utf8"));
const segments = Array.isArray(transcript.segments) ? transcript.segments : [];
const words = segments.flatMap((segment) => Array.isArray(segment.words) ? segment.words : []);

const sceneComparisons = sceneMap.map((scene) => {
  const matchingWords = words.filter((word) => {
    const midpoint = (Number(word.start || 0) + Number(word.end || 0)) / 2;
    return midpoint >= scene.startSec - 0.03 && midpoint < scene.endSec + 0.03;
  });
  const actual = matchingWords.length
    ? matchingWords.map((word) => word.word).join("")
    : segments.filter((segment) => segment.start >= scene.startSec - 0.03 && segment.start < scene.endSec + 0.03).map((segment) => segment.text).join("");
  return {
    shotId: scene.shotId,
    startSec: scene.startSec,
    endSec: scene.endSec,
    ...compare(scene.voice, actual),
  };
});
const expectedFull = sceneMap.map((scene) => scene.voice).join("");
const full = compare(expectedFull, transcript.text);
const lastSpeechEndSec = Math.max(0, ...segments.map((segment) => Number(segment.end || 0)));
const videoDurationSec = sceneMap.at(-1).endSec;
const result = {
  taskId,
  round,
  language: transcript.language,
  languageProbability: transcript.language_probability,
  videoDurationSec,
  lastSpeechEndSec,
  endTailSec: Number((videoDurationSec - lastSpeechEndSec).toFixed(3)),
  full,
  scenes: sceneComparisons,
};

await writeFile(join(qcDir, "transcript-comparison.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(
  join(qcDir, "transcript-comparison.md"),
  `# ${round} 配音复核\n\n- 整体字符错误率（本机 Whisper 复核值）：${(full.characterErrorRate * 100).toFixed(1)}%\n- 识别语种：${transcript.language}（置信度 ${(Number(transcript.language_probability || 0) * 100).toFixed(1)}%）\n- 最后语音结束：${lastSpeechEndSec.toFixed(3)}s\n- 视频目标结束：${videoDurationSec.toFixed(3)}s\n- 结尾余量：${(videoDurationSec - lastSpeechEndSec).toFixed(3)}s\n\n## 分镜对照\n\n${sceneComparisons.map((item) => `- 第 ${item.shotId} 镜｜${item.startSec.toFixed(3)}–${item.endSec.toFixed(3)}s｜CER ${(item.characterErrorRate * 100).toFixed(1)}%｜期望 ${item.expectedChars} 字 / 识别 ${item.actualChars} 字`).join("\n")}\n`,
  "utf8",
);

process.stdout.write(`${JSON.stringify({ fullCer: full.characterErrorRate, lastSpeechEndSec, endTailSec: videoDurationSec - lastSpeechEndSec, sceneCer: sceneComparisons.map((item) => item.characterErrorRate) })}\n`);
