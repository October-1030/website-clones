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
function segmentQuality(segment) {
  const segmentWords = Array.isArray(segment.words) ? segment.words : [];
  const durationSec = Math.max(0.001, Number(segment.end || 0) - Number(segment.start || 0));
  const probabilities = segmentWords.map((word) => Number(word.probability)).filter(Number.isFinite);
  const meanProbability = probabilities.length ? probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length : 1;
  const wordsPerSecond = segmentWords.length / durationSec;
  const impossibleTailHallucination = segmentWords.length >= 8 && wordsPerSecond > 25 && meanProbability < 0.6;
  return { durationSec, meanProbability, wordsPerSecond, impossibleTailHallucination };
}
const segmentAudit = segments.map((segment) => ({ segment, quality: segmentQuality(segment) }));
const acceptedSegments = segmentAudit.filter((item) => !item.quality.impossibleTailHallucination).map((item) => item.segment);
const discardedSegments = segmentAudit.filter((item) => item.quality.impossibleTailHallucination).map((item) => ({
  startSec: Number(item.segment.start || 0),
  endSec: Number(item.segment.end || 0),
  text: item.segment.text,
  wordCount: Array.isArray(item.segment.words) ? item.segment.words.length : 0,
  meanProbability: Number(item.quality.meanProbability.toFixed(4)),
  wordsPerSecond: Number(item.quality.wordsPerSecond.toFixed(1)),
  reason: "低置信度且语速超出物理可能范围的静音尾部幻觉",
}));
const words = acceptedSegments
  .flatMap((segment) => Array.isArray(segment.words) ? segment.words : [])
  .filter((word) => normalize(word.word));

const sceneComparisons = sceneMap.map((scene) => {
  const matchingWords = words.filter((word) => {
    const midpoint = (Number(word.start || 0) + Number(word.end || 0)) / 2;
    return midpoint >= scene.startSec - 0.03 && midpoint < scene.endSec + 0.03;
  });
  const actual = matchingWords.length
    ? matchingWords.map((word) => word.word).join("")
    : acceptedSegments.filter((segment) => segment.start >= scene.startSec - 0.03 && segment.start < scene.endSec + 0.03).map((segment) => segment.text).join("");
  return {
    shotId: scene.shotId,
    startSec: scene.startSec,
    endSec: scene.endSec,
    ...compare(scene.voice, actual),
  };
});
const expectedFull = sceneMap.map((scene) => scene.voice).join("");
const full = compare(expectedFull, acceptedSegments.map((segment) => segment.text).join(""));
const videoDurationSec = sceneMap.at(-1).endSec;
const lastSpeechEndSec = Math.min(
  videoDurationSec,
  Math.max(
    0,
    ...words.map((word) => Number(word.end || 0)),
    ...acceptedSegments.filter((segment) => normalize(segment.text)).map((segment) => Number(segment.end || 0)),
  ),
);
const result = {
  taskId,
  round,
  language: transcript.language,
  languageProbability: transcript.language_probability,
  videoDurationSec,
  lastSpeechEndSec,
  endTailSec: Number((videoDurationSec - lastSpeechEndSec).toFixed(3)),
  discardedAsrHallucinations: discardedSegments,
  full,
  scenes: sceneComparisons,
};

await writeFile(join(qcDir, "transcript-comparison.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(
  join(qcDir, "transcript-comparison.md"),
  `# ${round} 配音复核\n\n- 整体字符错误率（本机 Whisper 复核值）：${(full.characterErrorRate * 100).toFixed(1)}%\n- 识别语种：${transcript.language}（置信度 ${(Number(transcript.language_probability || 0) * 100).toFixed(1)}%）\n- 最后语音结束：${lastSpeechEndSec.toFixed(3)}s\n- 视频目标结束：${videoDurationSec.toFixed(3)}s\n- 结尾余量：${(videoDurationSec - lastSpeechEndSec).toFixed(3)}s\n- 排除的不可能 ASR 尾部幻觉：${discardedSegments.length} 段（原始数据仍保留在 transcript.json）\n\n## 分镜对照\n\n${sceneComparisons.map((item) => `- 第 ${item.shotId} 镜｜${item.startSec.toFixed(3)}–${item.endSec.toFixed(3)}s｜CER ${(item.characterErrorRate * 100).toFixed(1)}%｜期望 ${item.expectedChars} 字 / 识别 ${item.actualChars} 字`).join("\n")}\n`,
  "utf8",
);

process.stdout.write(`${JSON.stringify({ fullCer: full.characterErrorRate, lastSpeechEndSec, endTailSec: videoDurationSec - lastSpeechEndSec, sceneCer: sceneComparisons.map((item) => item.characterErrorRate) })}\n`);
