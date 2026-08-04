import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const sourceTaskId = process.argv[2] || "3a14c8a6-e0f6-4a01-b8de-04a5b51d120b";
const resumeTaskId = process.argv[3] || process.env.RESUME_TASK_ID || "";
const referencePath = resolve(
  appRoot,
  "docs/research/character-references/li-xianglan/li-xianglan-1940.png",
);

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

async function uploadReference(taskId) {
  const bytes = await readFile(referencePath);
  return (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}/assets`, {
    method: "POST",
    body: JSON.stringify({
      kind: "uploads",
      fileName: "li-xianglan-1940-verified-reference.png",
      base64: bytes.toString("base64"),
    }),
  })).asset;
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
    targetScenes: task.artifacts.storyboard.shots.length,
    fixedIntro: task.options.fixedIntro,
    outroCta: task.options.outroCta,
    ttsMode: task.options.ttsMode,
  };
}

const fastOpening = [
  {
    text: "1945年日本战败后，上海。",
    visual: "1945年战后的上海街头，旧报纸散落，远处法院建筑，压抑的黑白纪实建立镜头",
  },
  {
    text: "一个穿旗袍的女人因汉奸嫌疑被拘押。",
    visual: "25岁的李香兰穿深色旗袍，在看守人员陪同下走过法院长廊，人物面部清楚，中景",
  },
  {
    text: "在战后清算的气氛里，她一度可能面临极重刑罚。",
    visual: "李香兰坐在审讯室木桌旁，窗格阴影落在脸上，神情克制紧张，近景",
  },
  {
    text: "她叫李香兰。很多中国人认识她，是从银幕上开始的。",
    visual: "年轻李香兰站在1940年代电影放映机光束前，身后银幕与胶片盘虚化，面部特写",
  },
  {
    text: "她讲一口流利的中文，穿旗袍，唱中文歌。",
    visual: "年轻李香兰穿1940年代旗袍站在老式圆形麦克风前演唱，舞台追光，中近景",
  },
  {
    text: "她演过许多地道的中国女人，曾是那个年代最红的歌星之一。",
    visual: "1940年代电影片场，李香兰身着旗袍面对摄影机表演，布景灯架与胶片摄影机清楚，全景",
  },
  {
    text: "可就在法庭上，一份证明她日本国籍的材料被呈上去。",
    visual: "法庭木桌上一份身份材料被推到李香兰面前，文件内容不可读，她的脸在背景清楚，手部特写",
  },
  {
    text: "所有人才恍然大悟：原来李香兰本名山口淑子。",
    visual: "李香兰抬头望向法庭众人，惊讶与释然交织，四周人物虚化，面部近景",
  },
  {
    text: "她是个日本人。这份身份材料救了她一命。",
    visual: "李香兰走出昏暗法庭门口，逆光落在同一张脸上，手中握着身份材料，中景",
  },
  {
    text: "却也让她的一生，变成一个很难用对错讲清的故事。",
    visual: "李香兰站在电影银幕、上海街景与日本列车站三重空间交界处，人物清晰，克制的全景构图",
  },
];

function buildShots(source) {
  const sourceShots = source.artifacts?.storyboard?.shots || [];
  if (sourceShots.length < 6) throw new Error("源任务分镜不足，无法重建");
  const opening = fastOpening.map((shot, index) => ({
    id: index + 1,
    text: shot.text,
    visual: shot.visual,
    emotion: "紧张、克制、纪实",
    durationSec: Math.max(2, Math.min(6, shot.text.length / 4.2)),
    sourceShotId: index < 2 ? 1 : Math.min(5, Math.floor(index / 2) + 1),
  }));
  const tail = sourceShots.slice(5).map((shot, index) => ({
    ...shot,
    id: opening.length + index + 1,
    sourceShotId: shot.id,
  }));
  return [...opening, ...tail];
}

function ageStage(shot) {
  if (shot.id <= 10) return "1945年，25岁的青年李香兰";
  const oldId = Number(shot.sourceShotId || shot.id - 5);
  if (oldId <= 8) return "青年时期，约20至25岁的李香兰";
  if (oldId <= 10) return "童年时期的山口淑子，保留与成年本人一致的东亚面部骨相";
  if (oldId === 11) return "1931年，11岁的山口淑子";
  if (oldId <= 14) return "1937年前后，17岁的山口淑子";
  if (oldId <= 29) return "1937至1942年，18至22岁的青年李香兰";
  if (oldId <= 36) return "1942年前后，22岁的青年李香兰";
  if (oldId <= 41) return "1945年，25岁的李香兰";
  if (oldId <= 46) return "战后至中年时期的山口淑子，仍保持同一本人面部骨相";
  if (oldId <= 50) return "1974年以后，54岁以上的中老年山口淑子，按本人骨相自然衰老";
  if (oldId === 51) return "晚年的山口淑子，东亚日本女性，按本人骨相自然衰老";
  if (oldId <= 53) return "回忆中的青年李香兰，约22岁";
  return "跨时代回望中的李香兰，以青年本人形象作为记忆锚点";
}

function hardenPrompts(task, promptData) {
  const shots = task.artifacts.storyboard.shots;
  const generated = promptData.prompts || [];
  const negative = "欧美面孔，白人面孔，非东亚面孔，人物换脸，随机陌生女性，错误国籍，年龄错乱，现代服装，现代建筑，文字，字幕，标题，水印，标志，多余人物，畸形手指，多余肢体，低清晰度，过度磨皮，3D渲染，动漫";
  return shots.map((shot, index) => {
    const source = generated.find((item) => Number(item.shotId) === shot.id) || generated[index] || {};
    const core = String(source.prompt || shot.visual)
      .replaceAll("一位主角", "李香兰（山口淑子）")
      .replaceAll("一位中国女性", "日本女性李香兰（山口淑子）")
      .replaceAll("中国女性", "日本女性")
      .slice(0, 1050);
    const identity = `人物真实性硬约束：若画面出现李香兰或山口淑子，必须以已上传的1940年本人照片为唯一脸部骨相参考；她是东亚日本女性，不得生成欧美人或更换面孔。年龄阶段：${ageStage(shot)}。椭圆脸，深色眼睛，黑色波浪短发；跨年龄只能自然改变皱纹、发色和成熟度，脸型、眼距、鼻形和嘴形保持同一人`;
    return {
      shotId: shot.id,
      prompt: `${identity}。本镜叙事：${shot.text}。本镜画面：${core}。纯灰阶黑白胶片纪实摄影，1940年代史料质感，竖屏9:16，禁止画面文字。画面中避免出现：${negative}`.slice(0, 1500),
      negativePrompt: negative,
    };
  });
}

function assetHeader(response, name) {
  return decodeURIComponent(response.headers.get(name) || "");
}

async function synthesize(task, shot, index) {
  const response = await fetch(`${baseUrl}/api/tts/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "minimax",
      text: shot.text,
      voiceId: task.options.ttsVoiceId || "Chinese (Mandarin)_Reliable_Executive",
      speed: Number(task.options.ttsSpeed || 1),
      config: { apiKey: "", model: "speech-2.8-hd" },
      taskId: task.id,
      shotId: shot.id,
      fileName: `${shot.id}.mp3`,
    }),
  });
  if (!response.ok) throw new Error(`TTS ${shot.id} failed: ${await response.text()}`);
  await response.arrayBuffer();
  const durationSec = Number(response.headers.get("X-TTS-Duration") || shot.durationSec || 1);
  process.stdout.write(`FAST_TTS ${index + 1}/10 shot=${shot.id} duration=${durationSec.toFixed(3)}\n`);
  return {
    id: `audio-N-${shot.id}-${Date.now()}-${index}`,
    shotId: shot.id,
    text: shot.text,
    voiceId: task.options.ttsVoiceId || "Chinese (Mandarin)_Reliable_Executive",
    fileName: assetHeader(response, "X-Asset-File"),
    path: assetHeader(response, "X-Asset-Path"),
    url: assetHeader(response, "X-Asset-Url"),
    bytes: Number(response.headers.get("Content-Length") || 0),
    durationSec,
    speed: Number(task.options.ttsSpeed || 1),
    status: "ready",
  };
}

async function reuseTailAudio(source, target) {
  const output = [];
  const targetAudioDir = join(appRoot, ".storybound-data", "tasks", target.id, "audio");
  await mkdir(targetAudioDir, { recursive: true });
  const sourceByShot = new Map((source.media?.audioSegments || []).map((item) => [Number(item.shotId), item]));
  for (const shot of target.artifacts.storyboard.shots.slice(10)) {
    const sourceSegment = sourceByShot.get(Number(shot.sourceShotId));
    if (!sourceSegment?.path) throw new Error(`缺少源音频：sourceShotId=${shot.sourceShotId}`);
    const targetPath = join(targetAudioDir, `${shot.id}.mp3`);
    await copyFile(sourceSegment.path, targetPath);
    const fileStat = await stat(targetPath);
    output.push({
      ...sourceSegment,
      id: `audio-N-${shot.id}-reused-${Date.now()}`,
      shotId: shot.id,
      text: shot.text,
      fileName: `${shot.id}.mp3`,
      path: targetPath,
      url: `/api/tasks/${encodeURIComponent(target.id)}/files/audio/${encodeURIComponent(`${shot.id}.mp3`)}`,
      bytes: fileStat.size,
      startSec: undefined,
      endSec: undefined,
      status: "ready",
    });
  }
  return output;
}

async function createOrResume(source) {
  if (resumeTaskId) return (await requestJson(`/api/tasks/${encodeURIComponent(resumeTaskId)}`)).task;
  const id = randomUUID();
  const shots = buildShots(source);
  let task = (await requestJson("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      ...source,
      id,
      title: "李香兰（真实参考·开头快切版）",
      status: "running",
      runState: "running",
      currentStep: 3,
      stepStatuses: ["done", "done", "done", "running", "pending", "pending", "pending"],
      options: {
        ...source.options,
        materialSource: "ai",
        ttsSpeed: 1,
        ttsMode: "original-segmented",
        referenceImage: null,
        draftTemplateId: "default-portrait-9-16",
        coverMode: "off",
      },
      artifacts: {
        precheck: source.artifacts.precheck,
        rewrite: source.artifacts.rewrite,
        storyboard: {
          shots,
          characterCard: {
            name: "李香兰（山口淑子）",
            identity: "1920年出生的日本女性，东亚人；战前在中国以艺名李香兰活动",
            age: "随字幕年代从童年至晚年变化",
            gender: "女性",
            appearance: "以1940年本人照片为唯一面部骨相参考：椭圆脸、深色眼睛、黑色波浪短发",
            clothing: "服装严格随1930至1940年代旗袍、战后日本服装和晚年正式服装变化",
          },
        },
      },
      media: { images: [], videos: [], coverImages: [], audioSegments: [], continuousAudio: null, podcast: null, externalAudio: null, bgm: null, timeline: [] },
      draft: null,
      error: null,
      createdAt: undefined,
      updatedAt: undefined,
      completedAt: null,
    }),
  })).task;
  const referenceImage = await uploadReference(task.id);
  task = (await requestJson(`/api/tasks/${encodeURIComponent(task.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ options: { ...task.options, referenceImage } }),
  })).task;
  return task;
}

async function main() {
  const source = (await requestJson(`/api/tasks/${encodeURIComponent(sourceTaskId)}`)).task;
  let task = await createOrResume(source);
  process.stdout.write(`TASK ${task.id}\nSHOTS ${task.artifacts.storyboard.shots.length}\nREFERENCE ${task.options.referenceImage?.fileName || "missing"}\n`);

  if (!task.artifacts.prompts?.prompts?.length) {
    const result = await requestJson("/api/llm/pipeline", {
      method: "POST",
      body: JSON.stringify({
        step: "prompts",
        config: { provider: "minimax", apiKey: "", model: "MiniMax-M3" },
        context: pipelineContext(task),
        artifacts: task.artifacts,
      }),
    });
    const prompts = hardenPrompts(task, result.data);
    task = (await requestJson(`/api/tasks/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        artifacts: {
          ...task.artifacts,
          prompts: {
            ...result.data,
            templateVersion: "Storybound 1.17.0 + verified identity + fast opening",
            prompts,
          },
        },
        currentStep: 4,
        stepStatuses: ["done", "done", "done", "done", "running", "pending", "pending"],
      }),
    })).task;
  }
  process.stdout.write(`PROMPTS ${task.artifacts.prompts.prompts.length}\n`);

  if (task.media.images?.length !== task.artifacts.storyboard.shots.length) {
    const generated = await requestJson("/api/images/minimax/generate", {
      method: "POST",
      body: JSON.stringify({
        taskId: task.id,
        prompts: task.artifacts.prompts.prompts,
        apiKey: "",
        aspectRatio: "9:16",
        maxImages: task.artifacts.prompts.prompts.length,
        track: task.track,
        visualStyle: task.visualStyle,
      }),
    });
    const failed = generated.images.filter((image) => image.status !== "ready" || !image.path);
    if (failed.length) throw new Error(`生图失败 ${failed.length} 张：${failed.map((item) => `#${item.shotId}`).join(",")}`);
    task = (await requestJson(`/api/tasks/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        media: { ...task.media, images: generated.images },
        currentStep: 5,
        stepStatuses: ["done", "done", "done", "done", "done", "running", "pending"],
      }),
    })).task;
  }
  process.stdout.write(`IMAGES ${task.media.images.length}\n`);

  if (task.media.audioSegments?.length !== task.artifacts.storyboard.shots.length) {
    const openingAudio = [];
    for (const [index, shot] of task.artifacts.storyboard.shots.slice(0, 10).entries()) {
      openingAudio.push(await synthesize(task, shot, index));
    }
    const audioSegments = [...openingAudio, ...(await reuseTailAudio(source, task))];
    let cursor = 0;
    for (const segment of audioSegments) {
      segment.startSec = cursor;
      segment.endSec = cursor + segment.durationSec;
      cursor = segment.endSec;
    }
    const timeline = audioSegments.map((segment) => ({
      shotId: segment.shotId,
      text: segment.text,
      startSec: segment.startSec,
      endSec: segment.endSec,
      durationSec: segment.durationSec,
    }));
    task = (await requestJson(`/api/tasks/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        media: { ...task.media, audioSegments, timeline },
        currentStep: 6,
        stepStatuses: ["done", "done", "done", "done", "done", "done", "running"],
      }),
    })).task;
  }
  process.stdout.write(`AUDIO ${task.media.audioSegments.length} TOTAL ${task.media.timeline.at(-1).endSec.toFixed(3)}\n`);
  process.stdout.write(`OPENING_DURATIONS ${task.media.timeline.slice(0, 10).map((item) => item.durationSec.toFixed(3)).join(",")}\n`);

  const built = await requestJson(`/api/tasks/${encodeURIComponent(task.id)}/draft`, { method: "POST", body: "{}" });
  task = built.task || task;
  process.stdout.write(`DRAFT ${task.draft?.projectDir || built.draft?.projectDir}\nZIP ${task.draft?.zipPath || built.draft?.zipPath}\nDONE ${task.id}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
