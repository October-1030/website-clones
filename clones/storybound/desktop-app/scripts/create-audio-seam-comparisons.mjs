import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ffmpeg = process.env.FFMPEG_PATH
  || "C:\\Users\\pdb12\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe";
const appRoot = resolve(import.meta.dirname, "..");
const taskId = process.argv[2];
const beforeRound = process.argv[3] || "round-2";
const afterRound = process.argv[4] || "audio-fix";

if (!taskId) {
  throw new Error("用法：node scripts/create-audio-seam-comparisons.mjs <task-id> [before-round] [after-round]");
}

const taskDir = join(appRoot, ".storybound-data", "tasks", taskId);

async function loadRound(round) {
  const roundDir = join(taskDir, "review", round);
  return {
    round,
    roundDir,
    videoPath: join(roundDir, `pocket-watch-${round}.mp4`),
    sceneMap: JSON.parse(await readFile(join(roundDir, "scene-voice-map.json"), "utf8")),
  };
}

async function createComparison(roundData, outputPath) {
  const boundaries = roundData.sceneMap.slice(0, -1).map((scene) => scene.endSec);
  const filters = [];
  const concatInputs = [];
  for (const [index, boundarySec] of boundaries.entries()) {
    const startSec = Math.max(0, boundarySec - 1.25);
    const endSec = boundarySec + 1.25;
    filters.push(`[0:a]atrim=start=${startSec.toFixed(6)}:end=${endSec.toFixed(6)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[w${index}]`);
    concatInputs.push(`[w${index}]`);
    if (index < boundaries.length - 1) {
      filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=0.35[s${index}]`);
      concatInputs.push(`[s${index}]`);
    }
  }
  filters.push(`${concatInputs.join("")}concat=n=${concatInputs.length}:v=0:a=1[out]`);
  await execFileAsync(ffmpeg, [
    "-y",
    "-i", roundData.videoPath,
    "-filter_complex", filters.join(";"),
    "-map", "[out]",
    "-c:a", "libmp3lame",
    "-b:a", "192k",
    outputPath,
  ], {
    cwd: appRoot,
    windowsHide: true,
    timeout: 5 * 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return boundaries;
}

async function createSeamClips(roundData, outputDir, label) {
  const boundaries = roundData.sceneMap.slice(0, -1).map((scene) => scene.endSec);
  const clips = [];
  for (const [index, boundarySec] of boundaries.entries()) {
    const outputPath = join(outputDir, `seam-${String(index + 1).padStart(2, "0")}-${label}.mp3`);
    await execFileAsync(ffmpeg, [
      "-y",
      "-ss", Math.max(0, boundarySec - 1.25).toFixed(6),
      "-t", "2.500",
      "-i", roundData.videoPath,
      "-vn",
      "-c:a", "libmp3lame",
      "-b:a", "192k",
      outputPath,
    ], {
      cwd: appRoot,
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    clips.push({ seam: `${index + 1}→${index + 2}`, boundarySec, outputPath });
  }
  return clips;
}

const before = await loadRound(beforeRound);
const after = await loadRound(afterRound);
const outputDir = join(after.roundDir, "comparison", `${beforeRound}-vs-${afterRound}`);
await mkdir(outputDir, { recursive: true });
const beforePath = join(outputDir, "8-seams-before.mp3");
const afterPath = join(outputDir, "8-seams-after.mp3");
const beforeBoundaries = await createComparison(before, beforePath);
const afterBoundaries = await createComparison(after, afterPath);
const beforeClips = await createSeamClips(before, outputDir, "before");
const afterClips = await createSeamClips(after, outputDir, "after");
const manifestPath = join(outputDir, "comparison-manifest.json");
await writeFile(manifestPath, `${JSON.stringify({
  window: "每个接缝前后各 1.25 秒，接缝样本之间保留 0.35 秒静音",
  before: { round: beforeRound, source: before.videoPath, boundariesSec: beforeBoundaries, outputPath: beforePath, clips: beforeClips },
  after: { round: afterRound, source: after.videoPath, boundariesSec: afterBoundaries, outputPath: afterPath, clips: afterClips },
}, null, 2)}\n`, "utf8");

process.stdout.write(`${JSON.stringify({ beforePath, afterPath, manifestPath })}\n`);
