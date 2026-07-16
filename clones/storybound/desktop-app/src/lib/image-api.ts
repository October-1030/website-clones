import type { ImageGenerationRequest, ImageGenerationResponse } from "../types/image";

async function responseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || `请求失败（HTTP ${response.status}）`;
  } catch {
    return `请求失败（HTTP ${response.status}）`;
  }
}

export async function generateMinimaxImages(
  options: ImageGenerationRequest,
  signal?: AbortSignal,
): Promise<ImageGenerationResponse> {
  const response = await fetch("/api/images/minimax/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
    signal,
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<ImageGenerationResponse>;
}
