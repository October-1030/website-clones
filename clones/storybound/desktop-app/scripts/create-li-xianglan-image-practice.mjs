import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const sourceTaskId = process.argv[2] || "8fc390f6-c0a1-49de-82ff-8855311c7fd1";
const referencePath = resolve(
  appRoot,
  "docs/research/character-references/li-xianglan/li-xianglan-1940.png",
);

const practiceShots = [
  {
    sourceShotId: 3,
    label: "人物近景（禁止大头照）",
    visual: "1945年审讯室内，25岁的李香兰坐在木桌旁，头顶至胸口入镜，窗格阴影落在脸上，桌面与房间环境清楚，人物占画面不超过60%",
    useReference: true,
    constraint: "人物近景但严禁证件照或大头照；头顶至胸口完整入镜，审讯桌、窗格与房间环境至少占画面40%，人物面部保持1940年真实参考照片的东亚骨相",
  },
  {
    sourceShotId: 6,
    label: "人物全景（环境为主）",
    visual: "1940年代电影片场全景，李香兰穿旗袍在摄影机前表演，完整人物、布景、灯架、轨道与工作人员活动空间均清楚，环境占画面约70%",
    useReference: true,
    constraint: "全景构图，完整人物从头到脚入镜，人物只占画面25%至35%；1940年代胶片摄影机、灯架、片场布景与空间层次是画面主体，禁止半身肖像和脸部特写",
  },
  {
    sourceShotId: 17,
    label: "历史环境空镜",
    visual: "1930年代东北空置电影片场与广播印刷设施，老式胶片摄影机、放映机、收音机、报纸和学校走廊组成历史环境，不出现任何人物",
    useReference: false,
    constraint: "纯历史环境建立镜头，不得出现人物、脸、人体剪影或肖像；用电影片场、广播设备、印刷机和旧报纸讲述战争如何占领媒介，禁止可读文字",
  },
  {
    sourceShotId: 55,
    label: "身份物件隐喻",
    visual: "三份年代不同的旧证件、镜面倒影、胶片盒与褪色车票组成身份隐喻静物，俯拍与侧光结合，克制留白，不出现人物",
    useReference: false,
    constraint: "纯物件叙事静物，不得出现人物、脸、手或人体倒影；证件文字全部虚焦不可读，镜面只反射空房间光影，物件和留白构成故事",
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

async function uploadReference(taskId) {
  const bytes = await readFile(referencePath);
  const payload = await requestJson(`/api/tasks/${encodeURIComponent(taskId)}/assets`, {
    method: "POST",
    body: JSON.stringify({
      kind: "uploads",
      fileName: "li-xianglan-1940-verified-reference.png",
      base64: bytes.toString("base64"),
    }),
  });
  return payload.asset;
}

function selectedArtifacts(source) {
  const sourceShots = new Map(source.artifacts.storyboard.shots.map((shot) => [Number(shot.id), shot]));
  const sourcePrompts = new Map(source.artifacts.prompts.prompts.map((prompt) => [Number(prompt.shotId), prompt]));
  const shots = [];
  const prompts = [];

  for (const [index, selection] of practiceShots.entries()) {
    const shot = sourceShots.get(selection.sourceShotId);
    const prompt = sourcePrompts.get(selection.sourceShotId);
    if (!shot || !prompt) throw new Error(`源任务缺少第 ${selection.sourceShotId} 镜`);
    const shotId = index + 1;
    shots.push({
      ...shot,
      id: shotId,
      visual: selection.visual,
      practiceLabel: selection.label,
      sourceShotId: selection.sourceShotId,
    });
    prompts.push({
      ...prompt,
      shotId,
      provider: "minimax",
      useReference: selection.useReference,
      prompt: `${prompt.prompt}。本次构图练习硬约束：${selection.constraint}。9:16竖屏，黑白纪实照片，画面中不得出现字幕、水印、标志或乱码。`,
    });
  }

  return {
    ...source.artifacts,
    storyboard: { ...source.artifacts.storyboard, shots },
    prompts: {
      ...source.artifacts.prompts,
      templateVersion: `${source.artifacts.prompts.templateVersion || "Storybound"} · 4镜构图练习`,
      prompts,
    },
  };
}

async function main() {
  const source = (await requestJson(`/api/tasks/${encodeURIComponent(sourceTaskId)}`)).task;
  const artifacts = selectedArtifacts(source);
  let task = (await requestJson("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      ...source,
      id: randomUUID(),
      title: "李香兰（4镜构图练习·MiniMax）",
      status: "running",
      runState: "running",
      currentStep: 4,
      stepStatuses: ["done", "done", "done", "done", "running", "pending", "pending"],
      options: {
        ...source.options,
        imageProvider: "minimax",
        referenceImage: null,
        coverMode: "off",
      },
      artifacts,
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

  process.stdout.write(`TASK ${task.id}\n`);
  const referenceImage = await uploadReference(task.id);
  task = (await requestJson(`/api/tasks/${encodeURIComponent(task.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ options: { ...task.options, referenceImage } }),
  })).task;

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
      status: "paused",
      runState: "paused",
      currentStep: 4,
      stepStatuses: ["done", "done", "done", "done", "done", "pending", "pending"],
      media: { ...task.media, images: generated.images },
    }),
  })).task;

  process.stdout.write(`IMAGES ${task.media.images.length}\n`);
  for (const [index, image] of task.media.images.entries()) {
    process.stdout.write(`#${image.shotId} ${practiceShots[index].label} ${image.path}\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
