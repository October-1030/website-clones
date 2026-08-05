import { defaultTtsConfig } from "../data/tts-data";
import type { MinimaxModel, TtsConfig, TtsProvider, TtsVoice, VolcengineVersion } from "../types/tts";

const storageKey = "storybound-tts-preferences-v1";

interface StoredTtsPreferences {
  provider?: TtsProvider;
  volcengine?: {
    version?: VolcengineVersion;
    voiceId?: string;
  };
  minimax?: {
    model?: MinimaxModel;
    voiceId?: string;
    systemVoices?: TtsVoice[];
    clonedVoices?: TtsVoice[];
  };
}

function validVoice(value: unknown): value is TtsVoice {
  if (!value || typeof value !== "object") return false;
  const voice = value as Partial<TtsVoice>;
  return typeof voice.id === "string"
    && Boolean(voice.id.trim())
    && typeof voice.name === "string"
    && typeof voice.tag === "string"
    && (voice.provider === "minimax" || voice.provider === "volcengine");
}

function voices(value: unknown): TtsVoice[] {
  return Array.isArray(value) ? value.filter(validVoice) : [];
}

export function readTtsPreferences(): TtsConfig {
  const fallback = structuredClone(defaultTtsConfig);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "null") as StoredTtsPreferences | null;
    if (!parsed) return fallback;
    const provider = parsed.provider === "minimax" || parsed.provider === "volcengine" ? parsed.provider : fallback.provider;
    const version = parsed.volcengine?.version === "1.0" || parsed.volcengine?.version === "2.0"
      ? parsed.volcengine.version
      : fallback.volcengine.version;
    const model = parsed.minimax?.model === "speech-2.8-hd" || parsed.minimax?.model === "speech-2.8-turbo"
      ? parsed.minimax.model
      : fallback.minimax.model;
    return {
      ...fallback,
      provider,
      volcengine: {
        ...fallback.volcengine,
        version,
        voiceId: parsed.volcengine?.voiceId?.trim() || fallback.volcengine.voiceId,
      },
      minimax: {
        ...fallback.minimax,
        model,
        voiceId: parsed.minimax?.voiceId?.trim() || fallback.minimax.voiceId,
        systemVoices: voices(parsed.minimax?.systemVoices),
        clonedVoices: voices(parsed.minimax?.clonedVoices),
      },
    };
  } catch {
    return fallback;
  }
}

export function writeTtsPreferences(config: TtsConfig): void {
  const preferences: StoredTtsPreferences = {
    provider: config.provider,
    volcengine: {
      version: config.volcengine.version,
      voiceId: config.volcengine.voiceId,
    },
    minimax: {
      model: config.minimax.model,
      voiceId: config.minimax.voiceId,
      systemVoices: voices(config.minimax.systemVoices),
      clonedVoices: voices(config.minimax.clonedVoices),
    },
  };
  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
}
