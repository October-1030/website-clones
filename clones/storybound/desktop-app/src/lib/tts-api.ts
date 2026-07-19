import type { TtsConfig, TtsCredentialStatus, TtsProvider, TtsVoice } from "../types/tts";
import type { TtsAlignment } from "../types/task";

interface TtsRequestOptions {
  provider: TtsProvider;
  text: string;
  voiceId: string;
  speed: number;
  config: TtsConfig;
  taskId?: string;
  shotId?: number;
  fileName?: string;
  signal?: AbortSignal;
}

interface TtsAudioResponse {
  blob: Blob;
  segments: number;
  durationSec: number;
  assetUrl?: string;
  assetPath?: string;
  fileName?: string;
  alignment?: TtsAlignment;
}

async function responseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || `请求失败（HTTP ${response.status}）`;
  } catch {
    return `请求失败（HTTP ${response.status}）`;
  }
}

function providerConfig(config: TtsConfig, provider: TtsProvider) {
  if (provider === "minimax") {
    return { apiKey: config.minimax.apiKey, model: config.minimax.model };
  }
  return { appId: config.volcengine.appId, accessToken: config.volcengine.accessToken };
}

async function requestAudio(path: string, options: TtsRequestOptions): Promise<TtsAudioResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: options.provider,
      text: options.text,
      voiceId: options.voiceId,
      speed: options.speed,
      config: providerConfig(options.config, options.provider),
      taskId: options.taskId,
      shotId: options.shotId,
      fileName: options.fileName,
      alignment: options.taskId && options.shotId === 0 && options.provider === "minimax",
    }),
    signal: options.signal,
  });
  if (!response.ok) throw new Error(await responseError(response));
  const alignmentUrl = decodeURIComponent(response.headers.get("X-TTS-Alignment-Url") || "");
  const blob = await response.blob();
  let alignment: TtsAlignment | undefined;
  if (alignmentUrl) {
    const alignmentResponse = await fetch(alignmentUrl, { cache: "no-store", signal: options.signal });
    if (alignmentResponse.ok) alignment = await alignmentResponse.json() as TtsAlignment;
  }
  return {
    blob,
    segments: Number(response.headers.get("X-TTS-Segments") || 1),
    durationSec: Number(response.headers.get("X-TTS-Duration") || 0),
    assetUrl: decodeURIComponent(response.headers.get("X-Asset-Url") || "") || undefined,
    assetPath: decodeURIComponent(response.headers.get("X-Asset-Path") || "") || undefined,
    fileName: decodeURIComponent(response.headers.get("X-Asset-File") || "") || undefined,
    alignment,
  };
}

export async function fetchTtsStatus(): Promise<TtsCredentialStatus> {
  const response = await fetch("/api/tts/status", { cache: "no-store" });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<TtsCredentialStatus>;
}

export function synthesizeTts(options: TtsRequestOptions): Promise<TtsAudioResponse> {
  return requestAudio("/api/tts/synthesize", options);
}

export function testTts(options: Omit<TtsRequestOptions, "text">): Promise<TtsAudioResponse> {
  return requestAudio("/api/tts/test", { ...options, text: "测" });
}

export async function fetchMinimaxVoices(apiKey: string): Promise<TtsVoice[]> {
  const response = await fetch("/api/tts/minimax/voices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, voiceType: "voice_cloning" }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  const payload = (await response.json()) as { voices?: TtsVoice[] };
  return payload.voices ?? [];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("无法读取音频文件"));
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

export async function cloneMinimaxVoice(
  config: TtsConfig,
  file: File,
  displayName: string,
  testText: string,
): Promise<TtsVoice> {
  const response = await fetch("/api/tts/minimax/clone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: config.minimax.apiKey,
      model: config.minimax.model,
      fileName: file.name,
      mimeType: file.type || "audio/mpeg",
      audioBase64: await fileToBase64(file),
      displayName,
      testText,
    }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  const payload = (await response.json()) as { voice?: TtsVoice };
  if (!payload.voice) throw new Error("MiniMax 未返回克隆音色");
  return payload.voice;
}
