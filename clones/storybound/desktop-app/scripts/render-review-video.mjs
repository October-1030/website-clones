import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ffmpeg = process.env.FFMPEG_PATH
  || "C:\\Users\\pdb12\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe";
const appRoot = resolve(import.meta.dirname, "..");
const taskId = process.argv[2];
const round = process.argv[3] || "round-1";

if (!taskId) throw new Error("用法：node scripts/render-review-video.mjs <task-id> [round-name]");

function assTime(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const whole = Math.floor(value % 60);
  const centiseconds = Math.floor((value - Math.floor(value)) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function parseSrt(value) {
  return String(value || "")
    .trim()
    .split(/\r?\n\r?\n+/)
    .map((block) => {
      const lines = block.split(/\r?\n/);
      const timing = lines.find((line) => line.includes("-->"));
      if (!timing) return null;
      const [start, end] = timing.split("-->").map((item) => item.trim());
      const parse = (time) => {
        const [hours, minutes, rest] = time.split(":");
        const [seconds, milliseconds] = rest.split(",");
        return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(milliseconds) / 1000;
      };
      return {
        startSec: parse(start),
        endSec: parse(end),
        text: lines.slice(lines.indexOf(timing) + 1).join(" ").replace(/[{}]/g, "").trim(),
      };
    })
    .filter(Boolean);
}

function buildAss(cues, durationSec) {
  const events = cues.map((cue) => `Dialogue: 1,${assTime(cue.startSec)},${assTime(cue.endSec)},Caption,,0,0,0,,${cue.text}`);
  events.push(`Dialogue: 0,0:00:00.00,${assTime(durationSec)},Disclaimer,,0,0,0,,图片由 AI 生成 · 故事演绎`);
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Caption,Microsoft YaHei,56,&H0000DEFF,&H0000DEFF,&H00101010,&H70000000,-1,0,0,0,100,100,1,0,1,5,2,2,100,100,250,1
Style: Disclaimer,Microsoft YaHei,26,&H99FFFFFF,&H99FFFFFF,&H99000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,80,80,52,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
${events.join("\n")}
`;
}

function imageFilter(index, durationSec, frameCount) {
  const mode = index % 4;
  const lastFrame = Math.max(1, frameCount - 1);
  const zoom = mode === 0
    ? `1+0.08*on/${lastFrame}`
    : mode === 1
      ? `1.08-0.08*on/${lastFrame}`
      : "1.08";
  const x = mode === 2
    ? `(iw-iw/zoom)*on/${lastFrame}`
    : mode === 3
      ? `(iw-iw/zoom)*(1-on/${lastFrame})`
      : "iw/2-(iw/zoom/2)";
  const y = "ih/2-(ih/zoom/2)";
  return `[${index}:v]scale=1200:2134:force_original_aspect_ratio=increase,crop=1200:2134,zoompan=z='${zoom}':x='${x}':y='${y}':d=${frameCount}:s=1080x1920:fps=30,trim=end_frame=${frameCount},setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v${index}]`;
}

const taskPath = join(appRoot, ".storybound-data", "tasks", taskId, "task.json");
const task = JSON.parse(await readFile(taskPath, "utf8"));
if (!task.draft?.projectDir) throw new Error("任务尚未生成剪映草稿");
const outputDir = join(dirname(taskPath), "review", round);
await mkdir(outputDir, { recursive: true });
let reviewPlan = null;
try {
  reviewPlan = JSON.parse(await readFile(join(outputDir, "review-plan.json"), "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
if (!reviewPlan) {
  try {
    reviewPlan = JSON.parse(await readFile(join(outputDir, "continuous-plan.json"), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
const shots = task.artifacts?.storyboard?.shots || [];
const timeline = reviewPlan?.timeline || task.media?.timeline || [];
const audioSegments = task.media?.audioSegments || [];
const images = task.media?.images || [];
const continuousAudioPath = reviewPlan?.audioPath || task.media?.continuousAudio?.path || null;
const materialCountsMatch = shots.length
  && shots.length === timeline.length
  && shots.length === images.length
  && (continuousAudioPath || shots.length === audioSegments.length);
if (!materialCountsMatch) {
  throw new Error(`素材数量不一致：shots=${shots.length}, timeline=${timeline.length}, audio=${audioSegments.length}, images=${images.length}`);
}

const totalDurationSec = reviewPlan?.totalDurationSec || timeline.at(-1).endSec;
const tutorialMode = task.options?.ttsMode === "continuous";
const coverHoldSec = tutorialMode ? 1 / 30 : Math.min(1.2, Math.max(0.6, timeline[0].durationSec * 0.18));
const visualSegments = [];
const cover = task.media?.coverImages?.find((item) => item.path);
if (cover) visualSegments.push({ path: cover.path, durationSec: coverHoldSec, label: "cover" });
for (const [index, image] of images.entries()) {
  const durationSec = index === 0 && cover ? timeline[index].durationSec - coverHoldSec : timeline[index].durationSec;
  visualSegments.push({ path: image.path, durationSec, label: `shot-${index + 1}` });
}

const srtPath = reviewPlan ? join(outputDir, "timeline.srt") : join(task.draft.projectDir, "timeline.srt");
const srt = await readFile(srtPath, "utf8");
const cues = parseSrt(srt);
const assPath = join(outputDir, "subtitles.ass");
const outputPath = join(outputDir, `pocket-watch-${round}.mp4`);
await writeFile(assPath, buildAss(cues, totalDurationSec), "utf8");

const inputs = [];
for (const segment of visualSegments) {
  inputs.push("-i", segment.path);
}
if (continuousAudioPath) {
  inputs.push("-i", continuousAudioPath);
} else {
  for (const segment of audioSegments) inputs.push("-i", segment.path);
}

const filters = [];
for (const [index, segment] of visualSegments.entries()) {
  filters.push(imageFilter(index, segment.durationSec, Math.max(1, Math.round(segment.durationSec * 30))));
}
filters.push(`${visualSegments.map((_segment, index) => `[v${index}]`).join("")}concat=n=${visualSegments.length}:v=1:a=0[vcat]`);

const audioStartIndex = visualSegments.length;
if (continuousAudioPath) {
  filters.push(`[${audioStartIndex}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:${totalDurationSec.toFixed(6)},asetpts=PTS-STARTPTS[acat]`);
} else {
  for (const [index] of audioSegments.entries()) {
    const durationSec = timeline[index].durationSec;
    filters.push(`[${audioStartIndex + index}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:${durationSec.toFixed(6)},asetpts=PTS-STARTPTS[a${index}]`);
  }
  filters.push(`${audioSegments.map((_segment, index) => `[a${index}]`).join("")}concat=n=${audioSegments.length}:v=0:a=1[acat]`);
}
filters.push(`[vcat]ass='${assPath.replaceAll("\\", "/").replace(":", "\\:")}',setsar=1,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709,format=yuv420p,fade=t=out:st=${Math.max(0, totalDurationSec - 0.5).toFixed(3)}:d=0.5[vout]`);
filters.push(`[acat]afade=t=in:st=0:d=0.05,afade=t=out:st=${Math.max(0, totalDurationSec - 0.45).toFixed(3)}:d=0.45,loudnorm=I=-14:TP=-1.5:LRA=7[aout]`);

await execFileAsync(ffmpeg, [
  "-y",
  ...inputs,
  "-filter_complex", filters.join(";"),
  "-map", "[vout]",
  "-map", "[aout]",
  "-r", "30",
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "18",
  "-profile:v", "high",
  "-pix_fmt", "yuv420p",
  "-color_range", "tv",
  "-color_primaries", "bt709",
  "-color_trc", "bt709",
  "-colorspace", "bt709",
  "-c:a", "aac",
  "-b:a", "192k",
  "-ar", "48000",
  "-movflags", "+faststart",
  "-shortest",
  outputPath,
], {
  cwd: appRoot,
  windowsHide: true,
  timeout: 20 * 60_000,
  maxBuffer: 16 * 1024 * 1024,
});

const sceneMap = shots.map((shot, index) => ({
  shotId: shot.id,
  startSec: timeline[index].startSec,
  endSec: timeline[index].endSec,
  durationSec: timeline[index].durationSec,
  voice: shot.text,
  subtitle: shot.text,
  visualAnchor: shot.visual,
  imagePath: images[index].path,
  audioPath: continuousAudioPath || audioSegments[index].path,
  speechStartSec: timeline[index].speechStartSec ?? timeline[index].startSec,
  speechEndSec: timeline[index].speechEndSec ?? timeline[index].endSec,
}));
await writeFile(join(outputDir, "scene-voice-map.json"), `${JSON.stringify(sceneMap, null, 2)}\n`, "utf8");
await writeFile(join(outputDir, "video-spec.md"), `# 怀表测试成片 ${round}\n\n- 画布：1080 × 1920\n- 帧率：30 fps\n- 目标时长：${totalDurationSec.toFixed(3)} 秒\n- 视频：H.264 / yuv420p\n- 音频：AAC / 48 kHz / 192 kbps / -14 LUFS 目标\n- 分镜：${shots.length}\n- 字幕：${cues.length} 条，手机底部安全区 250 px\n- 封面首屏：${cover ? `${coverHoldSec.toFixed(2)} 秒` : "无独立封面"}\n- 配音模式：${continuousAudioPath ? "单条连续旁白，字幕与镜头依据 MiniMax 词级时间戳重建" : "逐镜头音频拼接"}\n- BGM：本轮未加入，只检查配音连续性、字幕与镜头节奏\n`, "utf8");

process.stdout.write(`${JSON.stringify({ outputPath, outputDir, durationSec: totalDurationSec, shots: shots.length, subtitles: cues.length, audioMode: continuousAudioPath ? "continuous" : "segmented" })}\n`);
