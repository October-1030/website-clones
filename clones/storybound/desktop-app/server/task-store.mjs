import { randomUUID } from "node:crypto";
import {
  appendFile,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";

const artifactFileNames = {
  precheck: "00-reviewed.json",
  rewrite: "01-rewritten.json",
  storyboard: "02-sentences.json",
  prompts: "03-prompts.json",
  imageMeta: "04-image-meta.json",
  audioMeta: "05-audio-meta.json",
  timeline: "05-timeline.json",
};

function nowIso() {
  return new Date().toISOString();
}

function assertTaskId(taskId) {
  const value = String(taskId || "");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{5,80}$/.test(value)) {
    throw new Error("无效任务 ID");
  }
  return value;
}

function safeFileName(value, fallback = "asset.bin") {
  const cleaned = basename(String(value || fallback))
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\p{Cc}/gu, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return cleaned || fallback;
}

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

function taskSummary(task) {
  return {
    id: task.id,
    title: task.title,
    inputText: task.inputText,
    mode: task.mode,
    videoForm: task.videoForm,
    track: task.track,
    status: task.status,
    runState: task.runState,
    currentStep: task.currentStep,
    stepStatuses: task.stepStatuses,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt ?? null,
    imageCount: task.media?.images?.filter((item) => item.status === "ready").length ?? 0,
    audioCount: task.media?.continuousAudio?.status === "ready"
      ? 1
      : task.media?.audioSegments?.filter((item) => item.status === "ready").length ?? 0,
    draftReady: Boolean(task.draft?.ready),
  };
}

export function createTaskStore(root) {
  const dataRoot = resolve(process.env.STORYBOUND_DATA_DIR || join(root, ".storybound-data"));
  const tasksRoot = join(dataRoot, "tasks");

  async function ensureRoot() {
    await mkdir(tasksRoot, { recursive: true });
  }

  function taskDir(taskId) {
    return join(tasksRoot, assertTaskId(taskId));
  }

  function taskFile(taskId) {
    return join(taskDir(taskId), "task.json");
  }

  async function ensureTaskFolders(taskId) {
    const base = taskDir(taskId);
    await Promise.all([
      mkdir(base, { recursive: true }),
      mkdir(join(base, "images"), { recursive: true }),
      mkdir(join(base, "videos"), { recursive: true }),
      mkdir(join(base, "audio"), { recursive: true }),
      mkdir(join(base, "uploads"), { recursive: true }),
      mkdir(join(base, "draft"), { recursive: true }),
    ]);
    return base;
  }

  async function writeJsonAtomic(file, value) {
    await mkdir(dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temp, file);
  }

  async function readTask(taskId) {
    const file = taskFile(taskId);
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async function listTasks() {
    await ensureRoot();
    const entries = await readdir(tasksRoot, { withFileTypes: true });
    const tasks = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const task = await readTask(entry.name);
        if (task) tasks.push(taskSummary(task));
      } catch {
        // A partially written or manually damaged task must not hide healthy tasks.
      }
    }
    return tasks.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async function createTask(input = {}) {
    await ensureRoot();
    const id = assertTaskId(input.id || randomUUID());
    const existing = await readTask(id);
    if (existing) return existing;
    const createdAt = input.createdAt || nowIso();
    const task = {
      schemaVersion: 2,
      id,
      title: String(input.title || "未命名视频"),
      inputText: String(input.inputText || ""),
      sourceMode: input.sourceMode === "ai" ? "ai" : "paste",
      aiBrief: String(input.aiBrief || ""),
      mode: ["auto", "semi_auto", "direct"].includes(input.mode) ? input.mode : "auto",
      pausePreset: ["none", "key", "every", "custom"].includes(input.pausePreset) ? input.pausePreset : "key",
      customPauseSteps: Array.isArray(input.customPauseSteps) ? input.customPauseSteps : [2, 3],
      videoForm: input.videoForm === "podcast" ? "podcast" : "narration",
      track: String(input.track || "通用故事"),
      visualStyle: String(input.visualStyle || "黑白摄影"),
      aspectRatio: String(input.aspectRatio || "9:16"),
      status: input.status || "draft",
      runState: input.runState || "idle",
      currentStep: Number.isInteger(input.currentStep) ? input.currentStep : -1,
      stepStatuses: Array.isArray(input.stepStatuses) ? input.stepStatuses : Array(7).fill("pending"),
      options: input.options && typeof input.options === "object" ? input.options : {},
      artifacts: input.artifacts && typeof input.artifacts === "object" ? input.artifacts : {},
      media: deepMerge({
        images: [],
        videos: [],
        coverImages: [],
        audioSegments: [],
        continuousAudio: null,
        podcast: null,
        externalAudio: null,
        bgm: null,
      }, input.media || {}),
      draft: input.draft || null,
      error: input.error || null,
      createdAt,
      updatedAt: input.updatedAt || createdAt,
      completedAt: input.completedAt || null,
    };
    await ensureTaskFolders(id);
    await writeJsonAtomic(taskFile(id), task);
    await appendEvent(id, { type: "task_created", detail: "任务已创建" });
    return task;
  }

  async function updateTask(taskId, patch = {}) {
    const current = await readTask(taskId);
    if (!current) throw new Error("任务不存在");
    const next = deepMerge(current, patch);
    next.id = current.id;
    next.createdAt = current.createdAt;
    next.updatedAt = nowIso();
    if (next.status === "completed" && !next.completedAt) next.completedAt = next.updatedAt;
    await writeJsonAtomic(taskFile(taskId), next);
    await mirrorArtifacts(taskId, next);
    return next;
  }

  async function mirrorArtifacts(taskId, task) {
    const base = await ensureTaskFolders(taskId);
    for (const [key, fileName] of Object.entries(artifactFileNames)) {
      const value = key === "imageMeta"
        ? task.media?.images
        : key === "audioMeta"
          ? { segments: task.media?.audioSegments, continuousAudio: task.media?.continuousAudio, podcast: task.media?.podcast, externalAudio: task.media?.externalAudio }
          : key === "timeline"
            ? task.media?.timeline
            : task.artifacts?.[key];
      if (value !== undefined && value !== null) {
        await writeJsonAtomic(join(base, fileName), value);
      }
    }
  }

  async function appendEvent(taskId, event) {
    const base = await ensureTaskFolders(taskId);
    const payload = {
      taskId,
      timestamp: nowIso(),
      ...event,
    };
    await appendFile(join(base, "events.ndjson"), `${JSON.stringify(payload)}\n`, "utf8");
    return payload;
  }

  async function readEvents(taskId) {
    try {
      const contents = await readFile(join(taskDir(taskId), "events.ndjson"), "utf8");
      return contents.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async function saveBuffer(taskId, kind, fileName, buffer) {
    const allowedKinds = new Set(["images", "videos", "audio", "uploads", "draft"]);
    if (!allowedKinds.has(kind)) throw new Error("无效资源类型");
    const base = await ensureTaskFolders(taskId);
    const name = safeFileName(fileName);
    const file = join(base, kind, name);
    await writeFile(file, buffer);
    return {
      fileName: name,
      path: file,
      url: `/api/tasks/${encodeURIComponent(taskId)}/files/${kind}/${encodeURIComponent(name)}`,
      bytes: buffer.byteLength,
    };
  }

  async function saveRemoteAsset(taskId, kind, fileName, url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`下载生成资源失败（HTTP ${response.status}）`);
    return saveBuffer(taskId, kind, fileName, Buffer.from(await response.arrayBuffer()));
  }

  function resolveTaskFile(taskId, kind, fileName) {
    const allowedKinds = new Set(["images", "videos", "audio", "uploads", "draft"]);
    if (!allowedKinds.has(kind)) return null;
    const base = resolve(taskDir(taskId), kind);
    const target = resolve(base, safeFileName(fileName));
    if (target !== base && !target.startsWith(`${base}${sep}`)) return null;
    return target;
  }

  async function copyIntoTask(taskId, kind, sourcePath, fileName) {
    const base = await ensureTaskFolders(taskId);
    const name = safeFileName(fileName || basename(sourcePath));
    const target = join(base, kind, name);
    await copyFile(sourcePath, target);
    return {
      fileName: name,
      path: target,
      url: `/api/tasks/${encodeURIComponent(taskId)}/files/${kind}/${encodeURIComponent(name)}`,
      bytes: (await stat(target)).size,
    };
  }

  async function clearFromStep(taskId, fromStep) {
    const task = await readTask(taskId);
    if (!task) throw new Error("任务不存在");
    const step = Math.max(0, Math.min(6, Number(fromStep) || 0));
    const artifacts = { ...task.artifacts };
    if (step <= 0) delete artifacts.precheck;
    if (step <= 1) delete artifacts.rewrite;
    if (step <= 2) delete artifacts.storyboard;
    if (step <= 3) delete artifacts.prompts;
    const media = deepMerge({}, task.media || {});
    if (step <= 4) {
      media.images = [];
      media.videos = [];
      media.coverImages = [];
      await rm(join(taskDir(taskId), "images"), { recursive: true, force: true });
      await rm(join(taskDir(taskId), "videos"), { recursive: true, force: true });
      await Promise.all([
        mkdir(join(taskDir(taskId), "images"), { recursive: true }),
        mkdir(join(taskDir(taskId), "videos"), { recursive: true }),
      ]);
    }
    if (step <= 5) {
      media.audioSegments = [];
      media.continuousAudio = null;
      media.podcast = null;
      media.timeline = null;
      await rm(join(taskDir(taskId), "audio"), { recursive: true, force: true });
      await mkdir(join(taskDir(taskId), "audio"), { recursive: true });
    }
    if (step <= 6) {
      task.draft = null;
      await rm(join(taskDir(taskId), "draft"), { recursive: true, force: true });
      await mkdir(join(taskDir(taskId), "draft"), { recursive: true });
    }
    task.artifacts = artifacts;
    task.media = media;
    task.stepStatuses = task.stepStatuses.map((status, index) => index < step ? status : "pending");
    task.currentStep = step;
    task.status = "paused";
    task.runState = "paused";
    task.error = null;
    await appendEvent(taskId, { type: "artifacts_cleared", step, detail: `从 Step ${step} 清理下游产物` });
    return updateTask(taskId, task);
  }

  async function deleteTask(taskId) {
    await rm(taskDir(taskId), { recursive: true, force: true });
  }

  return {
    artifactFileNames,
    dataRoot,
    tasksRoot,
    ensureRoot,
    taskDir,
    ensureTaskFolders,
    listTasks,
    createTask,
    readTask,
    updateTask,
    deleteTask,
    appendEvent,
    readEvents,
    saveBuffer,
    saveRemoteAsset,
    resolveTaskFile,
    copyIntoTask,
    clearFromStep,
  };
}
