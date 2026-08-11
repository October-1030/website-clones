import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const taskId = process.argv[2] || "60e16696-c3fd-4a24-b5db-7844f56447d8";
const onlyBatch = process.argv[3] || "";
const masterShotId = 3;
const approvedShotIds = new Set([3, 6, 17, 55]);

const batches = [
  { name: "face-a", shotIds: [2, 5, 7, 8] },
  { name: "face-b", shotIds: [11, 15, 20, 23] },
  { name: "face-c", shotIds: [26, 28, 30, 31] },
  { name: "face-d", shotIds: [33, 40, 41, 43] },
  { name: "face-e", shotIds: [44, 45, 46, 48] },
  { name: "face-f", shotIds: [50, 51, 53] },
  { name: "face-g", shotIds: [56, 58, 60] },
  { name: "face-special-2", shotIds: [2] },
  { name: "face-age", shotIds: [53, 56] },
  {
    name: "face-age60-derived",
    shotIds: [53],
    referenceFile: resolve(appRoot, "docs/research/character-references/li-xianglan/li-xianglan-approved-master-age-60.png"),
  },
  {
    name: "face-age90-derived",
    shotIds: [56],
    referenceFile: resolve(appRoot, "docs/research/character-references/li-xianglan/li-xianglan-approved-master-age-90.png"),
  },
];

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

async function patchTask(patch) {
  return (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })).task;
}

function ageRule(shotId) {
  if (shotId === 53) {
    return "人物约60岁，只通过自然皱纹、短卷发和1980年代服装表现年龄；脸型、眼距、鼻形和嘴形仍须来自唯一主脸卡。";
  }
  if (shotId === 56) {
    return "人物约90岁，只通过真实深皱纹、松弛皮肤、灰白短卷发和眼镜表现老年；脸部骨相仍须来自唯一主脸卡，禁止变成另一个老人。";
  }
  if ([48, 50, 51].includes(shotId)) {
    return "人物处于30至50岁阶段，允许自然成熟和时代发型变化，但脸部骨相必须与唯一主脸卡一致。";
  }
  return "人物为青年至30岁阶段，脸部骨相必须与唯一主脸卡一致。";
}

function lockedPrompt(prompt, shotId) {
  if (shotId === 2) {
    return "竖屏9:16，纯黑白历史纪实照片。1940年代上海木质长廊，一名25岁东亚女性穿深色旗袍，与两名制服工作人员并肩向前走，三人从头到脚完整入镜，长廊环境占画面70%，严肃克制，不是肖像照。上传图片是本任务唯一主角脸卡，必须严格保持第3镜女主角的椭圆脸、眼距、鼻形、嘴形和短卷发发际线。无桌子，无文件，无文字，无欧美面孔，无彩色，无现代物件。";
  }
  if (shotId === 53) {
    return "竖屏9:16，纯黑白历史纪实照片。1980年代国际交流会议室中远景，一名明确约60岁的东亚日本女性与多名东亚代表围桌交谈；她有自然眼角纹、法令纹、轻微皮肤松弛和夹灰短卷发，绝不是年轻模特。上传图片是唯一主角脸卡，只允许在第3镜同一脸部骨相上自然衰老，必须保持眼距、鼻形、嘴形和脸型一致。会议室与长桌占画面70%，人物不是大头照。无名牌，无文件文字，无欧美面孔，无彩色，无现代电子屏。";
  }
  if (shotId === 56) {
    return "竖屏9:16，纯黑白历史纪实照片。2010年代，明确约90岁的东亚日本女性山口淑子安静坐在窗边，佩戴浅色眼镜，深而自然的皱纹、明显皮肤松弛、稀疏灰白短卷发和老年手部都清楚可见，绝不是六十岁或年轻化面孔。上传图片是唯一主角脸卡，只允许在第3镜同一脸部骨相上深度自然衰老，必须保持眼距、鼻形、嘴形和脸型一致。头至腰中景，房间环境清晰。纯黑白，无彩色，无文字，无欧美面孔。";
  }
  const identityRule = `角色一致性最高优先级：上传图片是本任务唯一有效的主角脸卡，来源为用户已确认的第${masterShotId}镜。所有露脸画面必须是同一个东亚女性李香兰，严格保持主脸卡的椭圆脸、眼距、鼻形、嘴形和短卷发发际线；不得借用其他女演员面孔，不得变成欧美人、混血脸、韩国偶像脸或另一名亚洲女性。${ageRule(shotId)}`;
  const compositionRule = "保持当前分镜指定的景别、动作、人物比例和历史环境，脸卡只用于锁定身份，禁止把中景、动作镜头或群像自动改成证件照与大头照。纯黑白纪实摄影，无可读文字、字母、数字、标志或水印。";
  return `${identityRule}${compositionRule}${String(prompt.prompt || "").slice(0, 900)}`.slice(0, 1500);
}

function patchPrompts(task, shotIds) {
  const selected = new Set(shotIds);
  return task.artifacts.prompts.prompts.map((prompt) =>
    selected.has(Number(prompt.shotId))
      ? {
          ...prompt,
          prompt: lockedPrompt(prompt, Number(prompt.shotId)),
          useReference: true,
          provider: "minimax",
          negativePrompt: "different woman, inconsistent identity, Caucasian face, mixed-race face, K-pop idol, male face, portrait headshot, modern clothing, readable text, letters, numbers, logo, watermark, color, sepia, malformed hands",
        }
      : prompt,
  );
}

async function uploadMasterFace(task) {
  const source = task.media.images.find((image) => Number(image.shotId) === masterShotId && image.path);
  if (!source?.path) throw new Error(`Approved master face shot ${masterShotId} is missing`);
  const bytes = await readFile(source.path);
  return (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}/assets`, {
    method: "POST",
    body: JSON.stringify({
      kind: "uploads",
      fileName: `li-xianglan-approved-master-face-shot-${masterShotId}.jpg`,
      base64: bytes.toString("base64"),
    }),
  })).asset;
}

async function uploadDerivedFace(path, fileName) {
  const bytes = await readFile(path);
  return (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}/assets`, {
    method: "POST",
    body: JSON.stringify({
      kind: "uploads",
      fileName,
      base64: bytes.toString("base64"),
    }),
  })).asset;
}

async function generate(task, prompts) {
  return requestJson("/api/images/minimax/generate", {
    method: "POST",
    body: JSON.stringify({
      taskId,
      prompts,
      apiKey: "",
      aspectRatio: "9:16",
      maxImages: prompts.length,
      track: task.track,
      visualStyle: task.visualStyle,
      force: true,
    }),
  });
}

async function generateBatch(task, batch, masterFace) {
  if (batch.shotIds.some((shotId) => approvedShotIds.has(shotId))) {
    throw new Error(`${batch.name} attempts to overwrite an approved shot`);
  }
  const prompts = patchPrompts(task, batch.shotIds);
  task = await patchTask({
    options: {
      ...task.options,
      referenceImage: masterFace,
      characterReferencePolicy: "single-approved-master-face",
      characterReferenceSourceShot: masterShotId,
    },
    artifacts: {
      ...task.artifacts,
      prompts: {
        ...task.artifacts.prompts,
        templateVersion: "Storybound 1.17.0 · 李香兰唯一主脸卡锁定",
        prompts,
      },
    },
    draft: null,
  });
  const promptMap = new Map(prompts.map((prompt) => [Number(prompt.shotId), prompt]));
  const selected = batch.shotIds.map((shotId) => promptMap.get(shotId));
  process.stdout.write(`GENERATE ${batch.name} ${batch.shotIds.join(",")}\n`);
  let result = await generate(task, selected);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const fallbackIds = result.images
      .filter((image) => image.status !== "ready" || !image.path || Number(image.retryLevel) !== 0)
      .map((image) => Number(image.shotId));
    if (!fallbackIds.length) break;
    process.stdout.write(`RETRY_PRIMARY ${batch.name} ${fallbackIds.join(",")} attempt=${attempt}\n`);
    const retryResult = await generate(task, fallbackIds.map((shotId) => promptMap.get(shotId)));
    const retryMap = new Map(retryResult.images.map((image) => [Number(image.shotId), image]));
    result = {
      images: result.images.map((image) => retryMap.get(Number(image.shotId)) || image),
    };
  }

  const merged = new Map((task.media.images || []).map((image) => [Number(image.shotId), image]));
  for (const image of result.images) {
    if (image.status === "ready" && image.path) merged.set(Number(image.shotId), image);
  }
  task = await patchTask({
    media: {
      ...task.media,
      images: [...merged.values()].sort((left, right) => Number(left.shotId) - Number(right.shotId)),
    },
    draft: null,
  });
  const failed = result.images.filter(
    (image) => image.status !== "ready" || !image.path || Number(image.retryLevel) !== 0,
  );
  process.stdout.write(`SAVED ${batch.name} ${result.images.length - failed.length}/${result.images.length}\n`);
  if (failed.length) throw new Error(`${batch.name} did not return primary results for: ${failed.map((image) => image.shotId).join(",")}`);
  return task;
}

async function main() {
  let task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`)).task;
  const masterFace = await uploadMasterFace(task);
  const selectedBatches = onlyBatch ? batches.filter((batch) => batch.name === onlyBatch) : batches;
  if (!selectedBatches.length) throw new Error(`Unknown batch: ${onlyBatch}`);
  for (const batch of selectedBatches) {
    const reference = batch.referenceFile
      ? await uploadDerivedFace(batch.referenceFile, `li-xianglan-${batch.name}.png`)
      : masterFace;
    task = await generateBatch(task, batch, reference);
  }

  const readyIds = new Set(
    (task.media.images || [])
      .filter((image) => image.status === "ready" && image.path)
      .map((image) => Number(image.shotId)),
  );
  const missing = task.artifacts.storyboard.shots
    .map((shot) => Number(shot.id))
    .filter((shotId) => !readyIds.has(shotId));
  if (missing.length) throw new Error(`Images missing after face lock: ${missing.join(",")}`);
  task = await patchTask({
    status: "paused",
    runState: "paused",
    currentStep: 4,
    stepStatuses: ["done", "done", "done", "done", "done", "pending", "pending"],
    options: {
      ...task.options,
      referenceImage: masterFace,
      characterReferencePolicy: "single-approved-master-face",
      characterReferenceSourceShot: masterShotId,
    },
    draft: null,
    error: null,
  });
  process.stdout.write(`DONE ${task.id} READY ${readyIds.size} MASTER_SHOT ${masterShotId}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
