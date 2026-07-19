import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ffmpeg = process.env.FFMPEG_PATH
  || "C:\\Users\\pdb12\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe";
const ffprobe = process.env.FFPROBE_PATH
  || "C:\\Users\\pdb12\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffprobe.exe";
const appRoot = resolve(import.meta.dirname, "..");
const taskId = process.argv[2];
const round = process.argv[3] || "round-1";

if (!taskId) throw new Error("用法：node scripts/qc-review-video.mjs <task-id> [round-name]");

function uniqueTimes(items) {
  const result = [];
  for (const item of items.sort((a, b) => a.timeSec - b.timeSec)) {
    if (result.some((entry) => Math.abs(entry.timeSec - item.timeSec) < 0.03)) continue;
    result.push(item);
  }
  return result;
}

function diagnosticsLines(value, patterns) {
  return String(value || "")
    .split(/\r?\n/)
    .filter((line) => patterns.some((pattern) => line.includes(pattern)));
}

async function run(binary, args, options = {}) {
  try {
    return await execFileAsync(binary, args, {
      cwd: appRoot,
      windowsHide: true,
      timeout: 20 * 60_000,
      maxBuffer: 32 * 1024 * 1024,
      ...options,
    });
  } catch (error) {
    if (error.code === 1 && error.stderr) return { stdout: error.stdout || "", stderr: error.stderr };
    throw error;
  }
}

const outputDir = join(appRoot, ".storybound-data", "tasks", taskId, "review", round);
const videoPath = join(outputDir, `pocket-watch-${round}.mp4`);
const sceneMap = JSON.parse(await readFile(join(outputDir, "scene-voice-map.json"), "utf8"));
const durationSec = sceneMap.at(-1).endSec;
const qcDir = join(outputDir, "qc");
const framesDir = join(qcDir, "frames");
await mkdir(framesDir, { recursive: true });

const frameRequests = [
  { timeSec: 0.25, label: "opening" },
  { timeSec: Math.min(1.1, durationSec / 4), label: "opening-hook" },
  { timeSec: durationSec / 2, label: "middle" },
  { timeSec: Math.max(0, durationSec - 0.4), label: "ending" },
];
for (const [index, scene] of sceneMap.entries()) {
  frameRequests.push({ timeSec: (scene.startSec + scene.endSec) / 2, label: `shot-${index + 1}-mid` });
  if (index > 0) {
    frameRequests.push({ timeSec: Math.max(0, scene.startSec - 0.12), label: `cut-${index}-before` });
    frameRequests.push({ timeSec: Math.min(durationSec - 0.04, scene.startSec + 0.12), label: `cut-${index}-after` });
  }
}
const timestamps = uniqueTimes(frameRequests);

for (const [index, item] of timestamps.entries()) {
  const fileName = `frame-${String(index + 1).padStart(2, "0")}.jpg`;
  await run(ffmpeg, [
    "-y",
    "-ss", item.timeSec.toFixed(3),
    "-i", videoPath,
    "-frames:v", "1",
    "-q:v", "2",
    join(framesDir, fileName),
  ]);
  item.file = join(framesDir, fileName);
}

const columns = 5;
const rows = Math.ceil(timestamps.length / columns);
const contactSheetPath = join(qcDir, "contact-sheet.jpg");
await run(ffmpeg, [
  "-y",
  "-framerate", "1",
  "-start_number", "1",
  "-i", join(framesDir, "frame-%02d.jpg"),
  "-vf", `scale=216:384:force_original_aspect_ratio=decrease,pad=216:384:(ow-iw)/2:(oh-ih)/2:color=black,tile=${columns}x${rows}:padding=4:margin=4`,
  "-frames:v", "1",
  contactSheetPath,
]);

const probe = await run(ffprobe, ["-v", "error", "-show_format", "-show_streams", "-of", "json", videoPath]);
const visualDiagnostics = await run(ffmpeg, [
  "-hide_banner", "-i", videoPath,
  "-vf", "blackdetect=d=0.08:pix_th=0.10,freezedetect=n=-50dB:d=0.40",
  "-an", "-f", "null", "NUL",
]);
const silenceDiagnostics = await run(ffmpeg, [
  "-hide_banner", "-i", videoPath,
  "-af", "silencedetect=n=-45dB:d=0.60,volumedetect",
  "-vn", "-f", "null", "NUL",
]);
const loudnessDiagnostics = await run(ffmpeg, [
  "-hide_banner", "-i", videoPath,
  "-af", "loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json",
  "-vn", "-f", "null", "NUL",
]);

const report = {
  taskId,
  round,
  videoPath,
  videoFile: basename(videoPath),
  contactSheetPath,
  expectedDurationSec: durationSec,
  probe: JSON.parse(probe.stdout),
  frames: timestamps,
  visualDiagnostics: diagnosticsLines(visualDiagnostics.stderr, ["black_start", "freeze_start", "freeze_end", "freeze_duration"]),
  silenceDiagnostics: diagnosticsLines(silenceDiagnostics.stderr, ["silence_start", "silence_end", "mean_volume", "max_volume"]),
  loudnessTail: String(loudnessDiagnostics.stderr || "").split(/\r?\n/).slice(-18),
};
await writeFile(join(qcDir, "qc-data.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(
  join(qcDir, "frame-index.md"),
  `# ${round} 关键帧索引\n\n${timestamps.map((item, index) => `- ${String(index + 1).padStart(2, "0")}｜${item.timeSec.toFixed(3)}s｜${item.label}｜${basename(item.file)}`).join("\n")}\n`,
  "utf8",
);

process.stdout.write(`${JSON.stringify({ videoPath, contactSheetPath, frameCount: timestamps.length, qcData: join(qcDir, "qc-data.json") })}\n`);
