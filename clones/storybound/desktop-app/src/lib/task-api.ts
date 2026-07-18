import type { StoryboundTask, StoredAsset, TaskSummary } from "../types/task";

async function responseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || `请求失败（HTTP ${response.status}）`;
  } catch {
    return `请求失败（HTTP ${response.status}）`;
  }
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<T>;
}

export async function listTasks(): Promise<{ tasks: TaskSummary[]; dataRoot: string }> {
  return jsonRequest("/api/tasks", { cache: "no-store" });
}

export async function getTask(taskId: string): Promise<StoryboundTask> {
  const payload = await jsonRequest<{ task: StoryboundTask }>(`/api/tasks/${encodeURIComponent(taskId)}`, { cache: "no-store" });
  return payload.task;
}

export async function createTask(input: Partial<StoryboundTask>): Promise<StoryboundTask> {
  const payload = await jsonRequest<{ task: StoryboundTask }>("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.task;
}

export async function updateTask(taskId: string, patch: Partial<StoryboundTask>): Promise<StoryboundTask> {
  const payload = await jsonRequest<{ task: StoryboundTask }>(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return payload.task;
}

export async function deleteTask(taskId: string): Promise<void> {
  await jsonRequest(`/api/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
}

export async function clearTaskFromStep(taskId: string, step: number): Promise<StoryboundTask> {
  const payload = await jsonRequest<{ task: StoryboundTask }>(`/api/tasks/${encodeURIComponent(taskId)}/clear-from-step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step }),
  });
  return payload.task;
}

export async function appendTaskEvent(taskId: string, event: Record<string, unknown>): Promise<void> {
  await jsonRequest(`/api/tasks/${encodeURIComponent(taskId)}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

export async function uploadTaskAsset(taskId: string, file: File, kind: "images" | "videos" | "audio" | "uploads"): Promise<StoredAsset> {
  const payload = await jsonRequest<{ asset: StoredAsset }>(`/api/tasks/${encodeURIComponent(taskId)}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, fileName: file.name, base64: await fileToBase64(file) }),
  });
  return payload.asset;
}

export async function buildTaskDraft(taskId: string): Promise<StoryboundTask> {
  const payload = await jsonRequest<{ task: StoryboundTask }>(`/api/tasks/${encodeURIComponent(taskId)}/draft`, { method: "POST" });
  return payload.task;
}
