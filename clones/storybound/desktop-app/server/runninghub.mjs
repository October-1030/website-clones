import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const baseUrl = "https://www.runninghub.ai";

export const runningHubModels = [
  {
    id: "hailuo-2.3-fast",
    name: "海螺 2.3 Fast",
    endpoint: "/openapi/v2/minimax/hailuo-2.3-fast/image-to-video",
    durationSec: 6,
  },
  {
    id: "hailuo-2.3-fast-pro",
    name: "海螺 2.3 Fast Pro",
    endpoint: "/openapi/v2/minimax/hailuo-2.3-fast-pro/image-to-video",
    durationSec: 6,
  },
  {
    id: "pixverse-v6",
    name: "PixVerse V6",
    endpoint: "/openapi/v2/pixverse-v6/image-to-video",
    durationSec: null,
    minDurationSec: 5,
    maxDurationSec: 15,
  },
];

function modelConfig(modelId) {
  return runningHubModels.find((model) => model.id === modelId) || runningHubModels[0];
}

function providerError(payload, fallback) {
  return String(payload?.errorMessage || payload?.message || payload?.msg || fallback || "RunningHub 请求失败");
}

function ensureHttps(value, label) {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:") throw new Error(`${label}不是 HTTPS 地址`);
  return url.toString();
}

function mimeForFile(file) {
  const extension = extname(file).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("请求已取消", "AbortError"));
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

async function runningHubJson(pathname, apiKey, body, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
    signal: options.signal,
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`RunningHub 返回了无法解析的响应（HTTP ${response.status}）`);
  }
  if (!response.ok) throw new Error(`RunningHub HTTP ${response.status}：${providerError(payload, text.slice(0, 160))}`);
  return payload;
}

export async function testRunningHubConnection(apiKey, options = {}) {
  const payload = await runningHubJson("/uc/openapi/accountStatus", apiKey, { apikey: apiKey }, options);
  if (Number(payload?.code) !== 0) throw new Error(providerError(payload, "RunningHub 凭据验证失败"));
  return {
    available: true,
    remainCoins: String(payload?.data?.remainCoins || ""),
    currentTaskCounts: String(payload?.data?.currentTaskCounts || "0"),
    currency: String(payload?.data?.currency || ""),
    apiType: String(payload?.data?.apiType || ""),
  };
}

export async function uploadRunningHubImage(file, apiKey, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const bytes = await readFile(file);
  if (!bytes.length) throw new Error("待转换图片为空");
  if (bytes.length > 30 * 1024 * 1024) throw new Error("RunningHub 单文件上传上限为 30MB");
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeForFile(file) }), `storybound${extname(file) || ".jpg"}`);
  const response = await fetchImpl(`${baseUrl}/openapi/v2/media/upload/binary`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: options.signal,
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`RunningHub 上传返回无法解析（HTTP ${response.status}）`);
  }
  if (!response.ok || !payload?.data?.download_url) {
    throw new Error(providerError(payload, `RunningHub 上传失败（HTTP ${response.status}）`));
  }
  return ensureHttps(payload.data.download_url, "RunningHub 上传结果");
}

export async function submitRunningHubVideo(input, apiKey, options = {}) {
  const model = modelConfig(input.model);
  const requestedDuration = Math.max(1, Number(input.durationSec) || 6);
  const durationSec = model.durationSec || Math.max(model.minDurationSec || 1, Math.min(model.maxDurationSec || 15, Math.round(requestedDuration)));
  const common = {
    prompt: String(input.prompt || "").trim(),
    imageUrl: ensureHttps(input.imageUrl, "待转换图片"),
  };
  const requestBody = model.id === "pixverse-v6"
    ? { ...common, resolution: "720 p", duration: durationSec, generateAudioSwitch: false }
    : { ...common, enablePromptExpansion: true, duration: String(durationSec) };
  const payload = await runningHubJson(model.endpoint, apiKey, requestBody, options);
  const taskId = String(payload?.taskId || payload?.data?.taskId || "").trim();
  if (!taskId) throw new Error(providerError(payload, "RunningHub 未返回 taskId"));
  return { taskId, model, durationSec };
}

export async function waitForRunningHubVideo(taskId, apiKey, options = {}) {
  const pollIntervalMs = Math.max(10, Number(options.pollIntervalMs) || 3000);
  const maxPolls = Math.max(1, Number(options.maxPolls) || 240);
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    if (attempt > 0) await sleep(pollIntervalMs, options.signal);
    const payload = await runningHubJson("/openapi/v2/query", apiKey, { taskId }, options);
    const status = String(payload?.status || "").toUpperCase();
    if (["FAILED", "ERROR", "CANCELLED", "CANCELED"].includes(status)) {
      throw new Error(providerError(payload, `RunningHub 任务 ${taskId} 失败`));
    }
    if (status === "SUCCESS") {
      const result = (Array.isArray(payload?.results) ? payload.results : []).find((item) => {
        const type = String(item?.outputType || "").toLowerCase();
        return type === "mp4" || type === "mov" || type === "webm" || /\.(mp4|mov|webm)(?:\?|$)/i.test(String(item?.url || ""));
      });
      if (!result?.url) throw new Error("RunningHub 任务成功，但没有返回视频文件");
      return { url: ensureHttps(result.url, "RunningHub 视频结果"), outputType: String(result.outputType || "mp4") };
    }
  }
  throw new Error(`RunningHub 任务 ${taskId} 等待超时`);
}

function dynamicPrompt(task, shot) {
  const base = String(shot?.visual || shot?.text || "").trim();
  return [
    base,
    "以原图为唯一主体和构图依据，保持人物身份、五官、服装、时代、场景和光影一致。",
    "只添加自然的小幅动作、环境微动和缓慢稳定的推近或横移镜头；禁止换脸、变形、突然切镜、凭空增加人物、字幕、文字和水印。",
    `成片比例保持 ${task.aspectRatio || "9:16"}，画面连贯，适合人物故事旁白短视频。`,
  ].filter(Boolean).join(" ");
}

async function mapLimit(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length || 1) }, run));
  return results;
}

export async function generateRunningHubVideos(input) {
  const {
    taskStore,
    task,
    apiKey,
    probeMediaDuration,
    signal,
    fetchImpl,
  } = input;
  const shotIds = new Set((input.shotIds || []).map(Number).filter((value) => Number.isInteger(value) && value > 0));
  const shots = (task.artifacts?.storyboard?.shots || []).filter((shot) => shotIds.has(shot.id));
  const imageByShot = new Map((task.media?.images || []).filter((image) => image.path && image.status !== "failed").map((image) => [image.shotId, image]));
  const results = await mapLimit(shots, Math.max(1, Math.min(3, Number(input.concurrency) || 1)), async (shot) => {
    const image = imageByShot.get(shot.id);
    if (!image?.path) {
      return { id: `runninghub-${shot.id}-${Date.now()}`, shotId: shot.id, fileName: "", path: "", url: "", bytes: 0, durationSec: 0, status: "failed", error: "该分镜没有可上传的静态图片" };
    }
    try {
      await taskStore.appendEvent(task.id, { type: "runninghub_start", step: 5, detail: `第 ${shot.id} 镜开始生成动态视频` });
      const imageUrl = await uploadRunningHubImage(image.path, apiKey, { fetchImpl, signal });
      const timelineEntry = (task.media?.timeline || []).find((item) => item.shotId === shot.id);
      const desiredDurationSec = task.options?.videoIntroDurationMode === "fixed"
        ? Number(task.options?.videoIntroDuration || 6)
        : Number(timelineEntry?.durationSec || shot.durationSec || 6);
      const submitted = await submitRunningHubVideo({ model: input.model, imageUrl, prompt: dynamicPrompt(task, shot), durationSec: desiredDurationSec }, apiKey, { fetchImpl, signal });
      const output = await waitForRunningHubVideo(submitted.taskId, apiKey, {
        fetchImpl,
        signal,
        pollIntervalMs: input.pollIntervalMs,
        maxPolls: input.maxPolls,
      });
      const extension = output.outputType && /^[a-z0-9]+$/i.test(output.outputType) ? `.${output.outputType.toLowerCase()}` : ".mp4";
      const asset = await taskStore.saveRemoteAsset(task.id, "videos", `runninghub-${shot.id}${extension}`, output.url, signal);
      const durationSec = Math.max(0.1, Number(await probeMediaDuration(asset.path)) || submitted.durationSec);
      await taskStore.appendEvent(task.id, { type: "runninghub_complete", step: 5, detail: `第 ${shot.id} 镜动态视频完成`, data: { providerTaskId: submitted.taskId, model: submitted.model.id, durationSec } });
      return {
        id: `runninghub-${submitted.taskId}`,
        shotId: shot.id,
        ...asset,
        durationSec,
        status: "ready",
        provider: "runninghub",
        providerTaskId: submitted.taskId,
        model: submitted.model.id,
        targetDurationSec: desiredDurationSec,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "RunningHub 动态视频生成失败";
      await taskStore.appendEvent(task.id, { type: "runninghub_failed", step: 5, detail: `第 ${shot.id} 镜失败：${message}` });
      return { id: `runninghub-${shot.id}-${Date.now()}`, shotId: shot.id, fileName: "", path: "", url: "", bytes: 0, durationSec: 0, status: "failed", error: message, provider: "runninghub", model: modelConfig(input.model).id };
    }
  });
  return results;
}

export const runningHubInternals = {
  dynamicPrompt,
  ensureHttps,
  modelConfig,
};
