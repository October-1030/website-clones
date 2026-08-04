import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ffmpeg = process.env.FFMPEG_PATH
  || "ffmpeg";
const appRoot = resolve(import.meta.dirname, "..");
const draftTemplates = JSON.parse(await readFile(join(appRoot, "original-draft-templates.json"), "utf8"));
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

function deepMerge(target, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch ?? target;
  const output = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    output[key] = value && typeof value === "object" && !Array.isArray(value)
      ? deepMerge(target?.[key] || {}, value)
      : value;
  }
  return output;
}

function resolveCaptionStyle(task) {
  const templateId = task.options?.draftTemplateId || "default-portrait-9-16";
  const definition = draftTemplates.find((template) => template.id === templateId) || draftTemplates[0];
  const config = task.options?.draftTemplateConfig
    ? deepMerge(definition.config, task.options.draftTemplateConfig)
    : definition.config;
  const caption = config.caption;
  const fontSize = Math.max(48, Math.round(Number(caption.fontSize || 12) * 4.67));
  const normalizedCenterY = 0.5 - Math.max(-1, Math.min(1, Number(caption.y || 0))) / 2;
  const marginV = Math.max(80, Math.round(1920 * (1 - normalizedCenterY) - fontSize * 0.55));
  return {
    fontSize,
    marginV,
    bold: caption.bold ? -1 : 0,
    spacing: Math.max(0, Math.round(Number(caption.letterSpacing || 0))),
  };
}

function buildAss(cues, durationSec, captionStyle) {
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
Style: Caption,Microsoft YaHei,${captionStyle.fontSize},&H0000DEFF,&H0000DEFF,&H00101010,&H70000000,${captionStyle.bold},0,0,0,100,100,${captionStyle.spacing},0,1,5,2,2,100,100,${captionStyle.marginV},1
Style: Disclaimer,Microsoft YaHei,26,&H99FFFFFF,&H99FFFFFF,&H99000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,80,80,52,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
${events.join("\n")}
`;
}

const taskPath = join(appRoot, ".storybound-data", "tasks", taskId, "task.json");
const task = JSON.parse(await readFile(taskPath, "utf8"));
const captionStyle = resolveCaptionStyle(task);
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
await writeFile(assPath, buildAss(cues, totalDurationSec, captionStyle), "utf8");

function concatPath(filePath) {
  return filePath.replaceAll("\\", "/").replaceAll("'", "'\\''");
}

// Windows has a short process command-line limit. Passing every image, audio
// file and per-shot filter as a separate argument breaks on normal long-form
// jobs (for example 57 shots). Feed FFmpeg compact concat manifests instead.
const visualConcatPath = join(outputDir, "visual-input.ffconcat");
const visualManifest = ["ffconcat version 1.0"];
for (const segment of visualSegments) {
  visualManifest.push(`file '${concatPath(segment.path)}'`);
  visualManifest.push(`duration ${segment.durationSec.toFixed(6)}`);
}
visualManifest.push(`file '${concatPath(visualSegments.at(-1).path)}'`);
await writeFile(visualConcatPath, `${visualManifest.join("\n")}\n`, "utf8");

let audioInput;
if (continuousAudioPath) {
  audioInput = ["-i", continuousAudioPath];
} else {
  const audioConcatPath = join(outputDir, "audio-input.ffconcat");
  const audioManifest = [
    "ffconcat version 1.0",
    ...audioSegments.map((segment) => `file '${concatPath(segment.path)}'`),
  ];
  await writeFile(audioConcatPath, `${audioManifest.join("\n")}\n`, "utf8");
  audioInput = ["-f", "concat", "-safe", "0", "-i", audioConcatPath];
}

const filters = [
  `[0:v]fps=30,scale=1200:2134:force_original_aspect_ratio=increase,crop=1200:2134,scale=1080:1920,trim=duration=${totalDurationSec.toFixed(6)},setpts=PTS-STARTPTS,ass='${assPath.replaceAll("\\", "/").replace(":", "\\:")}',setsar=1,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709,format=yuv420p,fade=t=out:st=${Math.max(0, totalDurationSec - 0.5).toFixed(3)}:d=0.5[vout]`,
  `[1:a]aresample=48000:async=1:first_pts=0,aformat=channel_layouts=stereo,apad,atrim=0:${totalDurationSec.toFixed(6)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.05,afade=t=out:st=${Math.max(0, totalDurationSec - 0.45).toFixed(3)}:d=0.45,loudnorm=I=-14:TP=-1.5:LRA=7[aout]`,
];

await execFileAsync(ffmpeg, [
  "-y",
  "-f", "concat", "-safe", "0", "-i", visualConcatPath,
  ...audioInput,
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
await writeFile(join(outputDir, "video-spec.md"), `# Storybound 测试成片 ${round}\n\n- 画布：1080 × 1920\n- 帧率：30 fps\n- 目标时长：${totalDurationSec.toFixed(3)} 秒\n- 视频：H.264 / yuv420p\n- 音频：AAC / 48 kHz / 192 kbps / -14 LUFS 目标\n- 分镜：${shots.length}\n- 字幕：${cues.length} 条，字号 ${captionStyle.fontSize}px，距底部 ${captionStyle.marginV}px（读取剪映草稿模板）\n- 封面首屏：${cover ? `${coverHoldSec.toFixed(2)} 秒` : "使用第一张分镜图"}\n- 配音模式：${continuousAudioPath ? "单条连续旁白，字幕与镜头依据 MiniMax 词级时间戳重建" : "原版逐镜音频结构"}\n- BGM：本轮未加入，只检查配音连续性、字幕与镜头节奏\n`, "utf8");

process.stdout.write(`${JSON.stringify({ outputPath, outputDir, durationSec: totalDurationSec, shots: shots.length, subtitles: cues.length, audioMode: continuousAudioPath ? "continuous" : "segmented" })}\n`);
