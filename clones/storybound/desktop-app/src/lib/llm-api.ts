import type {
  LlmConfig,
  LlmCredentialStatus,
  LlmPipelineResult,
  LlmPipelineStep,
  PipelineContext,
  PipelineLlmArtifacts,
} from "../types/llm";

interface LlmPipelineRequest {
  step: LlmPipelineStep;
  config: LlmConfig;
  context: PipelineContext;
  artifacts: PipelineLlmArtifacts;
  signal?: AbortSignal;
}

async function responseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || `请求失败（HTTP ${response.status}）`;
  } catch {
    return `请求失败（HTTP ${response.status}）`;
  }
}

export async function fetchLlmStatus(): Promise<LlmCredentialStatus> {
  const response = await fetch("/api/llm/status", { cache: "no-store" });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<LlmCredentialStatus>;
}

export async function runLlmPipelineStep(options: LlmPipelineRequest): Promise<LlmPipelineResult> {
  const response = await fetch("/api/llm/pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      step: options.step,
      config: {
        provider: options.config.provider,
        apiKey: options.config.apiKey,
        baseUrl: options.config.baseUrl,
        model: options.config.model,
      },
      context: options.context,
      artifacts: options.artifacts,
    }),
    signal: options.signal,
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<LlmPipelineResult>;
}

export async function createAiCopy(options: Omit<LlmPipelineRequest, "step" | "artifacts">): Promise<LlmPipelineResult & { step: "rewrite" }> {
  const response = await fetch("/api/llm/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: {
        provider: options.config.provider,
        apiKey: options.config.apiKey,
        baseUrl: options.config.baseUrl,
        model: options.config.model,
      },
      context: options.context,
    }),
    signal: options.signal,
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<LlmPipelineResult & { step: "rewrite" }>;
}
