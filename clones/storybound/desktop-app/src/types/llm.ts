export type LlmProvider = "openai" | "deepseek" | "siliconflow" | "custom";

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
}

export interface PipelineContext {
  title: string;
  inputText: string;
  track: string;
  videoForm: string;
  visualStyle: string;
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
  narration: string;
  publishCopy: string;
  tags: string[];
  pinnedComment: string;
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
}

export interface ImagePrompt {
  shotId: number;
  prompt: string;
  negativePrompt: string;
}

export interface PromptResult {
  prompts: ImagePrompt[];
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
