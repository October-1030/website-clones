import { randomUUID } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const taskId = randomUUID();
const longSubtitle = "第一句测试字幕需要自动拆成适合手机阅读的短句，不能整段铺满屏幕。";

function silentWav(seconds = 2, sampleRate = 8000) {
  const samples = seconds * sampleRate;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
  return response;
}

async function json(path, init) {
  return request(path, init).then((response) => response.json());
}

async function upload(fileName, kind, buffer) {
  const payload = await json(`/api/tasks/${taskId}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, kind, base64: buffer.toString("base64") }),
  });
  return payload.asset;
}

let created = false;
try {
  await json("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: taskId,
      title: "Storybound 草稿闭环测试",
      inputText: `${longSubtitle}第二句测试字幕。`,
      mode: "direct",
      videoForm: "narration",
      track: "通用故事",
      visualStyle: "现代电影",
      aspectRatio: "9:16",
      status: "paused",
      runState: "paused",
      currentStep: 6,
      stepStatuses: ["skipped", "skipped", "done", "done", "done", "done", "pending"],
      options: { draftTemplateId: "default-portrait-9-16", dynamicStoryboard: true, videoIntro: true, videoIntroCount: 1, videoIntroDurationMode: "fixed", videoIntroDuration: 1 },
      artifacts: {
        rewrite: { title: "测试片头标题", subtitle: ["第一行副标题", "第二行副标题"], narration: `${longSubtitle}第二句测试字幕。`, tags: [], pinnedComment: "", comments: [], publishCopy: "", summary: "" },
        storyboard: { shots: [
          { id: 1, text: longSubtitle, visual: "夜晚城市", emotion: "安静", durationSec: 2 },
          { id: 2, text: "第二句测试字幕。", visual: "清晨窗边", emotion: "温暖", durationSec: 2 },
        ] },
        prompts: { templateVersion: "Storybound 1.13.1", prompts: [
          { shotId: 1, prompt: "夜晚城市", negativePrompt: "水印" },
          { shotId: 2, prompt: "清晨窗边", negativePrompt: "水印" },
        ] },
      },
    }),
  });
  created = true;
  const [image1, image2, cover, video1, audio1, audio2] = await Promise.all([
    upload("1.png", "images", png),
    upload("2.png", "images", png),
    upload("cover.png", "images", png),
    upload("1.mp4", "videos", Buffer.from("storybound-smoke-video")),
    upload("1.wav", "audio", silentWav()),
    upload("2.wav", "audio", silentWav()),
  ]);
  if (Math.abs(Number(audio1.durationSec) - 2) > 0.05 || Math.abs(Number(audio2.durationSec) - 2) > 0.05) {
    throw new Error(`音频真实时长探测失败：${audio1.durationSec}, ${audio2.durationSec}`);
  }
  const patch = {
    media: {
      images: [
        { id: "image-1", shotId: 1, prompt: "夜晚城市", status: "ready", crop: { x: 0.1, y: -0.05, scale: 1.2 }, ...image1 },
        { id: "image-2", shotId: 2, prompt: "清晨窗边", status: "ready", ...image2 },
      ],
      videos: [{ id: "video-1", shotId: 1, status: "ready", durationSec: 1, ...video1 }],
      coverImages: [{ id: "cover-1", shotId: 0, prompt: "测试封面", status: "ready", ...cover }],
      audioSegments: [
        { id: "audio-1", shotId: 1, text: longSubtitle, voiceId: "smoke", durationSec: 2, status: "ready", ...audio1 },
        { id: "audio-2", shotId: 2, text: "第二句测试字幕。", voiceId: "smoke", durationSec: 2, status: "ready", ...audio2 },
      ],
      podcast: null,
      externalAudio: null,
      bgm: audio1,
    },
  };
  await json(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  const result = await json(`/api/tasks/${taskId}/draft`, { method: "POST" });
  if (!result.draft?.ready || result.draft.trackCount < 3 || result.draft.fileCount < 8) throw new Error("草稿产物不完整");
  const [imageFiles, audioFiles] = await Promise.all([
    readdir(join(result.draft.projectDir, "assets", "image")),
    readdir(join(result.draft.projectDir, "assets", "audio")),
  ]);
  if (!imageFiles.every((file) => file.endsWith(".png"))) throw new Error(`图片扩展名丢失：${imageFiles.join(", ")}`);
  if (!audioFiles.includes("1.wav") || !audioFiles.includes("2.wav") || !audioFiles.includes("bgm.mp3")) throw new Error(`音频素材不完整：${audioFiles.join(", ")}`);
  const draftInfo = JSON.parse(await readFile(join(result.draft.projectDir, "draft_info.json"), "utf8"));
  const firstImageSegment = draftInfo.tracks?.find((track) => track.name === "image_main")?.segments?.[0];
  if (firstImageSegment?.clip?.transform?.x !== 0.1 || firstImageSegment?.clip?.scale?.x !== 1.2) throw new Error("图片裁切参数未写入剪映草稿");
  const firstVisualMaterial = draftInfo.materials?.videos?.find((item) => item.id === firstImageSegment?.material_id);
  if (firstVisualMaterial?.type !== "video" || firstImageSegment?.source_timerange?.duration !== 1_000_000 || Math.abs(firstImageSegment.speed - 0.5) > 0.0001 || firstImageSegment.volume !== 0) {
    throw new Error("动态视频没有按原版以源时长/配音时长变速并静音");
  }
  const subtitleTrack = draftInfo.tracks?.find((track) => track.name === "subtitle");
  const textById = new Map((draftInfo.materials?.texts || []).map((item) => [item.id, JSON.parse(item.content).text]));
  const subtitleTexts = (subtitleTrack?.segments || []).map((segment) => textById.get(segment.material_id) || "");
  if (subtitleTexts.length <= 2 || subtitleTexts.some((text) => [...text.replace(/\s/g, "")].length > 12 || /[，,。！？!?；;：:、]/.test(text))) {
    throw new Error(`长字幕未正确拆分：${subtitleTexts.join(" | ")}`);
  }
  const firstCaptionMaterial = draftInfo.materials?.texts?.find((item) => item.id === subtitleTrack?.segments?.[0]?.material_id);
  const firstCaptionStyle = firstCaptionMaterial && JSON.parse(firstCaptionMaterial.content).styles?.[0];
  if (!firstCaptionMaterial || firstCaptionMaterial.background_alpha !== 0.5 || firstCaptionMaterial.font_size !== 15 || firstCaptionMaterial.line_max_width !== 1 || firstCaptionStyle?.size !== 12 || firstCaptionStyle?.strokes?.length !== 1) {
    throw new Error("默认模板没有按原版 subtitle 素材结构写入");
  }
  const disclaimerTrack = draftInfo.tracks?.find((track) => track.name === "cover_disclaimer");
  if (!disclaimerTrack || disclaimerTrack.segments?.[0]?.target_timerange?.duration !== draftInfo.duration) throw new Error("免责声明轨未覆盖完整时间线");
  for (const trackName of ["cover_title", "cover_subtitle"]) {
    const track = draftInfo.tracks?.find((item) => item.name === trackName);
    if (!track || track.segments?.[0]?.target_timerange?.duration !== draftInfo.duration || track.segments?.[0]?.render_index !== 15000 || track.segments?.[0]?.clip?.alpha !== 0) {
      throw new Error(`${trackName} 没有按原版覆盖完整时间线`);
    }
  }
  const coverFrame = draftInfo.tracks?.find((track) => track.name === "cover_frame")?.segments?.[0];
  if (coverFrame?.target_timerange?.duration !== 33_334 || coverFrame?.render_index !== 20_000) throw new Error("AI 封面没有写入原版一帧封面轨");
  if (draftInfo.materials?.canvases?.length) throw new Error("原版默认草稿不应额外写入 canvas 素材");
  const bgmTrack = draftInfo.tracks?.find((track) => track.name === "bgm");
  if (draftInfo.materials?.audio_fades?.length || bgmTrack?.segments?.length !== 1 || bgmTrack.segments[0].target_timerange.duration !== draftInfo.duration) throw new Error("BGM 未按原版预混为等长单轨");
  const firstProjectDir = result.draft.projectDir;

  await json(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ options: { draftTemplateId: "builtin-knowledge-card", dynamicStoryboard: true, videoIntro: true, draftTemplateConfig: { image: { motion: ["zoom_in", "pan_left"], motionStrength: 1.5 } } } }),
  });
  const frameResult = await json(`/api/tasks/${taskId}/draft`, { method: "POST" });
  const frameDraftInfo = JSON.parse(await readFile(join(frameResult.draft.projectDir, "draft_info.json"), "utf8"));
  if (frameDraftInfo.canvas_config?.width !== 1080 || frameDraftInfo.canvas_config?.height !== 1920) throw new Error("知识卡画布尺寸错误");
  for (const trackName of ["bg_main", "mask_top", "mask_bottom"]) {
    if (!frameDraftInfo.tracks?.some((track) => track.name === trackName)) throw new Error(`知识卡缺少 ${trackName}`);
  }
  if (frameDraftInfo.materials?.material_animations?.length) throw new Error("运镜开启后不应继续写动画素材");
  const motionSegments = frameDraftInfo.tracks?.find((track) => track.name === "image_main")?.segments || [];
  if (!motionSegments[0]?.common_keyframes?.some((item) => item.property_type === "KFTypeScaleX") || !motionSegments[0]?.common_keyframes?.some((item) => item.property_type === "KFTypeAlpha") || !motionSegments[1]?.common_keyframes?.some((item) => item.property_type === "KFTypePositionX")) {
    throw new Error("运镜或首尾淡入淡出关键帧未按原版写入");
  }
  if (frameDraftInfo.tracks?.some((track) => track.name === "cover_disclaimer")) throw new Error("知识卡模板应关闭免责声明");
  let oldDraftExists = true;
  try { await access(firstProjectDir); } catch { oldDraftExists = false; }
  if (oldDraftExists) throw new Error("新草稿落地后没有清理旧草稿目录");
  const zip = Buffer.from(await (await request(`/api/tasks/${taskId}/draft.zip`)).arrayBuffer());
  if (zip.subarray(0, 2).toString("ascii") !== "PK") throw new Error("下载结果不是 ZIP");
  process.stdout.write(JSON.stringify({ ok: true, taskId, projectName: result.draft.projectName, tracks: result.draft.trackCount, files: result.draft.fileCount, zipBytes: zip.length }) + "\n");
} finally {
  if (created && process.env.KEEP_TASK !== "1") await request(`/api/tasks/${taskId}`, { method: "DELETE" }).catch(() => undefined);
}
