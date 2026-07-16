import type { ImagePrompt } from "./llm";

export interface GeneratedImage {
  id: string;
  shotId: number;
  prompt: string;
  url: string;
  path?: string;
  bytes?: number;
  retryLevel?: number;
  status?: "pending" | "ready" | "failed" | "borrowed";
  error?: string;
}

export interface ImageGenerationRequest {
  taskId?: string;
  prompts: ImagePrompt[];
  apiKey: string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  maxImages: number;
  track: string;
  visualStyle: string;
}

export interface ImageGenerationResponse {
  images: GeneratedImage[];
}
