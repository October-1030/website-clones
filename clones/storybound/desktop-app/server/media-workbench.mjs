import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

import { buildJianyingDraft } from "./draft-builder.mjs";
import { createTaskStore, resolveStoryboundDataRoot } from "./task-store.mjs";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);
const defaultMaxUploadBytes = 128 * 1024 * 1024;
const acceptedAudioExtensions = new Set([".mp3", ".wav", ".flac"]);
const acceptedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const uploadKinds = new Set(["images", "audio", "music", "cover", "uploads"]);
const fileKinds = new Set([...uploadKinds, "output"]);
const mediaMimeTypes = {
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".mp4": "video/mp4",
  ".zip": "application/zip",
};

function nowIso() {
  return new Date().toISOString();
}

function assertJobId(value) {
  const jobId = String(value || "");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{5,80}$/u.test(jobId)) throw new Error("无效的媒体任务 ID");
  return jobId;
}

function safeFileName(value, fallback = "asset.bin") {
  const cleaned = basename(String(value || fallback))
    .replace(/[<>:"/\\|?*]/gu, "-")
    .replace(/\p{Cc}/gu, "-")
    .replace(/^\.+/u, "")
    .slice(0, 120);
  return cleaned || fallback;
}

function isPathInside(base, target) {
  const safeBase = resolve(base);
  const safeTarget = resolve(target);
  const left = process.platform === "win32" ? safeBase.toLowerCase() : safeBase;
  const right = process.platform === "win32" ? safeTarget.toLowerCase() : safeTarget;
  return right === left || right.startsWith(`${left}${sep}`);
}

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

async function readJson(request, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error(`请求内容超过 ${Math.round(maxBytes / 1024 / 1024)} MB`);
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function writeJsonAtomic(file, value) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rm(file, { force: true });
  await rename(temporary, file);
}

function jobSummary(job) {
  return {
    id: job.id,
    kind: job.kind,
    title: job.title,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    resumable: job.resumable,
    durationSec: job.output?.durationSec,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function validDimensions(manifest) {
  const portrait = manifest.aspectRatio !== "16:9";
  const fallbackWidth = portrait ? 1080 : 1920;
  const fallbackHeight = portrait ? 1920 : 1080;
  const width = Math.max(320, Math.min(3840, Math.round(Number(manifest.width) || fallbackWidth)));
  const height = Math.max(320, Math.min(3840, Math.round(Number(manifest.height) || fallbackHeight)));
  const evenWidth = width % 2 === 0 ? width : width - 1;
  const evenHeight = height % 2 === 0 ? height : height - 1;
  const fps = Math.max(20, Math.min(60, Math.round(Number(manifest.fps) || 30)));
  return { width: evenWidth, height: evenHeight, fps };
}

function secondsToAssTime(value) {
  const centiseconds = Math.max(0, Math.round(Number(value) * 100));
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const remainder = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(remainder).padStart(2, "0")}`;
}

function escapeAssText(value) {
  return String(value || "")
    .replace(/[{}]/gu, "")
    .replace(/\r?\n/gu, "\\N")
    .replace(/,/gu, "，");
}

function wrapAssText(value, width, fontSize) {
  const maxUnits = Math.max(9, Math.floor((width * 0.78) / Math.max(1, fontSize)));
  const paragraphs = String(value || "").split(/\r?\n/gu);
  const lines = [];
  for (const paragraph of paragraphs) {
    let current = "";
    let units = 0;
    for (const character of Array.from(paragraph.trim())) {
      const weight = (character.codePointAt(0) || 0) <= 0xff ? 0.55 : 1;
      if (current && units + weight > maxUnits) {
        lines.push(current.trim());
        current = "";
        units = 0;
      }
      current += character;
      units += weight;
    }
    if (current.trim()) lines.push(current.trim());
  }
  return escapeAssText(lines.join("\n"));
}

function assStyleForScene(scene, index, width, height) {
  const subtitleStyle = scene.subtitleStyle || "outline";
  const layout = scene.layout || "center-focus";
  const styleMap = {
    outline: { primary: "&H00FFFFFF", outline: "&H00101010", back: "&H00000000", border: 1, outlineSize: 3, shadow: 1 },
    pill: { primary: "&H00FFFFFF", outline: "&H00181716", back: "&HCC181716", border: 3, outlineSize: 1, shadow: 0 },
    translucent: { primary: "&H00FFFFFF", outline: "&H00181716", back: "&H88181716", border: 3, outlineSize: 0, shadow: 0 },
    gradient: { primary: "&H006DFFCF", outline: "&H002E2038", back: "&H00000000", border: 1, outlineSize: 3, shadow: 1 },
    neon: { primary: "&H00FFF1D5", outline: "&H00A97100", back: "&H00000000", border: 1, outlineSize: 4, shadow: 2 },
    karaoke: { primary: "&H0000E8FF", outline: "&H00101010", back: "&H00000000", border: 1, outlineSize: 3, shadow: 1 },
    highlight: { primary: "&H0000FFC8", outline: "&H00101010", back: "&H00000000", border: 1, outlineSize: 3, shadow: 1 },
  };
  const positionMap = {
    "center-focus": { alignment: 2, marginV: Math.round(height * 0.12) },
    "person-focus": { alignment: 2, marginV: Math.round(height * 0.13) },
    "left-right-text-object": { alignment: 1, marginV: Math.round(height * 0.32) },
    "top-object-bottom-text": { alignment: 2, marginV: Math.round(height * 0.12) },
    "three-float": { alignment: 5, marginV: Math.round(height * 0.05) },
    "split-compare": { alignment: 5, marginV: Math.round(height * 0.05) },
    "quote-card": { alignment: 5, marginV: Math.round(height * 0.05) },
    "full-image": { alignment: 2, marginV: Math.round(height * 0.12) },
    "full-quote": { alignment: 5, marginV: Math.round(height * 0.05) },
    "grid-four": { alignment: 5, marginV: Math.round(height * 0.05) },
    "rule-of-thirds": { alignment: 1, marginV: Math.round(height * 0.22) },
    "data-emphasis": { alignment: 8, marginV: Math.round(height * 0.12) },
  };
  const style = styleMap[subtitleStyle] || styleMap.outline;
  const position = positionMap[layout] || positionMap["center-focus"];
  const fontSize = Math.max(28, Math.round(Math.min(width, height) * 0.042));
  return {
    name: `Scene${index + 1}`,
    line: [
      `Scene${index + 1}`,
      "Microsoft YaHei",
      fontSize,
      style.primary,
      style.primary,
      style.outline,
      style.back,
      -1,
      0,
      0,
      0,
      100,
      100,
      0,
      0,
      style.border,
      style.outlineSize,
      style.shadow,
      position.alignment,
      Math.round(width * 0.08),
      Math.round(width * 0.08),
      position.marginV,
      1,
    ].join(","),
  };
}

function assAnimationTag(animation, width, height) {
  switch (animation) {
    case "pop":
      return "{\\fscx118\\fscy118\\t(0,260,\\fscx100\\fscy100)\\fad(80,120)}";
    case "rise":
      return `{\\move(${Math.round(width / 2)},${Math.round(height * 0.82)},${Math.round(width / 2)},${Math.round(height * 0.72)},0,360)\\fad(120,120)}`;
    case "bounce":
      return "{\\fscx92\\fscy92\\t(0,180,\\fscx108\\fscy108)\\t(180,360,\\fscx100\\fscy100)}";
    case "wipe":
    case "typewriter":
      return `{\\clip(0,0,1,${height})\\t(0,700,\\clip(0,0,${width},${height}))}`;
    case "breathe":
      return "{\\fscx98\\fscy98\\t(0,900,\\fscx103\\fscy103)\\t(900,1800,\\fscx100\\fscy100)}";
    case "reveal":
    default:
      return "{\\fad(260,180)}";
  }
}

async function writeAssSubtitles(file, scenes, width, height) {
  const styles = scenes.map((scene, index) => assStyleForScene(scene, index, width, height));
  const fontSize = Math.max(28, Math.round(Math.min(width, height) * 0.042));
  let cursor = 0;
  const dialogues = scenes.map((scene, index) => {
    const duration = Math.max(0.3, Number(scene.durationSec) || 0.3);
    const start = cursor;
    const end = start + duration;
    cursor = end;
    const title = wrapAssText(scene.title, width, fontSize);
    const subtitle = wrapAssText(scene.subtitle || scene.lyrics, width, fontSize);
    const body = title && subtitle && title !== subtitle ? `${title}\\N${subtitle}` : title || subtitle;
    const animation = assAnimationTag(scene.animation, width, height);
    return `Dialogue: 0,${secondsToAssTime(start)},${secondsToAssTime(end)},${styles[index].name},,0,0,0,,${animation}${body}`;
  });
  const contents = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "ScaledBorderAndShadow: yes",
    "WrapStyle: 0",
    "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    ...styles.map((style) => `Style: ${style.line}`),
    "",
    "[Events]",
    "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
    ...dialogues,
    "",
  ].join("\n");
  await writeFile(file, contents, "utf8");
}

function ffmpegFilter(width, height, fps, animation, durationSec) {
  const frames = Math.max(1, Math.round(durationSec * fps));
  const base = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  if (animation === "breathe") {
    return `${base},zoompan=z='1.025+0.018*sin(on/14)':d=1:s=${width}x${height}:fps=${fps},format=yuv420p`;
  }
  if (animation === "pop") {
    return `${base},zoompan=z='if(lte(on,12),1.14-on*0.01,1.02)':d=1:s=${width}x${height}:fps=${fps},format=yuv420p`;
  }
  if (animation === "bounce") {
    return `${base},zoompan=z='1.025+0.025*abs(sin(on/8))':d=1:s=${width}x${height}:fps=${fps},format=yuv420p`;
  }
  if (animation === "rise") {
    return `${base},zoompan=z='1.05':x='iw/2-(iw/zoom/2)':y='max(0,(ih-ih/zoom)*(1-on/${frames}))':d=1:s=${width}x${height}:fps=${fps},format=yuv420p`;
  }
  if (["wipe", "reveal", "typewriter"].includes(animation)) {
    return `${base},fade=t=in:st=0:d=0.35,fade=t=out:st=${Math.max(0, durationSec - 0.25).toFixed(3)}:d=0.25,format=yuv420p`;
  }
  return `${base},format=yuv420p`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env["PROGRAMFILES(X86)"] && join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

async function imageAsDataUrl(file) {
  const extension = extname(file).toLowerCase();
  const mime = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${(await readFile(file)).toString("base64")}`;
}

function browserSceneHtml(scene, imageUrl, width, height) {
  const title = escapeHtml(scene.title);
  const subtitle = escapeHtml(scene.subtitle || scene.lyrics).replace(/\r?\n/gu, "<br>");
  const layout = escapeHtml(scene.layout || "center-focus");
  const subtitleStyle = escapeHtml(scene.subtitleStyle || "outline");
  const animation = escapeHtml(scene.animation || "reveal");
  const repeated = ["grid-four", "split-compare", "three-float"].includes(layout)
    ? Array.from({ length: layout === "grid-four" ? 4 : layout === "three-float" ? 3 : 2 }, () => `<img src="${imageUrl}" alt="">`).join("")
    : `<img src="${imageUrl}" alt="">`;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#050808;font-family:"Microsoft YaHei","PingFang SC",sans-serif}.scene{--duration:${Math.max(0.3, Number(scene.durationSec) || 1)}s;position:relative;width:100%;height:100%;overflow:hidden;background:radial-gradient(circle at 50% 30%,#25302d,#050808 72%)}.media{position:absolute;inset:0;display:grid;overflow:hidden}.media img{width:100%;height:100%;object-fit:cover;filter:saturate(.92) contrast(1.04)}.caption{position:absolute;z-index:3;max-width:84%;padding:.25em .5em;color:#fff;text-align:center;font-size:${Math.max(30, Math.round(Math.min(width, height) * .045))}px;font-weight:800;line-height:1.35;letter-spacing:.02em}.caption strong{display:block;margin-bottom:.2em;font-size:1.18em}.style-outline{text-shadow:0 2px 2px #000,2px 0 2px #000,-2px 0 2px #000,0 -2px 2px #000}.style-pill{border-radius:999px;background:#181716e6}.style-translucent{border-radius:.55em;background:#18171699;backdrop-filter:blur(8px)}.style-gradient{border-radius:.55em;background:linear-gradient(110deg,#28d9a4cc,#4731b8cc)}.style-neon{color:#fff1d5;text-shadow:0 0 .12em #ffbf00,0 0 .35em #ff8a00,0 2px 2px #000}.style-karaoke{color:#00e8ff;text-shadow:0 2px 3px #000}.style-highlight{color:#00ffc8;text-shadow:0 2px 3px #000}
.layout-center-focus .caption,.layout-person-focus .caption,.layout-full-image .caption{left:50%;bottom:11%;transform:translateX(-50%)}.layout-left-right-text-object .media{left:48%;padding:4%;}.layout-left-right-text-object .caption{left:6%;top:50%;width:40%;transform:translateY(-50%);text-align:left}.layout-top-object-bottom-text .media{bottom:38%;padding:3%}.layout-top-object-bottom-text .caption{left:50%;bottom:5%;transform:translateX(-50%)}.layout-three-float .media{grid-template-columns:repeat(3,1fr);gap:3%;padding:11% 4% 28%}.layout-three-float .media img{border-radius:4%;box-shadow:0 15px 34px #000a}.layout-three-float .caption{left:50%;bottom:7%;transform:translateX(-50%)}.layout-split-compare .media{grid-template-columns:1fr 1fr;gap:2%;padding:7% 3% 24%}.layout-split-compare .caption{left:50%;bottom:6%;transform:translateX(-50%)}.layout-quote-card .media,.layout-full-quote .media,.layout-data-emphasis .media{filter:brightness(.42) blur(2px);transform:scale(1.04)}.layout-quote-card .caption{left:50%;top:50%;transform:translate(-50%,-50%);padding:1em;border:1px solid #ffffff55;border-radius:.6em;background:#0b1212cc}.layout-full-quote .caption{left:50%;top:50%;transform:translate(-50%,-50%);font-size:${Math.max(36, Math.round(Math.min(width, height) * .058))}px}.layout-grid-four .media{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:1.2%;padding:2% 2% 27%}.layout-grid-four .caption{left:50%;bottom:5%;transform:translateX(-50%)}.layout-rule-of-thirds .caption{left:7%;bottom:12%;max-width:58%;text-align:left}.layout-data-emphasis .caption{left:50%;top:18%;transform:translateX(-50%);font-size:${Math.max(38, Math.round(Math.min(width, height) * .062))}px}
@keyframes media-breathe{0%{transform:scale(1.01)}50%{transform:scale(1.07)}100%{transform:scale(1.03)}}@keyframes media-rise{0%{transform:scale(1.08) translateY(3%)}100%{transform:scale(1.04) translateY(-3%)}}@keyframes media-pop{0%{transform:scale(1.18);opacity:.2}22%{opacity:1}100%{transform:scale(1.03)}}@keyframes media-bounce{0%{transform:scale(.94)}18%{transform:scale(1.08)}35%{transform:scale(1.01)}100%{transform:scale(1.03)}}@keyframes caption-rise{0%{opacity:0;translate:0 1.2em}28%,100%{opacity:1;translate:0 0}}@keyframes caption-reveal{0%{opacity:0}30%,100%{opacity:1}}@keyframes caption-wipe{0%{clip-path:inset(0 100% 0 0);opacity:1}45%,100%{clip-path:inset(0 0 0 0);opacity:1}}.animation-breathe .media{animation:media-breathe var(--duration) ease-in-out both}.animation-rise .media{animation:media-rise var(--duration) ease-out both}.animation-pop .media{animation:media-pop var(--duration) ease-out both}.animation-bounce .media{animation:media-bounce var(--duration) ease-out both}.animation-rise .caption,.animation-bounce .caption{animation:caption-rise var(--duration) ease-out both}.animation-wipe .caption,.animation-typewriter .caption{animation:caption-wipe var(--duration) linear both}.animation-reveal .caption,.animation-pop .caption,.animation-breathe .caption{animation:caption-reveal var(--duration) ease-out both}
</style></head><body><main class="scene layout-${layout} animation-${animation}"><div class="media">${repeated}</div><div class="caption style-${subtitleStyle}">${title ? `<strong>${title}</strong>` : ""}<span>${subtitle}</span></div></main></body></html>`;
}

function escapeFilterPath(file) {
  return resolve(file).replaceAll("\\", "/").replace(":", "\\:").replaceAll("'", "\\'");
}

function concatLine(file) {
  return `file '${resolve(file).replaceAll("\\", "/").replaceAll("'", "'\\''")}'`;
}

async function clipFingerprint(paths, values) {
  const hash = createHash("sha1");
  for (const file of paths.filter(Boolean)) {
    const metadata = await stat(file);
    hash.update(`${resolve(file)}:${metadata.size}:${metadata.mtimeMs}|`);
  }
  hash.update(JSON.stringify(values));
  return hash.digest("hex").slice(0, 12);
}

function mediaError(error, fallback) {
  if (error instanceof Error) return error.message.slice(0, 1200);
  return fallback;
}

export function createMediaWorkbenchHandler(options = {}) {
  const root = resolve(options.root || moduleRoot);
  const dataRoot = options.dataRoot ? resolve(options.dataRoot) : resolveStoryboundDataRoot(root);
  const workbenchRoot = join(dataRoot, "media-workbench");
  const jobsRoot = join(workbenchRoot, "jobs");
  const tasksRoot = join(dataRoot, "tasks");
  const maxUploadBytes = Number(options.maxUploadBytes) || defaultMaxUploadBytes;
  const taskStore = createTaskStore(root);
  const ffmpegCandidates = [
    process.env.FFMPEG_PATH,
    "ffmpeg",
  ].filter(Boolean);
  const ffprobeCandidates = [
    process.env.FFPROBE_PATH,
    "ffprobe",
  ].filter(Boolean);
  const activeProcesses = new Map();
  const cancelledJobs = new Set();
  let toolPromise;

  function jobDir(jobId) {
    return join(jobsRoot, assertJobId(jobId));
  }

  function jobFile(jobId) {
    return join(jobDir(jobId), "job.json");
  }

  async function ensureJobFolders(jobId) {
    const base = jobDir(jobId);
    await Promise.all([
      mkdir(base, { recursive: true }),
      ...[...uploadKinds, "output", "work"].map((kind) => mkdir(join(base, kind), { recursive: true })),
    ]);
    return base;
  }

  async function readJob(jobId) {
    try {
      return JSON.parse(await readFile(jobFile(jobId), "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async function saveJob(job) {
    const next = { ...job, updatedAt: nowIso() };
    await writeJsonAtomic(jobFile(next.id), next);
    return next;
  }

  async function patchJob(jobId, patch) {
    const current = await readJob(jobId);
    if (!current) throw new Error("媒体任务不存在");
    return saveJob({
      ...current,
      ...patch,
      manifest: patch.manifest || current.manifest,
      id: current.id,
      kind: current.kind,
      createdAt: current.createdAt,
    });
  }

  async function createJob(input) {
    if (!["html-video", "music-mv"].includes(input.kind)) throw new Error("不支持的媒体任务类型");
    if (!input.manifest || input.manifest.kind !== input.kind) throw new Error("媒体任务 manifest 类型不匹配");
    const id = assertJobId(input.id || `media-${randomUUID()}`);
    const existing = await readJob(id);
    if (existing) return existing;
    const createdAt = nowIso();
    const job = {
      id,
      kind: input.kind,
      title: String(input.title || input.manifest.title || "未命名媒体任务").trim().slice(0, 120),
      status: "draft",
      stage: "配置",
      progress: 0,
      resumable: true,
      manifest: input.manifest,
      createdAt,
      updatedAt: createdAt,
    };
    await ensureJobFolders(id);
    await writeJsonAtomic(jobFile(id), job);
    await taskStore.ensureRoot();
    await taskStore.createTask({
      id,
      title: job.title,
      inputText: input.manifest.sourceText || input.manifest.lyrics || "",
      mode: "semi_auto",
      videoForm: "narration",
      status: "draft",
      runState: "idle",
      aspectRatio: input.manifest.aspectRatio || "9:16",
      options: { source: "media-workbench", mediaKind: input.kind },
    });
    return job;
  }

  async function listJobs() {
    await mkdir(jobsRoot, { recursive: true });
    const entries = await readdir(jobsRoot, { withFileTypes: true });
    const jobs = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const job = await readJob(entry.name);
        if (job) jobs.push(jobSummary(job));
      } catch {
        // A damaged draft must not hide healthy jobs.
      }
    }
    return jobs.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }

  async function findExecutable(candidates) {
    for (const executable of candidates) {
      try {
        await execFileAsync(executable, ["-version"], { timeout: 10_000, windowsHide: true });
        return executable;
      } catch {
        // Continue to the next configured executable.
      }
    }
    return null;
  }

  async function tools() {
    if (!toolPromise) {
      toolPromise = Promise.all([findExecutable(ffmpegCandidates), findExecutable(ffprobeCandidates)])
        .then(([ffmpeg, ffprobe]) => ({ ffmpeg, ffprobe }));
    }
    return toolPromise;
  }

  async function probeMedia(file, ffprobe) {
    const { stdout } = await execFileAsync(ffprobe, [
      "-v",
      "error",
      "-show_entries",
      "format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate",
      "-of",
      "json",
      file,
    ], { timeout: 20_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    const payload = JSON.parse(stdout);
    const video = payload.streams?.find((stream) => stream.codec_type === "video");
    const audio = payload.streams?.find((stream) => stream.codec_type === "audio");
    const [numerator, denominator] = String(video?.r_frame_rate || "0/1").split("/").map(Number);
    return {
      durationSec: Number(payload.format?.duration) || 0,
      bytes: Number(payload.format?.size) || 0,
      width: Number(video?.width) || 0,
      height: Number(video?.height) || 0,
      fps: denominator ? numerator / denominator : 0,
      videoCodec: video?.codec_name || "",
      audioCodec: audio?.codec_name || "",
    };
  }

  function runFfmpeg(ffmpeg, args, jobId, timeoutMs = 15 * 60_000) {
    return new Promise((resolvePromise, rejectPromise) => {
      if (cancelledJobs.has(jobId)) {
        const error = new Error("任务已取消，已保留断点");
        error.code = "MEDIA_CANCELLED";
        rejectPromise(error);
        return;
      }
      const child = spawn(ffmpeg, ["-y", "-nostdin", "-hide_banner", "-loglevel", "error", ...args], {
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
      });
      activeProcesses.set(jobId, child);
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
      }, timeoutMs);
      child.stderr.on("data", (chunk) => {
        stderr = `${stderr}${chunk.toString("utf8")}`.slice(-24_000);
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        if (activeProcesses.get(jobId) === child) activeProcesses.delete(jobId);
        rejectPromise(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        if (activeProcesses.get(jobId) === child) activeProcesses.delete(jobId);
        if (cancelledJobs.has(jobId)) {
          const error = new Error("任务已取消，已保留断点");
          error.code = "MEDIA_CANCELLED";
          rejectPromise(error);
        } else if (code === 0) {
          resolvePromise();
        } else {
          rejectPromise(new Error(`FFmpeg 失败（退出码 ${code}）：${stderr.trim() || "没有错误输出"}`));
        }
      });
    });
  }

  function resolveAssetPath(jobId, asset, expected) {
    if (!asset || typeof asset !== "object") throw new Error(`缺少${expected}资源`);
    let candidate = String(asset.path || "").trim();
    const url = String(asset.url || "").trim();
    if (!candidate && url) {
      const taskMatch = url.match(/^\/api\/tasks\/([^/]+)\/files\/([^/]+)\/(.+)$/u);
      const workbenchMatch = url.match(/^\/api\/media-workbench\/jobs\/([^/]+)\/files\/([^/]+)\/(.+)$/u);
      if (taskMatch) {
        const urlJobId = assertJobId(decodeURIComponent(taskMatch[1]));
        if (urlJobId !== jobId) throw new Error("资源不属于当前媒体任务");
        candidate = join(tasksRoot, urlJobId, safeFileName(decodeURIComponent(taskMatch[2])), safeFileName(decodeURIComponent(taskMatch[3])));
      } else if (workbenchMatch) {
        const urlJobId = assertJobId(decodeURIComponent(workbenchMatch[1]));
        if (urlJobId !== jobId) throw new Error("资源不属于当前媒体任务");
        candidate = join(jobDir(urlJobId), safeFileName(decodeURIComponent(workbenchMatch[2])), safeFileName(decodeURIComponent(workbenchMatch[3])));
      }
    }
    if (!candidate) throw new Error(`${expected}资源没有本地路径`);
    const resolved = resolve(candidate);
    const allowedTaskRoot = join(tasksRoot, jobId);
    const allowedJobRoot = jobDir(jobId);
    if (!isPathInside(allowedTaskRoot, resolved) && !isPathInside(allowedJobRoot, resolved)) {
      throw new Error(`${expected}资源路径超出当前任务目录`);
    }
    if (!existsSync(resolved)) throw new Error(`${expected}资源文件不存在：${basename(resolved)}`);
    return resolved;
  }

  async function saveAsset(jobId, body, ffprobe) {
    const kind = String(body.kind || "");
    if (!uploadKinds.has(kind)) throw new Error("不支持的上传资源类型");
    const buffer = Buffer.from(String(body.base64 || ""), "base64");
    if (!buffer.length) throw new Error("上传资源为空");
    if (buffer.length > maxUploadBytes) throw new Error(`单个文件不能超过 ${Math.round(maxUploadBytes / 1024 / 1024)} MB`);
    const requestedFileName = safeFileName(body.fileName);
    const extension = extname(requestedFileName).toLowerCase();
    if (["audio", "music"].includes(kind) && !acceptedAudioExtensions.has(extension)) {
      throw new Error("音频只支持 MP3、WAV、FLAC");
    }
    if (["images", "cover"].includes(kind) && !acceptedImageExtensions.has(extension)) {
      throw new Error("图片只支持 PNG、JPG、WEBP");
    }
    const digest = createHash("sha256").update(buffer).digest("hex").slice(0, 10);
    const fileStem = basename(requestedFileName, extension);
    const fileName = `${fileStem}-${digest}${extension}`;
    const base = await ensureJobFolders(jobId);
    const file = join(base, kind, fileName);
    await writeFile(file, buffer);
    const probe = ["audio", "music"].includes(kind) && ffprobe ? await probeMedia(file, ffprobe) : null;
    return {
      fileName,
      path: file,
      url: `/api/media-workbench/jobs/${encodeURIComponent(jobId)}/files/${kind}/${encodeURIComponent(fileName)}`,
      bytes: buffer.byteLength,
      mimeType: body.mimeType || mediaMimeTypes[extension] || "application/octet-stream",
      ...(probe?.durationSec ? { durationSec: Number(probe.durationSec.toFixed(3)) } : {}),
    };
  }

  async function renderImageClip({ ffmpeg, jobId, imagePath, audioPath, output, durationSec, width, height, fps, animation }) {
    const args = ["-loop", "1", "-i", imagePath];
    if (audioPath) args.push("-i", audioPath);
    args.push(
      "-t",
      durationSec.toFixed(3),
      "-vf",
      ffmpegFilter(width, height, fps, animation, durationSec),
      "-r",
      String(fps),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
    );
    if (audioPath) {
      args.push("-map", "0:v:0", "-map", "1:a:0", "-af", "apad", "-c:a", "aac", "-b:a", "160k");
    } else {
      args.push("-an");
    }
    args.push(output);
    await runFfmpeg(ffmpeg, args, jobId);
  }

  async function renderBrowserClip({
    browser,
    ffmpeg,
    jobId,
    scene,
    output,
    durationSec,
    width,
    height,
    fps,
    framesDir,
  }) {
    await rm(framesDir, { recursive: true, force: true });
    await mkdir(framesDir, { recursive: true });
    const page = await browser.newPage();
    try {
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      const imageUrl = await imageAsDataUrl(scene.imagePath);
      await page.setContent(browserSceneHtml({ ...scene, durationSec }, imageUrl, width, height), { waitUntil: "load" });
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) animation.pause();
      });
      const frameCount = Math.max(1, Math.ceil(durationSec * fps));
      for (let index = 0; index < frameCount; index += 1) {
        if (cancelledJobs.has(jobId)) {
          const error = new Error("任务已取消，已保留断点");
          error.code = "MEDIA_CANCELLED";
          throw error;
        }
        const currentTime = Math.min(durationSec * 1000, index * 1000 / fps);
        await page.evaluate((milliseconds) => {
          for (const animation of document.getAnimations()) animation.currentTime = milliseconds;
        }, currentTime);
        await page.screenshot({
          path: join(framesDir, `frame-${String(index + 1).padStart(6, "0")}.jpg`),
          type: "jpeg",
          quality: 90,
          captureBeyondViewport: false,
        });
      }
      await runFfmpeg(ffmpeg, [
        "-framerate",
        String(fps),
        "-i",
        join(framesDir, "frame-%06d.jpg"),
        "-i",
        scene.audioPath,
        "-t",
        durationSec.toFixed(3),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-r",
        String(fps),
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-af",
        "apad",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        output,
      ], jobId);
    } finally {
      await page.close().catch(() => undefined);
      await rm(framesDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async function renderHtml(job, manifest, ffmpeg, ffprobe, workDir, outputDir) {
    const dimensions = validDimensions(manifest);
    if (!Array.isArray(manifest.scenes) || manifest.scenes.length === 0) throw new Error("HTML 动画没有可渲染场景");
    const scenes = [];
    for (const [index, scene] of manifest.scenes.entries()) {
      const imagePath = resolveAssetPath(job.id, scene.image, `第 ${index + 1} 场图片`);
      const audioPath = resolveAssetPath(job.id, scene.audio, `第 ${index + 1} 场配音`);
      const audioProbe = await probeMedia(audioPath, ffprobe);
      if (!audioProbe.durationSec) throw new Error(`第 ${index + 1} 场配音无法读取真实时长`);
      scenes.push({
        ...scene,
        imagePath,
        audioPath,
        durationSec: Number(audioProbe.durationSec.toFixed(3)),
      });
    }
    const chromeExecutable = findChromeExecutable();
    let browser = null;
    let renderer = "ffmpeg-ass-fallback";
    if (chromeExecutable) {
      try {
        browser = await puppeteer.launch({
          executablePath: chromeExecutable,
          headless: true,
          args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--disable-dev-shm-usage"],
        });
        renderer = "chromium-html-frames";
      } catch (error) {
        console.warn("[html-renderer] Chromium 启动失败，回退 FFmpeg/ASS:", error);
      }
    }
    const clips = [];
    try {
      for (const [index, scene] of scenes.entries()) {
        const fingerprint = await clipFingerprint(
          [scene.imagePath, scene.audioPath],
          { durationSec: scene.durationSec, animation: scene.animation, layout: scene.layout, subtitleStyle: scene.subtitleStyle, renderer, ...dimensions },
        );
        const clip = join(workDir, `scene-${String(index + 1).padStart(3, "0")}-${fingerprint}.mp4`);
        if (!existsSync(clip) || (await stat(clip)).size === 0) {
          await patchJob(job.id, { stage: `渲染 HTML 场景 ${index + 1}/${scenes.length}`, progress: 48 + Math.round((index / scenes.length) * 24) });
          if (browser) {
            await renderBrowserClip({
              browser,
              ffmpeg,
              jobId: job.id,
              scene,
              output: clip,
              durationSec: scene.durationSec,
              ...dimensions,
              framesDir: join(workDir, `frames-${String(index + 1).padStart(3, "0")}`),
            });
          } else {
            await renderImageClip({
              ffmpeg,
              jobId: job.id,
              imagePath: scene.imagePath,
              audioPath: scene.audioPath,
              output: clip,
              durationSec: scene.durationSec,
              ...dimensions,
              animation: scene.animation,
            });
          }
        }
        clips.push(clip);
      }
    } finally {
      if (browser) await browser.close().catch(() => undefined);
    }
    const concatFile = join(workDir, "html-scenes.txt");
    const assembled = join(workDir, "html-assembled.mp4");
    await writeFile(concatFile, `${clips.map(concatLine).join("\n")}\n`, "utf8");
    await runFfmpeg(ffmpeg, ["-f", "concat", "-safe", "0", "-i", concatFile, "-c", "copy", assembled], job.id);
    const output = join(outputDir, "storybound-html-video.mp4");
    if (renderer === "chromium-html-frames") {
      await runFfmpeg(ffmpeg, ["-i", assembled, "-c", "copy", "-movflags", "+faststart", output], job.id);
    } else {
      const subtitleFile = join(workDir, "html-scenes.ass");
      await writeAssSubtitles(subtitleFile, scenes, dimensions.width, dimensions.height);
      await runFfmpeg(ffmpeg, [
        "-i",
        assembled,
        "-vf",
        `ass='${escapeFilterPath(subtitleFile)}'`,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        output,
      ], job.id);
    }
    return { output, scenes, dimensions, renderer };
  }

  function alignMusicGroups(groups, durationSec) {
    const hasExplicitTimeline = groups.every((group) => (
      Number.isFinite(Number(group.startSec))
      && Number.isFinite(Number(group.endSec))
      && Number(group.endSec) > Number(group.startSec)
    ));
    if (hasExplicitTimeline) {
      const sorted = groups.map((group) => ({ ...group }));
      const explicitEnd = Number(sorted.at(-1)?.endSec);
      const scale = explicitEnd > 0 ? durationSec / explicitEnd : 1;
      return sorted.map((group) => ({
        ...group,
        startSec: Number(group.startSec) * scale,
        endSec: Number(group.endSec) * scale,
        durationSec: (Number(group.endSec) - Number(group.startSec)) * scale,
      }));
    }
    const weights = groups.map((group) => Math.max(1, [...String(group.lyrics || "")].length));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = 0;
    return groups.map((group, index) => {
      const end = index === groups.length - 1 ? durationSec : cursor + durationSec * weights[index] / totalWeight;
      const aligned = { ...group, startSec: cursor, endSec: end, durationSec: end - cursor };
      cursor = end;
      return aligned;
    });
  }

  async function renderMusic(job, manifest, ffmpeg, ffprobe, workDir, outputDir) {
    const dimensions = validDimensions(manifest);
    const musicPath = resolveAssetPath(job.id, manifest.music, "本地音乐");
    if (!acceptedAudioExtensions.has(extname(musicPath).toLowerCase())) throw new Error("本地音乐只支持 MP3、WAV、FLAC");
    const musicProbe = await probeMedia(musicPath, ffprobe);
    if (!musicProbe.durationSec) throw new Error("无法读取本地音乐真实时长");
    if (!Array.isArray(manifest.groups) || manifest.groups.length === 0) throw new Error("音乐 MV 没有歌词分组");
    const groups = alignMusicGroups(manifest.groups, musicProbe.durationSec);
    const scenes = groups.map((group, index) => ({
      ...group,
      title: "",
      subtitle: group.lyrics,
      lyrics: group.lyrics,
      layout: "full-image",
      subtitleStyle: "outline",
      animation: index % 2 === 0 ? "breathe" : "rise",
      imagePath: resolveAssetPath(job.id, group.image, `第 ${index + 1} 组图片`),
    }));
    const clips = [];
    for (const [index, scene] of scenes.entries()) {
      const fingerprint = await clipFingerprint(
        [scene.imagePath],
        { durationSec: scene.durationSec, animation: scene.animation, ...dimensions },
      );
      const clip = join(workDir, `mv-scene-${String(index + 1).padStart(3, "0")}-${fingerprint}.mp4`);
      if (!existsSync(clip) || (await stat(clip)).size === 0) {
        await patchJob(job.id, { stage: `渲染 MV 画面 ${index + 1}/${scenes.length}`, progress: 48 + Math.round((index / scenes.length) * 24) });
        await renderImageClip({
          ffmpeg,
          jobId: job.id,
          imagePath: scene.imagePath,
          output: clip,
          durationSec: Math.max(0.3, scene.durationSec),
          ...dimensions,
          animation: scene.animation,
        });
      }
      clips.push(clip);
    }
    const concatFile = join(workDir, "mv-scenes.txt");
    const silentVideo = join(workDir, "mv-silent.mp4");
    await writeFile(concatFile, `${clips.map(concatLine).join("\n")}\n`, "utf8");
    await runFfmpeg(ffmpeg, ["-f", "concat", "-safe", "0", "-i", concatFile, "-c", "copy", silentVideo], job.id);
    const subtitleFile = join(workDir, "mv-lyrics.ass");
    await writeAssSubtitles(subtitleFile, scenes, dimensions.width, dimensions.height);
    const output = join(outputDir, "storybound-music-mv.mp4");
    await runFfmpeg(ffmpeg, [
      "-i",
      silentVideo,
      "-i",
      musicPath,
      "-vf",
      `ass='${escapeFilterPath(subtitleFile)}'`,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-t",
      musicProbe.durationSec.toFixed(3),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      output,
    ], job.id);
    return { output, scenes, musicPath, musicProbe, dimensions };
  }

  async function buildDraft(job, manifest, renderData, outputDir) {
    const scenes = renderData.scenes;
    const timeline = [];
    let cursor = 0;
    for (const [index, scene] of scenes.entries()) {
      const durationSec = Math.max(0.3, Number(scene.durationSec));
      timeline.push({
        shotId: Number(scene.id || index + 1),
        text: scene.subtitle || scene.lyrics || scene.title || "",
        startSec: cursor,
        endSec: cursor + durationSec,
        durationSec,
      });
      cursor += durationSec;
    }
    const images = scenes.map((scene, index) => ({
      shotId: Number(scene.id || index + 1),
      path: scene.imagePath,
      url: scene.image?.url || "",
      status: "ready",
      width: renderData.dimensions.width,
      height: renderData.dimensions.height,
    }));
    const audioSegments = job.kind === "html-video"
      ? scenes.map((scene, index) => ({
        shotId: Number(scene.id || index + 1),
        path: scene.audioPath,
        url: scene.audio?.url || "",
        durationSec: scene.durationSec,
        status: "ready",
      }))
      : [];
    const coverPath = manifest.cover
      ? resolveAssetPath(job.id, manifest.cover, "封面")
      : scenes[0]?.imagePath;
    const storyboardShots = timeline.map((item) => ({
      id: item.shotId,
      text: item.text,
      visual: scenes.find((scene) => Number(scene.id) === item.shotId)?.prompt || "",
      emotion: "",
      durationSec: item.durationSec,
    }));
    const task = await taskStore.updateTask(job.id, {
      title: job.title,
      inputText: manifest.sourceText || manifest.lyrics || "",
      aspectRatio: manifest.aspectRatio || "9:16",
      status: "running",
      runState: "running",
      artifacts: {
        rewrite: { title: job.title, narration: manifest.sourceText || manifest.lyrics || "", subtitle: [], publishCopy: "", tags: [], pinnedComment: "" },
        storyboard: { shots: storyboardShots },
      },
      media: {
        images,
        audioSegments,
        timeline,
        externalAudio: job.kind === "music-mv"
          ? { path: renderData.musicPath, durationSec: renderData.musicProbe.durationSec, status: "ready" }
          : null,
        coverImages: coverPath ? [{ shotId: 9001, path: coverPath, status: "ready" }] : [],
      },
      options: {
        source: "media-workbench",
        mediaKind: job.kind,
        ttsMode: "original-segmented",
        draftTemplateId: manifest.aspectRatio === "16:9" ? "default-landscape-16-9" : "default-portrait-9-16",
      },
    });
    const draft = await buildJianyingDraft(taskStore, task);
    if (!draft.ready || !draft.zipPath || !existsSync(draft.zipPath)) throw new Error("剪映草稿构建器未生成真实 ZIP");
    const zipPath = join(outputDir, "jianying-draft.zip");
    await copyFile(draft.zipPath, zipPath);
    if ((await stat(zipPath)).size === 0) throw new Error("剪映草稿 ZIP 为空");
    await taskStore.updateTask(job.id, { draft, status: "completed", runState: "completed" });
    return zipPath;
  }

  async function renderJob(jobId, body) {
    let job = await readJob(jobId);
    if (!job) throw new Error("媒体任务不存在");
    if (activeProcesses.has(jobId)) throw new Error("媒体任务正在渲染");
    const manifest = body.manifest || job.manifest;
    if (!manifest || manifest.kind !== job.kind) throw new Error("渲染 manifest 类型不匹配");
    const available = await tools();
    if (!available.ffmpeg || !available.ffprobe) {
      throw new Error("本机缺少可用的 ffmpeg/ffprobe，无法生成真实 MP4");
    }
    cancelledJobs.delete(jobId);
    const base = await ensureJobFolders(jobId);
    const workDir = join(base, "work");
    const outputDir = join(base, "output");
    await Promise.all([mkdir(workDir, { recursive: true }), mkdir(outputDir, { recursive: true })]);
    job = await patchJob(jobId, {
      manifest,
      status: "running",
      stage: "校验本地资源",
      progress: 42,
      resumable: true,
      error: null,
      output: undefined,
    });
    try {
      const renderData = job.kind === "html-video"
        ? await renderHtml(job, manifest, available.ffmpeg, available.ffprobe, workDir, outputDir)
        : await renderMusic(job, manifest, available.ffmpeg, available.ffprobe, workDir, outputDir);
      const renderedManifest = job.kind === "html-video"
        ? {
          ...manifest,
          scenes: manifest.scenes.map((scene, index) => ({
            ...scene,
            durationSec: renderData.scenes[index]?.durationSec,
          })),
          updatedAt: nowIso(),
        }
        : {
          ...manifest,
          groups: manifest.groups.map((group, index) => ({
            ...group,
            startSec: renderData.scenes[index]?.startSec,
            endSec: renderData.scenes[index]?.endSec,
            durationSec: renderData.scenes[index]?.durationSec,
          })),
          updatedAt: nowIso(),
        };
      await patchJob(jobId, { stage: "生成剪映草稿", progress: 84 });
      const zipPath = await buildDraft(job, renderedManifest, renderData, outputDir);
      const manifestPath = join(outputDir, "manifest.json");
      await writeJsonAtomic(manifestPath, {
        schemaVersion: 1,
        jobId,
        kind: job.kind,
        generatedAt: nowIso(),
        renderer: renderData.renderer || "ffmpeg",
        manifest: renderedManifest,
        timeline: renderData.scenes.map((scene) => ({
          id: scene.id,
          title: scene.title || "",
          text: scene.subtitle || scene.lyrics || "",
          durationSec: scene.durationSec,
          imagePath: scene.imagePath,
          audioPath: scene.audioPath,
        })),
      });
      const outputProbe = await probeMedia(renderData.output, available.ffprobe);
      if (!outputProbe.durationSec || !outputProbe.videoCodec || !outputProbe.audioCodec) {
        throw new Error("最终 MP4 缺少可解码的视频或音频轨");
      }
      const outputStats = await stat(renderData.output);
      const zipStats = await stat(zipPath);
      if (!outputStats.size || !zipStats.size) throw new Error("最终产物写入失败");
      const output = {
        mp4Path: renderData.output,
        mp4Url: `/api/media-workbench/jobs/${encodeURIComponent(jobId)}/files/output/${encodeURIComponent(basename(renderData.output))}`,
        manifestPath,
        manifestUrl: `/api/media-workbench/jobs/${encodeURIComponent(jobId)}/files/output/manifest.json`,
        jianyingZipPath: zipPath,
        jianyingZipUrl: `/api/media-workbench/jobs/${encodeURIComponent(jobId)}/files/output/jianying-draft.zip`,
        durationSec: Number(outputProbe.durationSec.toFixed(3)),
        width: outputProbe.width,
        height: outputProbe.height,
        fps: Number(outputProbe.fps.toFixed(3)),
        videoCodec: outputProbe.videoCodec,
        audioCodec: outputProbe.audioCodec,
        renderer: renderData.renderer || "ffmpeg",
        bytes: outputStats.size,
        generatedAt: nowIso(),
      };
      return patchJob(jobId, {
        status: "completed",
        stage: "真实文件已生成",
        progress: 100,
        resumable: false,
        completedAt: nowIso(),
        manifest: renderedManifest,
        output,
        error: null,
      });
    } catch (error) {
      const cancelled = error?.code === "MEDIA_CANCELLED" || cancelledJobs.has(jobId);
      await patchJob(jobId, {
        status: cancelled ? "paused" : "failed",
        stage: cancelled ? "已暂停，断点已保留" : "生成失败",
        resumable: true,
        error: mediaError(error, "媒体生成失败"),
      });
      throw error;
    } finally {
      activeProcesses.delete(jobId);
    }
  }

  async function cancelJob(jobId) {
    const job = await readJob(jobId);
    if (!job) throw new Error("媒体任务不存在");
    cancelledJobs.add(jobId);
    const child = activeProcesses.get(jobId);
    if (child) child.kill();
    return patchJob(jobId, {
      status: "paused",
      stage: "已暂停，断点已保留",
      resumable: true,
      error: null,
    });
  }

  function resolveDownload(jobId, kind, fileName) {
    if (!fileKinds.has(kind)) return null;
    const base = resolve(jobDir(jobId), kind);
    const file = resolve(base, safeFileName(fileName));
    if (!isPathInside(base, file)) return null;
    return file;
  }

  return async function handleMediaWorkbenchRequest(request, response, pathnameInput) {
    const pathname = pathnameInput || new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`).pathname;
    if (!pathname.startsWith("/api/media-workbench/")) return false;
    const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
    try {
      if (pathname === "/api/media-workbench/capabilities" && request.method === "GET") {
        const available = await tools();
        sendJson(response, 200, {
          ffmpeg: Boolean(available.ffmpeg),
          ffprobe: Boolean(available.ffprobe),
          acceptedAudio: [...acceptedAudioExtensions],
          acceptedImages: [...acceptedImageExtensions],
          maxUploadBytes,
        });
        return true;
      }
      if (pathname === "/api/media-workbench/jobs") {
        if (request.method === "GET") {
          sendJson(response, 200, { jobs: await listJobs() });
          return true;
        }
        if (request.method === "POST") {
          sendJson(response, 201, { job: await createJob(await readJson(request, maxUploadBytes * 1.4)) });
          return true;
        }
        sendJson(response, 405, { error: "该接口只支持 GET/POST" });
        return true;
      }
      const jobId = parts[3] ? assertJobId(parts[3]) : "";
      if (!jobId) {
        sendJson(response, 404, { error: "媒体任务不存在" });
        return true;
      }
      if (parts.length === 4) {
        if (request.method === "GET") {
          const job = await readJob(jobId);
          sendJson(response, job ? 200 : 404, job ? { job } : { error: "媒体任务不存在" });
          return true;
        }
        if (request.method === "PATCH") {
          const body = await readJson(request, maxUploadBytes * 1.4);
          const current = await readJob(jobId);
          if (!current) throw new Error("媒体任务不存在");
          if (body.manifest && body.manifest.kind !== current.kind) throw new Error("manifest 类型不匹配");
          sendJson(response, 200, {
            job: await patchJob(jobId, {
              ...(typeof body.title === "string" ? { title: body.title.trim().slice(0, 120) } : {}),
              ...(body.manifest ? { manifest: body.manifest } : {}),
              ...(typeof body.stage === "string" ? { stage: body.stage.slice(0, 120) } : {}),
              ...(Number.isFinite(Number(body.progress)) ? { progress: Math.max(0, Math.min(99, Number(body.progress))) } : {}),
              ...(body.status === "draft" || body.status === "paused" ? { status: body.status } : {}),
              ...(body.error === null || typeof body.error === "string" ? { error: body.error } : {}),
            }),
          });
          return true;
        }
        sendJson(response, 405, { error: "该接口只支持 GET/PATCH" });
        return true;
      }
      if (parts[4] === "assets" && request.method === "POST") {
        const available = await tools();
        sendJson(response, 201, { asset: await saveAsset(jobId, await readJson(request, maxUploadBytes * 1.4), available.ffprobe) });
        return true;
      }
      if (parts[4] === "render" && request.method === "POST") {
        sendJson(response, 200, { job: await renderJob(jobId, await readJson(request, maxUploadBytes * 1.4)) });
        return true;
      }
      if (parts[4] === "cancel" && request.method === "POST") {
        sendJson(response, 200, { job: await cancelJob(jobId) });
        return true;
      }
      if (parts[4] === "files" && parts.length >= 7 && request.method === "GET") {
        const file = resolveDownload(jobId, parts[5], parts.slice(6).join("-"));
        if (!file || !existsSync(file) || !(await stat(file)).isFile()) {
          sendJson(response, 404, { error: "媒体文件不存在" });
          return true;
        }
        const extension = extname(file).toLowerCase();
        response.writeHead(200, {
          "Content-Type": mediaMimeTypes[extension] || "application/octet-stream",
          "Content-Length": String((await stat(file)).size),
          "Cache-Control": "no-store",
        });
        createReadStream(file).pipe(response);
        return true;
      }
      sendJson(response, 404, { error: "未知媒体工作台接口" });
      return true;
    } catch (error) {
      const status = /不存在/u.test(mediaError(error, "")) ? 404 : /正在渲染/u.test(mediaError(error, "")) ? 409 : 400;
      sendJson(response, status, { error: mediaError(error, "媒体工作台请求失败") });
      return true;
    }
  };
}

export const handleMediaWorkbenchRequest = createMediaWorkbenchHandler();
