import type { ImagePrompt } from "./llm";

export interface GeneratedImage {
  id: string;
  shotId: number;
  prompt: string;
  url: string;
  bytes?: number;
}

export interface ImageGenerationRequest {
  prompts: ImagePrompt[];
  apiKey: string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  maxImages: number;
}

export interface ImageGenerationResponse {
  images: GeneratedImage[];
}
