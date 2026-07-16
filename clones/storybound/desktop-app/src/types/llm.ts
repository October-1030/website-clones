export type LlmProvider = "minimax" | "openai" | "deepseek" | "siliconflow" | "custom";

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface LlmCredentialStatus {
  available: boolean;
  source: string | null;
  provider: LlmProvider | null;
  baseUrl: string | null;
  model: string | null;
  promptLibrary?: {
    sourceVersion: string;
    trackCount: number;
    styleCount: number;
  };
}

export interface PipelineContext {
  title: string;
  inputText: string;
  track: string;
  videoForm: string;
  visualStyle: string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  sourceMode?: "paste" | "ai";
  rewriteIntensity?: string;
  narrativePov?: string;
  targetLength?: number | null;
  targetScenes?: number | null;
  fixedIntro?: string;
  outroCta?: string;
}

export type LlmPipelineStep = "precheck" | "rewrite" | "storyboard" | "prompts";

export interface PrecheckResult {
  title: string;
  cleanText: string;
  warnings: string[];
  sensitiveTerms: string[];
}

export interface RewriteResult {
  title: string;
  subtitle?: string[];
  narration: string;
  publishCopy: string;
  summary?: string;
  tags: string[];
  pinnedComment: string;
  comments?: string[];
  scores?: Record<string, number>;
  totalScore?: number;
}

export interface StoryboardShot {
  id: number;
  text: string;
  visual: string;
  emotion: string;
  durationSec: number;
}

export interface StoryboardResult {
  shots: StoryboardShot[];
  characterCard?: {
    name: string;
    identity: string;
    age: string;
    gender: string;
    appearance: string;
    clothing: string;
  };
}

export interface ImagePrompt {
  shotId: number;
  prompt: string;
  negativePrompt: string;
}

export interface PromptResult {
  prompts: ImagePrompt[];
  templateVersion?: string;
  trackId?: string;
  styleId?: string;
}

export interface PipelineLlmArtifacts {
  precheck?: PrecheckResult;
  rewrite?: RewriteResult;
  storyboard?: StoryboardResult;
  prompts?: PromptResult;
}

export type LlmPipelineResult =
  | { step: "precheck"; data: PrecheckResult }
  | { step: "rewrite"; data: RewriteResult }
  | { step: "storyboard"; data: StoryboardResult }
  | { step: "prompts"; data: PromptResult };
