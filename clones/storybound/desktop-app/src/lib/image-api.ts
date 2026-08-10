import type { GeneratedImage, ImageGenerationRequest, ImageGenerationResponse, ImageProviderId } from "../types/image";
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

const providerNames: Record<ImageProviderId, string> = {
  jimeng: "即梦 Seedream",
  "all-purpose": "全能绘图",
  minimax: "MiniMax image-01",
  "openai-compatible": "自定义图片引擎",
};

async function generateCompatibleImages(
  options: ImageGenerationRequest,
  provider: Exclude<ImageProviderId, "minimax">,
  signal?: AbortSignal,
): Promise<ImageGenerationResponse> {
  const config = readImageProviderConfig();
  const endpointConfig = provider === "jimeng"
    ? config.jimeng
    : provider === "all-purpose"
      ? config.allPurpose
      : config.custom;
  if (!endpointConfig.baseUrl.trim() || !endpointConfig.model.trim() || !endpointConfig.apiKey.trim()) {
    throw new Error(`${providerNames[provider]}尚未完整配置，请先到系统设置填写 API Key、Base URL 和模型`);
  }
  const response = await fetch("/api/images/openai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...options,
      provider,
      config: {
        ...endpointConfig,
        providerName: providerNames[provider],
        supportsReference: provider === "jimeng",
      },
    }),
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
  const defaultProvider = request.provider ?? readImageProviderConfig().provider;
  const groups = new Map<ImageProviderId, typeof request.prompts>();
  for (const prompt of request.prompts) {
    const promptProvider = prompt.provider ?? defaultProvider;
    groups.set(promptProvider, [...(groups.get(promptProvider) || []), prompt]);
  }
  const generated = new Map<number, GeneratedImage>();
  for (const [provider, prompts] of groups) {
    const groupedRequest = { ...request, provider, prompts, maxImages: prompts.length };
    try {
      const response = provider === "minimax"
        ? await generateMinimaxImages(groupedRequest, signal)
        : await generateCompatibleImages(groupedRequest, provider, signal);
      for (const image of response.images) generated.set(image.shotId, { ...image, provider: image.provider || provider });
    } catch (error) {
      if (signal?.aborted) throw error;
      const message = error instanceof Error ? error.message : `${providerNames[provider]}生图失败`;
      for (const prompt of prompts) {
        generated.set(prompt.shotId, {
          id: `failed-${provider}-${prompt.shotId}-${Date.now()}`,
          shotId: prompt.shotId,
          prompt: prompt.prompt,
          url: "",
          provider,
          status: "failed",
          error: message,
        });
      }
    }
  }
  return {
    images: request.prompts
      .map((prompt) => generated.get(prompt.shotId))
      .filter((image): image is GeneratedImage => Boolean(image)),
  };
}
