import type { LlmConfig } from "../types/llm";
import type { StoryboundTask } from "../types/task";

async function responseError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error || `网络素材请求失败（HTTP ${response.status}）`;
  } catch {
    return `网络素材请求失败（HTTP ${response.status}）`;
  }
}

export async function generateStockMaterials(
  taskId: string,
  shotIds: number[],
  llmConfig: LlmConfig,
  signal?: AbortSignal,
): Promise<StoryboundTask> {
  const response = await fetch("/api/materials/stock/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, shotIds, llmConfig }),
    signal,
  });
  if (!response.ok) throw new Error(await responseError(response));
  const payload = await response.json() as { task: StoryboundTask };
  return payload.task;
}
