import { randomUUID } from "node:crypto";

const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const sourceTaskId = process.argv[2] || "de33bf73-94a8-4520-8535-eb8c1bdd8218";
const targetScenes = Number(process.argv[3] || 12);
const resumeTaskId = process.argv[4] || process.env.RESUME_TASK_ID || "";
const forceCover = process.argv[5] === "force-cover";

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${path} failed (${response.status}): ${body}`);
  }
  return response.json();
}

function pipelineContext(task) {
  return {
    title: task.title,
    inputText: task.inputText,
    track: task.track,
    videoForm: task.videoForm,
    visualStyle: task.visualStyle,
    aspectRatio: task.aspectRatio,
    sourceMode: task.sourceMode,
    rewriteIntensity: task.options.rewriteIntensity,
    narrativePov: task.options.narrativePov,
    targetLength: task.options.targetLength,
    targetScenes,
    fixedIntro: task.options.fixedIntro,
    outroCta: task.options.outroCta,
  };
}

function buildCinematicCoverPrompt(task, prompts) {
  const title = String(task.artifacts.rewrite?.title || task.title).trim();
  const subtitles = (task.artifacts.rewrite?.subtitle || []).map((item) => String(item).trim()).filter(Boolean);
  const cleanScenePrompt = String(prompts[0]?.prompt || "怀表、深夜、悬疑氛围的高完成度短视频封面")
    .replace(/。画面中避免出现[:：][\s\S]*$/u, "")
    .trim();
  const subtitleText = subtitles.length
    ? `；主标题正下方排副标题${subtitles.map((item) => `「${item}」`).join("")}（每句一行居中，字号约为主标题的二分之一，必须足够醒目，手机信息流缩略图下也清晰可读，严禁小到看不清；字体设计与主标题协调统一，白字配深色描边或半透明色带衬底）`
    : "";
  return {
    shotId: 9001,
    prompt: `爆款海报构图法（区别于叙事分镜）：主体醒目且为画面最亮处，背景可用与主题相关的元素虚化环绕，整体色调统一、明暗层次分明，中部留出相对干净或可压暗的区域。${task.visualStyle}，主题：${title}，${cleanScenePrompt}。整体按电影海报式排版：主标题「${title}」以超大号、粗壮有力的中文艺术字水平横排在画面正中央（垂直方向居中）的视觉焦点位置，严禁竖排、竖向排列或逐字错位斜排，所有字必须在同一水平行上从左到右排列；严禁贴着画面顶部边缘，标题上方必须留出约四分之一画面高度的画面内容；字色与背景强对比，可用白字配深色描边或暖金色大字${subtitleText}；文字区域背景做轻微压暗或半透明渐变衬底处理保证文字浮出可读；所有文字必须与提供的文案完全一致，笔画完整、清晰可读、无错字、不变形、不增减字。画面中避免出现：水印、品牌标志、低清晰度、畸形人物、除指定标题与副标题外的多余文字、错别字、漏字、文字变形`,
    negativePrompt: "水印，品牌标志，低清晰度，畸形人物，除指定标题与副标题外的多余文字，错别字，漏字，文字变形",
  };
}

function assetHeader(response, name) {
  const value = response.headers.get(name) || "";
  return decodeURIComponent(value);
}

async function synthesize(taskId, task, shot, index) {
  const response = await fetch(`${baseUrl}/api/tts/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "minimax",
      text: shot.text,
      voiceId: task.options.ttsVoiceId || "Chinese (Mandarin)_Reliable_Executive",
      speed: Number(task.options.ttsSpeed || 1),
      config: { apiKey: "", model: "speech-2.8-hd" },
      taskId,
      shotId: shot.id,
      fileName: `${shot.id}.mp3`,
    }),
  });
  if (!response.ok) throw new Error(`TTS ${shot.id} failed: ${await response.text()}`);
  await response.arrayBuffer();
  const durationSec = Number(response.headers.get("X-TTS-Duration") || shot.durationSec || 1);
  const segment = {
    id: `audio-N-${shot.id}-${Date.now()}-${index}`,
    shotId: shot.id,
    text: shot.text,
    voiceId: task.options.ttsVoiceId || "Chinese (Mandarin)_Reliable_Executive",
    fileName: assetHeader(response, "X-Asset-File"),
    path: assetHeader(response, "X-Asset-Path"),
    url: assetHeader(response, "X-Asset-Url"),
    bytes: Number(response.headers.get("Content-Length") || 0),
    durationSec,
    status: "ready",
  };
  process.stdout.write(`TTS ${index + 1}/${task.artifacts.storyboard.shots.length}: ${durationSec.toFixed(2)}s\n`);
  return segment;
}

async function main() {
  let task;
  if (resumeTaskId) {
    task = (await requestJson(`/api/tasks/${encodeURIComponent(resumeTaskId)}`)).task;
    process.stdout.write(`RESUME ${task.id}\n`);
  } else {
    const sourcePayload = await requestJson(`/api/tasks/${encodeURIComponent(sourceTaskId)}`);
    const source = sourcePayload.task;
    const newId = randomUUID();
    task = (await requestJson("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        ...source,
        id: newId,
        title: `${source.title}（完整复刻测试版）`,
        status: "running",
        runState: "running",
        currentStep: 2,
        stepStatuses: ["done", "done", "running", "pending", "pending", "pending", "pending"],
        options: { ...source.options, targetScenes, dynamicStoryboard: false, dynamicShotCount: 0, draftTemplateId: "default-portrait-9-16", coverMode: "titled", coverTemplateId: "cinematic-poster", coverRatio: "3:4" },
        artifacts: { precheck: source.artifacts.precheck, rewrite: source.artifacts.rewrite },
        media: { images: [], videos: [], coverImages: [], audioSegments: [], podcast: null, externalAudio: null, bgm: null, timeline: [] },
        draft: null,
        error: null,
        createdAt: undefined,
        updatedAt: undefined,
        completedAt: null,
      }),
    })).task;
    process.stdout.write(`TASK ${task.id}\n`);
  }

  if (!task.artifacts.storyboard?.shots?.length) {
    const storyboardResult = await requestJson("/api/llm/pipeline", {
      method: "POST",
      body: JSON.stringify({ step: "storyboard", config: { provider: "minimax", apiKey: "" }, context: pipelineContext(task), artifacts: task.artifacts }),
    });
    task = (await requestJson(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ artifacts: { ...task.artifacts, storyboard: storyboardResult.data }, currentStep: 3, stepStatuses: ["done", "done", "done", "running", "pending", "pending", "pending"] }),
    })).task;
  }
  process.stdout.write(`STORYBOARD ${task.artifacts.storyboard.shots.length} shots\n`);

  if (!task.artifacts.prompts?.prompts?.length) {
    const promptResult = await requestJson("/api/llm/pipeline", {
      method: "POST",
      body: JSON.stringify({ step: "prompts", config: { provider: "minimax", apiKey: "" }, context: pipelineContext(task), artifacts: task.artifacts }),
    });
    task = (await requestJson(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ artifacts: { ...task.artifacts, prompts: promptResult.data }, currentStep: 4, stepStatuses: ["done", "done", "done", "done", "running", "pending", "pending"] }),
    })).task;
  }
  process.stdout.write(`PROMPTS ${task.artifacts.prompts.prompts.length}\n`);

  if (!task.media.images?.length || !task.media.coverImages?.length || forceCover) {
    const imageResult = task.media.images?.length ? { images: task.media.images } : await requestJson("/api/images/minimax/generate", {
      method: "POST",
      body: JSON.stringify({ taskId: task.id, prompts: task.artifacts.prompts.prompts, apiKey: "", aspectRatio: task.aspectRatio, maxImages: task.artifacts.prompts.prompts.length, track: task.track, visualStyle: task.visualStyle }),
    });
    const coverResult = task.media.coverImages?.length && !forceCover ? { images: task.media.coverImages } : await requestJson("/api/images/minimax/generate", {
      method: "POST",
      body: JSON.stringify({ taskId: task.id, prompts: [buildCinematicCoverPrompt(task, task.artifacts.prompts.prompts)], apiKey: "", aspectRatio: "3:4", maxImages: 1, track: task.track, visualStyle: task.visualStyle, coverBackgroundOnly: true }),
    });
    task = (await requestJson(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ media: { ...task.media, images: imageResult.images, coverImages: coverResult.images }, currentStep: 5, stepStatuses: ["done", "done", "done", "done", "done", "running", "pending"] }),
    })).task;
  }
  process.stdout.write(`IMAGES ${task.media.images.length}, COVERS ${task.media.coverImages.length}\n`);

  const audioSegments = task.media.audioSegments?.length === task.artifacts.storyboard.shots.length
    ? task.media.audioSegments
    : [];
  let cursor = 0;
  if (!audioSegments.length) {
    for (const [index, shot] of task.artifacts.storyboard.shots.entries()) {
      const segment = await synthesize(task.id, task, shot, index);
      segment.startSec = cursor;
      cursor += segment.durationSec;
      audioSegments.push(segment);
    }
  } else {
    for (const segment of audioSegments) {
      segment.startSec = cursor;
      cursor += segment.durationSec;
    }
  }
  const timeline = audioSegments.map((segment) => ({
    shotId: segment.shotId,
    text: segment.text,
    startSec: segment.startSec,
    endSec: segment.startSec + segment.durationSec,
    durationSec: segment.durationSec,
  }));
  task = (await requestJson(`/api/tasks/${task.id}`, {
    method: "PATCH",
    body: JSON.stringify({ media: { ...task.media, audioSegments, timeline }, currentStep: 6, stepStatuses: ["done", "done", "done", "done", "done", "done", "running"] }),
  })).task;
  process.stdout.write(`AUDIO ${audioSegments.length}, TOTAL ${cursor.toFixed(2)}s\n`);

  const draftPayload = await requestJson(`/api/tasks/${task.id}/draft`, { method: "POST", body: "{}" });
  process.stdout.write(`DRAFT ${draftPayload.draft.projectPath}\nZIP ${draftPayload.draft.zipPath}\nDONE ${task.id}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
