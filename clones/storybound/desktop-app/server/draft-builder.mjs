import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { deflateSync } from "node:zlib";

import { Jieba } from "@node-rs/jieba";
import { dict as jiebaDict } from "@node-rs/jieba/dict.js";

import { writeStoredZip } from "./zip-store.mjs";

const microseconds = 1_000_000;
const jieba = Jieba.withDict(jiebaDict);
const draftTemplates = JSON.parse(await readFile(new URL("../original-draft-templates.json", import.meta.url), "utf8"));
const execFileAsync = promisify(execFile);
const ffmpegCandidates = [
  process.env.FFMPEG_PATH,
  "C:\\Users\\pdb12\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe",
  "ffmpeg",
].filter(Boolean);

const animationMetadata = {
  "缩放": ["446078", "6759078592740594184"],
  "缩放_II": ["493000", "6779083172429697544"],
  "左拉镜": ["471345", "6772415248973435395"],
  "右拉镜": ["471347", "6772415374165021191"],
  "向左缩小": ["471343", "6772415148423385607"],
  "向右缩小": ["471341", "6772415063216099848"],
  "形变左缩": ["813140", "6851395726937690637"],
  "形变右缩": ["813139", "6851395907804467720"],
  "上下分割": ["931224", "6875935836177699335"],
  "左右分割": ["948476", "6886282872680878599"],
  "向左下降": ["447588", "6760223716392571395"],
  "向右下降": ["503138", "6781683438396117517"],
  "旋转缩小": ["445858", "6759046644462785037"],
  "旋转上升": ["691843", "6813965670716281352"],
  "翻转": ["872838", "6843309964732142094"],
  "形变缩小": ["487587", "6777260789263766030"],
  "回弹伸缩": ["530249", "6795425591014199822"],
  "滑滑梯": ["741020", "6828829568879563271"],
  "四格滑动": ["945730", "6883727868451361293"],
  "百叶窗": ["467361", "6771299961171612174"],
  "抖入放大": ["450264", "6761360765925462536"],
};

function deepMerge(target, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch;
  const output = target && typeof target === "object" && !Array.isArray(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    output[key] = value && typeof value === "object" && !Array.isArray(value)
      ? deepMerge(output[key], value)
      : value;
  }
  return output;
}

function resolveDraftTemplate(templateId, customConfig) {
  const definition = draftTemplates.find((template) => template.id === templateId) || draftTemplates[0];
  return customConfig ? { ...definition, config: deepMerge(definition.config, customConfig) } : definition;
}

function id() {
  return randomUUID().replaceAll("-", "").toLowerCase();
}

function capcutId() {
  return randomUUID().toUpperCase();
}

function sanitizeTitle(value) {
  return String(value || "Storybound任务")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/[.\s]+$/g, "")
    .slice(0, 64) || "Storybound任务";
}

function textDuration(text) {
  return Math.max(1.2, Math.min(12, String(text || "").replace(/\s/g, "").length / 4.3));
}

function colorFromHex(hex) {
  const value = String(hex || "#ffffff").replace("#", "").padEnd(6, "f").slice(0, 6);
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255);
}

function rgbFromHex(hex) {
  return colorFromHex(hex).map((value) => Math.round(value * 255));
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return chunk;
}

function rgbaPng(width, height, paint) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      const [red, green, blue, alpha] = paint(x, y);
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      raw[offset + 3] = alpha;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function mixColor(start, end, amount) {
  return start.map((value, index) => Math.round(value + (end[index] - value) * amount));
}

async function writeTemplateFrameAssets(template, imageDirectory) {
  const backgroundSource = String(template.canvas.backgroundImage || "").trim();
  if (!template.frame.enabled && !backgroundSource) return null;
  const { width, height } = template.canvas;
  const image = imageGeometry(template);
  const imageTop = Math.max(0, Math.min(height, Math.round(template.image.top * height)));
  const imageBottom = Math.max(imageTop, Math.min(height, imageTop + image.height));
  const topHeight = imageTop;
  const bottomHeight = height - imageBottom;
  const borderWidth = Math.max(1, Math.round(template.frame.imageBorderWidth || 0));
  const canvasColor = rgbFromHex(template.canvas.backgroundColor);
  const headerStart = rgbFromHex(template.frame.headerColor || template.canvas.backgroundColor);
  const headerEnd = rgbFromHex(template.frame.headerColorEnd || template.frame.headerColor || template.canvas.backgroundColor);
  const footerStart = rgbFromHex(template.frame.footerColor || template.canvas.backgroundColor);
  const footerEnd = rgbFromHex(template.frame.footerColorEnd || template.frame.footerColor || template.canvas.backgroundColor);
  const borderColor = rgbFromHex(template.frame.imageBorderColor || "#ffffff");
  const sides = String(template.frame.imageBorderSides || "all").toLowerCase();
  const drawTopBorder = template.frame.enabled && borderWidth > 0 && ["all", "tb", "top", "horizontal"].includes(sides);
  const drawBottomBorder = template.frame.enabled && borderWidth > 0 && ["all", "tb", "bottom", "horizontal"].includes(sides);
  const result = { backgroundPath: null, topPath: null, bottomPath: null, topHeight, bottomHeight };

  const backgroundPath = join(imageDirectory, "background.png");
  if (backgroundSource) await copyFile(resolve(backgroundSource), backgroundPath);
  else await writeFile(backgroundPath, rgbaPng(width, height, () => [...canvasColor, 255]));
  result.backgroundPath = backgroundPath;

  if (template.frame.enabled && topHeight > 0 && template.frame.headerVisible !== false) {
    const topPath = join(imageDirectory, "mask_top.png");
    await writeFile(topPath, rgbaPng(width, topHeight, (_x, y) => {
      if (drawTopBorder && y >= topHeight - borderWidth) return [...borderColor, 255];
      return [...mixColor(headerStart, headerEnd, y / Math.max(1, topHeight - 1)), 255];
    }));
    result.topPath = topPath;
  }
  if (template.frame.enabled && bottomHeight > 0 && template.frame.footerVisible !== false) {
    const bottomPath = join(imageDirectory, "mask_bottom.png");
    await writeFile(bottomPath, rgbaPng(width, bottomHeight, (_x, y) => {
      if (drawBottomBorder && y < borderWidth) return [...borderColor, 255];
      return [...mixColor(footerStart, footerEnd, y / Math.max(1, bottomHeight - 1)), 255];
    }));
    result.bottomPath = bottomPath;
  }
  return result;
}

function textLayerOptions(layer, extra = {}) {
  return {
    color: layer.color,
    alpha: layer.alpha,
    fontSize: layer.fontSize,
    bold: layer.bold,
    underline: layer.underline,
    alignment: layer.align,
    letterSpacing: Number(layer.letterSpacing || 0) * 0.05,
    lineSpacing: 0.02 + Number(layer.lineSpacing || 0) * 0.05,
    hasBorder: Boolean(layer.border),
    strokeColor: layer.border?.color,
    strokeAlpha: layer.border?.alpha,
    strokeWidth: Number(layer.border?.width || 0) / 100 * 0.2,
    ...extra,
  };
}

function textMaterial(text, options = {}) {
  const materialId = id();
  const fontSize = options.fontSize ?? 12;
  const value = String(text);
  const strokes = options.hasBorder
    ? [{ content: { solid: { alpha: options.strokeAlpha, color: colorFromHex(options.strokeColor || "#000000") } }, width: options.strokeWidth }]
    : [];
  const content = {
    styles: [{
      fill: { alpha: 1, content: { render_type: "solid", solid: { alpha: options.alpha ?? 1, color: colorFromHex(options.color) } } },
      range: [0, value.length],
      size: fontSize,
      bold: Boolean(options.bold),
      italic: false,
      underline: Boolean(options.underline),
      strokes,
    }],
    text: value,
  };
  return {
    id: materialId,
    content: JSON.stringify(content),
    typesetting: 0,
    alignment: options.alignment ?? 1,
    letter_spacing: options.letterSpacing ?? 0,
    line_spacing: options.lineSpacing ?? 0,
    line_feed: 1,
    line_max_width: options.type === "subtitle" ? 1 : 0.82,
    force_apply_line_max_width: false,
    check_flag: 7 | (options.hasBorder ? 8 : 0) | (options.type === "subtitle" ? 16 : 0),
    type: options.type || "text",
    fixed_width: -1,
    fixed_height: -1,
    font_category_id: "",
    font_category_name: "",
    font_id: "",
    font_name: "",
    font_path: "",
    font_resource_id: "",
    font_size: 15,
    font_source_platform: 0,
    font_team_id: "",
    font_title: "none",
    font_url: "",
    fonts: [],
    ...(options.globalAlpha == null ? {} : { global_alpha: options.globalAlpha }),
    ...(options.type === "subtitle" ? {
      background_style: 0,
      background_color: options.backgroundColor || "#000000",
      background_alpha: options.backgroundAlpha ?? 0.5,
      background_round_radius: options.backgroundRoundRadius ?? 0.3,
      background_height: 0.14,
      background_width: 0.14,
      background_horizontal_offset: 0,
      background_vertical_offset: 0,
      sub_type: 0,
      recognize_type: 0,
      is_rich_text: true,
      caption_template_info: {
        category_id: "",
        category_name: "",
        effect_id: "",
        is_new: false,
        path: "",
        request_id: "",
        resource_id: "",
        resource_name: "",
        source_platform: 0,
      },
      combo_info: { text_templates: [] },
      words: { end_time: [], start_time: [], text: [] },
      subtitle_keywords: null,
    } : {}),
  };
}

function trackSegment(materialId, start, duration, type, options = {}) {
  return {
    enable_adjust: true,
    enable_color_correct_adjust: false,
    enable_color_curves: true,
    enable_color_match_adjust: false,
    enable_color_wheels: true,
    enable_lut: true,
    enable_smart_color_adjust: false,
    last_nonzero_volume: 1,
    reverse: false,
    track_attribute: 0,
    track_render_index: 0,
    visible: true,
    id: id(),
    material_id: materialId,
    target_timerange: { start, duration },
    common_keyframes: options.commonKeyframes || [],
    keyframe_refs: [],
    source_timerange: type === "text" ? null : { start: options.sourceStart || 0, duration: options.sourceDuration ?? duration },
    speed: type === "video" ? options.speed ?? null : 1,
    volume: type === "audio" ? options.volume ?? 10 : options.volume ?? 1,
    extra_material_refs: options.extraMaterialRefs ?? (type === "text" ? [id()] : []),
    clip: type === "audio" ? null : {
      alpha: options.alpha ?? 1,
      flip: { horizontal: false, vertical: false },
      rotation: 0,
      scale: { x: options.scale ?? 1, y: options.scale ?? 1 },
      transform: { x: options.x ?? 0, y: options.y ?? 0 },
    },
    ...(type !== "audio" ? { uniform_scale: { on: true, value: options.scale ?? 1 } } : {}),
    hdr_settings: type === "audio" ? null : { intensity: 1, mode: 1, nits: 1000 },
    render_index: options.renderIndex ?? 0,
  };
}

function emptyMaterials() {
  return {
    ai_translates: [],
    audio_balances: [],
    audio_effects: [],
    audio_fades: [],
    audio_track_indexes: [],
    audios: [],
    beats: [],
    canvases: [],
    chromas: [],
    color_curves: [],
    digital_humans: [],
    drafts: [],
    effects: [],
    flowers: [],
    green_screens: [],
    handwrites: [],
    hsl: [],
    images: [],
    log_color_wheels: [],
    loudnesses: [],
    manual_deformations: [],
    material_animations: [],
    material_colors: [],
    multi_language_refs: [],
    placeholders: [],
    plugin_effects: [],
    primary_color_wheels: [],
    realtime_denoises: [],
    shapes: [],
    smart_crops: [],
    smart_relights: [],
    sound_channel_mappings: [],
    speeds: [],
    stickers: [],
    tail_leaders: [],
    text_templates: [],
    texts: [],
    time_marks: [],
    transitions: [],
    video_effects: [],
    video_trackings: [],
    videos: [],
  };
}

function ratioNumbers(value) {
  const [width, height] = String(value || "1:1").split(":").map(Number);
  return width > 0 && height > 0 ? [width, height] : [1, 1];
}

function imageGeometry(template) {
  const [ratioWidth, ratioHeight] = ratioNumbers(template.image.ratio);
  const height = Math.max(1, Math.round(template.canvas.height * template.image.height));
  const width = Math.max(1, Math.round(height * ratioWidth / ratioHeight));
  const center = template.image.top + template.image.height / 2;
  return { width, height, x: 0, y: 1 - center * 2 };
}

function videoMaterial(file, duration, width, height, type = "photo") {
  const materialId = id();
  return {
    audio_fade: null,
    category_id: "",
    category_name: "local",
    check_flag: 63487,
    crop: {
      upper_left_x: 0,
      upper_left_y: 0,
      upper_right_x: 1,
      upper_right_y: 0,
      lower_left_x: 0,
      lower_left_y: 1,
      lower_right_x: 1,
      lower_right_y: 1,
    },
    crop_ratio: "free",
    crop_scale: 1,
    duration: type === "video" ? duration : Math.max(duration, 10_800 * microseconds),
    height,
    id: materialId,
    local_material_id: "",
    material_id: materialId,
    material_name: basename(file),
    media_path: "",
    path: file,
    remote_url: null,
    type,
    width,
  };
}

function normalizePool(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => String(item || "").trim()).filter((item) => item && item !== "none");
}

function animationMaterial(name, duration) {
  const metadata = animationMetadata[name];
  if (!metadata) return null;
  return {
    id: id(),
    type: "sticker_animation",
    multi_language_current: "none",
    animations: [{
      anim_adjust_params: null,
      platform: "all",
      panel: "video",
      material_type: "video",
      name,
      id: metadata[0],
      type: "group",
      resource_id: metadata[1],
      start: 0,
      duration,
    }],
  };
}

function keyframe(propertyType, startTime, startValue, endTime, endValue) {
  const point = (time_offset, value) => ({
    curveType: "Line",
    graphID: "",
    left_control: { x: 0, y: 0 },
    right_control: { x: 0, y: 0 },
    id: id(),
    time_offset,
    values: [value],
  });
  return {
    id: id(),
    keyframe_list: [point(startTime, startValue), point(endTime, endValue)],
    material_id: "",
    property_type: propertyType,
  };
}

function applyMotion(segment, motionName, duration, strength = 1) {
  const name = String(motionName || "").trim().toLowerCase();
  if (!name || name === "none") return false;
  const amount = Math.max(0.1, Number(strength) || 1);
  const zoom = 0.15 * amount;
  const kenBurnsZoom = 0.2 * amount;
  const position = 0.06 * amount;
  const panScale = 1 + 0.15 * amount;
  const add = (property, start, end) => segment.common_keyframes.push(keyframe(property, 0, start, duration, end));
  if (name === "zoom_in") add("KFTypeScaleX", 1, 1 + zoom);
  else if (name === "zoom_out") add("KFTypeScaleX", 1 + zoom, 1);
  else if (name === "kenburns_up") {
    add("KFTypeScaleX", 1, 1 + kenBurnsZoom);
    add("KFTypePositionY", 0, position);
  } else if (name === "kenburns_down") {
    add("KFTypeScaleX", 1, 1 + kenBurnsZoom);
    add("KFTypePositionY", 0, -position);
  } else if (name === "pan_left") {
    add("KFTypeScaleX", panScale, panScale);
    add("KFTypePositionX", position, -position);
  } else if (name === "pan_right") {
    add("KFTypeScaleX", panScale, panScale);
    add("KFTypePositionX", -position, position);
  } else return false;
  return true;
}

function applyEdgeFade(segment, duration, isFirst, isLast) {
  if (isFirst) {
    const fadeIn = Math.min(800_000, Math.floor(duration / 3));
    segment.common_keyframes.push(keyframe("KFTypeAlpha", 0, 0, fadeIn, 1));
  }
  if (isLast) {
    const fadeOut = Math.min(1_800_000, Math.floor(duration / 3));
    segment.common_keyframes.push(keyframe("KFTypeAlpha", Math.max(0, duration - fadeOut), 1, duration, 0));
  }
}

function audioMaterial(file, duration) {
  const materialId = id();
  return {
    app_id: 0,
    category_id: "",
    category_name: "local",
    check_flag: 1,
    copyright_limit_type: "none",
    duration,
    effect_id: "",
    formula_id: "",
    id: materialId,
    intensifies_path: "",
    is_ai_clone_tone: false,
    is_text_edit_overdub: false,
    is_ugc: false,
    local_material_id: materialId,
    music_id: materialId,
    name: basename(file),
    path: file,
    remote_url: null,
    query: "",
    request_id: "",
    resource_id: "",
    search_id: "",
    source_from: "",
    source_platform: 0,
    team_id: "",
    text_id: "",
    tone_category_id: "",
    tone_category_name: "",
    tone_effect_id: "",
    tone_effect_name: "",
    tone_platform: "",
    tone_second_category_id: "",
    tone_second_category_name: "",
    tone_speaker: "",
    tone_type: "",
    type: "extract_music",
    video_id: "",
    wave_points: [],
  };
}

async function copyAsset(source, targetDirectory, preferredName) {
  const sourcePath = resolve(source);
  const requestedName = String(preferredName || basename(sourcePath));
  const requestedExtension = extname(requestedName);
  const extension = requestedExtension || extname(sourcePath) || ".bin";
  const stem = basename(requestedName, requestedExtension).replace(/[^A-Za-z0-9_-]/g, "-") || "asset";
  const name = `${stem}${extension.toLowerCase()}`;
  const target = join(targetDirectory, name);
  await copyFile(sourcePath, target);
  return target;
}

async function prepareBgm(source, audioDirectory, totalDuration, fadeOutMs) {
  const output = join(audioDirectory, "bgm.mp3");
  const totalSeconds = Math.max(0.3, totalDuration / microseconds);
  const fadeSeconds = Math.min(totalSeconds, Math.max(0, Number(fadeOutMs || 0) / 1000));
  const filter = fadeSeconds > 0
    ? `afade=t=out:st=${Math.max(0, totalSeconds - fadeSeconds).toFixed(6)}:d=${fadeSeconds.toFixed(6)}`
    : null;
  const args = ["-y", "-stream_loop", "-1", "-i", resolve(source), "-t", totalSeconds.toFixed(6), "-vn"];
  if (filter) args.push("-af", filter);
  args.push("-codec:a", "libmp3lame", "-q:a", "2", output);
  for (const executable of ffmpegCandidates) {
    try {
      await execFileAsync(executable, args, { timeout: 120_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
      return { path: output, duration: totalDuration, preRendered: true };
    } catch {
      // Try the next configured ffmpeg. A valid source copy remains a safe fallback.
    }
  }
  const fallback = await copyAsset(source, audioDirectory, `bgm${extname(source) || ".mp3"}`);
  return { path: fallback, duration: totalDuration, preRendered: false };
}

function resolveShots(task) {
  const podcastSegments = task.media?.podcast?.segments;
  if (task.videoForm === "podcast" && Array.isArray(podcastSegments) && podcastSegments.length) {
    return podcastSegments.map((segment, index) => ({
      id: Number(segment.shotId || index + 1),
      text: `${segment.speaker ? `[${segment.speaker}] ` : ""}${segment.text}`,
      durationSec: Number(segment.durationSec || textDuration(segment.text)),
      visual: "",
      emotion: "",
    }));
  }
  const shots = task.artifacts?.storyboard?.shots;
  if (Array.isArray(shots) && shots.length) return shots;
  return String(task.artifacts?.rewrite?.narration || task.inputText || "")
    .split(/(?<=[。！？!?；;])|\n+/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: index + 1, text, durationSec: textDuration(text), visual: "", emotion: "" }));
}

function normalizedTimeline(task, shots) {
  const byShot = new Map((task.media?.audioSegments || []).filter((item) => item.status === "ready").map((item) => [item.shotId, item]));
  const savedTimeline = Array.isArray(task.media?.timeline) ? task.media.timeline : [];
  if (savedTimeline.length === shots.length && savedTimeline.every((item) => Number(item.durationSec) > 0)) {
    return shots.map((shot, index) => {
      const saved = savedTimeline.find((item) => Number(item.shotId) === Number(shot.id)) || savedTimeline[index];
      return {
        shotId: shot.id,
        text: saved.text || shot.text,
        startSec: Number(saved.startSec),
        endSec: Number(saved.endSec),
        durationSec: Number(saved.durationSec),
        audio: byShot.get(shot.id),
      };
    });
  }
  let cursor = 0;
  return shots.map((shot) => {
    const audio = byShot.get(shot.id);
    const seconds = Number(audio?.durationSec || shot.durationSec || textDuration(shot.text));
    const start = cursor;
    const end = start + Math.max(0.3, seconds);
    cursor = end;
    return { shotId: shot.id, text: shot.text, startSec: start, endSec: end, durationSec: end - start, audio };
  });
}

function buildSrt(timeline) {
  function time(valueUs) {
    const milliseconds = Math.max(0, Math.floor(valueUs / 1000));
    const hours = Math.floor(milliseconds / 3_600_000);
    const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
    const seconds = Math.floor((milliseconds % 60_000) / 1000);
    const remainder = milliseconds % 1000;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(remainder).padStart(3, "0")}`;
  }
  return `${timeline.map((item, index) => `${index + 1}\n${time(item.startUs)} --> ${time(item.endUs)}\n${item.text}`).join("\n\n")}\n`;
}

function subtitleLength(value) {
  return [...String(value || "").replace(/\s/g, "")].length;
}

function splitSubtitleText(value, maxChars = 18) {
  const splitPunctuation = /[，。、；：？！''（）【】《》…]|——/u;
  const punctuation = /[，。、；：？！''（）【】《》——…·.,!?;:"'()[\]]/gu;
  const chunks = [];

  function packWords(words) {
    let current = "";
    for (let word of words) {
      if (subtitleLength(word) > maxChars) {
        if (current) chunks.push(current);
        current = "";
        while (subtitleLength(word) > maxChars) {
          const characters = [...word];
          chunks.push(characters.slice(0, maxChars).join(""));
          word = characters.slice(maxChars).join("");
        }
        current = word;
        continue;
      }
      if (subtitleLength(current + word) <= maxChars) current += word;
      else {
        if (current) chunks.push(current);
        current = word;
      }
    }
    if (current) chunks.push(current);
  }

  for (const part of String(value || "").split(splitPunctuation)) {
    const clean = part
      .replace(punctuation, "")
      .replaceAll("\n", " ")
      .replaceAll("\r", " ")
      .replaceAll("\t", " ")
      .trim();
    if (!clean) continue;
    if (subtitleLength(clean) <= maxChars) chunks.push(clean);
    else packWords(jieba.cut(clean, true));
  }
  return chunks;
}

function splitSubtitleTimeline(item, maxChars) {
  const chunks = splitSubtitleText(item.text, maxChars);
  if (!chunks.length) return [];
  const weights = chunks.map((text) => Math.max(1, subtitleLength(text)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let currentUs = item.startUs;
  const cues = chunks.map((text, index) => {
    const rawDurationUs = Math.trunc(item.durationUs * weights[index] / totalWeight);
    const startUs = Math.floor(currentUs / 1000) * 1000;
    const endUs = Math.floor((currentUs + rawDurationUs) / 1000) * 1000;
    currentUs += rawDurationUs;
    return { shotId: item.shotId, text, startUs, endUs, durationUs: endUs - startUs };
  });
  const lastCue = cues.at(-1);
  if (lastCue) {
    lastCue.endUs = item.endUs;
    lastCue.durationUs = item.endUs - lastCue.startUs;
  }
  return cues;
}

function timelineInMicroseconds(timeline) {
  let cursorUs = 0;
  return timeline.map((item) => {
    const durationUs = Math.max(1, Math.trunc(Number(item.durationSec) * microseconds));
    const startUs = cursorUs;
    cursorUs += durationUs;
    return {
      ...item,
      startUs,
      endUs: cursorUs,
      durationUs,
      startSec: startUs / microseconds,
      endSec: cursorUs / microseconds,
      durationSec: durationUs / microseconds,
    };
  });
}

function displayWidth(value) {
  return [...String(value || "")].reduce((sum, character) => sum + (character.codePointAt(0) < 4352 ? 0.5 : 1), 0);
}

function fittedFontSize(configuredSize, value, budget, minimum) {
  const longestLine = Math.max(1, ...String(value || "").split("\n").map(displayWidth));
  return Math.max(minimum, Math.min(Number(configuredSize), budget / longestLine));
}

export async function buildJianyingDraft(taskStore, task) {
  const shots = resolveShots(task);
  if (!shots.length) throw new Error("没有分镜，无法生成剪映草稿");
  const readyImages = new Map((task.media?.images || []).filter((item) => item.status === "ready" && item.path).map((item) => [item.shotId, item]));
  const readyVideos = new Map((task.media?.videos || []).filter((item) => item.status === "ready" && item.path).map((item) => [item.shotId, item]));
  const firstImage = [...readyImages.values()][0];
  const singleImage = task.videoForm === "podcast" && task.options?.podcastImageMode === "single";
  const missingImages = singleImage
    ? (firstImage ? [] : [shots[0].id])
    : shots.filter((shot) => !readyImages.has(shot.id) && !readyVideos.has(shot.id)).map((shot) => shot.id);
  if (missingImages.length) throw new Error(`以下分镜缺少图片：#${missingImages.join("、#")}`);

  const audioSegments = (task.media?.audioSegments || []).filter((item) => item.status === "ready" && item.path);
  const continuousAudio = task.media?.continuousAudio?.status === "ready" && task.media?.continuousAudio?.path
    ? task.media.continuousAudio
    : null;
  const podcastSegments = task.media?.podcast?.segments?.filter((item) => item.status === "ready" && item.path) || [];
  const externalAudio = task.media?.externalAudio?.path ? task.media.externalAudio : null;
  if (!externalAudio && task.videoForm === "podcast" && !podcastSegments.length) {
    throw new Error("播客任务缺少 A/B 双人音频");
  }
  if (!externalAudio && !continuousAudio && task.videoForm !== "podcast" && audioSegments.length < shots.length) {
    const readyIds = new Set(audioSegments.map((item) => item.shotId));
    const missing = shots.filter((shot) => !readyIds.has(shot.id)).map((shot) => shot.id);
    throw new Error(`以下分镜缺少配音：#${missing.join("、#")}`);
  }

  const base = taskStore.taskDir(task.id);
  const draftRoot = join(base, "draft");
  await mkdir(draftRoot, { recursive: true });
  const projectName = `${sanitizeTitle(task.title)}_${randomUUID().slice(0, 8)}`;
  const projectDir = join(draftRoot, projectName);
  const imageDir = join(projectDir, "assets", "image");
  const audioDir = join(projectDir, "assets", "audio");
  const videoDir = join(projectDir, "assets", "video");
  await Promise.all([mkdir(imageDir, { recursive: true }), mkdir(audioDir, { recursive: true }), mkdir(videoDir, { recursive: true })]);
  let draftCover = "";
  const coverSource = task.media?.coverImages?.find((image) => image.status === "ready" && image.path)?.path;
  if (coverSource) {
    const extension = extname(coverSource) || ".jpg";
    const coverTarget = join(projectDir, `draft_cover${extension}`);
    await copyFile(coverSource, coverTarget);
    draftCover = basename(coverTarget);
  }

  const templateId = task.options?.draftTemplateId || "default-portrait-9-16";
  const templateDefinition = resolveDraftTemplate(templateId, task.options?.draftTemplateConfig);
  const template = templateDefinition.config;
  const { width, height } = template.canvas;
  const imageLayout = imageGeometry(template);
  const timeline = timelineInMicroseconds(normalizedTimeline(task, shots));
  const materials = emptyMaterials();
  const videoSegments = [];
  const narrationSegments = [];
  const subtitleSegments = [];
  const subtitleTimeline = [];
  const animationPool = normalizePool(template.image.animation);
  const motionPool = normalizePool(template.image.motion);
  const motionStrength = Number(template.image.motionStrength || 1);

  const copiedImageByShot = new Map();
  for (const [shotIndex, shot] of shots.entries()) {
    const image = singleImage ? firstImage : readyImages.get(shot.id);
    const dynamicVideo = singleImage ? null : readyVideos.get(shot.id);
    const item = timeline.find((entry) => entry.shotId === shot.id);
    const start = item.startUs;
    const duration = item.durationUs;
    let material;
    let sourceDuration = duration;
    if (dynamicVideo) {
      const target = await copyAsset(dynamicVideo.path, videoDir, `${shot.id}${extname(dynamicVideo.path) || ".mp4"}`);
      sourceDuration = Math.max(1, Math.round(Number(dynamicVideo.durationSec || item.durationSec) * microseconds));
      material = videoMaterial(target, sourceDuration, Number(dynamicVideo.width || width), Number(dynamicVideo.height || height), "video");
    } else {
      const existing = copiedImageByShot.get(image.path);
      const target = existing || await copyAsset(image.path, imageDir, `${shot.id}${extname(image.path) || ".png"}`);
      copiedImageByShot.set(image.path, target);
      material = videoMaterial(target, duration, Number(image.width || imageLayout.width), Number(image.height || imageLayout.height));
    }
    materials.videos.push(material);
    const speedId = id();
    materials.speeds.push({ curve_speed: null, id: speedId, mode: 0, speed: dynamicVideo ? sourceDuration / duration : null, type: "speed" });
    const crop = image?.crop || { x: 0, y: 0, scale: 1 };
    const segment = trackSegment(material.id, start, duration, "video", {
      x: imageLayout.x + Number(crop.x || 0),
      y: imageLayout.y + Number(crop.y || 0),
      scale: Number(crop.scale || 1),
      sourceDuration,
      speed: dynamicVideo ? sourceDuration / duration : null,
      volume: dynamicVideo ? 0 : 1,
      extraMaterialRefs: [speedId],
      renderIndex: 0,
    });
    const motion = motionPool.length ? motionPool[shotIndex % motionPool.length] : "";
    const motionApplied = motion ? applyMotion(segment, motion, duration, motionStrength) : false;
    if (!motionApplied && animationPool.length) {
      const animation = animationMaterial(animationPool[shotIndex % animationPool.length], duration);
      if (animation) {
        materials.material_animations.push(animation);
        segment.extra_material_refs.push(animation.id);
      }
    }
    videoSegments.push(segment);

    for (const cue of splitSubtitleTimeline(item, template.caption.maxCharsPerLine)) {
      if (!template.caption.visible) continue;
      const subtitle = textMaterial(cue.text, textLayerOptions(template.caption, {
        type: "subtitle",
        backgroundColor: template.caption.background.color,
        backgroundAlpha: template.caption.background.alpha,
        backgroundRoundRadius: template.caption.background.roundRadius,
      }));
      materials.texts.push(subtitle);
      subtitleSegments.push(trackSegment(subtitle.id, cue.startUs, cue.durationUs, "text", { x: template.caption.x, y: template.caption.y, alpha: template.caption.alpha, renderIndex: 15999 }));
      subtitleTimeline.push(cue);
    }
  }
  if (motionPool.length && videoSegments.length) {
    for (const [index, segment] of videoSegments.entries()) {
      applyEdgeFade(segment, segment.target_timerange.duration, index === 0, index === videoSegments.length - 1);
    }
  }

  const singleNarration = externalAudio || continuousAudio;
  const audioInputSegments = singleNarration
    ? [{ shotId: 0, path: singleNarration.path, startUs: 0, durationUs: timeline.at(-1)?.endUs || microseconds }]
    : task.videoForm === "podcast"
      ? podcastSegments.map((source, index) => ({ ...source, startUs: timeline[index]?.startUs, durationUs: timeline[index]?.durationUs }))
      : shots.map((shot, index) => ({
        ...audioSegments.find((source) => Number(source.shotId) === Number(shot.id)),
        startUs: timeline[index].startUs,
        durationUs: timeline[index].durationUs,
      }));
  let audioCursor = 0;
  for (const [index, source] of audioInputSegments.entries()) {
    const target = await copyAsset(source.path, audioDir, `${index + 1}${extname(source.path) || ".mp3"}`);
    const duration = Number.isFinite(source.durationUs)
      ? source.durationUs
      : Math.max(1, Math.trunc(Number(source.durationSec || textDuration(source.text)) * microseconds));
    const start = Number.isFinite(source.startUs) ? source.startUs : audioCursor;
    audioCursor = Math.max(audioCursor, start + duration);
    const material = audioMaterial(target, duration);
    materials.audios.push(material);
    const speedId = id();
    materials.speeds.push({ curve_speed: null, id: speedId, mode: 0, speed: 1, type: "speed" });
    narrationSegments.push(trackSegment(material.id, start, duration, "audio", { volume: task.options?.narrationVolume ?? template.audio.narrationVolume, extraMaterialRefs: [speedId] }));
  }

  const totalDuration = Math.max(
    timeline.at(-1)?.endUs || audioCursor || microseconds,
    ...narrationSegments.map((segment) => segment.target_timerange.start + segment.target_timerange.duration),
  );
  const frameAssets = await writeTemplateFrameAssets(template, imageDir);
  const tracks = [];
  if (frameAssets) {
    const backgroundMaterial = videoMaterial(frameAssets.backgroundPath, totalDuration, width, height);
    materials.videos.push(backgroundMaterial);
    tracks.push({ attribute: 0, flag: 0, id: id(), is_default_name: false, name: "bg_main", segments: [trackSegment(backgroundMaterial.id, 0, totalDuration, "video", { renderIndex: 0 })], type: "video" });
    for (const segment of videoSegments) segment.render_index = 1;
  }
  tracks.push(
    { attribute: 0, flag: 0, id: id(), is_default_name: false, name: "image_main", segments: videoSegments, type: "video" },
    { attribute: 0, flag: 0, id: id(), is_default_name: false, name: "audio_main", segments: narrationSegments, type: "audio" },
  );
  if (frameAssets) {
    if (frameAssets.topPath) {
      const material = videoMaterial(frameAssets.topPath, totalDuration, width, frameAssets.topHeight);
      materials.videos.push(material);
      tracks.push({
        attribute: 0,
        flag: 0,
        id: id(),
        is_default_name: false,
        name: "mask_top",
        segments: [trackSegment(material.id, 0, totalDuration, "video", {
          y: 1 - frameAssets.topHeight / height,
          renderIndex: 2,
        })],
        type: "video",
      });
    }
    if (frameAssets.bottomPath) {
      const material = videoMaterial(frameAssets.bottomPath, totalDuration, width, frameAssets.bottomHeight);
      materials.videos.push(material);
      tracks.push({
        attribute: 0,
        flag: 0,
        id: id(),
        is_default_name: false,
        name: "mask_bottom",
        segments: [trackSegment(material.id, 0, totalDuration, "video", {
          y: -(1 - frameAssets.bottomHeight / height),
          renderIndex: 2,
        })],
        type: "video",
      });
    }
  }

  const titleText = task.artifacts?.rewrite?.title || task.title;
  if (template.title.visible && titleText) {
    const material = textMaterial(titleText, textLayerOptions(template.title, {
      fontSize: fittedFontSize(template.title.fontSize, titleText, 200, 14),
    }));
    materials.texts.push(material);
    tracks.push({
      attribute: 0,
      flag: 0,
      id: id(),
      is_default_name: false,
      name: "cover_title",
      segments: [trackSegment(material.id, 0, totalDuration, "text", { x: template.title.x, y: template.title.y, alpha: coverSource ? 0 : template.title.alpha, renderIndex: 15000 })],
      type: "text",
    });
  }

  const subtitleText = Array.isArray(task.artifacts?.rewrite?.subtitle)
    ? task.artifacts.rewrite.subtitle.filter(Boolean).slice(0, 2).join("\n")
    : "";
  if (template.subtitle.visible && subtitleText) {
    const material = textMaterial(subtitleText, textLayerOptions(template.subtitle, {
      fontSize: fittedFontSize(template.subtitle.fontSize, subtitleText, 168, 8),
    }));
    materials.texts.push(material);
    tracks.push({
      attribute: 0,
      flag: 0,
      id: id(),
      is_default_name: false,
      name: "cover_subtitle",
      segments: [trackSegment(material.id, 0, totalDuration, "text", { x: template.subtitle.x, y: template.subtitle.y, alpha: coverSource ? 0 : template.subtitle.alpha, renderIndex: 15000 })],
      type: "text",
    });
  }

  if (template.disclaimer.visible && template.disclaimer.text) {
    const material = textMaterial(template.disclaimer.text, textLayerOptions(template.disclaimer, {
      globalAlpha: template.disclaimer.alpha,
    }));
    materials.texts.push(material);
    tracks.push({
      attribute: 0,
      flag: 0,
      id: id(),
      is_default_name: false,
      name: "cover_disclaimer",
      segments: [trackSegment(material.id, 0, totalDuration, "text", { x: template.disclaimer.x, y: template.disclaimer.y, alpha: template.disclaimer.alpha, renderIndex: 15000 })],
      type: "text",
    });
  }

  if (template.caption.visible && subtitleSegments.length) {
    tracks.push({ attribute: 0, flag: 0, id: id(), is_default_name: false, name: "subtitle", segments: subtitleSegments, type: "text" });
  }

  if (coverSource) {
    const coverTarget = await copyAsset(coverSource, imageDir, `cover${extname(coverSource) || ".png"}`);
    const coverMaterial = videoMaterial(coverTarget, 33_334, width, height);
    const speedId = id();
    materials.videos.push(coverMaterial);
    materials.speeds.push({ curve_speed: null, id: speedId, mode: 0, speed: null, type: "speed" });
    tracks.push({
      attribute: 0,
      flag: 0,
      id: id(),
      is_default_name: false,
      name: "cover_frame",
      segments: [trackSegment(coverMaterial.id, 0, 33_334, "video", {
        sourceDuration: 33_334,
        extraMaterialRefs: [speedId],
        renderIndex: 20_000,
      })],
      type: "video",
    });
  }

  if (task.media?.bgm?.path) {
    const prepared = await prepareBgm(task.media.bgm.path, audioDir, totalDuration, template.audio.bgmFadeOutMs);
    const material = audioMaterial(prepared.path, totalDuration);
    materials.audios.push(material);
    const speedId = id();
    materials.speeds.push({ curve_speed: null, id: speedId, mode: 0, speed: 1, type: "speed" });
    const segments = [trackSegment(material.id, 0, totalDuration, "audio", {
      volume: task.options?.bgmVolume ?? template.audio.bgmVolume,
      sourceDuration: totalDuration,
      extraMaterialRefs: [speedId],
    })];
    tracks.push({
      attribute: 0,
      flag: 0,
      id: id(),
      is_default_name: false,
      name: "bgm",
      segments,
      type: "audio",
    });
  }

  const platform = {
    app_id: 359289,
    app_source: "cc",
    app_version: "6.5.0",
    device_id: createHash("md5").update(task.id).digest("hex"),
    hard_disk_id: createHash("md5").update(projectDir).digest("hex"),
    mac_address: "",
    os: "windows",
    os_version: process.getSystemVersion?.() || "10",
  };
  const draftInfo = {
    canvas_config: { width, height, ratio: "original" },
    color_space: 0,
    config: {
      adjust_max_index: 1,
      attachment_info: [],
      combination_max_index: 1,
      export_range: null,
      extract_audio_last_index: 1,
      lyrics_recognition_id: "",
      lyrics_sync: true,
      lyrics_taskinfo: [],
      maintrack_adsorb: true,
      material_save_mode: 0,
      multi_language_current: "none",
      multi_language_list: [],
      multi_language_main: "none",
      multi_language_mode: "none",
      original_sound_last_index: 1,
      record_audio_last_index: 1,
      sticker_max_index: 1,
      subtitle_keywords_config: null,
      subtitle_recognition_id: "",
      subtitle_sync: true,
      subtitle_taskinfo: [],
      system_font_list: [],
      video_mute: false,
      zoom_info_params: null,
    },
    cover: null,
    create_time: 0,
    duration: totalDuration,
    extra_info: null,
    fps: 30,
    free_render_index_mode_on: false,
    group_container: null,
    id: capcutId(),
    keyframe_graph_list: [],
    keyframes: { adjusts: [], audios: [], effects: [], filters: [], handwrites: [], stickers: [], texts: [], videos: [] },
    last_modified_platform: platform,
    materials,
    mutable_config: null,
    name: "",
    new_version: "110.0.0",
    relationships: [],
    render_index_track_mode_on: true,
    retouch_cover: null,
    source: "default",
    static_cover_image_path: "",
    time_marks: null,
    tracks,
    update_time: 0,
    version: 360000,
    platform,
  };
  const timestamp = Date.now() * 1000;
  const draftMeta = {
    cloud_package_completed_time: "",
    draft_cloud_capcut_purchase_info: "",
    draft_cloud_last_action_download: false,
    draft_cloud_materials: [],
    draft_cloud_purchase_info: "",
    draft_cloud_template_id: "",
    draft_cloud_tutorial_info: "",
    draft_cloud_videocut_purchase_info: "",
    draft_cover: draftCover,
    draft_deeplink_url: "",
    draft_enterprise_info: { draft_enterprise_extra: "", draft_enterprise_id: "", draft_enterprise_name: "", enterprise_material: [] },
    draft_fold_path: draftRoot,
    draft_id: capcutId(),
    draft_is_ai_packaging_used: false,
    draft_is_ai_shorts: false,
    draft_is_ai_translate: false,
    draft_is_article_video_draft: false,
    draft_is_from_deeplink: "false",
    draft_is_invisible: false,
    draft_materials: [0, 1, 2, 3, 6, 7, 8].map((type) => ({ type, value: [] })),
    draft_materials_copied_info: [],
    draft_name: projectName,
    draft_new_version: "",
    draft_removable_storage_device: "",
    draft_root_path: draftRoot,
    draft_segment_extra_info: [],
    draft_timeline_materials_size_: materials.videos.length + materials.audios.length + materials.texts.length,
    draft_type: "",
    tm_draft_cloud_completed: "",
    tm_draft_cloud_modified: 0,
    tm_draft_create: timestamp,
    tm_draft_modified: timestamp,
    tm_draft_removed: 0,
    tm_duration: totalDuration,
  };

  await Promise.all([
    writeFile(join(projectDir, "draft_info.json"), `${JSON.stringify(draftInfo, null, 2)}\n`, "utf8"),
    writeFile(join(projectDir, "draft_info.json.bak"), `${JSON.stringify(draftInfo, null, 2)}\n`, "utf8"),
    writeFile(join(projectDir, "draft_meta_info.json"), `${JSON.stringify(draftMeta, null, 2)}\n`, "utf8"),
    writeFile(join(projectDir, "draft_settings"), "{}\n", "utf8"),
    writeFile(join(projectDir, "draft_biz_config.json"), "{}\n", "utf8"),
    writeFile(join(projectDir, "draft_agency_config.json"), "{}\n", "utf8"),
    writeFile(join(projectDir, "attachment_pc_common.json"), "{}\n", "utf8"),
    writeFile(join(projectDir, "timeline.srt"), buildSrt(subtitleTimeline), "utf8"),
    writeFile(join(projectDir, "storybound-manifest.json"), `${JSON.stringify({
      schemaVersion: 2,
      taskId: task.id,
      taskTitle: task.title,
      generatedAt: new Date().toISOString(),
      durationSec: totalDuration / microseconds,
      shots: timeline,
      trackCount: tracks.length,
      templateId,
      aiCover: Boolean(coverSource),
      dynamicVideoShots: [...readyVideos.keys()],
      animationPool,
      motionPool,
      sourceVersion: "Storybound 1.13.1 compatible",
    }, null, 2)}\n`, "utf8"),
  ]);
  const zipPath = join(base, "draft.zip");
  const zip = await writeStoredZip(projectDir, zipPath);
  const oldProject = task.draft?.projectDir ? resolve(task.draft.projectDir) : "";
  const safeDraftRoot = resolve(draftRoot).toLowerCase();
  if (oldProject && oldProject !== resolve(projectDir) && oldProject.toLowerCase().startsWith(`${safeDraftRoot}\\`)) {
    await rm(oldProject, { recursive: true, force: true }).catch(() => undefined);
  }
  return {
    ready: true,
    projectName,
    projectDir,
    zipPath,
    zipUrl: `/api/tasks/${encodeURIComponent(task.id)}/draft.zip`,
    durationSec: totalDuration / microseconds,
    trackCount: tracks.length,
    fileCount: zip.fileCount,
    bytes: zip.bytes,
    missing: [],
    generatedAt: new Date().toISOString(),
  };
}
