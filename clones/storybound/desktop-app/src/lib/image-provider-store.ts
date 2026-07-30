export type ImageProviderId = "minimax" | "openai-compatible";

export interface ImageProviderConfig {
  provider: ImageProviderId;
  custom: {
    baseUrl: string;
    model: string;
    apiKey: string;
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
    };
  } catch {
    return structuredClone(defaults);
  }
}

export function writeImageProviderConfig(config: ImageProviderConfig): void {
  window.sessionStorage.setItem(storageKey, JSON.stringify(config));
  window.dispatchEvent(new Event(imageProviderStoreEvent));
}
