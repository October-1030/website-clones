import type { StoryboundTask } from "../types/task";

export interface RunningHubStatus {
  available: boolean;
  source: string | null;
  models: Array<{ id: string; name: string; durationSec: number }>;
}

async function responseError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error || `RunningHub 请求失败（HTTP ${response.status}）`;
  } catch {
    return `RunningHub 请求失败（HTTP ${response.status}）`;
  }
}

export async function fetchRunningHubStatus(): Promise<RunningHubStatus> {
  const response = await fetch("/api/runninghub/status", { cache: "no-store" });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<RunningHubStatus>;
}

export async function testRunningHub(apiKey: string): Promise<{
  available: boolean;
  remainCoins: string;
  currentTaskCounts: string;
  currency: string;
  apiType: string;
}> {
  const response = await fetch("/api/runninghub/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json();
}

export async function generateRunningHubStoryboards(options: {
  taskId: string;
  shotIds?: number[];
  apiKey: string;
  model: string;
  concurrency: number;
  signal?: AbortSignal;
}): Promise<{ task: StoryboundTask; generatedCount: number; failedCount: number }> {
  const response = await fetch("/api/runninghub/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskId: options.taskId,
      shotIds: options.shotIds || [],
      apiKey: options.apiKey,
      model: options.model,
      concurrency: options.concurrency,
    }),
    signal: options.signal,
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json();
}
