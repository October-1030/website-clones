export type ImageProviderId = "minimax" | "openai-compatible";

export interface ImageProviderConfig {
  provider: ImageProviderId;
  custom: {
    baseUrl: string;
    model: string;
    apiKey: string;
  };
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
  custom: {
    baseUrl: "",
    model: "gpt-image-1",
    apiKey: "",
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
    return {
      provider: value.provider === "openai-compatible" ? "openai-compatible" : "minimax",
      custom: {
        baseUrl: String(value.custom?.baseUrl || ""),
        model: String(value.custom?.model || defaults.custom.model),
        apiKey: String(value.custom?.apiKey || ""),
      },
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
