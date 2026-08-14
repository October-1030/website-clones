import type { ImagePrompt, VisualStyleOverride } from "./llm";

export type ImageProviderId = "jimeng" | "all-purpose" | "minimax" | "openai-compatible";

export interface GeneratedImage {
  id: string;
  shotId: number;
  prompt: string;
  url: string;
  path?: string;
  bytes?: number;
  retryLevel?: number;
  useReference?: boolean;
  status?: "pending" | "ready" | "failed" | "borrowed";
  error?: string;
  source?: "wikimedia-commons" | string;
  sourceTitle?: string;
  sourceUrl?: string;
  creator?: string;
  license?: string;
  licenseUrl?: string;
  attribution?: string;
  matchReason?: string;
  matchConfidence?: number;
  provider?: ImageProviderId | string;
  sourceBackupPath?: string;
  textComposited?: boolean;
  textRenderer?: string;
}

export interface ImageGenerationRequest {
  taskId?: string;
  prompts: ImagePrompt[];
  apiKey: string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  maxImages: number;
  track: string;
  visualStyle: string;
  visualStyleOverride?: VisualStyleOverride | null;
  provider?: ImageProviderId;
  force?: boolean;
  coverBackgroundOnly?: boolean;
  coverTemplateId?: string;
}

export interface ImageGenerationResponse {
  images: GeneratedImage[];
}
