import type { ImagePrompt } from "./llm";

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
}

export interface ImageGenerationRequest {
  taskId?: string;
  prompts: ImagePrompt[];
  apiKey: string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  maxImages: number;
  track: string;
  visualStyle: string;
  coverBackgroundOnly?: boolean;
}

export interface ImageGenerationResponse {
  images: GeneratedImage[];
}
