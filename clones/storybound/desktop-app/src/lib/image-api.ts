import type { ImageGenerationRequest, ImageGenerationResponse } from "../types/image";
import { findCustomVisualStyle } from "./custom-style-store";
import { readImageProviderConfig } from "./image-provider-store";

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

export async function generateImages(
  options: ImageGenerationRequest,
  signal?: AbortSignal,
): Promise<ImageGenerationResponse> {
  const customStyle = findCustomVisualStyle(options.visualStyle);
  const request = customStyle
    ? {
        ...options,
        prompts: options.prompts.map((prompt) => ({
          ...prompt,
          prompt: `${customStyle.prompt}，${prompt.prompt}${customStyle.negativePrompt ? `。画面中避免出现：${customStyle.negativePrompt}` : ""}`,
        })),
      }
    : options;
  const provider = readImageProviderConfig();
  if (provider.provider === "minimax") return generateMinimaxImages(request, signal);
  if (!provider.custom.baseUrl.trim() || !provider.custom.model.trim() || !provider.custom.apiKey.trim()) {
    throw new Error("OpenAI-compatible 图片引擎未完整配置");
  }
  const response = await fetch("/api/images/openai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      config: provider.custom,
    }),
    signal,
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<ImageGenerationResponse>;
}
