import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ffmpeg = process.env.FFMPEG_PATH
  || "C:\\Users\\pdb12\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe";
const appRoot = resolve(import.meta.dirname, "..");
const taskId = process.argv[2];
const round = process.argv[3] || "round-2";

if (!taskId) throw new Error("用法：node scripts/analyze-audio-continuity.mjs <task-id> [round-name]");

async function meanVolume(videoPath, startSec, endSec) {
  const durationSec = Math.max(0.12, endSec - startSec);
  const args = [
    "-hide_banner", "-ss", Math.max(0, startSec).toFixed(3), "-t", durationSec.toFixed(3),
    "-i", videoPath, "-vn", "-af", "volumedetect", "-f", "null", "NUL",
  ];
  try {
    const { stderr } = await execFileAsync(ffmpeg, args, { windowsHide: true, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
    return Number(String(stderr).match(/mean_volume:\s*(-?[0-9.]+)\s*dB/)?.[1]);
  } catch (error) {
    const match = String(error.stderr || "").match(/mean_volume:\s*(-?[0-9.]+)\s*dB/);
    return match ? Number(match[1]) : null;
  }
}

const outputDir = join(appRoot, ".storybound-data", "tasks", taskId, "review", round);
const qcDir = join(outputDir, "qc");
await mkdir(qcDir, { recursive: true });
const videoPath = join(outputDir, `pocket-watch-${round}.mp4`);
const sceneMap = JSON.parse(await readFile(join(outputDir, "scene-voice-map.json"), "utf8"));
const transcript = JSON.parse(await readFile(join(qcDir, "transcript.json"), "utf8"));
const words = transcript.segments.flatMap((segment) => segment.words || []).sort((a, b) => a.start - b.start);
let ttsAnalysis = null;
try {
  ttsAnalysis = JSON.parse(await readFile(join(qcDir, "tts-segment-analysis.json"), "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const seams = [];

for (let index = 0; index < sceneMap.length - 1; index += 1) {
  const boundarySec = Number(sceneMap[index].endSec);
  const previousWords = words.filter((word) => (Number(word.start) + Number(word.end)) / 2 < boundarySec);
  const nextWords = words.filter((word) => (Number(word.start) + Number(word.end)) / 2 >= boundarySec);
  const previous = previousWords.at(-1);
  const next = nextWords[0];
  if (!previous || !next) continue;
  const previousTts = ttsAnalysis?.segments?.find((segment) => Number(segment.shotId) === index + 1);
  const nextTts = ttsAnalysis?.segments?.find((segment) => Number(segment.shotId) === index + 2);
  const previousSpeechEndSec = previousTts
    ? boundarySec - Number(previousTts.trailingSilenceSec || 0)
    : Number(previous.end);
  const nextSpeechStartSec = nextTts
    ? boundarySec + Number(nextTts.leadingSilenceSec || 0)
    : Number(next.start);
  const beforeMeanDb = await meanVolume(videoPath, Math.max(0, previousSpeechEndSec - 0.8), previousSpeechEndSec);
  const afterMeanDb = await meanVolume(videoPath, nextSpeechStartSec, Math.min(nextSpeechStartSec + 0.8, transcript.duration));
  seams.push({
    seam: `${index + 1}→${index + 2}`,
    boundarySec,
    previousWord: previous.word,
    previousSpeechEndSec: Number(previousSpeechEndSec.toFixed(3)),
    nextWord: next.word,
    nextSpeechStartSec: Number(nextSpeechStartSec.toFixed(3)),
    silenceSec: Number(Math.max(0, nextSpeechStartSec - previousSpeechEndSec).toFixed(3)),
    silenceSource: previousTts && nextTts ? "逐镜音频段尾+下一段段首实测" : "ASR 字级时间戳",
    beforeMeanDb,
    afterMeanDb,
    loudnessJumpDb: Number.isFinite(beforeMeanDb) && Number.isFinite(afterMeanDb)
      ? Number(Math.abs(afterMeanDb - beforeMeanDb).toFixed(1))
      : null,
  });
}

const result = {
  taskId,
  round,
  videoPath,
  seams,
  maxSilenceSec: Math.max(0, ...seams.map((item) => item.silenceSec)),
  averageSilenceSec: Number((seams.reduce((sum, item) => sum + item.silenceSec, 0) / Math.max(1, seams.length)).toFixed(3)),
  maxLoudnessJumpDb: Math.max(0, ...seams.map((item) => item.loudnessJumpDb || 0)),
};
await writeFile(join(qcDir, "audio-continuity.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(
  join(qcDir, "audio-continuity.md"),
  `# ${round} 配音接缝分析\n\n| 接缝 | 前字→后字 | 静音 | 前/后均值 | 跳变 |\n|---|---|---:|---:|---:|\n${seams.map((item) => `| ${item.seam} | ${item.previousWord} → ${item.nextWord} | ${item.silenceSec.toFixed(3)}s | ${item.beforeMeanDb ?? "-"} / ${item.afterMeanDb ?? "-"} dB | ${item.loudnessJumpDb ?? "-"} dB |`).join("\n")}\n\n- 平均接缝静音：${result.averageSilenceSec.toFixed(3)}s\n- 最长接缝静音：${result.maxSilenceSec.toFixed(3)}s\n- 最大接缝响度跳变：${result.maxLoudnessJumpDb.toFixed(1)}dB\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(result)}\n`);
