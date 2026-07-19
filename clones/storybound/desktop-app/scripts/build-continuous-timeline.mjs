import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const taskId = process.argv[2] || "6e8bcd4d-86d7-4244-9ac6-ff9124b1fd1d";
const round = process.argv[3] || "audio-fix";

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function parseCaptionTexts(ass) {
  return String(ass)
    .split(/\r?\n/)
    .filter((line) => line.startsWith("Dialogue: 1,"))
    .map((line) => line.split(/,(.*)/s)[1]?.split(",", 9))
    .map((_unused, index) => {
      const line = String(ass).split(/\r?\n/).filter((item) => item.startsWith("Dialogue: 1,"))[index];
      return line.split(",", 10)[9]?.trim();
    })
    .filter(Boolean);
}

function editAlignment(expected, actual) {
  const m = expected.length;
  const n = actual.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1),
      );
    }
  }
  const mapping = Array(m).fill(null);
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const diagonalCost = i > 0 && j > 0 ? dp[i - 1][j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1) : Infinity;
    if (i > 0 && j > 0 && dp[i][j] === diagonalCost) {
      mapping[i - 1] = j - 1;
      i -= 1;
      j -= 1;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return { mapping, distance: dp[m][n] };
}

function assTime(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const whole = Math.floor(value % 60);
  const milliseconds = Math.round((value - Math.floor(value)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(whole).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

const taskPath = join(appRoot, ".storybound-data", "tasks", taskId, "task.json");
const outputDir = join(appRoot, ".storybound-data", "tasks", taskId, "review", round);
const task = JSON.parse(await readFile(taskPath, "utf8"));
const source = JSON.parse(await readFile(join(outputDir, "continuous-source.json"), "utf8"));
const transcript = JSON.parse(await readFile(join(outputDir, "qc", "transcript.json"), "utf8"));
const oldAss = await readFile(join(appRoot, ".storybound-data", "tasks", taskId, "review", "round-2", "subtitles.ass"), "utf8");
const captionTexts = parseCaptionTexts(oldAss);
const shots = task.artifacts.storyboard.shots;
const expectedText = shots.map((shot) => normalize(shot.text)).join("");
const actualCharacters = transcript.segments.flatMap((segment) => (segment.words || []).flatMap((word) => {
  const characters = Array.from(normalize(word.word));
  return characters.map((character, index) => ({
    character,
    start: Number(word.start) + (Number(word.end) - Number(word.start)) * index / Math.max(1, characters.length),
    end: Number(word.start) + (Number(word.end) - Number(word.start)) * (index + 1) / Math.max(1, characters.length),
  }));
}));
const actualText = actualCharacters.map((item) => item.character).join("");
const alignment = editAlignment(Array.from(expectedText), Array.from(actualText));
const expectedTiming = alignment.mapping.map((actualIndex, expectedIndex) => {
  if (actualIndex !== null) return { ...actualCharacters[actualIndex], expectedIndex };
  return null;
});
for (let index = 0; index < expectedTiming.length; index += 1) {
  if (expectedTiming[index]) continue;
  let previous = index - 1;
  while (previous >= 0 && !expectedTiming[previous]) previous -= 1;
  let next = index + 1;
  while (next < expectedTiming.length && !expectedTiming[next]) next += 1;
  const previousEnd = previous >= 0 ? expectedTiming[previous].end : 0;
  const nextStart = next < expectedTiming.length ? expectedTiming[next].start : Number(transcript.duration || source.actualDurationSec);
  const missingCount = next - previous - 1;
  const offset = index - previous;
  const start = previousEnd + (nextStart - previousEnd) * (offset - 1) / Math.max(1, missingCount);
  const end = previousEnd + (nextStart - previousEnd) * offset / Math.max(1, missingCount);
  expectedTiming[index] = { character: expectedText[index], start, end, expectedIndex: index, interpolated: true };
}

function rangeTiming(startIndex, endIndex) {
  const items = expectedTiming.slice(startIndex, endIndex).filter(Boolean);
  return {
    rawStart: items[0]?.start || 0,
    rawEnd: items.at(-1)?.end || 0,
  };
}

let expectedCursor = 0;
const cues = captionTexts.map((text, index) => {
  const clean = normalize(text);
  let startIndex = expectedText.indexOf(clean, expectedCursor);
  if (startIndex < 0) startIndex = expectedCursor;
  const endIndex = Math.min(expectedText.length, startIndex + clean.length);
  expectedCursor = endIndex;
  const timing = rangeTiming(startIndex, endIndex);
  return { index: index + 1, text, startIndex, endIndex, ...timing, startSec: Math.max(0, timing.rawStart - 0.06), endSec: timing.rawEnd + 0.18 };
});
for (let index = 0; index < cues.length - 1; index += 1) {
  const current = cues[index];
  const next = cues[index + 1];
  if (current.endSec >= next.startSec - 0.02) {
    const boundary = Math.max(current.rawEnd, Math.min(next.rawStart, (current.rawEnd + next.rawStart) / 2));
    current.endSec = boundary;
    next.startSec = boundary + 0.02;
  }
  if (current.endSec - current.startSec < 0.35) current.endSec = current.startSec + 0.35;
}
const audioEndSec = Number(source.actualDurationSec);
if (cues.length) cues.at(-1).endSec = Math.min(audioEndSec + 0.25, Math.max(cues.at(-1).endSec, cues.at(-1).rawEnd + 0.22));

let shotCursor = 0;
const shotRanges = shots.map((shot) => {
  const clean = normalize(shot.text);
  const startIndex = shotCursor;
  const endIndex = Math.min(expectedText.length, startIndex + clean.length);
  shotCursor = endIndex;
  return { shot, startIndex, endIndex, ...rangeTiming(startIndex, endIndex) };
});
const totalDurationSec = Number((audioEndSec + 0.55).toFixed(3));
const boundaries = [0];
for (let index = 1; index < shotRanges.length; index += 1) {
  boundaries.push(Number(Math.max(boundaries.at(-1) + 0.5, shotRanges[index].rawStart - 0.08).toFixed(3)));
}
boundaries.push(totalDurationSec);
const timeline = shotRanges.map((item, index) => ({
  shotId: item.shot.id,
  text: item.shot.text,
  startSec: boundaries[index],
  endSec: boundaries[index + 1],
  durationSec: Number((boundaries[index + 1] - boundaries[index]).toFixed(3)),
  speechStartSec: Number(item.rawStart.toFixed(3)),
  speechEndSec: Number(item.rawEnd.toFixed(3)),
}));
const sceneMap = shotRanges.map((item, index) => ({
  shotId: item.shot.id,
  startSec: timeline[index].startSec,
  endSec: timeline[index].endSec,
  durationSec: timeline[index].durationSec,
  voice: item.shot.text,
  subtitle: item.shot.text,
  visualAnchor: item.shot.visual,
  imagePath: task.media.images[index].path,
  audioPath: source.audioPath,
  speechStartSec: timeline[index].speechStartSec,
  speechEndSec: timeline[index].speechEndSec,
}));
const srt = cues.map((cue) => `${cue.index}\n${assTime(cue.startSec)} --> ${assTime(cue.endSec)}\n${cue.text}\n`).join("\n");
const plan = {
  mode: "continuous-narration",
  audioPath: source.audioPath,
  actualAudioDurationSec: audioEndSec,
  totalDurationSec,
  timeline,
  cues,
  asr: {
    language: transcript.language,
    languageProbability: transcript.language_probability,
    expectedCharacters: expectedText.length,
    actualCharacters: actualText.length,
    editDistance: alignment.distance,
    characterErrorRate: Number((alignment.distance / Math.max(1, expectedText.length)).toFixed(4)),
    interpolatedCharacters: expectedTiming.filter((item) => item.interpolated).length,
  },
};
await writeFile(join(outputDir, "continuous-plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
await writeFile(join(outputDir, "timeline.srt"), srt, "utf8");
await writeFile(join(outputDir, "scene-voice-map.json"), `${JSON.stringify(sceneMap, null, 2)}\n`, "utf8");
await writeFile(join(outputDir, "qc", "alignment-report.json"), `${JSON.stringify(plan.asr, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ totalDurationSec, timeline: timeline.map((item) => ({ shotId: item.shotId, startSec: item.startSec, endSec: item.endSec, durationSec: item.durationSec })), cues: cues.length, asr: plan.asr })}\n`);
