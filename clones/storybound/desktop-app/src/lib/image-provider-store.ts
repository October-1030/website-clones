import type { ImageProviderId } from "../types/image";

export type { ImageProviderId } from "../types/image";

export interface ImageEndpointConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  concurrency: number;
}

export interface ImageProviderConfig {
  provider: ImageProviderId;
  jimeng: ImageEndpointConfig;
  allPurpose: ImageEndpointConfig;
  custom: ImageEndpointConfig;
  runninghub: {
    apiKey: string;
    model: "hailuo-2.3-fast" | "hailuo-2.3-fast-pro" | "pixverse-v6";
    concurrency: number;
  };
}

const storageKey = "storybound-image-provider-session-v1";
export const imageProviderStoreEvent = "storybound-image-provider-changed";

const defaults: ImageProviderConfig = {
  provider: "minimax",
  jimeng: {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seedream-4-0-250828",
    apiKey: "",
    concurrency: 3,
  },
  allPurpose: {
    baseUrl: "",
    model: "gpt-image-1",
    apiKey: "",
    concurrency: 3,
  },
  custom: {
    baseUrl: "",
    model: "gpt-image-1",
    apiKey: "",
    concurrency: 3,
  },
  runninghub: {
    apiKey: "",
    model: "hailuo-2.3-fast",
    concurrency: 1,
  },
};

export function readImageProviderConfig(): ImageProviderConfig {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(storageKey) || "null") as Partial<ImageProviderConfig> | null;
    if (!value) return structuredClone(defaults);
    const provider: ImageProviderId = value.provider === "jimeng"
      || value.provider === "all-purpose"
      || value.provider === "openai-compatible"
      || value.provider === "minimax"
      ? value.provider
      : "minimax";
    const endpoint = (saved: Partial<ImageEndpointConfig> | undefined, fallback: ImageEndpointConfig): ImageEndpointConfig => ({
      baseUrl: String(saved?.baseUrl || fallback.baseUrl),
      model: String(saved?.model || fallback.model),
      apiKey: String(saved?.apiKey || ""),
      concurrency: Math.max(1, Math.min(10, Number(saved?.concurrency) || fallback.concurrency)),
    });
    return {
      provider,
      jimeng: endpoint(value.jimeng, defaults.jimeng),
      allPurpose: endpoint(value.allPurpose, defaults.allPurpose),
      custom: endpoint(value.custom, defaults.custom),
      runninghub: {
        apiKey: String(value.runninghub?.apiKey || ""),
        model: value.runninghub?.model === "hailuo-2.3-fast-pro"
          ? "hailuo-2.3-fast-pro"
          : value.runninghub?.model === "pixverse-v6"
            ? "pixverse-v6"
            : "hailuo-2.3-fast",
        concurrency: Math.max(1, Math.min(3, Number(value.runninghub?.concurrency) || 1)),
      },
    };
  } catch {
    return structuredClone(defaults);
  }
}

export function writeImageProviderConfig(config: ImageProviderConfig): void {
  window.sessionStorage.setItem(storageKey, JSON.stringify(config));
  window.dispatchEvent(new Event(imageProviderStoreEvent));
}
