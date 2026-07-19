import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ffmpeg = process.env.FFMPEG_PATH
  || "C:\\Users\\pdb12\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe";
const ffprobe = process.env.FFPROBE_PATH
  || "C:\\Users\\pdb12\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffprobe.exe";
const appRoot = resolve(import.meta.dirname, "..");
const taskId = process.argv[2];

if (!taskId) throw new Error("用法：node scripts/analyze-tts-segments.mjs <task-id>");

function valueAfter(line, marker) {
  const value = Number(line.slice(line.indexOf(marker) + marker.length).trim().split(/[ |]/)[0]);
  return Number.isFinite(value) ? value : null;
}

async function analyze(filePath, shotId) {
  const [{ stdout: durationOut }, silenceResult, volumeResult] = await Promise.all([
    execFileAsync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath], { windowsHide: true, timeout: 30_000 }),
    execFileAsync(ffmpeg, ["-hide_banner", "-i", filePath, "-af", "silencedetect=noise=-45dB:d=0.04", "-f", "null", "NUL"], { windowsHide: true, timeout: 60_000 }).catch((error) => ({ stderr: error.stderr || "" })),
    execFileAsync(ffmpeg, ["-hide_banner", "-i", filePath, "-af", "volumedetect", "-f", "null", "NUL"], { windowsHide: true, timeout: 60_000 }).catch((error) => ({ stderr: error.stderr || "" })),
  ]);
  const durationSec = Number(Number(durationOut.trim()).toFixed(3));
  const silenceLines = String(silenceResult.stderr || "").split(/\r?\n/).filter((line) => line.includes("silence_"));
  const ranges = [];
  let openStart = null;
  for (const line of silenceLines) {
    if (line.includes("silence_start:")) openStart = valueAfter(line, "silence_start:");
    if (line.includes("silence_end:")) {
      const end = valueAfter(line, "silence_end:");
      if (openStart !== null && end !== null) ranges.push({ startSec: openStart, endSec: end, durationSec: Number((end - openStart).toFixed(3)) });
      openStart = null;
    }
  }
  if (openStart !== null) ranges.push({ startSec: openStart, endSec: durationSec, durationSec: Number((durationSec - openStart).toFixed(3)) });
  const leading = ranges.find((range) => range.startSec <= 0.02);
  const trailing = [...ranges].reverse().find((range) => Math.abs(range.endSec - durationSec) <= 0.08);
  const volumeText = String(volumeResult.stderr || "");
  const meanMatch = volumeText.match(/mean_volume:\s*(-?[\d.]+) dB/);
  const maxMatch = volumeText.match(/max_volume:\s*(-?[\d.]+) dB/);
  const leadingSilenceSec = Number((leading?.durationSec || 0).toFixed(3));
  const trailingSilenceSec = Number((trailing?.durationSec || 0).toFixed(3));
  return {
    shotId,
    filePath,
    durationSec,
    leadingSilenceSec,
    trailingSilenceSec,
    internalSilences: ranges.filter((range) => range !== leading && range !== trailing),
    meanDb: meanMatch ? Number(meanMatch[1]) : null,
    maxDb: maxMatch ? Number(maxMatch[1]) : null,
    abnormalLeading: leadingSilenceSec > 0.35,
    abnormalTrailing: trailingSilenceSec > 0.55,
  };
}

const taskPath = join(appRoot, ".storybound-data", "tasks", taskId, "task.json");
const task = JSON.parse(await readFile(taskPath, "utf8"));
const audioDir = join(dirname(taskPath), "audio");
const files = (await readdir(audioDir))
  .map((name) => ({ name, match: name.match(/^(\d+)\.mp3$/) }))
  .filter((item) => item.match)
  .sort((a, b) => Number(a.match[1]) - Number(b.match[1]));
const segments = [];
for (const file of files) segments.push(await analyze(join(audioDir, file.name), Number(file.match[1])));
const report = {
  taskId,
  voiceId: task.options?.ttsVoiceId || null,
  speed: task.options?.ttsSpeed || null,
  threshold: { silenceDb: -45, minimumSilenceSec: 0.04, abnormalLeadingSec: 0.35, abnormalTrailingSec: 0.55 },
  totalDurationSec: Number(segments.reduce((sum, item) => sum + item.durationSec, 0).toFixed(3)),
  totalLeadingSilenceSec: Number(segments.reduce((sum, item) => sum + item.leadingSilenceSec, 0).toFixed(3)),
  totalTrailingSilenceSec: Number(segments.reduce((sum, item) => sum + item.trailingSilenceSec, 0).toFixed(3)),
  segments,
};
const outputDir = join(dirname(taskPath), "review", "segmented-actual", "qc");
await mkdir(outputDir, { recursive: true });
const jsonPath = join(outputDir, "tts-segment-analysis.json");
const markdownPath = join(outputDir, "tts-segment-analysis.md");
const rows = segments.map((item) => `| ${item.shotId} | ${item.durationSec.toFixed(3)} | ${item.leadingSilenceSec.toFixed(3)} | ${item.trailingSilenceSec.toFixed(3)} | ${item.meanDb?.toFixed(1) ?? "—"} | ${item.maxDb?.toFixed(1) ?? "—"} | ${item.abnormalLeading || item.abnormalTrailing ? "需裁剪" : "保留原音"} |`).join("\n");
const markdown = `# 逐镜 TTS 段首/段尾分析\n\n- 实测总时长：${report.totalDurationSec.toFixed(3)} 秒\n- 段首静音合计：${report.totalLeadingSilenceSec.toFixed(3)} 秒\n- 段尾静音合计：${report.totalTrailingSilenceSec.toFixed(3)} 秒\n- 判定阈值：段首 > 0.35 秒、段尾 > 0.55 秒才视为异常；内部停顿不裁剪。\n\n| 镜头 | 实测时长(s) | 段首静音(s) | 段尾静音(s) | 平均(dB) | 峰值(dB) | 处理 |\n| --- | ---: | ---: | ---: | ---: | ---: | --- |\n${rows}\n`;
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(markdownPath, markdown, "utf8");
process.stdout.write(`${JSON.stringify({ jsonPath, markdownPath, totalDurationSec: report.totalDurationSec, segments })}\n`);
