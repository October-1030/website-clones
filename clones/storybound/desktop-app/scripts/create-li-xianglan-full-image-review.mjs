import { randomUUID } from "node:crypto";
import { copyFile, readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const sourceTaskId = process.argv[2] || "8fc390f6-c0a1-49de-82ff-8855311c7fd1";
const practiceTaskId = process.argv[3] || "4f65561f-c1ed-4bf0-a76b-a7e6c3580465";
const resumeTaskId = process.argv[4] || process.env.RESUME_TASK_ID || "";

const referencePaths = {
  youth: resolve(appRoot, "docs/research/character-references/li-xianglan/li-xianglan-1940.png"),
  postwar: resolve(appRoot, "docs/research/character-references/li-xianglan/yamaguchi-yoshiko-1950.jpg"),
  late: resolve(appRoot, "docs/research/character-references/li-xianglan/yamaguchi-yoshiko-midlife-bunshun.jpg"),
};

const confirmedShotMap = new Map([
  [3, 1],
  [6, 2],
  [17, 3],
  [55, 4],
]);

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

async function uploadReference(taskId, group) {
  const path = referencePaths[group];
  const bytes = await readFile(path);
  return (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}/assets`, {
    method: "POST",
    body: JSON.stringify({
      kind: "uploads",
      fileName: `li-xianglan-${group}-verified${extname(path).toLowerCase()}`,
      base64: bytes.toString("base64"),
    }),
  })).asset;
}

function referenceGroup(prompt) {
  if (!prompt.useReference) return "environment";
  const shotId = Number(prompt.shotId);
  if ([52, 53].includes(shotId)) return "postwar";
  if (shotId === 56) return "late";
  return "youth";
}

function ageConstraint(shotId) {
  if ([52, 53].includes(shotId)) {
    return "人物为1970年代约54岁的山口淑子，必须保持战后本人参考照的东亚日本女性骨相，自然中年面容、短卷发和1970年代正式服装，禁止青年脸和欧美面孔";
  }
  if (shotId === 56) {
    return "人物为2010年代约90岁的山口淑子，必须保持本人中晚年参考照的东亚日本女性骨相、浅色眼镜、自然皱纹和短卷发，禁止青年脸、过度美化和欧美面孔";
  }
  return "人物必须保持1940年李香兰本人参考照的东亚日本女性骨相、真实东亚眼型和黑色短卷发；服装与年龄严格跟随字幕年代，禁止欧美、混血或韩式偶像面孔";
}

function compositionConstraint(personIndex) {
  const slot = personIndex % 10;
  if ([0, 4, 8].includes(slot)) {
    return "人物近景但禁止大头照和证件照，头顶到胸口完整入镜，人物占画面不超过60%，必须保留至少40%的时代环境线索";
  }
  if ([1, 3, 6, 9].includes(slot)) {
    return "人物中景，至少头顶到膝上入镜，动作与时代环境共同讲故事，人物占画面35%至50%，禁止静态半身肖像";
  }
  return "人物远景或全景，从头到脚完整入镜，环境占画面65%以上，人物只占20%至35%，禁止脸部特写和摄影棚肖像";
}

function buildPrompts(source, practice) {
  const confirmedPrompts = new Map(
    [...confirmedShotMap].map(([sourceShotId, practiceShotId]) => [
      sourceShotId,
      practice.artifacts.prompts.prompts.find((prompt) => Number(prompt.shotId) === practiceShotId),
    ]),
  );
  let personIndex = 0;
  return source.artifacts.prompts.prompts.map((prompt) => {
    const shotId = Number(prompt.shotId);
    const confirmed = confirmedPrompts.get(shotId);
    if (confirmed) return { ...confirmed, shotId, provider: "minimax" };
    const useReference = Boolean(prompt.useReference);
    const finalConstraint = useReference
      ? `${ageConstraint(shotId)}；${compositionConstraint(personIndex++)}`
      : "纯历史环境或关键物件镜头，不得出现人物、脸、手、人体剪影、肖像或人体倒影；环境与物件必须对应字幕年代并承担叙事，不得出现可读文字";
    return {
      ...prompt,
      provider: "minimax",
      useReference,
      prompt: `${prompt.prompt}。完整图片重制硬约束：${finalConstraint}。9:16竖屏，纯黑白纪实照片；不得出现字幕、文字、字母、数字、标志、水印或乱码。`.slice(0, 1500),
      negativePrompt: `${prompt.negativePrompt || ""}，大头照，证件照，欧美面孔，混血面孔，现代服装，现代建筑，文字，字母，数字，乱码，水印，多余肢体，畸形手指`,
    };
  });
}

function buildShots(source, practice) {
  const practiceShots = new Map(
    [...confirmedShotMap].map(([sourceShotId, practiceShotId]) => [
      sourceShotId,
      practice.artifacts.storyboard.shots.find((shot) => Number(shot.id) === practiceShotId),
    ]),
  );
  return source.artifacts.storyboard.shots.map((shot) => {
    const confirmed = practiceShots.get(Number(shot.id));
    return confirmed ? { ...shot, visual: confirmed.visual } : shot;
  });
}

async function createOrResume(source, practice) {
  if (resumeTaskId) return (await requestJson(`/api/tasks/${encodeURIComponent(resumeTaskId)}`)).task;
  const prompts = buildPrompts(source, practice);
  const shots = buildShots(source, practice);
  return (await requestJson("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      ...source,
      id: randomUUID(),
      title: "李香兰（完整62镜构图重制·MiniMax）",
      status: "running",
      runState: "running",
      currentStep: 4,
      stepStatuses: ["done", "done", "done", "done", "running", "pending", "pending"],
      options: { ...source.options, imageProvider: "minimax", referenceImage: null, coverMode: "off" },
      artifacts: {
        ...source.artifacts,
        storyboard: { ...source.artifacts.storyboard, shots },
        prompts: {
          ...source.artifacts.prompts,
          templateVersion: `${source.artifacts.prompts.templateVersion || "Storybound"} · 完整62镜构图重制`,
          prompts,
        },
      },
      media: {
        images: [],
        videos: [],
        coverImages: [],
        audioSegments: [],
        continuousAudio: null,
        podcast: null,
        externalAudio: null,
        bgm: null,
        stockLicenseManifest: null,
        timeline: [],
      },
      draft: null,
      error: null,
      createdAt: undefined,
      updatedAt: undefined,
      completedAt: null,
    }),
  })).task;
}

async function copyConfirmedImages(task, practice) {
  const existing = new Map((task.media.images || []).map((image) => [Number(image.shotId), image]));
  const promptMap = new Map(task.artifacts.prompts.prompts.map((prompt) => [Number(prompt.shotId), prompt]));
  for (const [sourceShotId, practiceShotId] of confirmedShotMap) {
    if (existing.has(sourceShotId)) continue;
    const image = practice.media.images.find((item) => Number(item.shotId) === practiceShotId);
    if (!image?.path) throw new Error(`练习任务缺少已确认图片 #${practiceShotId}`);
    const targetPath = resolve(appRoot, ".storybound-data", "tasks", task.id, "images", `${sourceShotId}.jpg`);
    await copyFile(image.path, targetPath);
    const fileStat = await stat(targetPath);
    existing.set(sourceShotId, {
      ...image,
      id: `confirmed-image-${sourceShotId}`,
      shotId: sourceShotId,
      prompt: promptMap.get(sourceShotId)?.prompt || image.prompt,
      path: targetPath,
      url: `/api/tasks/${encodeURIComponent(task.id)}/files/images/${encodeURIComponent(`${sourceShotId}.jpg`)}`,
      bytes: fileStat.size,
      provider: "minimax",
      status: "ready",
      confirmedFromPractice: true,
    });
  }
  return [...existing.values()].sort((a, b) => Number(a.shotId) - Number(b.shotId));
}

async function patchReference(task, referenceImage) {
  return (await requestJson(`/api/tasks/${encodeURIComponent(task.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ options: { ...task.options, referenceImage } }),
  })).task;
}

async function generateGroup(task, group, referenceImage) {
  const existing = new Set((task.media.images || []).filter((image) => image.status === "ready" && image.path).map((image) => Number(image.shotId)));
  const prompts = task.artifacts.prompts.prompts.filter((prompt) => referenceGroup(prompt) === group && !existing.has(Number(prompt.shotId)));
  if (!prompts.length) return task;
  task = await patchReference(task, referenceImage);
  process.stdout.write(`GROUP ${group} ${prompts.length}\n`);
  const result = await requestJson("/api/images/minimax/generate", {
    method: "POST",
    body: JSON.stringify({
      taskId: task.id,
      prompts,
      apiKey: "",
      aspectRatio: "9:16",
      maxImages: prompts.length,
      track: task.track,
      visualStyle: task.visualStyle,
    }),
  });
  const ready = result.images.filter((image) => image.status === "ready" && image.path);
  const failed = result.images.filter((image) => image.status !== "ready" || !image.path);
  const merged = new Map((task.media.images || []).map((image) => [Number(image.shotId), image]));
  for (const image of ready) merged.set(Number(image.shotId), image);
  task = (await requestJson(`/api/tasks/${encodeURIComponent(task.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ media: { ...task.media, images: [...merged.values()].sort((a, b) => Number(a.shotId) - Number(b.shotId)) } }),
  })).task;
  process.stdout.write(`READY ${group} ${ready.length}/${prompts.length}\n`);
  if (failed.length) throw new Error(`${group} 组失败：${failed.map((image) => `#${image.shotId}`).join(",")}`);
  return task;
}

async function main() {
  const source = (await requestJson(`/api/tasks/${encodeURIComponent(sourceTaskId)}`)).task;
  const practice = (await requestJson(`/api/tasks/${encodeURIComponent(practiceTaskId)}`)).task;
  let task = await createOrResume(source, practice);
  process.stdout.write(`TASK ${task.id}\n`);

  const references = {};
  for (const group of ["youth", "postwar", "late"]) references[group] = await uploadReference(task.id, group);
  task = await patchReference(task, references.youth);
  const confirmedImages = await copyConfirmedImages(task, practice);
  task = (await requestJson(`/api/tasks/${encodeURIComponent(task.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ media: { ...task.media, images: confirmedImages } }),
  })).task;
  process.stdout.write(`CONFIRMED ${confirmedImages.length}\n`);

  task = await generateGroup(task, "environment", references.youth);
  task = await generateGroup(task, "youth", references.youth);
  task = await generateGroup(task, "postwar", references.postwar);
  task = await generateGroup(task, "late", references.late);

  const missing = task.artifacts.storyboard.shots
    .map((shot) => Number(shot.id))
    .filter((shotId) => !task.media.images.some((image) => Number(image.shotId) === shotId && image.status === "ready" && image.path));
  if (missing.length) throw new Error(`仍缺少图片：${missing.join(",")}`);
  task = (await requestJson(`/api/tasks/${encodeURIComponent(task.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "paused",
      runState: "paused",
      currentStep: 4,
      stepStatuses: ["done", "done", "done", "done", "done", "pending", "pending"],
      options: { ...task.options, referenceImage: references.youth },
      draft: null,
    }),
  })).task;
  process.stdout.write(`DONE ${task.id} ${task.media.images.length}\n`);
  for (const group of ["environment", "youth", "postwar", "late"]) {
    const count = task.artifacts.prompts.prompts.filter((prompt) => referenceGroup(prompt) === group).length;
    process.stdout.write(`SUMMARY ${group} ${count}\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
