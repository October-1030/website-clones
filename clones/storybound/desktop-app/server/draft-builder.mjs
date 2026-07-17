import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

import { writeStoredZip } from "./zip-store.mjs";

const microseconds = 1_000_000;

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

function textMaterial(text, options = {}) {
  const materialId = id();
  const fontSize = options.fontSize ?? 12;
  const content = {
    styles: [{
      fill: { alpha: 1, content: { render_type: "solid", solid: { alpha: 1, color: colorFromHex(options.color) } } },
      range: [0, String(text).length],
      size: fontSize,
      bold: Boolean(options.bold),
      italic: false,
      underline: Boolean(options.underline),
      strokes: [{ content: { solid: { alpha: options.strokeAlpha ?? 0.72, color: [0, 0, 0] } }, width: options.strokeWidth ?? 0.08 }],
    }],
    text: String(text).replace(/[。！？!?]$/, ""),
  };
  return {
    id: materialId,
    content: JSON.stringify(content),
    typesetting: 0,
    alignment: options.alignment ?? 1,
    letter_spacing: options.letterSpacing ?? 0,
    line_spacing: 0.02,
    line_feed: 1,
    line_max_width: options.maxWidth ?? 0.86,
    force_apply_line_max_width: false,
    check_flag: options.type === "subtitle" ? 31 : 15,
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
    ...(options.type === "subtitle" ? {
      background_style: 0,
      background_color: options.backgroundColor || "#000000",
      background_alpha: options.backgroundAlpha ?? 0.5,
      background_round_radius: 0.3,
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
    common_keyframes: [],
    keyframe_refs: [],
    source_timerange: type === "text" ? null : { start: options.sourceStart || 0, duration },
    speed: type === "video" ? null : 1,
    volume: type === "audio" ? options.volume ?? 10 : 1,
    extra_material_refs: options.extraMaterialRefs || [],
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

function videoMaterial(file, duration, width, height) {
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
    duration: Math.max(duration, 10_800 * microseconds),
    height,
    id: materialId,
    local_material_id: "",
    material_id: materialId,
    material_name: basename(file),
    media_path: "",
    path: file,
    remote_url: null,
    type: "photo",
    width,
  };
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
  function time(value) {
    const milliseconds = Math.max(0, Math.round(value * 1000));
    const hours = Math.floor(milliseconds / 3_600_000);
    const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
    const seconds = Math.floor((milliseconds % 60_000) / 1000);
    const remainder = milliseconds % 1000;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(remainder).padStart(3, "0")}`;
  }
  return `${timeline.map((item, index) => `${index + 1}\n${time(item.startSec)} --> ${time(item.endSec)}\n${item.text}`).join("\n\n")}\n`;
}

export async function buildJianyingDraft(taskStore, task) {
  const shots = resolveShots(task);
  if (!shots.length) throw new Error("没有分镜，无法生成剪映草稿");
  const readyImages = new Map((task.media?.images || []).filter((item) => item.status === "ready" && item.path).map((item) => [item.shotId, item]));
  const firstImage = [...readyImages.values()][0];
  const singleImage = task.videoForm === "podcast" && task.options?.podcastImageMode === "single";
  const missingImages = singleImage
    ? (firstImage ? [] : [shots[0].id])
    : shots.filter((shot) => !readyImages.has(shot.id)).map((shot) => shot.id);
  if (missingImages.length) throw new Error(`以下分镜缺少图片：#${missingImages.join("、#")}`);

  const audioSegments = (task.media?.audioSegments || []).filter((item) => item.status === "ready" && item.path);
  const podcastSegments = task.media?.podcast?.segments?.filter((item) => item.status === "ready" && item.path) || [];
  const externalAudio = task.media?.externalAudio?.path ? task.media.externalAudio : null;
  if (!externalAudio && task.videoForm === "podcast" && !podcastSegments.length) {
    throw new Error("播客任务缺少 A/B 双人音频");
  }
  if (!externalAudio && task.videoForm !== "podcast" && audioSegments.length < shots.length) {
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
  await Promise.all([mkdir(imageDir, { recursive: true }), mkdir(audioDir, { recursive: true })]);
  let draftCover = "";
  const coverSource = task.media?.coverImages?.find((image) => image.status === "ready" && image.path)?.path;
  if (coverSource) {
    const extension = extname(coverSource) || ".jpg";
    const coverTarget = join(projectDir, `draft_cover${extension}`);
    await copyFile(coverSource, coverTarget);
    draftCover = basename(coverTarget);
  }

  const templateId = task.options?.draftTemplateId || "default-portrait-9-16";
  const ratio = task.aspectRatio || "9:16";
  const selectedSize = templateId === "builtin-portrait-4-3"
    ? [1080, 1440]
    : templateId === "builtin-landscape-16-9"
      ? [1920, 1080]
      : ratio === "16:9" ? [1920, 1080] : ratio === "1:1" ? [1080, 1080] : ratio === "4:3" ? [1440, 1080] : ratio === "3:4" ? [1080, 1440] : [1080, 1920];
  const [width, height] = selectedSize;
  const template = templateId === "builtin-knowledge-card"
    ? { subtitleY: -0.12, subtitleSize: 10, titleY: 0.28, titleSize: 22, subtitleColor: "#FFFFFF" }
    : templateId === "builtin-landscape-16-9"
      ? { subtitleY: -0.32, subtitleSize: 10, titleY: 0.24, titleSize: 21, subtitleColor: "#FFDE00" }
      : { subtitleY: -0.215, subtitleSize: 12, titleY: 0.047, titleSize: 25, subtitleColor: "#FFDE00" };
  const timeline = normalizedTimeline(task, shots);
  const materials = emptyMaterials();
  const videoSegments = [];
  const narrationSegments = [];
  const subtitleSegments = [];
  const animationRefs = [];
  const speedRefs = [];

  const copiedImageByShot = new Map();
  for (const shot of shots) {
    const image = singleImage ? firstImage : readyImages.get(shot.id);
    const existing = copiedImageByShot.get(image.path);
    const target = existing || await copyAsset(image.path, imageDir, `${shot.id}${extname(image.path) || ".png"}`);
    copiedImageByShot.set(image.path, target);
    const item = timeline.find((entry) => entry.shotId === shot.id);
    const start = Math.round(item.startSec * microseconds);
    const duration = Math.round(item.durationSec * microseconds);
    const material = videoMaterial(target, duration, width, height);
    materials.videos.push(material);
    const speedId = id();
    const animationId = id();
    materials.speeds.push({ curve_speed: null, id: speedId, mode: 0, speed: null, type: "speed" });
    materials.material_animations.push({
      id: animationId,
      type: "sticker_animation",
      multi_language_current: "none",
      animations: [{ anim_adjust_params: null, platform: "all", panel: "video", material_type: "video", name: "缩放", id: "446078", type: "group", resource_id: "6759078592740594184", start: 0, duration }],
    });
    speedRefs.push(speedId);
    animationRefs.push(animationId);
    const crop = image.crop || { x: 0, y: 0, scale: 1 };
    videoSegments.push(trackSegment(material.id, start, duration, "video", { x: crop.x, y: crop.y, scale: crop.scale, extraMaterialRefs: [speedId, animationId] }));

    const subtitle = textMaterial(shot.text, { type: "subtitle", color: template.subtitleColor, fontSize: template.subtitleSize });
    materials.texts.push(subtitle);
    subtitleSegments.push(trackSegment(subtitle.id, start, duration, "text", { y: template.subtitleY, renderIndex: 15999 }));
  }

  const audioInputSegments = externalAudio
    ? [{ shotId: 0, path: externalAudio.path, durationSec: timeline.at(-1)?.endSec || 1, startSec: 0 }]
    : task.videoForm === "podcast" ? podcastSegments : audioSegments;
  let audioCursor = 0;
  for (const [index, source] of audioInputSegments.entries()) {
    const target = await copyAsset(source.path, audioDir, `${index + 1}${extname(source.path) || ".mp3"}`);
    const durationSec = Number(source.durationSec || textDuration(source.text));
    const startSec = Number.isFinite(source.startSec) ? source.startSec : audioCursor;
    audioCursor = Math.max(audioCursor, startSec + durationSec);
    const duration = Math.round(durationSec * microseconds);
    const material = audioMaterial(target, duration);
    materials.audios.push(material);
    const speedId = id();
    materials.speeds.push({ curve_speed: null, id: speedId, mode: 0, speed: 1, type: "speed" });
    narrationSegments.push(trackSegment(material.id, Math.round(startSec * microseconds), duration, "audio", { volume: task.options?.narrationVolume ?? 10, extraMaterialRefs: [speedId] }));
  }

  const totalDuration = Math.max(
    Math.round((timeline.at(-1)?.endSec || audioCursor || 1) * microseconds),
    ...narrationSegments.map((segment) => segment.target_timerange.start + segment.target_timerange.duration),
  );
  const tracks = [
    { attribute: 0, flag: 0, id: id(), is_default_name: false, name: "image_main", segments: videoSegments, type: "video" },
    { attribute: 0, flag: 0, id: id(), is_default_name: false, name: "audio_main", segments: narrationSegments, type: "audio" },
    { attribute: 0, flag: 0, id: id(), is_default_name: false, name: "subtitle", segments: subtitleSegments, type: "text" },
  ];

  const titleText = task.artifacts?.rewrite?.title || task.title;
  if (titleText) {
    const material = textMaterial(titleText, { color: "#FFDE00", fontSize: template.titleSize, bold: true, underline: true });
    materials.texts.push(material);
    tracks.push({
      attribute: 0,
      flag: 0,
      id: id(),
      is_default_name: false,
      name: "cover_title",
      segments: [trackSegment(material.id, 0, totalDuration, "text", { y: template.titleY, renderIndex: 15000 })],
      type: "text",
    });
  }

  if (task.media?.bgm?.path) {
    const target = await copyAsset(task.media.bgm.path, audioDir, `bgm${extname(task.media.bgm.path) || ".mp3"}`);
    const sourceDuration = Math.round(Math.max(0.3, Number(task.media.bgm.durationSec || totalDuration / microseconds)) * microseconds);
    const material = audioMaterial(target, sourceDuration);
    materials.audios.push(material);
    const segments = [];
    let bgmCursor = 0;
    while (bgmCursor < totalDuration) {
      const duration = task.options?.bgmSync ? Math.min(sourceDuration, totalDuration - bgmCursor) : totalDuration - bgmCursor;
      segments.push(trackSegment(material.id, bgmCursor, duration, "audio", { volume: task.options?.bgmVolume ?? 3 }));
      bgmCursor += duration;
      if (!task.options?.bgmSync || sourceDuration <= 0) break;
    }
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
    writeFile(join(projectDir, "timeline.srt"), buildSrt(timeline), "utf8"),
    writeFile(join(projectDir, "storybound-manifest.json"), `${JSON.stringify({
      schemaVersion: 1,
      taskId: task.id,
      taskTitle: task.title,
      generatedAt: new Date().toISOString(),
      durationSec: totalDuration / microseconds,
      shots: timeline,
      trackCount: tracks.length,
      sourceVersion: "Storybound 1.13.1 compatible",
    }, null, 2)}\n`, "utf8"),
  ]);
  const zipPath = join(base, "draft.zip");
  const zip = await writeStoredZip(projectDir, zipPath);
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
